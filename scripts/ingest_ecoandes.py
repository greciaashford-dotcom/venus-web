"""One-shot ingest: enrich DB products with rich content scraped from
productosecoandes.com via the WooCommerce Store API.

- Parses: highlights (tagline), trust badges (<img>), description blocks (H2 sections),
  gallery images (ordered), price range, rating/review counts, categories.
- Matches web products to our DB products by normalized-name token Jaccard (+ overrides).
- Overwrites retail price (from web min), sets badges/description_blocks/highlights/gallery,
  flags best sellers, leaves nutrition blank (not present on source site).
- Produces a missing-data report (JSON + Markdown).

Run: python scripts/ingest_ecoandes.py
"""
import asyncio
import html
import json
import re
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
import sys
sys.path.insert(0, "/app/backend")
from core.config import db  # noqa: E402

H = {"User-Agent": "Mozilla/5.0"}
BASE = "https://productosecoandes.com/wp-json/wc/store/v1/products"

BEST_SELLERS = ["maca negra", "cacao nibs", "quinoa tricolor", "curcuma", "cúrcuma", "canela"]
# Precise anchored patterns used to flag best sellers (avoids matching e.g. "Aceitunas con Cúrcuma")
BEST_SELLER_PATTERNS = [
    r"^maca negra",
    r"^cacao nibs",
    r"quinoa real tricolor",
    r"^c[úu]rcuma en polvo",
    r"^canela",
]

STOP = {
    "bio", "eco", "ecologico", "ecológico", "de", "la", "el", "en", "y", "con", "sin",
    "kg", "g", "gr", "gramos", "rama", "polvo", "integral", "blanco", "real", "peru", "perú",
    "a", "del", "los", "las", "para",
}

HEAD_MAP = {
    "ingredientes": "ingredients",
    "origen": "origin",
    "procedencia": "origin",
    "descripcion": "benefits",
    "descripción": "benefits",
    "beneficios": "benefits",
    "propiedades": "benefits",
    "modo de empleo": "usage",
    "uso": "usage",
    "usos": "usage",
    "modo de uso": "usage",
    "almacenamiento": "storage",
    "conservacion": "storage",
    "conservación": "storage",
}


def strip_tags(s: str) -> str:
    s = re.sub(r"<br\s*/?>", "\n", s or "", flags=re.I)
    s = re.sub(r"</p>", "\n\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n\s*\n\s*\n+", "\n\n", s)
    return s.strip()


def norm_tokens(name: str):
    n = html.unescape(name or "")
    n = re.sub(r"<[^>]+>", " ", n)
    n = re.sub(r"\b\d+[.,]?\d*\s?(kg|g|gr|ml|l|unidad|ud|uds)\b", " ", n, flags=re.I)
    n = re.sub(r"[^a-zA-Z0-9áéíóúñü ]", " ", n).lower()
    return {t for t in n.split() if t not in STOP and len(t) > 1}


def fetch_all():
    out, page = [], 1
    while True:
        r = requests.get(BASE, headers=H, params={"per_page": 100, "page": page}, timeout=45)
        if r.status_code != 200 or not r.json():
            break
        out.extend(r.json())
        if page >= int(r.headers.get("X-WP-TotalPages", "1")):
            break
        page += 1
    return out


def parse_short(short_desc: str):
    """Returns (highlights, certifications_text, badges[])."""
    badges = []
    for m in re.finditer(r'<img[^>]+>', short_desc or "", flags=re.I):
        tag = m.group(0)
        src = re.search(r'src="([^"]+)"', tag)
        alt = re.search(r'alt="([^"]*)"', tag)
        if src:
            badges.append({"src": src.group(1), "alt": html.unescape(alt.group(1)) if alt else ""})
    paras = [strip_tags(p) for p in re.findall(r"<p[^>]*>(.*?)</p>", short_desc or "", flags=re.I | re.S)]
    paras = [p for p in paras if p]
    highlights = paras[0] if paras else strip_tags(short_desc)
    cert_parts = [p for p in paras[1:] if re.search(r"(certificad|agricultura ecol|ES-ECO|CAEM)", p, re.I)]
    certifications = " ".join(cert_parts).strip()
    return highlights, certifications, badges


def parse_blocks(desc: str):
    """Split description HTML by <h2> headings into mapped blocks."""
    marked = re.sub(
        r"<h2[^>]*>(.*?)</h2>",
        lambda m: "\n@@@H2@@@" + strip_tags(m.group(1)) + "@@@SEP@@@",
        desc or "",
        flags=re.I | re.S,
    )
    parts = marked.split("@@@H2@@@")
    blocks = {"ingredients": "", "origin": "", "benefits": "", "usage": "", "storage": ""}
    for chunk in parts[1:]:
        if "@@@SEP@@@" not in chunk:
            continue
        head, body = chunk.split("@@@SEP@@@", 1)
        head_key = head.strip().lower().rstrip(":").strip()
        head_key = re.sub(r"\s+", " ", head_key)
        key = HEAD_MAP.get(head_key)
        if not key:
            continue
        text = strip_tags(body)
        if not text:
            continue
        blocks[key] = (blocks[key] + "\n\n" + text).strip() if blocks[key] else text
    return blocks


async def main():
    web = fetch_all()
    print(f"[info] fetched {len(web)} web products")

    web_parsed = []
    for p in web:
        highlights, certs, badges = parse_short(p.get("short_description", ""))
        blocks = parse_blocks(p.get("description", ""))
        if certs:
            blocks["certifications"] = certs
        prices = p.get("prices") or {}
        pr = prices.get("price_range")
        minor = int(prices.get("currency_minor_unit", 2))
        div = 10 ** minor
        if pr:
            price_min = int(pr["min_amount"]) / div
            price_max = int(pr["max_amount"]) / div
        else:
            val = prices.get("price")
            price_min = price_max = (int(val) / div) if val not in (None, "") else None
        images = [img.get("src") for img in p.get("images", []) if img.get("src")]
        web_parsed.append({
            "name": html.unescape(re.sub(r"<[^>]+>", "", p.get("name", ""))),
            "tokens": norm_tokens(p.get("name", "")),
            "highlights": highlights,
            "badges": badges,
            "blocks": blocks,
            "images": images,
            "price_min": price_min,
            "price_max": price_max,
            "in_stock": bool(p.get("is_in_stock", True)),
            "rating": float(p.get("average_rating") or 0) or 0.0,
            "reviews": int(p.get("review_count") or 0),
        })

    dbp = await db.products.find({}, {"_id": 0, "id": 1, "sku": 1, "name": 1, "variations": 1}).to_list(2000)
    print(f"[info] {len(dbp)} DB products")

    matched = 0
    enriched_ids = set()
    report_unmatched = []
    report_no_blocks = []

    for d in dbp:
        dtoks = norm_tokens(d["name"])
        best = None
        best_score = 0.0
        for wp in web_parsed:
            wtoks = wp["tokens"]
            if not dtoks or not wtoks:
                continue
            inter = len(dtoks & wtoks)
            union = len(dtoks | wtoks)
            score = inter / union if union else 0
            # boost if one is subset of the other (handles extra format words)
            if dtoks <= wtoks or wtoks <= dtoks:
                score = max(score, 0.65)
            if score > best_score:
                best_score = score
                best = wp
        if not best or best_score < 0.5:
            report_unmatched.append(d["name"])
            continue

        matched += 1
        enriched_ids.add(d["id"])
        set_fields = {}
        if best["highlights"]:
            set_fields["highlights"] = best["highlights"][:600]
        if best["badges"]:
            set_fields["badges"] = best["badges"]
        blocks = best["blocks"]
        # only set non-empty blocks; keep Desc structure
        set_fields["description_blocks"] = blocks
        if best["images"]:
            set_fields["image_url"] = best["images"][0]
            set_fields["gallery"] = best["images"]
        if best["price_min"] is not None:
            set_fields["price_retail"] = round(best["price_min"], 2)
        set_fields["web_rating"] = best["rating"]
        set_fields["web_reviews"] = best["reviews"]
        # stock: default sellable (100) based on source availability
        stock_val = 100 if best["in_stock"] else 0
        set_fields["stock"] = stock_val
        existing_vars = d.get("variations") or []
        if existing_vars:
            for v in existing_vars:
                v["stock"] = stock_val
            set_fields["variations"] = existing_vars

        # best seller flag
        lname = d["name"].lower()
        if any(re.search(pat, lname) for pat in BEST_SELLER_PATTERNS):
            set_fields["best_seller"] = True

        await db.products.update_one({"id": d["id"]}, {"$set": set_fields})

        if not any(blocks.get(k) for k in ("ingredients", "origin", "benefits", "usage", "storage")):
            report_no_blocks.append(d["name"])

    # Ensure best sellers flagged with precise anchored patterns (reset first)
    await db.products.update_many({}, {"$set": {"best_seller": False}})
    for pat in BEST_SELLER_PATTERNS:
        await db.products.update_many(
            {"name": {"$regex": pat, "$options": "i"}}, {"$set": {"best_seller": True}}
        )
    bs_count = await db.products.count_documents({"best_seller": True})

    report = {
        "web_products": len(web),
        "db_products": len(dbp),
        "matched_enriched": matched,
        "best_sellers_flagged": bs_count,
        "unmatched_db_products (no web data found)": sorted(report_unmatched),
        "matched_but_missing_description_blocks": sorted(report_no_blocks),
        "note_nutrition": "Nutritional info per 100g is NOT published on productosecoandes.com -> left blank for ALL products; fill via admin dashboard.",
    }
    Path("/app/scripts/ingest_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))

    # human-friendly markdown
    md = ["# Reporte de importación de datos (productosecoandes.com)", ""]
    md.append(f"- Productos en la web: **{len(web)}**")
    md.append(f"- Productos en BD: **{len(dbp)}**")
    md.append(f"- Productos enriquecidos (emparejados): **{matched}**")
    md.append(f"- Productos marcados como más vendidos: **{bs_count}**")
    md.append("")
    md.append("## ⚠️ Información nutricional")
    md.append("La web **no publica** información nutricional por 100g (0 productos la tienen). "
              "Queda **en blanco** para todos los productos y debe rellenarse desde el dashboard de admin.")
    md.append("")
    md.append(f"## ❌ Productos SIN datos en la web ({len(report_unmatched)}) — quedan con datos previos")
    for n in sorted(report_unmatched):
        md.append(f"- {n}")
    md.append("")
    md.append(f"## ⚠️ Emparejados pero sin bloques de descripción ({len(report_no_blocks)})")
    for n in sorted(report_no_blocks):
        md.append(f"- {n}")
    Path("/app/memory/missing_data_report.md").write_text("\n".join(md), encoding="utf-8")

    print(json.dumps({k: (v if not isinstance(v, list) else f"{len(v)} items") for k, v in report.items()}, ensure_ascii=False, indent=2))
    print("\n[done] reports written to /app/scripts/ingest_report.json and /app/memory/missing_data_report.md")


if __name__ == "__main__":
    asyncio.run(main())
