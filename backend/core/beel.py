"""Validación de NIF/CIF/NIE españoles.

1. Validación local por algoritmo oficial (dígito/letra de control) — detecta errores de formato al instante.
2. Verificación contra la API de BeeL (censo AEAT): POST https://app.beel.es/api/v1/nif/validate
   -> VALID / INVALID / PENDING.  Auth: Bearer BEEL_API_KEY.

Flujo de registro profesional:
  - checksum inválido            -> failed  (registro no completado automáticamente)
  - BeeL VALID                   -> auto    (cuenta profesional aprobada automáticamente)
  - BeeL INVALID                 -> failed
  - BeeL PENDING / error de API  -> manual  (revisión manual en 24 h)
"""
import logging
import os
import re

import httpx

logger = logging.getLogger("ecoandes.beel")

BEEL_API_URL = os.environ.get("BEEL_API_URL", "https://app.beel.es/api/v1")
BEEL_API_KEY = os.environ.get("BEEL_API_KEY", "")

_NIF_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE"
_CIF_CONTROL_LETTERS = "JABCDEFGHI"
_CIF_LETTER_ONLY = set("KPQSNWR")
_CIF_DIGIT_ONLY = set("ABEH")


def normalize_tax_id(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", (value or "").upper())


def _valid_dni(v: str) -> bool:
    if not re.fullmatch(r"\d{8}[A-Z]", v):
        return False
    return v[-1] == _NIF_LETTERS[int(v[:8]) % 23]


def _valid_nie(v: str) -> bool:
    if not re.fullmatch(r"[XYZ]\d{7}[A-Z]", v):
        return False
    num = str("XYZ".index(v[0])) + v[1:8]
    return v[-1] == _NIF_LETTERS[int(num) % 23]


def _valid_cif(v: str) -> bool:
    if not re.fullmatch(r"[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]", v):
        return False
    digits = v[1:8]
    even_sum = sum(int(d) for d in digits[1::2])
    odd_sum = 0
    for d in digits[0::2]:
        dd = int(d) * 2
        odd_sum += dd // 10 + dd % 10
    control = (10 - (even_sum + odd_sum) % 10) % 10
    last = v[-1]
    first = v[0]
    if first in _CIF_LETTER_ONLY:
        return last == _CIF_CONTROL_LETTERS[control]
    if first in _CIF_DIGIT_ONLY:
        return last == str(control)
    return last == str(control) or last == _CIF_CONTROL_LETTERS[control]


def checksum_valid(tax_id: str) -> bool:
    """Validación local (algoritmo oficial) de DNI, NIE o CIF."""
    v = normalize_tax_id(tax_id)
    return _valid_dni(v) or _valid_nie(v) or _valid_cif(v)


async def beel_validate(tax_id: str) -> dict:
    """Consulta la API de BeeL. Devuelve {status: VALID|INVALID|PENDING|ERROR, name, raw}."""
    v = normalize_tax_id(tax_id)
    if not BEEL_API_KEY:
        return {"status": "ERROR", "detail": "BEEL_API_KEY no configurada"}
    try:
        async with httpx.AsyncClient(timeout=12.0) as cx:
            r = await cx.post(
                f"{BEEL_API_URL}/nif/validate",
                headers={"Authorization": f"Bearer {BEEL_API_KEY}",
                         "Content-Type": "application/json"},
                json={"nif": v},
            )
        data = {}
        try:
            data = r.json()
        except Exception:  # noqa: BLE001
            pass
        if r.status_code in (200, 201):
            inner = data.get("data") if isinstance(data.get("data"), dict) else {}
            status = str(
                inner.get("status") or data.get("status") or data.get("result")
                or data.get("validation_status") or ""
            ).upper()
            if not status and "valid" in inner:
                status = "VALID" if inner.get("valid") else "INVALID"
            if status in ("VALID", "INVALID", "PENDING"):
                name = (inner.get("name") or inner.get("fiscal_name")
                        or data.get("name") or data.get("fiscal_name"))
                return {"status": status, "name": name, "raw": data}
            # respuesta 200 sin status reconocible
            return {"status": "PENDING", "raw": data}
        if r.status_code in (400, 404, 422):
            # BeeL rechaza el identificador -> inválido
            return {"status": "INVALID", "raw": data}
        logger.warning("BeeL API %s: %s", r.status_code, str(data)[:300])
        return {"status": "ERROR", "detail": f"HTTP {r.status_code}", "raw": data}
    except Exception as e:  # noqa: BLE001
        logger.warning("BeeL API unreachable: %s", e)
        return {"status": "ERROR", "detail": str(e)}


async def verify_professional_tax_id(tax_id: str) -> dict:
    """Verificación completa. Devuelve {verification: auto|manual|failed, source, company_name}."""
    v = normalize_tax_id(tax_id)
    if not v or not checksum_valid(v):
        return {"verification": "failed", "source": "checksum", "tax_id": v}
    result = await beel_validate(v)
    status = result.get("status")
    if status == "VALID":
        return {"verification": "auto", "source": "beel", "tax_id": v,
                "company_name": result.get("name")}
    if status == "INVALID":
        return {"verification": "failed", "source": "beel", "tax_id": v}
    # PENDING o error de API -> revisión manual (checksum ya era válido)
    return {"verification": "manual", "source": "beel-" + str(status).lower(), "tax_id": v}
