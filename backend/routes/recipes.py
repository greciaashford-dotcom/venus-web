"""Sección 'Recetas con nuestros productos' de la home: vídeos verticales editables.

Documento único en site_config (_id="recipe_videos"):
{ "_id": "recipe_videos", "items": [ {id, order, active, video_url, title, description} ], "updated_at": iso }

- GET /api/recipes         -> items activos ordenados (público, para la home)
- GET /api/recipes/admin   -> todos los items (admin)
- PUT /api/recipes/admin   -> reemplaza la lista completa (admin)
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.auth import require_admin
from core.config import db

router = APIRouter(prefix="/api", tags=["recipes"])

DOC_ID = "recipe_videos"


class RecipeVideoIn(BaseModel):
    id: Optional[str] = None
    order: int = 0
    active: bool = True
    video_url: str
    title: str = ""
    description: str = ""  # metadescripción del vídeo (SEO + texto visible)


class RecipesPayload(BaseModel):
    items: List[RecipeVideoIn] = []


async def _get_doc() -> dict:
    return await db.site_config.find_one({"_id": DOC_ID}) or {"items": []}


@router.get("/recipes")
async def get_recipes():
    doc = await _get_doc()
    items = [i for i in doc.get("items", []) if i.get("active", True) and i.get("video_url")]
    items.sort(key=lambda x: x.get("order", 0))
    return {"items": items}


@router.get("/recipes/admin", dependencies=[Depends(require_admin)])
async def get_recipes_admin():
    doc = await _get_doc()
    items = sorted(doc.get("items", []), key=lambda x: x.get("order", 0))
    return {"items": items, "updated_at": doc.get("updated_at")}


@router.put("/recipes/admin", dependencies=[Depends(require_admin)])
async def save_recipes(payload: RecipesPayload):
    items = []
    for idx, item in enumerate(payload.items):
        data = item.model_dump()
        data["id"] = data.get("id") or str(uuid.uuid4())
        data["order"] = idx
        data["video_url"] = (data.get("video_url") or "").strip()
        data["title"] = (data.get("title") or "").strip()[:150]
        data["description"] = (data.get("description") or "").strip()[:300]
        items.append(data)
    await db.site_config.update_one(
        {"_id": DOC_ID},
        {"$set": {"items": items, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "items": items}
