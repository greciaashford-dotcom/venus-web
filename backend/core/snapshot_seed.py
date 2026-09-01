"""Restaura la configuración del sitio desde data/site_snapshot.json (si existe).

Se ejecuta al arrancar ANTES de los seeds por defecto: si la base de datos del
entorno es nueva, el snapshot versionado en el repo restaura la portada, el
carrusel de categorías, las páginas legales y los metadatos de archivos, de modo
que todos los cambios hechos en el dashboard viajan con el código.
Nunca sobrescribe datos ya presentes en la base de datos.
"""
import json
import logging
from pathlib import Path

from core.config import db

logger = logging.getLogger("ecoandes.snapshot")

SNAPSHOT_PATH = Path(__file__).resolve().parent.parent / "data" / "site_snapshot.json"


async def apply_site_snapshot() -> None:
    if not SNAPSHOT_PATH.exists():
        return
    try:
        snap = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        logger.error("No se pudo leer site_snapshot.json: %s", e)
        return

    restored = []

    # Portada (hero)
    hero = snap.get("hero")
    if hero and not await db.site_config.find_one({"_id": "hero"}):
        await db.site_config.update_one({"_id": "hero"}, {"$set": {"_id": "hero", **hero}}, upsert=True)
        restored.append("hero")

    # Carrusel de categorías
    carousel = snap.get("category_carousel")
    if carousel and not await db.site_config.find_one({"_id": "category_carousel"}):
        await db.site_config.update_one(
            {"_id": "category_carousel"},
            {"$set": {"_id": "category_carousel", **carousel}},
            upsert=True,
        )
        restored.append("carousel")

    # Páginas legales
    for page in snap.get("legal_pages") or []:
        slug = page.get("slug")
        if slug and not await db.legal_pages.find_one({"slug": slug}):
            await db.legal_pages.insert_one(dict(page))
            restored.append(f"legal:{slug}")

    # Metadatos de archivos (las fichas técnicas e imágenes viven en el object storage)
    files = snap.get("files") or []
    if files and await db.files.count_documents({}) == 0:
        await db.files.insert_many([dict(f) for f in files])
        restored.append(f"files:{len(files)}")

    if restored:
        logger.info("Snapshot del sitio restaurado: %s", ", ".join(restored))
