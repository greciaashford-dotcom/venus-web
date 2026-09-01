"""Fix bulk pricing: for every variation with weight_kg > 1, the Excel value is
€/kg (not the total). Multiply it by the format weight to get the real bag
price. Idempotent: sets `bulk_price_fixed=True` on the variation and stores
the original €/kg in `unit_price_kg` / `unit_price_kg_professional` so we never
double-multiply.
"""
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.config import db  # noqa: E402


def _round(v: float) -> float:
    return round(float(v) + 1e-9, 2)


async def main():
    now = datetime.now(timezone.utc).isoformat()
    total_products = 0
    fixed_variations = 0
    touched_products = 0
    skipped_variations = 0

    async for prod in db.products.find({}, {"_id": 0}):
        total_products += 1
        variations = prod.get("variations") or []
        changed = False

        for v in variations:
            w = float(v.get("weight_kg") or 0)
            if w <= 1.0:
                continue  # only bulk formats (>1kg) were priced per-kg
            if v.get("bulk_price_fixed"):
                skipped_variations += 1
                continue
            pr = float(v.get("price_retail") or 0)
            pp = float(v.get("price_professional") or 0)
            if pr <= 0 and pp <= 0:
                continue
            # backup unit prices
            v["unit_price_kg"] = _round(pr)
            v["unit_price_kg_professional"] = _round(pp)
            v["price_retail"] = _round(pr * w)
            v["price_professional"] = _round(pp * w)
            v["bulk_price_fixed"] = True
            fixed_variations += 1
            changed = True

        if not changed:
            continue

        # Recompute product base prices as the minimum of available variations
        retail_opts = [float(m["price_retail"]) for m in variations
                       if m.get("available_retail", True) and float(m.get("price_retail") or 0) > 0]
        pro_opts = [float(m["price_professional"]) for m in variations
                    if m.get("available_professional", True) and float(m.get("price_professional") or 0) > 0]
        new_retail = min(retail_opts) if retail_opts else prod.get("price_retail", 0)
        new_pro = min(pro_opts) if pro_opts else prod.get("price_professional", 0)

        await db.products.update_one(
            {"id": prod["id"]},
            {"$set": {
                "variations": variations,
                "price_retail": _round(new_retail),
                "price_professional": _round(new_pro),
                "updated_at": now,
            }},
        )
        touched_products += 1

    print("=" * 60)
    print("Bulk pricing fix — summary")
    print("=" * 60)
    print(f"Products scanned          : {total_products}")
    print(f"Products updated          : {touched_products}")
    print(f"Bulk variations fixed     : {fixed_variations}")
    print(f"Variations already fixed  : {skipped_variations}")


if __name__ == "__main__":
    asyncio.run(main())
