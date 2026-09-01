"""SEO con IA: análisis periódico de la web con recomendaciones accionables.

- run_seo_analysis(): recopila datos reales del sitio (productos, blog, analítica,
  puntuaciones SEO) y pide a Gemini un informe con recomendaciones priorizadas.
- Los informes se guardan en `seo_reports` (histórico) y se generan automáticamente
  cada semana vía core/scheduler.py, o bajo demanda desde el dashboard.
"""
import json
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from core.auth import require_admin
from core.config import db

logger = logging.getLogger("ecoandes.seo")

router = APIRouter(prefix="/api/admin/seo", tags=["seo"], dependencies=[Depends(require_admin)])


def _score_product_seo(p: dict) -> int:
    seo = p.get("seo") or {}
    score = 0
    t = len(seo.get("meta_title") or "")
    score += 30 if 30 <= t <= 65 else (15 if t > 0 else 0)
    d = len(seo.get("meta_description") or "")
    score += 30 if 80 <= d <= 170 else (15 if d > 0 else 0)
    k = len(seo.get("keywords") or [])
    score += 20 if k >= 3 else (10 if k > 0 else 0)
    if p.get("description") or p.get("short_description"):
        score += 10
    if p.get("image_url"):
        score += 10
    return score


async def _collect_site_data() -> dict:
    products = await db.products.find(
        {}, {"_id": 0, "name": 1, "slug": 1, "seo": 1, "description": 1,
             "short_description": 1, "image_url": 1, "category": 1, "nutrition": 1,
             "tech_sheet": 1}
    ).to_list(2000)
    scores = [_score_product_seo(p) for p in products]
    low = [p["name"] for p, s in zip(products, scores) if s < 45][:25]
    missing_desc = sum(1 for p in products if not (p.get("description") or p.get("short_description")))
    missing_meta = sum(1 for p in products if not (p.get("seo") or {}).get("meta_title"))
    missing_nutrition = sum(1 for p in products if not p.get("nutrition"))
    missing_tech = sum(1 for p in products if not (p.get("tech_sheet") or {}).get("url"))

    # Blog: los posts viven en el frontend (src/data/blogPosts.js)
    blog_count = 0
    try:
        from pathlib import Path

        blog_file = Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "data" / "blogPosts.js"
        content = blog_file.read_text(encoding="utf-8")
        blog_count = content.count("slug:")
    except Exception:  # noqa: BLE001
        pass
    latest_post = None

    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    v_match = {"date": {"$gte": week_ago}}
    pageviews = await db.visits.count_documents(v_match)
    sessions = len(await db.visits.distinct("session_id", v_match))
    sources, pages = [], []
    async for r in db.visits.aggregate([
        {"$match": v_match}, {"$group": {"_id": "$source", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}}, {"$limit": 8},
    ]):
        sources.append({"source": r["_id"], "visits": r["n"]})
    async for r in db.visits.aggregate([
        {"$match": v_match}, {"$group": {"_id": "$path", "n": {"$sum": 1}}},
        {"$sort": {"n": -1}}, {"$limit": 10},
    ]):
        pages.append({"path": r["_id"], "visits": r["n"]})

    orders_week = await db.orders.count_documents({"created_at": {"$gte": f"{week_ago}T00:00:00"}})

    return {
        "products_total": len(products),
        "avg_seo_score": round(sum(scores) / max(1, len(scores)), 1),
        "products_seo_low": len([s for s in scores if s < 45]),
        "products_seo_medium": len([s for s in scores if 45 <= s < 75]),
        "products_seo_high": len([s for s in scores if s >= 75]),
        "examples_low_seo": low,
        "missing_description": missing_desc,
        "missing_meta_title": missing_meta,
        "missing_nutrition": missing_nutrition,
        "missing_tech_sheet": missing_tech,
        "blog_posts": blog_count,
        "latest_blog_post": latest_post,
        "traffic_7d": {"pageviews": pageviews, "sessions": sessions,
                        "sources": sources, "top_pages": pages},
        "orders_7d": orders_week,
        "site": "productosecoandes.com · e-commerce ecológico BIO a granel (B2C + B2B), 7 idiomas, blog, fichas técnicas PDF",
    }


async def _ask_llm(site_data: dict) -> dict:
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    api_key = os.environ.get("EMERGENT_LLM_KEY", "")
    prompt = f"""Eres un consultor SEO senior especializado en e-commerce de alimentación ecológica en España.
Analiza estos datos REALES de la tienda online EcoAndes y genera un informe de recomendaciones SEO.

DATOS DEL SITIO (JSON):
{json.dumps(site_data, ensure_ascii=False, default=str)}

Devuelve SOLO un JSON válido (sin markdown) con esta estructura exacta:
{{
  "overall_score": <0-100, salud SEO global del sitio>,
  "summary": "<resumen ejecutivo en 2-3 frases, en español>",
  "recommendations": [
    {{"priority": "alta|media|baja", "area": "contenido|técnico|productos|blog|enlaces|local", "title": "<título corto>", "detail": "<explicación accionable y concreta en español, mencionando datos reales del sitio>"}}
  ]
}}
Entre 6 y 10 recomendaciones, ordenadas por prioridad (alta primero). Sé específico con los datos proporcionados (número de productos sin meta descripción, fuentes de tráfico, etc.)."""

    chat = LlmChat(
        api_key=api_key,
        session_id=f"seo-{uuid.uuid4().hex[:8]}",
        system_message="Eres un consultor SEO que responde únicamente con JSON válido.",
    ).with_model("gemini", "gemini-2.5-flash")
    resp = await chat.send_message(UserMessage(text=prompt))
    raw = (resp or "").strip()
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.S)
    return json.loads(raw)


async def run_seo_analysis(trigger: str = "manual") -> dict:
    site_data = await _collect_site_data()
    try:
        report = await _ask_llm(site_data)
    except Exception as e:  # noqa: BLE001
        logger.error("SEO LLM analysis failed: %s", e)
        report = {
            "overall_score": None,
            "summary": f"No se pudo generar el análisis con IA ({e}). Se muestran los datos recopilados.",
            "recommendations": [],
        }
    doc = {
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "trigger": trigger,
        "site_data": site_data,
        "report": report,
    }
    await db.seo_reports.insert_one({**doc})
    doc.pop("_id", None)
    return doc


@router.post("/analyze")
async def analyze_now():
    doc = await run_seo_analysis(trigger="manual")
    # marca el análisis como reciente para el programador semanal
    await db.site_config.update_one(
        {"_id": "scheduler"},
        {"$set": {"last_seo_analysis": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return doc


@router.get("/reports")
async def list_reports(limit: int = 10):
    docs = await db.seo_reports.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"reports": docs}


@router.get("/latest")
async def latest_report():
    docs = await db.seo_reports.find({}, {"_id": 0}).sort("created_at", -1).limit(1).to_list(1)
    return {"report": docs[0] if docs else None}
