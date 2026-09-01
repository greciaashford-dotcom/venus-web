"""Stripe + PayPal checkout and webhooks."""
import base64
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel

from core.config import (
    PAYPAL_API_BASE,
    PAYPAL_CLIENT_ID,
    PAYPAL_SECRET,
    STRIPE_API_KEY,
    db,
)
from core.mailer import send_order_confirmation, send_pickup_notification, send_company_order_notice

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/payments", tags=["payments"])


# ---------- Stripe ----------
class StripeCheckoutRequest(BaseModel):
    order_id: str
    origin_url: str


def _build_stripe(request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)


@router.post("/stripe/checkout")
async def stripe_checkout(payload: StripeCheckoutRequest, request: Request):
    from emergentintegrations.payments.stripe.checkout import CheckoutSessionRequest

    order = await db.orders.find_one({"id": payload.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Pedido ya pagado")
    if order.get("payment_status") == "awaiting_quote":
        raise HTTPException(
            status_code=400,
            detail="Este pedido está pendiente de presupuesto de portes. Recibirás un correo con el importe total para realizar el pago.",
        )

    amount = float(order["total"])
    currency = (order.get("currency") or "EUR").lower()
    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/pago/success?session_id={{CHECKOUT_SESSION_ID}}&order_number={order['order_number']}"
    cancel_url = f"{origin}/checkout?cancelled=1"

    stripe_checkout_obj = _build_stripe(request)
    checkout_req = CheckoutSessionRequest(
        amount=amount,
        currency=currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "order_id": order["id"],
            "order_number": order["order_number"],
            "email": order["email"],
        },
    )
    session = await stripe_checkout_obj.create_checkout_session(checkout_req)

    # create payment_transactions entry
    import uuid

    now = datetime.now(timezone.utc).isoformat()
    await db.payment_transactions.insert_one(
        {
            "id": str(uuid.uuid4()),
            "order_id": order["id"],
            "session_id": session.session_id,
            "provider": "stripe",
            "amount": amount,
            "currency": currency.upper(),
            "email": order["email"],
            "metadata": {
                "order_number": order["order_number"],
            },
            "payment_status": "initiated",
            "status": "initiated",
            "processed": False,
            "created_at": now,
            "updated_at": now,
        }
    )
    await db.orders.update_one(
        {"id": order["id"]},
        {
            "$set": {
                "payment_session_id": session.session_id,
                "payment_method": "stripe",
                "updated_at": now,
            }
        },
    )
    return {"url": session.url, "session_id": session.session_id}


async def _mark_paid_if_needed(order_id: str, session_id: str, background: BackgroundTasks) -> dict:
    # Avoid double processing
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    if tx.get("processed"):
        order = await db.orders.find_one({"id": order_id}, {"_id": 0})
        return order
    now = datetime.now(timezone.utc).isoformat()
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {
            "$set": {
                "payment_status": "paid",
                "status": "complete",
                "processed": True,
                "updated_at": now,
            }
        },
    )
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": {
                "payment_status": "paid",
                "status": "Pagado",
                "updated_at": now,
            }
        },
    )
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if order:
        background.add_task(send_order_confirmation, order)
        background.add_task(send_company_order_notice, order)
        if order.get("delivery_method") == "pickup":
            background.add_task(send_pickup_notification, order)
    return order


@router.get("/stripe/status/{session_id}")
async def stripe_status(session_id: str, request: Request, background: BackgroundTasks):
    # Retrieve directly via the official Stripe SDK (the wrapper's pydantic model
    # rejects StripeObject metadata under pydantic v2 strict dict validation).
    import asyncio as _asyncio

    import stripe as _stripe

    _stripe.api_key = STRIPE_API_KEY
    try:
        session = await _asyncio.to_thread(_stripe.checkout.Session.retrieve, session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al consultar Stripe: {e}")

    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
    order_id = tx["order_id"]

    payment_status = getattr(session, "payment_status", "") or ""
    sess_status = getattr(session, "status", "") or ""
    if payment_status == "paid" or sess_status == "complete":
        await _mark_paid_if_needed(order_id, session_id, background)
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return {
        "payment_status": payment_status,
        "status": sess_status,
        "amount_total": getattr(session, "amount_total", 0),
        "currency": getattr(session, "currency", "eur"),
        "order": order,
    }


# Stripe webhook exposed separately (not under /api/payments prefix in playbook, but we keep /api/webhook/stripe)
webhook_router = APIRouter(tags=["webhooks"])


@webhook_router.post("/api/webhook/stripe")
async def stripe_webhook(request: Request, background: BackgroundTasks):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    host_url = str(request.base_url).rstrip("/")
    stripe_checkout_obj = StripeCheckout(
        api_key=STRIPE_API_KEY, webhook_url=f"{host_url}/api/webhook/stripe"
    )
    try:
        event = await stripe_checkout_obj.handle_webhook(body, sig)
    except Exception as e:
        logger.warning("Stripe webhook verification failed: %s", e)
        return {"received": False}
    if event.payment_status == "paid" and event.session_id:
        tx = await db.payment_transactions.find_one({"session_id": event.session_id}, {"_id": 0})
        if tx:
            await _mark_paid_if_needed(tx["order_id"], event.session_id, background)
    return {"received": True}


# ---------- PayPal ----------
class PayPalCreateRequest(BaseModel):
    order_id: str
    origin_url: str


async def _paypal_access_token() -> str:
    if not PAYPAL_CLIENT_ID or not PAYPAL_SECRET:
        raise HTTPException(status_code=400, detail="PayPal no está configurado")
    auth = base64.b64encode(f"{PAYPAL_CLIENT_ID}:{PAYPAL_SECRET}".encode()).decode()
    async with httpx.AsyncClient(timeout=20.0) as cx:
        resp = await cx.post(
            f"{PAYPAL_API_BASE}/v1/oauth2/token",
            headers={"Authorization": f"Basic {auth}"},
            data={"grant_type": "client_credentials"},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail=f"PayPal auth error: {resp.text}")
    return resp.json()["access_token"]


@router.post("/paypal/create")
async def paypal_create(payload: PayPalCreateRequest):
    order = await db.orders.find_one({"id": payload.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Pedido ya pagado")
    if order.get("payment_status") == "awaiting_quote":
        raise HTTPException(
            status_code=400,
            detail="Este pedido está pendiente de presupuesto de portes. Recibirás un correo con el importe total para realizar el pago.",
        )

    token = await _paypal_access_token()
    amount = float(order["total"])
    body = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": order["order_number"],
                "amount": {"currency_code": order.get("currency", "EUR"), "value": f"{amount:.2f}"},
            }
        ],
        "application_context": {
            "return_url": f"{payload.origin_url.rstrip('/')}/pago/success?provider=paypal&order_number={order['order_number']}",
            "cancel_url": f"{payload.origin_url.rstrip('/')}/checkout?cancelled=1",
            "brand_name": "Ecoandes",
            "user_action": "PAY_NOW",
        },
    }
    async with httpx.AsyncClient(timeout=20.0) as cx:
        resp = await cx.post(
            f"{PAYPAL_API_BASE}/v2/checkout/orders",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=body,
        )
    if resp.status_code >= 300:
        raise HTTPException(status_code=500, detail=f"PayPal error: {resp.text}")
    data = resp.json()
    import uuid

    now = datetime.now(timezone.utc).isoformat()
    await db.payment_transactions.insert_one(
        {
            "id": str(uuid.uuid4()),
            "order_id": order["id"],
            "session_id": data["id"],
            "provider": "paypal",
            "amount": amount,
            "currency": order.get("currency", "EUR"),
            "email": order["email"],
            "metadata": {"order_number": order["order_number"]},
            "payment_status": "initiated",
            "status": "initiated",
            "processed": False,
            "created_at": now,
            "updated_at": now,
        }
    )
    await db.orders.update_one(
        {"id": order["id"]},
        {
            "$set": {
                "payment_method": "paypal",
                "payment_session_id": data["id"],
                "updated_at": now,
            }
        },
    )
    approve_link = ""
    for link in data.get("links", []):
        if link.get("rel") == "approve":
            approve_link = link["href"]
            break
    return {"paypal_order_id": data["id"], "approve_url": approve_link}


class PayPalCaptureRequest(BaseModel):
    paypal_order_id: str


@router.post("/paypal/capture")
async def paypal_capture(payload: PayPalCaptureRequest, background: BackgroundTasks):
    token = await _paypal_access_token()
    async with httpx.AsyncClient(timeout=20.0) as cx:
        resp = await cx.post(
            f"{PAYPAL_API_BASE}/v2/checkout/orders/{payload.paypal_order_id}/capture",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
    if resp.status_code >= 300:
        raise HTTPException(status_code=500, detail=f"PayPal capture error: {resp.text}")
    data = resp.json()
    tx = await db.payment_transactions.find_one({"session_id": payload.paypal_order_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transacción no encontrada")
    if data.get("status") == "COMPLETED":
        await _mark_paid_if_needed(tx["order_id"], payload.paypal_order_id, background)
    order = await db.orders.find_one({"id": tx["order_id"]}, {"_id": 0})
    return {"status": data.get("status"), "order": order}
