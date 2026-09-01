"""Refund system: admin-configurable reasons + order refunds with automatic
customer email and best-effort Stripe/PayPal provider refunds.

If payment-provider keys are not configured (or the order was not paid online),
the refund is recorded as a MANUAL refund (store returns money by hand) and the
customer is still notified by email.
"""
import base64
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.auth import require_admin
from core.config import (
    PAYPAL_API_BASE,
    PAYPAL_CLIENT_ID,
    PAYPAL_SECRET,
    STRIPE_API_KEY,
    db,
)
from core.mailer import send_refund_notification

logger = logging.getLogger("ecoandes.refunds")

router = APIRouter(prefix="/api/admin", tags=["refunds"])

DEFAULT_REASONS = [
    "Falta de stock",
    "Producto defectuoso o dañado",
    "Error en el pedido",
    "Cancelación a petición del cliente",
    "Retraso en el envío",
    "Otro motivo",
]


async def seed_refund_reasons() -> None:
    count = await db.refund_reasons.count_documents({})
    if count > 0:
        return
    now = datetime.now(timezone.utc).isoformat()
    for i, label in enumerate(DEFAULT_REASONS):
        await db.refund_reasons.insert_one({
            "id": str(uuid.uuid4()), "label": label, "active": True,
            "order": i, "created_at": now,
        })


# ---------- Refund reasons CRUD ----------
class ReasonIn(BaseModel):
    label: str = Field(..., min_length=2, max_length=120)
    active: bool = True


@router.get("/refund-reasons", dependencies=[Depends(require_admin)])
async def list_reasons():
    await seed_refund_reasons()
    reasons = await db.refund_reasons.find({}, {"_id": 0}).sort("order", 1).to_list(200)
    return {"reasons": reasons}


@router.post("/refund-reasons", dependencies=[Depends(require_admin)])
async def create_reason(payload: ReasonIn):
    count = await db.refund_reasons.count_documents({})
    doc = {
        "id": str(uuid.uuid4()), "label": payload.label.strip(),
        "active": payload.active, "order": count,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.refund_reasons.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.put("/refund-reasons/{reason_id}", dependencies=[Depends(require_admin)])
async def update_reason(reason_id: str, payload: ReasonIn):
    res = await db.refund_reasons.update_one(
        {"id": reason_id}, {"$set": {"label": payload.label.strip(), "active": payload.active}}
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Motivo no encontrado")
    return await db.refund_reasons.find_one({"id": reason_id}, {"_id": 0})


@router.delete("/refund-reasons/{reason_id}", dependencies=[Depends(require_admin)])
async def delete_reason(reason_id: str):
    res = await db.refund_reasons.delete_one({"id": reason_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Motivo no encontrado")
    return {"ok": True}


# ---------- Provider refunds (best-effort) ----------
async def _stripe_refund(order: dict, amount: float) -> dict:
    """Refund a paid Stripe order. Returns {ok, provider, id, manual, error}."""
    if not STRIPE_API_KEY:
        return {"ok": False, "manual": True, "error": "Stripe no configurado"}
    session_id = order.get("payment_session_id")
    if not session_id:
        return {"ok": False, "manual": True, "error": "Sin sesión de pago"}
    try:
        import stripe
        stripe.api_key = STRIPE_API_KEY
        session = await __import__("asyncio").to_thread(stripe.checkout.Session.retrieve, session_id)
        payment_intent = session.get("payment_intent") if isinstance(session, dict) else getattr(session, "payment_intent", None)
        if not payment_intent:
            return {"ok": False, "manual": True, "error": "Sin payment_intent"}
        refund = await __import__("asyncio").to_thread(
            stripe.Refund.create,
            payment_intent=payment_intent,
            amount=int(round(amount * 100)),
        )
        rid = refund.get("id") if isinstance(refund, dict) else getattr(refund, "id", None)
        return {"ok": True, "provider": "stripe", "id": rid, "manual": False}
    except Exception as e:  # noqa: BLE001
        logger.exception("Stripe refund failed: %s", e)
        return {"ok": False, "manual": True, "error": str(e)}


async def _paypal_refund(order: dict, amount: float) -> dict:
    if not PAYPAL_CLIENT_ID or not PAYPAL_SECRET:
        return {"ok": False, "manual": True, "error": "PayPal no configurado"}
    session_id = order.get("payment_session_id")
    if not session_id:
        return {"ok": False, "manual": True, "error": "Sin orden PayPal"}
    try:
        auth = base64.b64encode(f"{PAYPAL_CLIENT_ID}:{PAYPAL_SECRET}".encode()).decode()
        async with httpx.AsyncClient(timeout=20.0) as cx:
            tok = await cx.post(
                f"{PAYPAL_API_BASE}/v1/oauth2/token",
                headers={"Authorization": f"Basic {auth}"},
                data={"grant_type": "client_credentials"},
            )
            token = tok.json()["access_token"]
            # find capture id from the order
            od = await cx.get(
                f"{PAYPAL_API_BASE}/v2/checkout/orders/{session_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            capture_id = None
            data = od.json()
            for pu in data.get("purchase_units", []):
                for cap in (pu.get("payments", {}) or {}).get("captures", []):
                    capture_id = cap.get("id")
                    break
            if not capture_id:
                return {"ok": False, "manual": True, "error": "Sin captura PayPal"}
            rf = await cx.post(
                f"{PAYPAL_API_BASE}/v2/payments/captures/{capture_id}/refund",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                json={"amount": {"value": f"{amount:.2f}", "currency_code": order.get("currency", "EUR")}},
            )
            if rf.status_code >= 300:
                return {"ok": False, "manual": True, "error": rf.text}
            return {"ok": True, "provider": "paypal", "id": rf.json().get("id"), "manual": False}
    except Exception as e:  # noqa: BLE001
        logger.exception("PayPal refund failed: %s", e)
        return {"ok": False, "manual": True, "error": str(e)}


# ---------- Refund an order ----------
def order_refund_breakdown(order: dict) -> dict:
    """Desglose para reembolsos: productos (base + IVA por %) y envío (base + IVA 21%)."""
    vat_groups: dict = {}
    products_ex = 0.0
    for it in order.get("items", []):
        rate = int(it.get("vat_rate", 0) or 0)
        qty = int(it.get("quantity", 1) or 1)
        unit_ex = it.get("unit_price_ex_vat")
        if unit_ex is None:
            # pedidos antiguos: derivar la base desde el precio cobrado
            unit_price = float(it.get("unit_price", 0) or 0)
            unit_ex = unit_price / (1 + rate / 100) if rate else unit_price
        line_ex = round(float(unit_ex) * qty, 2)
        products_ex += line_ex
        vat_groups[rate] = round(vat_groups.get(rate, 0.0) + round(line_ex * rate / 100, 2), 2)
    shipping_gross = float(order.get("shipping_cost", 0) or 0)
    ship_ex = order.get("shipping_cost_ex_vat")
    ship_vat = order.get("shipping_vat")
    if ship_ex is None or ship_vat is None:
        # pedidos antiguos sin desglose: el IVA del envío es siempre 21%
        ship_ex = round(shipping_gross / 1.21, 2)
        ship_vat = round(shipping_gross - ship_ex, 2)
    return {
        "products_ex_vat": round(products_ex, 2),
        "products_vat": [
            {"rate": r, "amount": a} for r, a in sorted(vat_groups.items()) if a > 0 or r > 0
        ],
        "products_vat_total": round(sum(vat_groups.values()), 2),
        "shipping_ex_vat": round(float(ship_ex or 0), 2),
        "shipping_vat": round(float(ship_vat or 0), 2),
        "shipping_vat_rate": 21,
        "shipping_gross": round(shipping_gross, 2),
    }


class RefundItemIn(BaseModel):
    sku: str
    quantity: int = Field(1, ge=1)
    amount: Optional[float] = None  # importe editable por línea (default: unit_price × qty)


class RefundIn(BaseModel):
    reason: str = Field(..., min_length=2)
    amount: Optional[float] = None  # override manual del total (legacy / edición admin)
    items: Optional[List[RefundItemIn]] = None  # None => todo el pedido
    include_shipping: Optional[bool] = None  # None => auto (solo si reembolso total)
    shipping_amount: Optional[float] = None  # importe de envío editable
    restock: bool = False
    notify: bool = True


def _compute_refund_scope(order: dict, payload: "RefundIn") -> dict:
    """Calcula líneas, envío y total del reembolso (estilo WooCommerce).

    - Sin items => reembolso de todo el pedido.
    - Con items => reembolso parcial por producto/cantidad; importes editables.
    - El envío solo se incluye automáticamente en reembolsos totales
      (el admin puede forzarlo/editar el importe manualmente).
    """
    order_items = order.get("items", [])
    lines = []
    if payload.items:
        by_sku = {}
        for it in order_items:
            by_sku.setdefault(it.get("sku"), it)
        for sel in payload.items:
            src = by_sku.get(sel.sku)
            if not src:
                raise HTTPException(status_code=400, detail=f"SKU {sel.sku} no pertenece al pedido")
            qty = max(1, min(int(sel.quantity), int(src.get("quantity", 1))))
            default_amount = round(float(src.get("unit_price", 0)) * qty, 2)
            amount = round(float(sel.amount), 2) if sel.amount is not None else default_amount
            lines.append({
                "sku": sel.sku,
                "name": src.get("name"),
                "variation_name": src.get("variation_name"),
                "quantity": qty,
                "unit_price": src.get("unit_price"),
                "amount": max(0.0, amount),
            })
        # ¿Cubre todo el pedido a cantidad completa?
        sel_by_sku = {ln["sku"]: ln["quantity"] for ln in lines}
        full_refund = all(
            sel_by_sku.get(it.get("sku"), 0) >= int(it.get("quantity", 1)) for it in order_items
        )
    else:
        for it in order_items:
            qty = int(it.get("quantity", 1))
            lines.append({
                "sku": it.get("sku"),
                "name": it.get("name"),
                "variation_name": it.get("variation_name"),
                "quantity": qty,
                "unit_price": it.get("unit_price"),
                "amount": round(float(it.get("unit_price", 0)) * qty, 2),
            })
        full_refund = True

    shipping_gross = float(order.get("shipping_cost", 0) or 0)
    include_shipping = payload.include_shipping if payload.include_shipping is not None else full_refund
    shipping_refund = 0.0
    if include_shipping and shipping_gross > 0:
        shipping_refund = (
            round(float(payload.shipping_amount), 2)
            if payload.shipping_amount is not None
            else shipping_gross
        )
        shipping_refund = max(0.0, min(shipping_refund, shipping_gross))

    lines_total = round(sum(ln["amount"] for ln in lines), 2)
    discount = float(order.get("discount", 0) or 0)
    total = round(lines_total + shipping_refund - (discount if full_refund else 0.0), 2)
    if payload.amount is not None:  # override manual del total por el admin
        total = round(float(payload.amount), 2)
    return {
        "lines": lines,
        "full_refund": full_refund,
        "shipping_refund": round(shipping_refund, 2),
        "lines_total": lines_total,
        "total": max(0.0, total),
    }


@router.post("/orders/{order_id}/refund", dependencies=[Depends(require_admin)])
async def refund_order(order_id: str, payload: RefundIn):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if order.get("status") == "Reembolsado":
        raise HTTPException(status_code=400, detail="Este pedido ya fue reembolsado")

    already_refunded = float(order.get("refunded_total", 0) or 0)
    remaining = round(float(order.get("total", 0)) - already_refunded, 2)
    if remaining <= 0:
        raise HTTPException(status_code=400, detail="No queda importe pendiente de reembolsar")

    scope = _compute_refund_scope(order, payload)
    amount = round(max(0.0, min(scope["total"], remaining)), 2)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="El importe del reembolso debe ser mayor que 0")

    # Attempt provider refund only for paid online orders
    result = {"ok": False, "manual": True, "error": None}
    if order.get("payment_status") in ("paid", "refunded") or already_refunded > 0:
        if order.get("payment_method") == "stripe":
            result = await _stripe_refund(order, amount)
        elif order.get("payment_method") == "paypal":
            result = await _paypal_refund(order, amount)
        else:
            result = {"ok": False, "manual": True, "error": "Método sin reembolso automático"}
    else:
        result = {"ok": False, "manual": True, "error": "Pedido no pagado online"}

    now = datetime.now(timezone.utc).isoformat()
    refund_doc = {
        "id": str(uuid.uuid4()),
        "order_id": order_id,
        "order_number": order.get("order_number"),
        "email": order.get("email"),
        "amount": amount,
        "reason": payload.reason,
        "items": scope["lines"],
        "full_refund": scope["full_refund"],
        "shipping_refund": scope["shipping_refund"],
        "provider": result.get("provider") or order.get("payment_method"),
        "provider_refund_id": result.get("id"),
        "manual": bool(result.get("manual")),
        "provider_ok": bool(result.get("ok")),
        "provider_error": result.get("error"),
        "breakdown": order_refund_breakdown(order),
        "created_at": now,
    }
    await db.refunds.insert_one(dict(refund_doc))
    refund_doc.pop("_id", None)

    new_refunded_total = round(already_refunded + amount, 2)
    fully_refunded = new_refunded_total >= round(float(order.get("total", 0)) - 0.01, 2)
    order_updates = {
        "refunded_total": new_refunded_total,
        "partially_refunded": not fully_refunded,
        "refund": {
            "amount": amount, "reason": payload.reason,
            "manual": refund_doc["manual"], "provider": refund_doc["provider"],
            "provider_refund_id": refund_doc["provider_refund_id"],
            "full_refund": scope["full_refund"],
            "created_at": now,
        },
        "updated_at": now,
    }
    if fully_refunded:
        order_updates["status"] = "Reembolsado"
        order_updates["payment_status"] = "refunded"
    # Marcar solicitud del cliente como procesada
    if (order.get("refund_request") or {}).get("status") == "pending":
        order_updates["refund_request"] = {**order["refund_request"], "status": "processed", "processed_at": now}
    await db.orders.update_one(
        {"id": order_id},
        {"$set": order_updates, "$push": {"refunds": refund_doc}},
    )

    email_id = None
    if payload.notify:
        email_id = await send_refund_notification(order, refund_doc)
    # Aviso interno a la empresa (siempre)
    import asyncio as _asyncio

    from core.mailer import send_company_refund_notice

    _asyncio.create_task(send_company_refund_notice(order, refund_doc))

    return {
        "ok": True,
        "refund": refund_doc,
        "refunded_total": new_refunded_total,
        "fully_refunded": fully_refunded,
        "provider_result": result,
        "email_sent": bool(email_id),
        "email_configured": email_id is not None,
    }


@router.get("/refunds", dependencies=[Depends(require_admin)])
async def list_refunds():
    refunds = await db.refunds.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"refunds": refunds, "total": len(refunds)}
