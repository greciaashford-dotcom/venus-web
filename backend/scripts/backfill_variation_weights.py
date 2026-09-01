"""Backfill weight_kg en variaciones de producto a partir del nombre del formato.

Rellena weight_kg cuando falta (None/0) parseando el nombre de la variación
("150 g", "1 kg", "5 kg", "500 ml"...). Idempotente: solo escribe si hay cambios.

Uso: python -m scripts.backfill_variation_weights
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.config import db  # noqa: E402
from core.utils import parse_weight_from_format  # noqa: E402


async def main():
    updated_products = 0
    updated_variations = 0
    unresolved = []
    async for p in db.products.find({}, {"id": 1, "name": 1, "variations": 1}):
        variations = p.get("variations") or []
        changed = False
        for v in variations:
            current = v.get("weight_kg")
            try:
                current_f = float(current) if current is not None else 0.0
            except (TypeError, ValueError):
                current_f = 0.0
            if current_f > 0:
                continue
            parsed = parse_weight_from_format(v.get("name", ""))
            if parsed <= 0:
                parsed = parse_weight_from_format(p.get("name", ""))
            if parsed > 0:
                v["weight_kg"] = parsed
                v["is_bulk"] = parsed > 1.0
                changed = True
                updated_variations += 1
            else:
                unresolved.append(f"{p.get('name','?')} · {v.get('name','?')}")
        if changed:
            await db.products.update_one({"id": p["id"]}, {"$set": {"variations": variations}})
            updated_products += 1
    print(f"Productos actualizados: {updated_products}")
    print(f"Variaciones con peso rellenado: {updated_variations}")
    if unresolved:
        print(f"Variaciones sin peso deducible ({len(unresolved)}):")
        for u in unresolved[:20]:
            print("  -", u)


if __name__ == "__main__":
    asyncio.run(main())
