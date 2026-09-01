"""Catalog auto-reconciliation (Excel files in repo = source of truth).

Solves the cross-environment problem: code travels via GitHub but MongoDB does
not. The two Excel files in backend/data DO travel with the repo, so any new
environment can rebuild the exact catalog (products, prices, VAT, formats)
automatically:

  - On startup: server.py calls reconcile_catalog_if_needed() -> runs only when
    the DB was never imported (fresh environment) or the Excel files changed.
  - On demand: POST /api/admin/catalog/sync (admin dashboard button).

Idempotent and safe: same logic as `python -m scripts.import_catalog --commit`
(matched products keep id, images, translations and SEO).
"""
import hashlib
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict

from core.config import db

logger = logging.getLogger("ecoandes.catalog")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
EXCEL_FILES = [DATA_DIR / "precios_profesionales.xlsx", DATA_DIR / "precios_web.xlsx"]

SYNC_STATUS: Dict[str, object] = {
    "running": False,
    "started_at": None,
    "finished_at": None,
    "error": None,
    "last_result": None,
}


def catalog_excel_hash() -> str:
    h = hashlib.sha256()
    for fp in EXCEL_FILES:
        if not fp.exists():
            return ""
        h.update(fp.read_bytes())
    return h.hexdigest()


async def get_sync_marker() -> dict:
    doc = await db.site_config.find_one({"_id": "catalog_import"}, {"_id": 0}) or {}
    doc["excel_hash_current"] = catalog_excel_hash()
    doc["in_sync"] = bool(doc.get("excel_hash")) and doc.get("excel_hash") == doc["excel_hash_current"]
    return doc


async def reconcile_catalog_if_needed(force: bool = False) -> dict:
    """Run the Excel catalog importer when the DB is out of sync with the repo Excels."""
    excel_hash = catalog_excel_hash()
    if not excel_hash:
        logger.warning("Catalog Excel files missing; skipping reconciliation.")
        return {"ran": False, "reason": "excel_missing"}

    marker = await db.site_config.find_one({"_id": "catalog_import"})
    if not force and marker and marker.get("excel_hash") == excel_hash:
        logger.info("Catalog already in sync with repo Excels. Skipping auto-import.")
        return {"ran": False, "reason": "in_sync", "products_total": marker.get("products_total")}

    logger.info("Catalog out of sync (new environment or Excel updated). Running reconciliation...")
    SYNC_STATUS.update({
        "running": True,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "finished_at": None,
        "error": None,
    })
    try:
        from scripts.import_catalog import main as import_catalog_main

        await import_catalog_main(commit=True)
        total = await db.products.count_documents({})
        await db.site_config.update_one(
            {"_id": "catalog_import"},
            {"$set": {
                "excel_hash": excel_hash,
                "imported_at": datetime.now(timezone.utc).isoformat(),
                "products_total": total,
            }},
            upsert=True,
        )
        result = {"ran": True, "products_total": total}
        SYNC_STATUS.update({
            "running": False,
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "last_result": result,
        })
        logger.info("Catalog reconciliation applied. Products in DB: %d", total)
        return result
    except Exception as e:  # noqa: BLE001
        SYNC_STATUS.update({
            "running": False,
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "error": str(e),
        })
        logger.exception("Catalog reconciliation failed: %s", e)
        raise
