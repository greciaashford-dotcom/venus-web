"""Utility helpers."""
import re
import unicodedata


def slugify(value: str) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^a-zA-Z0-9\s-]", "", value).strip().lower()
    value = re.sub(r"[\s_-]+", "-", value)
    return value.strip("-") or "producto"


# NOTE: legacy calc_shipping removed — the active shipping engine is core/shipping.py


def parse_weight_from_format(name: str) -> float:
    """Deriva el peso (kg) desde el nombre del formato: '150 g', '1 kg', '5 kg', '500 ml'."""
    if not name:
        return 0.0
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|gr|gramos|ml|l|litros?)\b", str(name).lower())
    if not m:
        return 0.0
    try:
        val = float(m.group(1).replace(",", "."))
    except ValueError:
        return 0.0
    unit = m.group(2)
    if unit.startswith("k") or unit.startswith("l"):
        return round(val, 3)  # kg / litros (≈1 kg por litro)
    return round(val / 1000, 3)  # g / gr / ml
