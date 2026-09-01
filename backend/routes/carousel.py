"""Editable 'Nuestras categorías' carousel: public read + admin CRUD.

Stored as a single document in `site_config` (_id="category_carousel"):
{ "_id": "category_carousel", "items": [ {id, order, active, title, cat, img} ], "updated_at": iso }
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.auth import require_admin
from core.config import db

logger = logging.getLogger("ecoandes.carousel")

router = APIRouter(prefix="/api", tags=["carousel"])

# Default items (migrated from the previously hardcoded frontend list)
DEFAULT_ITEMS = [
    {"title": "CEREALES EN GRANO", "cat": "PSEUDOCEREALES Y CEREALES EN GRANO", "img": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/cereales-en-grano-nvN4HZZDlUud1P7E.png"},
    {"title": "SUPER ALIMENTOS", "cat": "SUPERALIMENTOS EN POLVO U HOJA", "img": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/superalimentos-cuL4v4KFXGJdYA83.png"},
    {"title": "ARROCES", "cat": "ARROCES", "img": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/arroces-c0rZdaWC9njktmzt.png"},
    {"title": "AZÚCARES Y ENDULZANTES", "cat": "AZUCARES Y ENDULZANTES", "img": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/azucares-y-endulzantes-X3Y6m6GRLw4EKlMp.png"},
    {"title": "CACAO Y DERIVADOS", "cat": "CACAO Y DERIVADOS", "img": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/cacao-y-derivados-kW3mfwsnGSMmBDZ9.png"},
    {"title": "COPOS", "cat": "COPOS", "img": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/copos-Ha6zriYnCD5hsKyc.png"},
    {"title": "ESPECIAS", "cat": "ESPECIAS Y CONDIMENTOS", "img": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/especias-UPhOHHOvtQnLOuMR.png"},
    {"title": "SEMILLAS", "cat": "SEMILLAS", "img": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/semillas-wLokHer8QfRzl1L0.png"},
    {"title": "FRUTOS SECOS", "cat": "FRUTOS SECOS", "img": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/frutos-secos-cvXFfd8j2BynRD0R.png"},
    {"title": "HARINAS", "cat": "HARINAS", "img": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/harinas-PKEQ39X53eDRxXPh.png"},
    {"title": "HINCHADOS", "cat": "HINCHADOS y MUESLIS", "img": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/hinchados-VzCmOzf0TBU5aAGU.png"},
    {"title": "LEGUMBRES", "cat": "LEGUMBRES", "img": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/legunbres-HqdovJLrgEPM7t90.png"},
    {"title": "ALMIDONES Y ESPESANTES", "cat": "ALMIDONES y ESPESANTES", "img": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/almidones-y-espezantes-Y5mIqThw5z9KDtqF.png"},
    {"title": "FRUTA DESHIDRATADA", "cat": "FRUTA DESHIDRATADA", "img": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/fruta-deshidratada-pUTD6MmhXkp8iefs.png"},
    {"title": "TEXTURIZADOS Y PROTEÍNAS", "cat": "PROTEÍNAS", "img": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/texturizados-y-proteinas-kLTsjYFc5z2c9RJv.png"},
]

DOC_ID = "category_carousel"


async def seed_carousel_if_empty() -> None:
    existing = await db.site_config.find_one({"_id": DOC_ID})
    if existing:
        return
    items = [
        {"id": str(uuid.uuid4()), "order": i, "active": True, **base}
        for i, base in enumerate(DEFAULT_ITEMS)
    ]
    await db.site_config.update_one(
        {"_id": DOC_ID},
        {"$set": {"_id": DOC_ID, "items": items,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    logger.info("Category carousel seeded with %d items", len(items))


def _build_auto_description(names: list, total: int) -> str:
    """Descripción automática: los productos que contiene la categoría en la tienda."""
    if not names:
        return ""
    shown = names[:5]
    rest = total - len(shown)
    if rest > 0:
        base = ", ".join(shown)
        return f"{base} y {rest} producto{'s' if rest != 1 else ''} más."
    base = ", ".join(shown[:-1]) + (" y " + shown[-1] if len(shown) > 1 else shown[0])
    return f"{base}."


async def _category_products_map() -> dict:
    """{categoría: {names, count}} de productos activos (una sola agregación)."""
    pipeline = [
        {"$match": {"active": True}},
        {"$sort": {"name": 1}},
        {"$group": {"_id": "$category", "names": {"$push": "$name"}, "count": {"$sum": 1}}},
    ]
    out = {}
    async for row in db.products.aggregate(pipeline):
        out[row["_id"]] = {"names": row["names"], "count": row["count"]}
    return out


@router.get("/carousel-categories")
async def get_carousel_categories():
    doc = await db.site_config.find_one({"_id": DOC_ID})
    if not doc:
        await seed_carousel_if_empty()
        doc = await db.site_config.find_one({"_id": DOC_ID}) or {}
    items = [i for i in (doc.get("items") or []) if i.get("active", True)]
    items.sort(key=lambda i: i.get("order", 0))
    # Descripción por tarjeta: manual (admin) o automática con los productos de la categoría
    cat_map = await _category_products_map()
    for it in items:
        info = cat_map.get(it.get("cat") or "", {"names": [], "count": 0})
        it["product_count"] = info["count"]
        if not (it.get("description") or "").strip():
            it["description"] = _build_auto_description(info["names"], info["count"])
    return {"items": items}


@router.get("/admin/carousel-categories", dependencies=[Depends(require_admin)])
async def admin_get_carousel():
    doc = await db.site_config.find_one({"_id": DOC_ID}, {"_id": 0})
    if not doc:
        await seed_carousel_if_empty()
        doc = await db.site_config.find_one({"_id": DOC_ID}, {"_id": 0}) or {}
    items = doc.get("items") or []
    items.sort(key=lambda i: i.get("order", 0))
    return {"items": items}


class CarouselItemIn(BaseModel):
    id: Optional[str] = None
    order: int = 0
    active: bool = True
    title: str
    cat: str = ""
    img: str = ""
    description: str = ""  # vacía = descripción automática con los productos de la categoría


class CarouselIn(BaseModel):
    items: List[CarouselItemIn]


@router.put("/admin/carousel-categories", dependencies=[Depends(require_admin)])
async def admin_save_carousel(payload: CarouselIn):
    items = []
    for idx, it in enumerate(payload.items):
        items.append({
            "id": it.id or str(uuid.uuid4()),
            "order": idx,
            "active": it.active,
            "title": it.title.strip(),
            "cat": it.cat.strip(),
            "img": it.img.strip(),
            "description": it.description.strip()[:220],
        })
    await db.site_config.update_one(
        {"_id": DOC_ID},
        {"$set": {"_id": DOC_ID, "items": items,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "items": len(items)}
