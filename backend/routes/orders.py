"""Shipping calc + order creation + admin management."""
import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel

from core.auth import get_current_user_optional, require_admin
from core.config import db
from core.mailer import send_company_order_notice, send_order_confirmation, send_custom_customer_message
from core.models import (
    Order,
    OrderCreate,
    OrderStatusUpdate,
    ShippingQuote,
)
from core.shipping import evaluate_shipping, get_shipping_config, shipping_with_vat, CONFIG_ID
from core.utils import parse_weight_from_format

logger = logging.getLogger("ecoandes.orders")

router = APIRouter(prefix="/api/orders", tags=["orders"])


class ShippingRequest(BaseModel):
    customer_type: str = "retail"
    country: str = "España"
    postal_code: str = ""
    subtotal_with_vat: float = 0.0
    subtotal_ex_vat: float = 0.0
    total_weight_kg: float = 0.0
    has_bulk: bool = False
    bulk_weight_kg: float = 0.0  # peso de ítems a granel (>1 kg/ud)
    # legacy fallback
    subtotal: Optional[float] = None


class CouponRequest(BaseModel):
    code: str
    email: Optional[str] = None
    subtotal: float
    customer_type: str = "retail"


async def _has_previous_order(email: str) -> bool:
    """True if this email already placed an order (i.e. not a first order)."""
    if not email:
        return False
    existing = await db.orders.find_one({"email": email.lower()}, {"_id": 1})
    return existing is not None


async def evaluate_coupon(code: str, email: Optional[str], subtotal: float) -> dict:
    """Validate a coupon (DB-driven, managed from the admin panel).

    Returns: {valid, discount, message, code}
    """
    from routes.coupons import evaluate_coupon_db

    return await evaluate_coupon_db(code, email, subtotal)


@router.post("/validate-coupon")
async def validate_coupon(payload: CouponRequest):
    return await evaluate_coupon(payload.code, payload.email, payload.subtotal)


@router.post("/shipping-quote")
async def shipping_quote(payload: ShippingRequest):
    cfg = await get_shipping_config()
    swv = payload.subtotal_with_vat or payload.subtotal or 0.0
    sev = payload.subtotal_ex_vat or payload.subtotal or 0.0
    return evaluate_shipping(
        cfg,
        customer_type=payload.customer_type,
        country=payload.country,
        postal_code=payload.postal_code,
        subtotal_with_vat=swv,
        subtotal_ex_vat=sev,
        total_weight_kg=payload.total_weight_kg,
        has_bulk=payload.has_bulk,
        bulk_weight_kg=payload.bulk_weight_kg,
    )


# ---------- Admin: shipping config ----------
@router.get("/shipping-config")
async def get_shipping_config_public():
    """Public read of shipping rules (zones/thresholds) for storefront info pages."""
    return await get_shipping_config()


@router.put("/shipping-config", dependencies=[Depends(require_admin)])
async def update_shipping_config(payload: dict):
    payload["id"] = CONFIG_ID
    await db.shipping_config.replace_one({"id": CONFIG_ID}, payload, upsert=True)
    return await get_shipping_config()


async def _register_buyer(order_doc: dict, user: Optional[dict]) -> None:
    """Track every purchasing email (registered or not) in the `buyers` collection.

    Classification: professional > registered > guest.
    """
    email = order_doc["email"]
    if user and user.get("role") in ("professional", "admin"):
        btype = "professional"
    elif order_doc.get("customer_type") == "professional":
        btype = "professional"
    elif order_doc.get("user_id"):
        btype = "registered"
    else:
        btype = "guest"
    name = order_doc.get("shipping_address", {}).get("full_name", "")
    now = order_doc["created_at"]
    await db.buyers.update_one(
        {"email": email},
        {
            "$set": {
                "email": email,
                "name": name or None,
                "type": btype,
                "registered": bool(order_doc.get("user_id")),
                "last_order_at": now,
                "last_order_number": order_doc.get("order_number"),
            },
            "$setOnInsert": {"first_order_at": now},
            "$inc": {"orders_count": 1, "total_spent": float(order_doc.get("total", 0.0))},
        },
        upsert=True,
    )


async def _next_order_number() -> str:
    counter = await db.counters.find_one_and_update(
        {"_id": "order"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True
    )
    if counter is None:
        await db.counters.update_one({"_id": "order"}, {"$set": {"seq": 1000}}, upsert=True)
        return "ECO-1000"
    seq = counter.get("seq", 1000)
    return f"ECO-{seq}"


def _allowed_payment_methods(delivery_method: str, is_pro: bool) -> list:
    """Payment methods allowed per delivery + role. No cash on delivery anywhere.

    - Particulares / invitados / profesionales NO verificados: solo Tarjeta (Stripe) y PayPal.
    - Profesionales verificados: los 4 métodos (Tarjeta, PayPal, Transferencia, Otro/Confirming).
    - Recogida en tienda: siempre pago online (Tarjeta / PayPal).
    """
    if delivery_method == "pickup":
        return ["stripe", "paypal"]  # pay now to collect
    if is_pro:
        # "other" = Confirming: disponible para clientes que llegan a un acuerdo con EcoAndes
        return ["stripe", "paypal", "transfer", "other"]
    return ["stripe", "paypal"]


@router.post("")
async def create_order(
    payload: OrderCreate,
    background: BackgroundTasks,
    user: Optional[dict] = Depends(get_current_user_optional),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="El carrito está vacío")

    # Recalculate prices from DB to prevent tampering (stored prices are SIN IVA)
    recomputed_items: List[dict] = []
    subtotal_ex_vat = 0.0
    vat_amount = 0.0
    total_weight_kg = 0.0
    bulk_weight_kg = 0.0
    has_bulk = False
    is_pro = payload.customer_type == "professional" and user and (
        user.get("role") == "admin"
        or (user.get("role") == "professional" and user.get("approved"))
    )
    # Tipo efectivo: un profesional NO verificado compra con condiciones de particular
    effective_type = "professional" if is_pro else "retail"
    for item in payload.items:
        product = await db.products.find_one({"id": item.product_id}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=400, detail=f"Producto no encontrado: {item.name}")
        vat_rate = int(product.get("vat_rate", 10) or 0)
        # resolve variation price + weight
        unit_ex_vat = product["price_professional"] if is_pro else product["price_retail"]
        weight_kg = 0.0
        variation_sku = item.sku
        if item.variation_name and product.get("variations"):
            for v in product["variations"]:
                if v["name"] == item.variation_name or v["sku"] == item.sku:
                    unit_ex_vat = v["price_professional"] if is_pro else v["price_retail"]
                    weight_kg = float(v.get("weight_kg", 0) or 0)
                    if weight_kg <= 0:
                        # peso del formato del producto (ej. "150 g", "1 kg")
                        weight_kg = parse_weight_from_format(v.get("name", ""))
                    variation_sku = v["sku"]
                    break
        if weight_kg <= 0:
            weight_kg = parse_weight_from_format(item.variation_name or product.get("name", ""))
        qty = max(1, int(item.quantity))
        line_ex_vat = round(unit_ex_vat * qty, 2)
        line_vat = round(line_ex_vat * vat_rate / 100, 2)
        subtotal_ex_vat += line_ex_vat
        vat_amount += line_vat
        total_weight_kg += weight_kg * qty
        if weight_kg > 1.0:
            has_bulk = True
            bulk_weight_kg += weight_kg * qty
        # unit price as charged/displayed: retail incl. VAT, pro ex VAT
        unit_charged = round(unit_ex_vat * (1 + vat_rate / 100), 2) if not is_pro else round(unit_ex_vat, 2)
        recomputed_items.append(
            {
                "product_id": product["id"],
                "sku": variation_sku or product.get("sku", ""),
                "name": product["name"],
                "variation_name": item.variation_name,
                "unit_price": unit_charged,
                "unit_price_ex_vat": round(unit_ex_vat, 2),
                "vat_rate": vat_rate,
                "weight_kg": weight_kg,
                "quantity": qty,
                "image_url": product.get("image_url", ""),
            }
        )

    subtotal_ex_vat = round(subtotal_ex_vat, 2)
    vat_amount = round(vat_amount, 2)
    subtotal_with_vat = round(subtotal_ex_vat + vat_amount, 2)
    # subtotal used for coupon + display follows role basis
    role_subtotal = subtotal_with_vat if not is_pro else subtotal_ex_vat

    # ---- Shipping via engine ----
    addr = payload.shipping_address
    cfg = await get_shipping_config()
    ship = evaluate_shipping(
        cfg,
        customer_type=effective_type,
        country=addr.country,
        postal_code=addr.postal_code,
        subtotal_with_vat=subtotal_with_vat,
        subtotal_ex_vat=subtotal_ex_vat,
        total_weight_kg=total_weight_kg,
        has_bulk=has_bulk,
        bulk_weight_kg=bulk_weight_kg,
    )
    shipping_status = ship.get("status", "ok")
    payment_method = payload.payment_method
    payment_status = "pending"
    order_status = "Pendiente"
    shipping_cost_ex_vat = 0.0
    shipping_vat = 0.0
    if payload.delivery_method == "pickup":
        # Click & Collect: no shipping cost
        shipping_cost = 0.0
        shipping_status = "ok"
    elif shipping_status == "blocked":
        raise HTTPException(status_code=400, detail=ship.get("message", "Envío no disponible para tu zona."))
    elif shipping_status == "manual_quote":
        # Canarias / fuera de península: pedido SIN pago, pendiente de presupuesto de portes.
        # La administración fijará los portes y EcoAndes enviará al cliente el total por email.
        shipping_cost = 0.0
        payment_method = "pending_quote"
        payment_status = "awaiting_quote"
        order_status = "Pendiente portes"
    else:
        shipping_cost = float(ship.get("shipping_cost") or 0.0)  # bruto (IVA 21% incl.)
        shipping_cost_ex_vat = float(ship.get("shipping_cost_ex_vat") or 0.0)
        shipping_vat = float(ship.get("shipping_vat") or 0.0)

    # Validate payment method against role + delivery (skipped for manual-quote orders)
    if shipping_status != "manual_quote":
        allowed_methods = _allowed_payment_methods(payload.delivery_method, bool(is_pro))
        if payment_method not in allowed_methods:
            raise HTTPException(
                status_code=400,
                detail=f"Método de pago no disponible para tu tipo de pedido. Permitidos: {', '.join(allowed_methods)}",
            )

    # Apply coupon server-side (re-validated against DB rules). Stacks with free shipping.
    discount = 0.0
    applied_coupon = None
    if payload.coupon_code:
        result = await evaluate_coupon(payload.coupon_code, payload.email, role_subtotal)
        if result["valid"]:
            discount = result["discount"]
            applied_coupon = result.get("code") or payload.coupon_code.strip().upper()
    total = round(subtotal_with_vat + shipping_cost - discount, 2)
    if total < 0:
        total = 0.0

    order_number = await _next_order_number()
    import uuid

    order_doc = {
        "id": str(uuid.uuid4()),
        "order_number": order_number,
        "email": payload.email.lower(),
        "user_id": user["id"] if user else None,
        "customer_type": effective_type,
        "items": recomputed_items,
        "shipping_address": payload.shipping_address.model_dump(),
        "billing_address": payload.billing_address.model_dump() if payload.billing_address else None,
        "subtotal": subtotal_with_vat,
        "subtotal_ex_vat": subtotal_ex_vat,
        "vat_amount": vat_amount,
        "shipping_cost": shipping_cost,
        "shipping_cost_ex_vat": round(shipping_cost_ex_vat, 2),
        "shipping_vat": round(shipping_vat, 2),
        "shipping_vat_rate": 21,
        "shipping_status": shipping_status,
        "shipping_zone": ship.get("zone"),
        "total_weight_kg": round(total_weight_kg, 3),
        "bulk_weight_kg": round(bulk_weight_kg, 3),
        "discount": discount,
        "coupon_code": applied_coupon,
        "total": total,
        "currency": "EUR",
        "status": order_status,
        "payment_method": payment_method,
        "delivery_method": payload.delivery_method,
        "payment_status": payment_status,
        "payment_session_id": None,
        "payment_id": None,
        "notes": payload.notes,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    # First-touch traffic attribution (connects orders with the analytics dashboard)
    acq_raw = payload.acquisition or {}
    from routes.analytics import classify_traffic

    acq_source, acq_medium, acq_ref_host = classify_traffic(
        acq_raw.get("referrer", "") or "",
        acq_raw.get("utm_source") or None,
        acq_raw.get("utm_medium") or None,
    )
    order_doc["acquisition"] = {
        "source": acq_source,
        "medium": acq_medium,
        "referrer_host": acq_ref_host,
        "utm_source": (acq_raw.get("utm_source") or "")[:100],
        "utm_campaign": (acq_raw.get("utm_campaign") or "")[:150],
        "landing_page": (acq_raw.get("landing_page") or "")[:300],
    }
    await db.orders.insert_one(order_doc)
    order_doc.pop("_id", None)
    # Recuperación de carritos: los carritos de este email quedan como convertidos
    try:
        from routes.carts import mark_carts_converted

        await mark_carts_converted(order_doc["email"], order_number)
    except Exception as e:  # noqa: BLE001
        logger.warning("mark_carts_converted failed: %s", e)
    # Register coupon redemption (usage counter for admin panel)
    if applied_coupon:
        from routes.coupons import register_coupon_use

        await register_coupon_use(applied_coupon)
    # Track buyer email (registered or guest) for first-order coupon control + marketing
    await _register_buyer(order_doc, user)
    # Send confirmation email in background (non-blocking, even for B2B bank transfers)
    background.add_task(send_order_confirmation, order_doc)
    # Aviso interno a la empresa: nuevo pedido recibido
    background.add_task(send_company_order_notice, order_doc)
    return order_doc


@router.get("/by-number/{order_number}")
async def get_by_number(order_number: str):
    order = await db.orders.find_one({"order_number": order_number}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return order


@router.get("/mine")
async def my_orders(user: dict = Depends(get_current_user_optional)):
    if not user:
        return []
    orders = (
        await db.orders.find({"user_id": user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(200)
    )
    return orders


def _assert_order_owner(order: dict, user: Optional[dict]):
    if not user:
        raise HTTPException(status_code=401, detail="Debes iniciar sesión")
    if user.get("role") == "admin":
        return
    if order.get("user_id") != user.get("id") and (order.get("email") or "").lower() != (user.get("email") or "").lower():
        raise HTTPException(status_code=403, detail="Este pedido no pertenece a tu cuenta")


class RefundRequestItemIn(BaseModel):
    sku: str
    quantity: int = 1


class RefundRequestIn(BaseModel):
    items: Optional[List[RefundRequestItemIn]] = None  # None / [] => todo el pedido
    full_order: bool = False
    reason: Optional[str] = None


@router.post("/{order_id}/refund-request")
async def create_refund_request(order_id: str, payload: RefundRequestIn, user: dict = Depends(get_current_user_optional)):
    """El cliente solicita el reembolso de 1, varios o todos los productos.

    No devuelve dinero automáticamente: la solicitud llega a EcoAndes (email + panel admin)
    y la administración la revisa y ejecuta.
    """
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    _assert_order_owner(order, user)
    if order.get("status") in ("Reembolsado", "Cancelado"):
        raise HTTPException(status_code=400, detail="Este pedido no admite solicitudes de reembolso")
    if (order.get("refund_request") or {}).get("status") == "pending":
        raise HTTPException(status_code=400, detail="Ya tienes una solicitud de reembolso pendiente para este pedido")

    full_order = payload.full_order or not payload.items
    req_items = []
    if not full_order:
        by_sku = {it.get("sku"): it for it in order.get("items", [])}
        for sel in payload.items:
            src = by_sku.get(sel.sku)
            if not src:
                raise HTTPException(status_code=400, detail=f"El producto {sel.sku} no pertenece al pedido")
            qty = max(1, min(int(sel.quantity), int(src.get("quantity", 1))))
            req_items.append({
                "sku": sel.sku,
                "name": src.get("name"),
                "variation_name": src.get("variation_name"),
                "quantity": qty,
                "unit_price": src.get("unit_price"),
            })
        if not req_items:
            raise HTTPException(status_code=400, detail="Selecciona al menos un producto")

    now = datetime.now(timezone.utc).isoformat()
    request_doc = {
        "full_order": full_order,
        "items": req_items,
        "reason": (payload.reason or "").strip()[:1000] or None,
        "status": "pending",
        "requested_at": now,
        "requested_by": user.get("email"),
    }
    await db.orders.update_one({"id": order_id}, {"$set": {"refund_request": request_doc, "updated_at": now}})
    # Aviso a la empresa (info@productosecoandes.com y direcciones configuradas)
    import asyncio as _asyncio
    from core.mailer import send_refund_request_notice
    _asyncio.create_task(send_refund_request_notice(order, request_doc))
    return {"ok": True, "refund_request": request_doc}


@router.post("/{order_id}/invoice-request")
async def create_invoice_request(order_id: str, user: dict = Depends(get_current_user_optional)):
    """Un profesional solicita la factura de su pedido. Aviso por email a la empresa."""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    _assert_order_owner(order, user)
    if user.get("role") not in ("professional", "admin"):
        raise HTTPException(status_code=403, detail="La solicitud de factura está disponible para cuentas profesionales")
    if (order.get("invoice_request") or {}).get("status") == "pending":
        raise HTTPException(status_code=400, detail="Ya has solicitado la factura de este pedido")

    now = datetime.now(timezone.utc).isoformat()
    request_doc = {"status": "pending", "requested_at": now, "requested_by": user.get("email")}
    await db.orders.update_one({"id": order_id}, {"$set": {"invoice_request": request_doc, "updated_at": now}})
    import asyncio as _asyncio
    from core.mailer import send_invoice_request_notice
    _asyncio.create_task(send_invoice_request_notice(order, user))
    return {"ok": True, "invoice_request": request_doc}


@router.get("/verify-address")
async def verify_address(
    street: str = "",
    city: str = "",
    postal_code: str = "",
    country: str = "España",
    province: str = "",
):
    """Verificación 'soft' de dirección vía OpenStreetMap/Nominatim.

    found=True (encontrada) · found=False (no encontrada, avisar) · found=None (servicio no disponible).
    Nunca bloquea la venta por sí sola.
    """
    import httpx

    params = {
        "format": "jsonv2",
        "limit": 1,
        "street": street.strip(),
        "city": city.strip(),
        "postalcode": postal_code.strip(),
        "country": country.strip() or "España",
    }
    headers = {"User-Agent": "EcoAndesShop/1.0 (info@productosecoandes.com)"}
    try:
        async with httpx.AsyncClient(timeout=6.0) as cx:
            r = await cx.get("https://nominatim.openstreetmap.org/search", params=params, headers=headers)
            if r.status_code != 200:
                return {"found": None}
            data = r.json()
            if data:
                return {"found": True, "display_name": data[0].get("display_name")}
            # segundo intento sin calle (al menos CP + ciudad correctos)
            params2 = {k: v for k, v in params.items() if k != "street"}
            r2 = await cx.get("https://nominatim.openstreetmap.org/search", params=params2, headers=headers)
            if r2.status_code == 200 and r2.json():
                return {"found": True, "partial": True, "display_name": r2.json()[0].get("display_name")}
            return {"found": False}
    except Exception:  # noqa: BLE001
        return {"found": None}


# ---------- Admin ----------
@router.get("/admin/list", dependencies=[Depends(require_admin)])
async def admin_list_orders(
    status: Optional[str] = None,
    customer_type: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    source: Optional[str] = None,
    registered: Optional[str] = None,
    limit: int = Query(200, le=1000),
):
    import re as _re

    query: dict = {}
    if status:
        query["status"] = status
    if customer_type:
        query["customer_type"] = customer_type
    if source:
        query["acquisition.source"] = source
    if registered == "1":
        query["user_id"] = {"$ne": None}
    elif registered == "0":
        query["user_id"] = None
    if date_from or date_to:
        rng: dict = {}
        if date_from:
            rng["$gte"] = f"{date_from}T00:00:00"
        if date_to:
            rng["$lte"] = f"{date_to}T23:59:59.999999+00:00"
        query["created_at"] = rng
    if search:
        rx = _re.compile(_re.escape(search.strip()), _re.IGNORECASE)
        query["$or"] = [
            {"order_number": rx},
            {"email": rx},
            {"shipping_address.full_name": rx},
        ]
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return orders


ORDER_STATUSES = ["Pendiente portes", "Pendiente", "Pagado", "Enviado", "Completado", "Cancelado"]


@router.get("/admin/status-counts", dependencies=[Depends(require_admin)])
async def admin_status_counts():
    """Counts per status for the WooCommerce-style quick filter tabs."""
    counts = {"all": await db.orders.count_documents({})}
    for s in ORDER_STATUSES:
        counts[s] = await db.orders.count_documents({"status": s})
    return counts


class BulkStatusUpdate(BaseModel):
    ids: List[str]
    status: str


@router.post("/admin/bulk-status", dependencies=[Depends(require_admin)])
async def admin_bulk_status(payload: BulkStatusUpdate):
    if payload.status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail="Estado no válido")
    if not payload.ids:
        raise HTTPException(status_code=400, detail="Sin pedidos seleccionados")
    result = await db.orders.update_many(
        {"id": {"$in": payload.ids}},
        {"$set": {"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"updated": result.modified_count}


@router.get("/admin/stats", dependencies=[Depends(require_admin)])
async def admin_stats():
    total = await db.orders.count_documents({})
    pending = await db.orders.count_documents({"status": "Pendiente"})
    paid = await db.orders.count_documents({"status": "Pagado"})
    shipped = await db.orders.count_documents({"status": "Enviado"})
    completed = await db.orders.count_documents({"status": "Completado"})
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]
    cursor = db.orders.aggregate(pipeline)
    revenue = 0.0
    async for r in cursor:
        revenue = r.get("total", 0.0)
    customers = await db.users.count_documents({})
    products_count = await db.products.count_documents({"active": True})
    return {
        "orders_total": total,
        "orders_pending": pending,
        "orders_paid": paid,
        "orders_shipped": shipped,
        "orders_completed": completed,
        "revenue": round(revenue, 2),
        "customers": customers,
        "products": products_count,
    }


@router.get("/admin/buyers", dependencies=[Depends(require_admin)])
async def admin_buyers(
    type: Optional[str] = None,
    limit: int = Query(500, le=2000),
):
    """All purchasing emails (registered or guest), with classification + totals."""
    query: dict = {}
    if type in ("guest", "registered", "professional"):
        query["type"] = type
    buyers = (
        await db.buyers.find(query, {"_id": 0})
        .sort("last_order_at", -1)
        .limit(limit)
        .to_list(limit)
    )
    stats = {
        "total": await db.buyers.count_documents({}),
        "guest": await db.buyers.count_documents({"type": "guest"}),
        "registered": await db.buyers.count_documents({"type": "registered"}),
        "professional": await db.buyers.count_documents({"type": "professional"}),
    }
    return {"buyers": buyers, "stats": stats}


@router.delete("/admin/buyers/{email}", dependencies=[Depends(require_admin)])
async def delete_buyer(email: str):
    """Elimina un comprador del CRM (no borra sus pedidos, solo la ficha CRM)."""
    res = await db.buyers.delete_one({"email": email.lower()})
    if res.deleted_count == 0:
        res = await db.buyers.delete_one({"email": email})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Comprador no encontrado")
    return {"ok": True, "deleted": email}


@router.get("/admin/{order_id}", dependencies=[Depends(require_admin)])
async def admin_get_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return order


@router.patch("/admin/{order_id}/status", dependencies=[Depends(require_admin)])
async def admin_update_status(order_id: str, payload: OrderStatusUpdate):
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": payload.status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return order


class AdminShippingUpdate(BaseModel):
    shipping_cost_ex_vat: float  # base imponible del transporte fijada por administración


@router.patch("/admin/{order_id}/shipping", dependencies=[Depends(require_admin)])
async def admin_set_shipping(order_id: str, payload: AdminShippingUpdate):
    """Fija los portes de un pedido pendiente de presupuesto (Canarias / fuera de península).

    La administración introduce la base imponible; se aplica siempre IVA 21% al transporte
    y se recalcula el total. Después, EcoAndes envía manualmente al cliente el correo con
    el importe total para que realice el pago.
    """
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if payload.shipping_cost_ex_vat < 0:
        raise HTTPException(status_code=400, detail="El importe de portes no puede ser negativo")

    parts = shipping_with_vat(payload.shipping_cost_ex_vat)
    new_total = round(
        float(order.get("subtotal", 0.0)) + parts["gross"] - float(order.get("discount", 0.0)), 2
    )
    if new_total < 0:
        new_total = 0.0
    now = datetime.now(timezone.utc).isoformat()
    updates = {
        "shipping_cost": parts["gross"],
        "shipping_cost_ex_vat": parts["ex_vat"],
        "shipping_vat": parts["vat"],
        "shipping_vat_rate": 21,
        "shipping_status": "quoted",
        "total": new_total,
        "updated_at": now,
    }
    # El pedido pasa a Pendiente (ya se puede gestionar el pago)
    if order.get("status") == "Pendiente portes":
        updates["status"] = "Pendiente"
    if order.get("payment_status") == "awaiting_quote":
        updates["payment_status"] = "pending"
    await db.orders.update_one({"id": order_id}, {"$set": updates})
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


class AdminCustomerMessage(BaseModel):
    subject: Optional[str] = None
    message: str


@router.post("/admin/{order_id}/message", dependencies=[Depends(require_admin)])
async def admin_send_customer_message(order_id: str, payload: AdminCustomerMessage):
    """Mensaje personalizado de EcoAndes enviado directamente al correo del cliente.

    Usa la plantilla corporativa. Queda registrado en el pedido (customer_messages).
    """
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    msg = (payload.message or "").strip()
    if not msg:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío")
    if len(msg) > 5000:
        raise HTTPException(status_code=400, detail="Mensaje demasiado largo (máx. 5000 caracteres)")
    email_id = await send_custom_customer_message(order, payload.subject, msg)
    entry = {
        "subject": (payload.subject or "").strip() or None,
        "message": msg,
        "sent": bool(email_id),
        "email_id": email_id,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.orders.update_one({"id": order_id}, {"$push": {"customer_messages": entry}})
    return {"sent": bool(email_id), "entry": entry}
