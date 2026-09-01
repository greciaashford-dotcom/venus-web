"""Imágenes globales del sitio, editables desde el dashboard.

Documento site_config _id="site_images": { "images": {clave: url}, "updated_at" }.
Cada clave tiene un valor por defecto (las imágenes actuales de la web), de modo
que el frontend siempre recibe una URL válida aunque no se haya editado nada.

Claves gestionadas:
- collection_main : imagen de "COLECCIÓN PRINCIPAL" (home)
- b2b_landscape   : imagen de "CANAL PROFESIONAL" (home, apaisada/web)
- b2b_portrait    : imagen de "CANAL PROFESIONAL" (home, vertical/móvil)
- philosophy      : imagen de "FILOSOFÍA ECOANDES" (página Nosotros)
"""
from datetime import datetime, timezone
from typing import Dict

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.auth import require_admin
from core.config import db

router = APIRouter(prefix="/api", tags=["site-images"])

DOC_ID = "site_images"

DEFAULTS: Dict[str, str] = {
    "collection_main": "/coleccion-principal.webp",
    "b2b_landscape": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/ab2cb895-a966-4f2e-8f75-353d990d0b2a-lKg4iIrIJ2eGA0DY.png",
    "b2b_portrait": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/90f2dc95-18ff-4a32-9b26-49c52abf3b38-ixZJMjIJezMiDrOG.png",
    "philosophy": "/tienda-ecoandes-barcelo.jpg",
}

SPOTS_META = [
    {"key": "collection_main", "label": "Colección Principal", "where": "Home · sección 'Nuestras Categorías / Colección principal'"},
    {"key": "b2b_landscape", "label": "Canal Profesional (web)", "where": "Home · banner B2B en pantallas apaisadas"},
    {"key": "b2b_portrait", "label": "Canal Profesional (móvil)", "where": "Home · banner B2B en pantallas verticales"},
    {"key": "philosophy", "label": "Filosofía EcoAndes", "where": "Página 'Nosotros' · imagen principal"},
]


class SiteImagesPayload(BaseModel):
    images: Dict[str, str] = {}


@router.get("/site-images")
async def get_site_images():
    doc = await db.site_config.find_one({"_id": DOC_ID}) or {}
    images = {**DEFAULTS, **{k: v for k, v in (doc.get("images") or {}).items() if v}}
    return {"images": images}


@router.get("/site-images/admin", dependencies=[Depends(require_admin)])
async def get_site_images_admin():
    doc = await db.site_config.find_one({"_id": DOC_ID}) or {}
    saved = doc.get("images") or {}
    images = {**DEFAULTS, **{k: v for k, v in saved.items() if v}}
    return {"images": images, "defaults": DEFAULTS, "spots": SPOTS_META,
            "updated_at": doc.get("updated_at")}


@router.put("/site-images/admin", dependencies=[Depends(require_admin)])
async def save_site_images(payload: SiteImagesPayload):
    images = {k: (v or "").strip() for k, v in payload.images.items() if k in DEFAULTS}
    await db.site_config.update_one(
        {"_id": DOC_ID},
        {"$set": {"images": images, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    merged = {**DEFAULTS, **{k: v for k, v in images.items() if v}}
    return {"ok": True, "images": merged}
