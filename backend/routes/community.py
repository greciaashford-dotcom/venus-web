"""Newsletter + Wishlist + Compare (hybrid: server-persisted for logged-in users)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List

from core.auth import get_current_user
from core.config import db
from core.models import NewsletterSubscribe

router = APIRouter(prefix="/api", tags=["community"])


# ---------- Newsletter ----------
@router.post("/newsletter/subscribe")
async def newsletter_subscribe(payload: NewsletterSubscribe):
    email = payload.email.lower()
    existing = await db.newsletter_subscribers.find_one({"email": email})
    if existing:
        return {"ok": True, "already": True}
    await db.newsletter_subscribers.insert_one(
        {"email": email, "created_at": datetime.now(timezone.utc).isoformat()}
    )
    # Email de bienvenida automático (no bloquea la respuesta)
    import asyncio
    from core.mailer import send_newsletter_welcome
    asyncio.create_task(send_newsletter_welcome(email))
    return {"ok": True, "already": False}


# ---------- Wishlist / Compare ----------
class IdList(BaseModel):
    product_ids: List[str] = []


async def _get_collection(kind: str):
    return db.wishlists if kind == "wishlist" else db.compares


async def _get_ids(kind: str, user_id: str) -> List[str]:
    coll = await _get_collection(kind)
    doc = await coll.find_one({"user_id": user_id})
    return (doc or {}).get("product_ids", [])


async def _save_ids(kind: str, user_id: str, ids: List[str]):
    coll = await _get_collection(kind)
    await coll.update_one(
        {"user_id": user_id},
        {"$set": {"user_id": user_id, "product_ids": ids,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )


async def _hydrate(ids: List[str]):
    if not ids:
        return []
    docs = await db.products.find({"id": {"$in": ids}, "active": True}, {"_id": 0, "translations": 0}).to_list(500)
    order = {pid: i for i, pid in enumerate(ids)}
    docs.sort(key=lambda d: order.get(d["id"], 999))
    return docs


def _make_endpoints(kind: str):
    @router.get(f"/me/{kind}")
    async def get_list(user: dict = Depends(get_current_user)):
        ids = await _get_ids(kind, user["id"])
        return {"product_ids": ids, "items": await _hydrate(ids)}

    @router.put(f"/me/{kind}")
    async def replace_list(payload: IdList, user: dict = Depends(get_current_user)):
        # merge unique, preserve order (used to sync local guest list on login)
        ids = list(dict.fromkeys(payload.product_ids))
        await _save_ids(kind, user["id"], ids)
        return {"product_ids": ids, "items": await _hydrate(ids)}

    @router.post(f"/me/{kind}/{{product_id}}")
    async def add_item(product_id: str, user: dict = Depends(get_current_user)):
        ids = await _get_ids(kind, user["id"])
        if product_id not in ids:
            ids.append(product_id)
        await _save_ids(kind, user["id"], ids)
        return {"product_ids": ids}

    @router.delete(f"/me/{kind}/{{product_id}}")
    async def remove_item(product_id: str, user: dict = Depends(get_current_user)):
        ids = [i for i in await _get_ids(kind, user["id"]) if i != product_id]
        await _save_ids(kind, user["id"], ids)
        return {"product_ids": ids}

    return get_list, replace_list, add_item, remove_item


_make_endpoints("wishlist")
_make_endpoints("compare")
