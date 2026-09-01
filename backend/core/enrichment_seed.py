"""Aplica el enriquecimiento de productos (fichas técnicas PDF) desde el JSON del repo.

/app/backend/data/product_enrichment.json se genera con scripts/enrich_from_pdfs.py
y viaja con el código. En cada arranque, si un producto tiene campos vacíos que el
JSON puede rellenar (descripción, bloques, nutrición, ficha técnica...), se aplican.
Nunca sobrescribe contenido ya existente en la base de datos.
"""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from core.config import db

logger = logging.getLogger("ecoandes.enrichment")

ENRICH_PATH = Path(__file__).resolve().parent.parent / "data" / "product_enrichment.json"

BLOCK_KEYS = ["ingredients", "origin", "benefits", "usage", "storage", "certifications"]


def _empty(v) -> bool:
    if v is None:
        return True
    if isinstance(v, str):
        return not v.strip()
    if isinstance(v, (list, dict)):
        return len(v) == 0
    return False


async def apply_enrichment_seed() -> None:
    if not ENRICH_PATH.exists():
        return
    try:
        store = json.loads(ENRICH_PATH.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        logger.error("No se pudo leer product_enrichment.json: %s", e)
        return
    records = store.get("products") or {}
    applied = 0
    for slug, rec in records.items():
        if rec.get("status") != "ok":
            continue
        p = await db.products.find_one({"slug": slug}, {"_id": 0})
        if not p:
            continue
        extracted = rec.get("extracted") or {}
        patch = {}
        tech = rec.get("tech_sheet") or {}
        if tech.get("url") and _empty((p.get("tech_sheet") or {}).get("url")):
            patch["tech_sheet"] = tech
        for field in ("description", "short_description", "highlights", "origin_country"):
            if _empty(p.get(field)) and not _empty(extracted.get(field)):
                patch[field] = str(extracted[field]).strip()
        blocks = dict(p.get("description_blocks") or {})
        ext_blocks = extracted.get("description_blocks") or {}
        changed = False
        for k in BLOCK_KEYS:
            if _empty(blocks.get(k)) and not _empty(ext_blocks.get(k)):
                blocks[k] = str(ext_blocks[k]).strip()
                changed = True
        if changed:
            patch["description_blocks"] = blocks
        nut = [n for n in (extracted.get("nutrition") or [])
               if isinstance(n, dict) and n.get("label") and n.get("value")]
        if _empty(p.get("nutrition")) and nut:
            patch["nutrition"] = nut
        if patch:
            patch["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.products.update_one({"slug": slug}, {"$set": patch})
            applied += 1
    if applied:
        logger.info("Enriquecimiento aplicado desde el repo a %d productos", applied)
