"""Test Stripe + Resend with the new client-provided keys."""
import asyncio
import json
import sys

import httpx

BASE = "http://localhost:8001"


async def test_stripe():
    print("\n--- STRIPE TEST ---")
    async with httpx.AsyncClient(timeout=30) as cx:
        # Use existing order ECO-1
        r = await cx.get(f"{BASE}/api/orders/by-number/ECO-1")
        if r.status_code != 200:
            print("FAIL: cannot fetch order ECO-1:", r.text[:200])
            return False
        order = r.json()
        r = await cx.post(
            f"{BASE}/api/payments/stripe/checkout",
            json={"order_id": order["id"], "origin_url": "https://eco-andes-test.preview.emergentagent.com"},
        )
        if r.status_code != 200:
            print("FAIL: stripe checkout:", r.status_code, r.text[:400])
            return False
        data = r.json()
        ok = bool(data.get("url", "").startswith("https://checkout.stripe.com"))
        print("Checkout session created:", data.get("session_id"))
        print("Checkout URL valid:", ok, "->", data.get("url", "")[:80])
        # Also check status endpoint works
        r2 = await cx.get(f"{BASE}/api/payments/stripe/status/{data['session_id']}")
        print("Status endpoint:", r2.status_code, json.dumps({k: r2.json().get(k) for k in ("payment_status", "status")}) if r2.status_code == 200 else r2.text[:200])
        return ok and r2.status_code == 200


async def test_resend():
    print("\n--- RESEND TEST ---")
    sys.path.insert(0, "/app/backend")
    from core.mailer import send_order_confirmation
    from core.config import RESEND_API_KEY
    print("Key loaded:", RESEND_API_KEY[:8] + "...")
    order = {
        "order_number": "TEST-EMAIL-1",
        "email": "delivered@resend.dev",  # Resend's official test inbox
        "items": [{"name": "Cacao nibs - BIO", "variation_name": "150 g", "sku": "CACN150", "quantity": 1, "unit_price": 8.0}],
        "subtotal": 8.0,
        "shipping_cost": 4.99,
        "total": 12.99,
        "shipping_address": {"full_name": "Test Resend", "street": "Calle Mayor 1", "postal_code": "28001", "city": "Madrid", "province": "Madrid", "country": "España"},
    }
    email_id = await send_order_confirmation(order)
    print("Email sent, Resend id:", email_id)
    return bool(email_id)


async def main():
    s = await test_stripe()
    r = await test_resend()
    print("\n=== RESULTS ===")
    print("Stripe:", "PASS" if s else "FAIL")
    print("Resend:", "PASS" if r else "FAIL")


asyncio.run(main())
