"""Shipping engine v2: zone detection + rule evaluation (user_type + zone + weight).

Business rules (confirmed by client, Aug 2026 — Excel portes_b2b.xlsx):

PARTICULARES (retail / B2C) — ES + PT peninsular + Baleares:
  - Envío gratis desde 50 € (subtotal CON IVA).
  - Por debajo: escala por peso del Excel (misma que profesionales).

PROFESIONALES (B2B verificados) — ES + PT peninsular + Baleares:
  - Por debajo de 150 € (base imponible, SIN IVA): escala por peso del Excel
    aplicada al PESO TOTAL del pedido (todos los productos).
  - Desde 150 € (base imponible):
      * Sin formatos a granel (>1 kg/ud): envío gratis total.
      * Con formatos a granel (>1 kg/ud): los formatos de hasta 1 kg van con
        portes GRATUITOS y los formatos a granel pagan la escala del Excel
        calculada SOLO con el peso de esos ítems (bulk_weight_kg).

ESCALA POR PESO (Excel portes_b2b.xlsx, importes SIN IVA):
  0–2 kg: 4 · 2–5: 6 · 5–10: 10 · 10–15: 15 · 15–20: 20 ·
  20–25: 23 · 25–30: 26 · 30–35: 29 · >35 kg: 29 (porte máximo)

IVA DEL ENVÍO: siempre 21 % (se cobra el bruto = neto × 1,21).

CANARIAS / CEUTA / MELILLA y cualquier destino fuera de la España/Portugal
peninsular + Baleares (retail Y profesional): presupuesto manual. Los portes
se calculan según peso, volumen y destino, y el pedido queda pendiente de
verificación por la administración de la tienda (sin pago hasta presupuesto).

Zone detection: país + prefijo de código postal (07 Baleares incluido;
35/38 Canarias; 51 Ceuta; 52 Melilla).
"""
from typing import Optional

from core.config import db

CONFIG_ID = "shipping_config"

SHIPPING_VAT_RATE = 21  # IVA del transporte: siempre 21 %

# Escala del Excel portes_b2b.xlsx (fees SIN IVA)
EXCEL_WEIGHT_SCALE = [
    {"from_kg": 0, "to_kg": 2, "fee": 4.0},
    {"from_kg": 2, "to_kg": 5, "fee": 6.0},
    {"from_kg": 5, "to_kg": 10, "fee": 10.0},
    {"from_kg": 10, "to_kg": 15, "fee": 15.0},
    {"from_kg": 15, "to_kg": 20, "fee": 20.0},
    {"from_kg": 20, "to_kg": 25, "fee": 23.0},
    {"from_kg": 25, "to_kg": 30, "fee": 26.0},
    {"from_kg": 30, "to_kg": 35, "fee": 29.0},
]

MANUAL_QUOTE_MESSAGE = (
    "Los portes para Canarias y destinos fuera de la España/Portugal peninsular y Baleares "
    "se calculan según peso, volumen y destino. Tu pedido quedará pendiente de presupuesto de "
    "portes: la administración lo revisará y te enviaremos un correo con el importe total "
    "(portes incluidos) para realizar el pago."
)

RETAIL_FLAT_FEE = 4.12  # neto; con IVA 21% = 4,99 € (porte único particulares < 50 €)

DEFAULT_SHIPPING_CONFIG = {
    "id": CONFIG_ID,
    "version": 3,
    "currency": "EUR",
    "weight_unit": "kg",
    "shipping_vat_rate": SHIPPING_VAT_RATE,
    "special_postal_prefixes": {
        "canarias": ["35", "38"],
        "ceuta": ["51"],
        "melilla": ["52"],
        "baleares": ["07"],
    },
    "rules": {
        "retail": {
            # v3: particulares SIN tabla por peso — porte único 4,12 € (neto) < 50 €, gratis >= 50 €
            "ES_PT_BAL": {
                "method": "flat_with_free_threshold",
                "free_amount_basis": "total_with_vat",
                "free_min_amount": 50.0,
                "free_operator": ">=",
                "flat_fee": RETAIL_FLAT_FEE,
            },
            "CANARIAS_EU": {
                "method": "manual_quote",
                "message": MANUAL_QUOTE_MESSAGE,
            },
        },
        "professional": {
            "ES_PT_BAL": {
                "method": "weight_scale_conditional_free",
                "free_amount_basis": "base_without_vat",
                "free_min_amount": 150.0,
                "free_operator": ">=",
                "weight_scale": EXCEL_WEIGHT_SCALE,
                "over_scale_fee": 29.0,  # porte máximo (>35 kg)
            },
            "CANARIAS_EU": {
                "method": "manual_quote",
                "message": MANUAL_QUOTE_MESSAGE,
            },
        },
    },
}


_COUNTRY_MAP = {
    "espana": "ES", "españa": "ES", "spain": "ES", "es": "ES",
    "portugal": "PT", "pt": "PT",
    "francia": "FR", "france": "FR", "fr": "FR",
}


def country_to_code(country: str) -> str:
    c = (country or "").strip().lower()
    return _COUNTRY_MAP.get(c, (c[:2].upper() if len(c) >= 2 else "XX"))


def detect_zone(country: str, postal_code: str, is_retail: bool, cfg: dict) -> str:
    """ES/PT peninsular + Baleares -> ES_PT_BAL. Todo lo demás -> CANARIAS_EU (manual)."""
    cc = country_to_code(country)
    pp = (str(postal_code or "")).strip()[:2]
    prefixes = cfg.get("special_postal_prefixes", {})
    canarias = set(prefixes.get("canarias", []))
    ceuta = set(prefixes.get("ceuta", []))
    melilla = set(prefixes.get("melilla", []))
    special_es = canarias | ceuta | melilla

    if cc == "ES":
        if pp in special_es:
            return "CANARIAS_EU"
        return "ES_PT_BAL"  # mainland + Baleares (07)
    if cc == "PT":
        return "ES_PT_BAL"  # peninsular
    # Francia y cualquier otro país: presupuesto manual (retail y profesional)
    return "CANARIAS_EU"


def _weight_tier(scale: list, weight: float) -> Optional[dict]:
    """from-exclusive / to-inclusive; weight 0 falls in first tier."""
    for t in scale:
        lo = float(t["from_kg"])
        hi = float(t["to_kg"])
        if weight <= 0:
            return scale[0]
        if lo < weight <= hi:
            return t
    return None


def shipping_with_vat(net_fee: float, vat_rate: int = SHIPPING_VAT_RATE) -> dict:
    """Given a net shipping fee, return {ex_vat, vat, gross} at the given rate (21%)."""
    net = round(float(net_fee), 2)
    vat = round(net * vat_rate / 100, 2)
    return {"ex_vat": net, "vat": vat, "gross": round(net + vat, 2)}


async def get_shipping_config() -> dict:
    cfg = await db.shipping_config.find_one({"id": CONFIG_ID}, {"_id": 0})
    if not cfg or int(cfg.get("version", 1)) < 3:
        # migración -> v3: retail con porte único 4,12 € (sin tabla por peso); pro mantiene Excel
        await db.shipping_config.replace_one(
            {"id": CONFIG_ID}, {**DEFAULT_SHIPPING_CONFIG}, upsert=True
        )
        cfg = {**DEFAULT_SHIPPING_CONFIG}
    return cfg


def evaluate_shipping(
    cfg: dict,
    *,
    customer_type: str,
    country: str,
    postal_code: str,
    subtotal_with_vat: float,
    subtotal_ex_vat: float,
    total_weight_kg: float,
    has_bulk: bool = False,  # kept for API compatibility
    bulk_weight_kg: float = 0.0,  # peso total de ítems a granel (>1 kg por unidad)
) -> dict:
    is_retail = customer_type != "professional"
    user_key = "retail" if is_retail else "professional"
    zone = detect_zone(country, postal_code, is_retail, cfg)
    role_subtotal = round(subtotal_with_vat if is_retail else subtotal_ex_vat, 2)
    vat_rate = int(cfg.get("shipping_vat_rate", SHIPPING_VAT_RATE))

    base = {
        "zone": zone,
        "customer_type": customer_type,
        "subtotal": role_subtotal,
        "subtotal_with_vat": round(subtotal_with_vat, 2),
        "subtotal_ex_vat": round(subtotal_ex_vat, 2),
        "total_weight_kg": round(total_weight_kg, 3),
        "shipping_cost": 0.0,           # bruto (IVA 21% incl.) — importe cobrado
        "shipping_cost_ex_vat": 0.0,    # base imponible del envío
        "shipping_vat": 0.0,            # IVA del envío (21%)
        "shipping_vat_rate": vat_rate,
        "total": role_subtotal,
        "free_shipping": False,
        "bulk_only_shipping": False,
        "free_shipping_threshold": 0.0,
        "remaining_for_free_shipping": 0.0,
        "status": "ok",
        "method": None,
        "amount_basis": None,
        "message": "",
    }

    rule = (cfg.get("rules", {}).get(user_key, {}) or {}).get(zone)
    if not rule:
        base["status"] = "manual_quote"
        base["method"] = "manual_quote"
        base["shipping_cost"] = None
        base["shipping_cost_ex_vat"] = None
        base["shipping_vat"] = None
        base["total"] = None
        base["message"] = MANUAL_QUOTE_MESSAGE
        return base

    method = rule["method"]
    base["method"] = method

    if method == "blocked":
        base["status"] = "blocked"
        base["shipping_cost"] = None
        base["shipping_cost_ex_vat"] = None
        base["shipping_vat"] = None
        base["total"] = None
        base["message"] = rule.get("message", "Envío no disponible para tu zona.")
        return base

    if method == "manual_quote":
        base["status"] = "manual_quote"
        base["shipping_cost"] = None
        base["shipping_cost_ex_vat"] = None
        base["shipping_vat"] = None
        base["total"] = None
        base["message"] = rule.get("message", MANUAL_QUOTE_MESSAGE)
        return base

    if method in ("weight_scale_conditional_free", "flat_with_free_threshold"):
        basis_key = rule.get("free_amount_basis") or rule.get("amount_basis") or "total_with_vat"
        amount = subtotal_with_vat if basis_key == "total_with_vat" else subtotal_ex_vat
        free_min = float(rule.get("free_min_amount") or rule.get("free_threshold") or 0.0)
        operator = rule.get("free_operator", ">=")
        base["amount_basis"] = basis_key
        base["free_shipping_threshold"] = free_min

        def _scale_fee(weight: float):
            """Devuelve (net_fee, tier_dict) según la escala del Excel, o (None, None) si
            no hay tramo ni porte máximo definidos (-> presupuesto manual)."""
            scale = rule.get("weight_scale", EXCEL_WEIGHT_SCALE)
            tier = _weight_tier(scale, weight)
            if tier is None:
                over_fee = rule.get("over_scale_fee")
                if over_fee is None:
                    return None, None
                fee = float(over_fee)
                return fee, {"from_kg": 35, "to_kg": None, "fee": fee, "max": True}
            fee = float(tier["fee"])
            return fee, {"from_kg": tier["from_kg"], "to_kg": tier["to_kg"], "fee": fee}

        def _manual_fallback():
            base["status"] = "manual_quote"
            base["shipping_cost"] = None
            base["shipping_cost_ex_vat"] = None
            base["shipping_vat"] = None
            base["total"] = None
            base["message"] = "Transporte calculado manualmente según peso."
            return base

        is_free = amount > free_min if operator == ">" else amount >= free_min
        bulk_w = max(0.0, float(bulk_weight_kg or 0.0))

        if is_free and method == "weight_scale_conditional_free" and bulk_w > 0:
            # ≥150 € base imponible PERO hay formatos a granel (>1 kg/ud):
            # los formatos ≤1 kg van gratis y los a granel pagan la escala del
            # Excel calculada SOLO con su peso.
            net_fee, tier_info = _scale_fee(bulk_w)
            if net_fee is None:
                return _manual_fallback()
            base["weight_tier"] = tier_info
            base["bulk_only_shipping"] = True
            base["bulk_weight_kg"] = round(bulk_w, 3)
            base["charged_weight_kg"] = round(bulk_w, 3)
            base["remaining_for_free_shipping"] = 0.0
            base["message"] = (
                "Portes gratuitos en formatos de hasta 1 kg. Los formatos a granel "
                "(más de 1 kg) llevan portes calculados según su peso."
            )
            parts = shipping_with_vat(net_fee, vat_rate)
            base["shipping_cost_ex_vat"] = parts["ex_vat"]
            base["shipping_vat"] = parts["vat"]
            base["shipping_cost"] = parts["gross"]
            base["total"] = round(role_subtotal + parts["gross"], 2)
            return base

        if is_free:
            base["shipping_cost"] = 0.0
            base["free_shipping"] = True
            base["remaining_for_free_shipping"] = 0.0
            base["total"] = round(role_subtotal, 2)
            base["message"] = "Portes gratuitos."
            return base

        base["remaining_for_free_shipping"] = round(max(0.0, free_min - amount), 2)

        # fee (net) from weight scale (Excel) or flat fee
        if method == "flat_with_free_threshold":
            net_fee = float(rule.get("flat_fee", 0.0))
        else:
            net_fee, tier_info = _scale_fee(total_weight_kg)
            if net_fee is None:
                return _manual_fallback()
            base["weight_tier"] = tier_info
            base["charged_weight_kg"] = round(total_weight_kg, 3)

        parts = shipping_with_vat(net_fee, vat_rate)
        base["shipping_cost_ex_vat"] = parts["ex_vat"]
        base["shipping_vat"] = parts["vat"]
        base["shipping_cost"] = parts["gross"]
        base["total"] = round(role_subtotal + parts["gross"], 2)
        return base

    # unknown method fallback
    base["status"] = "manual_quote"
    base["shipping_cost"] = None
    base["shipping_cost_ex_vat"] = None
    base["shipping_vat"] = None
    base["total"] = None
    base["message"] = "Coste de transporte pendiente."
    return base
