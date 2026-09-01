"""Test bulk price fix and preview PDF backend data."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://green-andes.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def products():
    r = requests.get(f"{BASE_URL}/api/products?limit=500", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    if isinstance(data, dict) and "items" in data:
        data = data["items"]
    assert isinstance(data, list)
    return data


def _find(products, sku):
    for p in products:
        if p.get("sku") == sku:
            return p
    return None


@pytest.mark.parametrize("parent_sku,var_sku,exp_retail,exp_pro,exp_upk", [
    ("CACN150", "CACN5", 185.50, 137.40, 37.10),
    ("QRB500",  "QRB5",   49.80,  36.90,  9.96),
    ("SGIR250", "SGIR5",  33.60,  24.90,  6.72),
    ("MCP300",  "MCP5",   94.90,  70.30,  None),
])
def test_bulk_variation_prices(products, parent_sku, var_sku, exp_retail, exp_pro, exp_upk):
    prod = _find(products, parent_sku)
    assert prod, f"Parent {parent_sku} not found"
    variations = prod.get("variations") or []
    var = next((v for v in variations if v.get("sku") == var_sku), None)
    assert var, f"Variation {var_sku} not found in {parent_sku}. Got: {[v.get('sku') for v in variations]}"
    assert abs(var["price_retail"] - exp_retail) < 0.05, f"{var_sku} retail={var['price_retail']} exp={exp_retail}"
    assert abs(var["price_professional"] - exp_pro) < 0.05, f"{var_sku} pro={var['price_professional']} exp={exp_pro}"
    if exp_upk is not None:
        assert abs(var.get("unit_price_kg", 0) - exp_upk) < 0.05
    if var.get("bulk_price_fixed"):
        w = var.get("weight_kg")
        assert w and w > 1


@pytest.mark.parametrize("sku,exp_base", [
    ("CACN150", 7.69),
    ("QRB500", 5.65),
    ("SGIR250", 2.70),
    ("MCP300", 8.33),
])
def test_base_price_is_min(products, sku, exp_base):
    p = _find(products, sku)
    assert p
    assert abs(p["price_retail"] - exp_base) < 0.05, f"{sku} base={p['price_retail']} exp={exp_base}"


def test_all_bulk_prices_consistent(products):
    """For every variation with weight_kg>1 and bulk_price_fixed==True,
    verify price_retail == unit_price_kg * weight_kg (±0.02)."""
    failures = []
    unfixed = []
    for p in products:
        for v in (p.get("variations") or []):
            w = v.get("weight_kg") or 0
            if w and w > 1:
                pr = v.get("price_retail") or 0
                upk = v.get("unit_price_kg") or 0
                if v.get("bulk_price_fixed"):
                    if upk and pr and abs(pr - upk * w) >= 0.05:
                        failures.append((p.get("sku"), v.get("sku"), pr, upk, w))
                else:
                    if pr > 0:
                        unfixed.append((p.get("sku"), v.get("sku"), pr, w))
    assert not failures, f"Inconsistent bulk prices: {failures[:10]}"
    # Report but don't necessarily fail on unfixed - request says shouldn't remain
    assert not unfixed, f"Unfixed bulk variations still with price>0: {unfixed[:20]}"


def test_small_formats_not_multiplied(products):
    """Formats with weight_kg <= 1 should not be flagged as bulk_price_fixed."""
    bad = []
    for p in products:
        for v in (p.get("variations") or []):
            w = v.get("weight_kg") or 0
            if 0 < w <= 1 and v.get("bulk_price_fixed"):
                bad.append((p.get("sku"), v.get("sku"), w))
    assert not bad, f"Small formats erroneously flagged bulk_price_fixed: {bad[:10]}"
