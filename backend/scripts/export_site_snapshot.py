"""Exporta la configuración editable del sitio a JSON versionado en el repo.

Genera /app/backend/data/site_snapshot.json con:
  - hero (portada), carrusel de categorías, páginas legales
  - metadatos de archivos subidos (db.files) para que las fichas técnicas e
    imágenes del gestor de Archivos sigan funcionando en un entorno nuevo

Ejecutar tras hacer cambios importantes desde el dashboard:
  python scripts/export_site_snapshot.py
En el arranque, core/snapshot_seed.py restaura este snapshot si la BD está vacía.
"""
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from core.config import db  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "data" / "site_snapshot.json"


async def main():
    hero = await db.site_config.find_one({"_id": "hero"}, {"_id": 0})
    carousel = await db.site_config.find_one({"_id": "category_carousel"}, {"_id": 0})
    legal = await db.legal_pages.find({}, {"_id": 0}).to_list(20)
    files = await db.files.find({"is_deleted": {"$ne": True}}, {"_id": 0}).to_list(3000)

    snapshot = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "hero": hero,
        "category_carousel": carousel,
        "legal_pages": legal,
        "files": files,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Snapshot guardado en {OUT}")
    print(f"  hero: {'sí' if hero else 'no'} · carrusel: {len((carousel or {}).get('items', []))} items"
          f" · legal: {len(legal)} páginas · files: {len(files)} archivos")


if __name__ == "__main__":
    asyncio.run(main())
