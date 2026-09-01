"""Traffic analytics: pageview tracking + admin dashboard summaries.

Real first-party analytics (no external trackers):
- POST /api/track/pageview  -> stores visits with source classification + geo country
- GET  /api/admin/analytics/summary -> aggregated KPIs, series, sources, countries
"""
import ipaddress
import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from core.auth import require_admin
from core.config import db

logger = logging.getLogger("ecoandes.analytics")
router = APIRouter(prefix="/api", tags=["analytics"])

# Order matters: AI assistants first (gemini.google would otherwise match google.)
SOURCE_RULES = [
    ("chatgpt", ("chatgpt.com", "chat.openai.com", "openai.com")),
    ("gemini", ("gemini.google",)),
    ("perplexity", ("perplexity.",)),
    ("copilot", ("copilot.microsoft",)),
    ("facebook", ("facebook.", "fb.com", "fb.me", "l.facebook")),
    ("instagram", ("instagram.", "l.instagram")),
    ("tiktok", ("tiktok.",)),
    ("x_twitter", ("twitter.", "t.co", "x.com")),
    ("linkedin", ("linkedin.", "lnkd.in")),
    ("youtube", ("youtube.", "youtu.be")),
    ("pinterest", ("pinterest.",)),
    ("whatsapp", ("whatsapp.", "wa.me")),
    ("telegram", ("telegram.", "t.me")),
    ("google", ("google.",)),
    ("bing", ("bing.",)),
    ("yahoo", ("yahoo.",)),
    ("duckduckgo", ("duckduckgo.",)),
    ("ecosia", ("ecosia.",)),
]

MEDIUM_BY_SOURCE = {
    "google": "organic", "bing": "organic", "yahoo": "organic",
    "duckduckgo": "organic", "ecosia": "organic",
    "facebook": "social", "instagram": "social", "tiktok": "social",
    "x_twitter": "social", "linkedin": "social", "youtube": "social",
    "pinterest": "social", "whatsapp": "social", "telegram": "social",
    "chatgpt": "ai", "gemini": "ai", "perplexity": "ai", "copilot": "ai",
}

_OWN_HOST_HINTS = ("emergentagent.com", "productosecoandes.com", "localhost")


def classify_traffic(
    referrer: str,
    utm_source: Optional[str] = None,
    utm_medium: Optional[str] = None,
) -> tuple:
    """Returns (source_key, medium, referrer_host)."""
    ref_host = ""
    if referrer:
        try:
            ref_host = (urlparse(referrer).netloc or "").lower().replace("www.", "")
        except Exception:  # noqa: BLE001
            ref_host = ""

    if utm_source:
        s = utm_source.strip().lower()
        for key, pats in SOURCE_RULES:
            if any(p.split(".")[0] in s for p in pats) or key == s:
                return key, (utm_medium or MEDIUM_BY_SOURCE.get(key, "campaign")), ref_host
        return s, (utm_medium or "campaign"), ref_host

    if not ref_host:
        return "direct", "none", ""
    if any(h in ref_host for h in _OWN_HOST_HINTS):
        return "direct", "none", ""
    for key, pats in SOURCE_RULES:
        if any(p in ref_host for p in pats):
            return key, MEDIUM_BY_SOURCE.get(key, "referral"), ref_host
    return "referral", "referral", ref_host


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else ""


def _is_public_ip(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
        return not (addr.is_private or addr.is_loopback or addr.is_reserved or addr.is_link_local)
    except ValueError:
        return False


async def resolve_country(request: Request, ip: str) -> tuple:
    """Returns (country_code, country_name) or (None, None)."""
    # 1) Edge/CDN headers (free & instant)
    for h in ("cf-ipcountry", "x-vercel-ip-country", "x-country-code"):
        cc = request.headers.get(h)
        if cc and len(cc) == 2 and cc.upper() not in ("XX", "T1"):
            return cc.upper(), None
    if not ip or not _is_public_ip(ip):
        return None, None
    # 2) Cache
    cached = await db.geoip.find_one({"ip": ip}, {"_id": 0})
    if cached:
        return cached.get("cc"), cached.get("name")
    # 3) ip-api.com free lookup (cached forever afterwards)
    try:
        async with httpx.AsyncClient(timeout=3.0) as cx:
            r = await cx.get(f"http://ip-api.com/json/{ip}?fields=status,countryCode,country")
        data = r.json()
        if data.get("status") == "success" and data.get("countryCode"):
            cc, name = data["countryCode"].upper(), data.get("country")
            await db.geoip.update_one(
                {"ip": ip},
                {"$set": {"ip": ip, "cc": cc, "name": name,
                          "cached_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True,
            )
            return cc, name
    except Exception as e:  # noqa: BLE001
        logger.debug("geoip lookup failed for %s: %s", ip, e)
    return None, None


class PageviewPayload(BaseModel):
    session_id: str
    visitor_id: Optional[str] = None
    path: str = "/"
    referrer: Optional[str] = ""
    utm_source: Optional[str] = ""
    utm_medium: Optional[str] = ""
    utm_campaign: Optional[str] = ""


@router.post("/track/pageview")
async def track_pageview(payload: PageviewPayload, request: Request):
    path = (payload.path or "/")[:300]
    if path.startswith("/admin"):
        return {"ok": True, "skipped": True}

    source, medium, ref_host = classify_traffic(
        payload.referrer or "", payload.utm_source or None, payload.utm_medium or None
    )
    ip = _client_ip(request)
    cc, cname = await resolve_country(request, ip)

    now = datetime.now(timezone.utc)
    import uuid

    await db.visits.insert_one({
        "id": str(uuid.uuid4()),
        "ts": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "session_id": payload.session_id[:80],
        "visitor_id": (payload.visitor_id or "")[:80],
        "path": path,
        "source": source,
        "medium": medium,
        "referrer_host": ref_host[:200],
        "utm_source": (payload.utm_source or "")[:100],
        "utm_medium": (payload.utm_medium or "")[:100],
        "utm_campaign": (payload.utm_campaign or "")[:150],
        "country_code": cc,
        "country_name": cname,
    })
    return {"ok": True}


@router.get("/admin/analytics/summary", dependencies=[Depends(require_admin)])
async def analytics_summary(date_from: str, date_to: str):
    """Aggregated traffic + commerce KPIs for the [date_from, date_to] range (YYYY-MM-DD)."""
    match = {"date": {"$gte": date_from, "$lte": date_to}}

    # ---- Totals ----
    totals_pipe = [
        {"$match": match},
        {"$group": {
            "_id": None,
            "pageviews": {"$sum": 1},
            "sessions": {"$addToSet": "$session_id"},
            "visitors": {"$addToSet": "$visitor_id"},
        }},
    ]
    totals = {"pageviews": 0, "sessions": 0, "visitors": 0}
    async for r in db.visits.aggregate(totals_pipe):
        totals = {
            "pageviews": r["pageviews"],
            "sessions": len(r["sessions"]),
            "visitors": len([v for v in r["visitors"] if v]),
        }

    # ---- Daily series ----
    series = []
    async for r in db.visits.aggregate([
        {"$match": match},
        {"$group": {"_id": "$date", "pageviews": {"$sum": 1},
                    "sessions": {"$addToSet": "$session_id"}}},
        {"$sort": {"_id": 1}},
    ]):
        series.append({"date": r["_id"], "pageviews": r["pageviews"], "sessions": len(r["sessions"])})

    # ---- Sources ----
    sources = []
    async for r in db.visits.aggregate([
        {"$match": match},
        {"$group": {"_id": {"source": "$source", "medium": "$medium"},
                    "pageviews": {"$sum": 1}, "sessions": {"$addToSet": "$session_id"}}},
        {"$sort": {"pageviews": -1}},
    ]):
        sources.append({
            "source": r["_id"]["source"], "medium": r["_id"]["medium"],
            "pageviews": r["pageviews"], "sessions": len(r["sessions"]),
        })

    # ---- Top external referrers (for 'referral' drill-down) ----
    referrers = []
    async for r in db.visits.aggregate([
        {"$match": {**match, "referrer_host": {"$nin": ["", None]}}},
        {"$group": {"_id": "$referrer_host", "pageviews": {"$sum": 1}}},
        {"$sort": {"pageviews": -1}}, {"$limit": 10},
    ]):
        referrers.append({"host": r["_id"], "pageviews": r["pageviews"]})

    # ---- Countries ----
    countries = []
    async for r in db.visits.aggregate([
        {"$match": {**match, "country_code": {"$nin": [None, ""]}}},
        {"$group": {"_id": "$country_code", "pageviews": {"$sum": 1},
                    "sessions": {"$addToSet": "$session_id"},
                    "name": {"$first": "$country_name"}}},
        {"$sort": {"pageviews": -1}},
    ]):
        countries.append({
            "code": r["_id"], "name": r.get("name"),
            "pageviews": r["pageviews"], "sessions": len(r["sessions"]),
        })
    unknown = await db.visits.count_documents({**match, "$or": [
        {"country_code": None}, {"country_code": ""}]})

    # ---- Top pages ----
    pages = []
    async for r in db.visits.aggregate([
        {"$match": match},
        {"$group": {"_id": "$path", "pageviews": {"$sum": 1}}},
        {"$sort": {"pageviews": -1}}, {"$limit": 10},
    ]):
        pages.append({"path": r["_id"], "pageviews": r["pageviews"]})

    # ---- Commerce (orders in range) ----
    o_match = {"created_at": {"$gte": f"{date_from}T00:00:00", "$lte": f"{date_to}T23:59:59.999999+00:00"}}
    orders_count = await db.orders.count_documents(o_match)
    revenue = 0.0
    async for r in db.orders.aggregate([
        {"$match": {**o_match, "payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]):
        revenue = r.get("total", 0.0)

    return {
        "range": {"from": date_from, "to": date_to},
        "totals": {**totals, "orders": orders_count, "revenue": round(revenue, 2),
                   "countries": len(countries)},
        "series": series,
        "sources": sources,
        "referrers": referrers,
        "countries": countries,
        "unknown_country": unknown,
        "pages": pages,
    }
