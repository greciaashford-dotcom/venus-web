"""Coupon management: DB-driven discount codes with admin CRUD.

Rules supported per coupon:
  - fixed (€) or percent (%) discount
  - minimum subtotal
  - first-order-only
  - usage limit (total redemptions)
  - expiry date
  - active toggle
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.auth import require_admin
from core.config import db

router = APIRouter(prefix="/api", tags=["coupons"])


# ---------- Seed: default ECOBONUS coupon ----------
async def seed_default_coupon() -> None:
    """Create the ECOBONUS coupon (5€ off, min 60€) if no coupons exist."""
    count = await db.coupons.count_documents({})
    if count > 0:
        return
    await db.coupons.insert_one({
        "id": str(uuid.uuid4()),
        "code": "ECOBONUS",
        "description": "5€ de descuento en tu primer pedido (compra mínima 60€)",
        "discount_type": "fixed",
        "discount_value": 5.0,
        "min_subtotal": 60.0,
        "first_order_only": True,
        "usage_limit": None,
        "used_count": 0,
        "expires_at": None,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })


# ---------- Evaluation (used by checkout + public validation) ----------
async def _has_previous_order(email: str) -> bool:
    if not email:
        return False
    existing = await db.orders.find_one({"email": email.lower()}, {"_id": 1})
    return existing is not None


async def evaluate_coupon_db(code: str, email: Optional[str], subtotal: float) -> dict:
    """Validate a coupon code against the DB rules.

    Returns: {valid, discount, message, code}
    """
    code = (code or "").strip().upper()
    if not code:
        return {"valid": False, "discount": 0.0, "message": "Introduce un código.", "code": code}

    coupon = await db.coupons.find_one({"code": code}, {"_id": 0})
    if not coupon or not coupon.get("active", False):
        return {"valid": False, "discount": 0.0, "message": "Cupón no válido.", "code": code}

    # Start date (not yet active)
    starts = coupon.get("starts_at")
    if starts:
        try:
            st_dt = datetime.fromisoformat(str(starts).replace("Z", "+00:00"))
            if st_dt.tzinfo is None:
                st_dt = st_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) < st_dt:
                return {"valid": False, "discount": 0.0, "message": "Este cupón aún no está disponible.", "code": code}
        except (ValueError, TypeError):
            pass

    # Expiry
    expires = coupon.get("expires_at")
    if expires:
        try:
            exp_dt = datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp_dt:
                return {"valid": False, "discount": 0.0, "message": "Este cupón ha caducado.", "code": code}
        except (ValueError, TypeError):
            pass

    # Usage limit
    limit = coupon.get("usage_limit")
    if limit is not None and int(coupon.get("used_count", 0)) >= int(limit):
        return {"valid": False, "discount": 0.0, "message": "Este cupón ha alcanzado su límite de usos.", "code": code}

    # Minimum subtotal
    min_subtotal = float(coupon.get("min_subtotal", 0) or 0)
    if subtotal < min_subtotal:
        return {
            "valid": False,
            "discount": 0.0,
            "message": f"El cupón requiere un mínimo de {min_subtotal:.0f}€ de compra.",
            "code": code,
        }

    # First order only
    if coupon.get("first_order_only") and email and await _has_previous_order(email):
        return {
            "valid": False,
            "discount": 0.0,
            "message": "Este cupón es solo para tu primer pedido.",
            "code": code,
        }

    # Discount amount
    if coupon.get("discount_type") == "percent":
        discount = round(subtotal * float(coupon.get("discount_value", 0)) / 100.0, 2)
    else:
        discount = float(coupon.get("discount_value", 0))
    discount = min(round(discount, 2), round(subtotal, 2))

    return {
        "valid": True,
        "discount": discount,
        "message": f"¡Cupón aplicado! -{discount:.2f}€ de descuento.",
        "code": code,
    }


async def register_coupon_use(code: str) -> None:
    await db.coupons.update_one({"code": (code or "").upper()}, {"$inc": {"used_count": 1}})


# ---------- Admin CRUD ----------
class CouponIn(BaseModel):
    code: str = Field(..., min_length=3, max_length=30)
    description: str = ""
    conditions: str = ""  # human-readable terms shown to customers/admin
    discount_type: str = "fixed"  # fixed | percent
    discount_value: float = Field(..., gt=0)
    min_subtotal: float = 0.0
    first_order_only: bool = False
    usage_limit: Optional[int] = None
    starts_at: Optional[str] = None
    expires_at: Optional[str] = None
    product_skus: list = Field(default_factory=list)  # empty = applies to all products
    active: bool = True


def _normalize(payload: CouponIn) -> dict:
    if payload.discount_type not in ("fixed", "percent"):
        raise HTTPException(status_code=422, detail="Tipo de descuento inválido")
    if payload.discount_type == "percent" and payload.discount_value > 100:
        raise HTTPException(status_code=422, detail="El porcentaje no puede superar 100")
    return {
        "code": payload.code.strip().upper().replace(" ", ""),
        "description": payload.description.strip(),
        "conditions": (payload.conditions or "").strip(),
        "discount_type": payload.discount_type,
        "discount_value": round(float(payload.discount_value), 2),
        "min_subtotal": round(float(payload.min_subtotal or 0), 2),
        "first_order_only": bool(payload.first_order_only),
        "usage_limit": int(payload.usage_limit) if payload.usage_limit else None,
        "starts_at": payload.starts_at or None,
        "expires_at": payload.expires_at or None,
        "product_skus": [str(s).strip().upper() for s in (payload.product_skus or []) if str(s).strip()],
        "active": bool(payload.active),
    }


@router.get("/admin/coupons", dependencies=[Depends(require_admin)])
async def list_coupons():
    coupons = await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"coupons": coupons, "total": len(coupons)}


@router.post("/admin/coupons", dependencies=[Depends(require_admin)])
async def create_coupon(payload: CouponIn):
    data = _normalize(payload)
    if await db.coupons.find_one({"code": data["code"]}):
        raise HTTPException(status_code=409, detail=f"Ya existe un cupón con el código {data['code']}")
    data.update({
        "id": str(uuid.uuid4()),
        "used_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.coupons.insert_one(dict(data))
    data.pop("_id", None)
    return data


@router.put("/admin/coupons/{coupon_id}", dependencies=[Depends(require_admin)])
async def update_coupon(coupon_id: str, payload: CouponIn):
    data = _normalize(payload)
    existing = await db.coupons.find_one({"id": coupon_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Cupón no encontrado")
    clash = await db.coupons.find_one({"code": data["code"], "id": {"$ne": coupon_id}})
    if clash:
        raise HTTPException(status_code=409, detail=f"Ya existe otro cupón con el código {data['code']}")
    await db.coupons.update_one({"id": coupon_id}, {"$set": data})
    updated = await db.coupons.find_one({"id": coupon_id}, {"_id": 0})
    return updated


@router.delete("/admin/coupons/{coupon_id}", dependencies=[Depends(require_admin)])
async def delete_coupon(coupon_id: str):
    res = await db.coupons.delete_one({"id": coupon_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cupón no encontrado")
    return {"ok": True}
