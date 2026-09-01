"""Product reviews & ratings (registered customers only)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from core.auth import get_current_user, get_current_user_optional
from core.config import db
from core.models import Review, ReviewCreate

router = APIRouter(prefix="/api/products", tags=["reviews"])


def _reviewer_name(user: dict) -> str:
    first = (user.get("first_name") or "").strip()
    last = (user.get("last_name") or "").strip()
    if first and last:
        return f"{first} {last[0]}."
    return first or (user.get("email", "Cliente").split("@")[0])


async def _summary(product_id: str) -> dict:
    pipeline = [
        {"$match": {"product_id": product_id}},
        {
            "$group": {
                "_id": "$rating",
                "count": {"$sum": 1},
            }
        },
    ]
    distribution = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
    total = 0
    weighted = 0
    async for row in db.reviews.aggregate(pipeline):
        rating = int(row["_id"])
        count = int(row["count"])
        distribution[rating] = count
        total += count
        weighted += rating * count
    average = round(weighted / total, 2) if total else 0.0
    return {"average": average, "count": total, "distribution": distribution}


async def _sync_product_rating(product_id: str):
    """Mantiene web_rating / web_reviews del producto al día (para las cartas)."""
    s = await _summary(product_id)
    await db.products.update_one(
        {"id": product_id},
        {"$set": {"web_rating": round(s["average"], 1), "web_reviews": s["count"]}},
    )


@router.get("/{product_id}/reviews")
async def list_reviews(product_id: str, user: dict = Depends(get_current_user_optional)):
    items = (
        await db.reviews.find({"product_id": product_id}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(200)
    )
    my_review = None
    if user:
        my_review = next((r for r in items if r["user_id"] == user["id"]), None)
    return {
        "summary": await _summary(product_id),
        "items": items,
        "my_review": my_review,
    }


@router.post("/{product_id}/reviews", response_model=Review)
async def create_review(
    product_id: str,
    payload: ReviewCreate,
    user: dict = Depends(get_current_user),
):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    now = datetime.now(timezone.utc).isoformat()
    existing = await db.reviews.find_one(
        {"product_id": product_id, "user_id": user["id"]}, {"_id": 0}
    )
    if existing:
        # Update the user's existing review (one review per customer per product)
        await db.reviews.update_one(
            {"id": existing["id"]},
            {
                "$set": {
                    "rating": payload.rating,
                    "comment": (payload.comment or "").strip() or None,
                    "updated_at": now,
                }
            },
        )
        await _sync_product_rating(product_id)
        return await db.reviews.find_one({"id": existing["id"]}, {"_id": 0})

    review = Review(
        product_id=product_id,
        user_id=user["id"],
        user_name=_reviewer_name(user),
        rating=payload.rating,
        comment=(payload.comment or "").strip() or None,
    )
    await db.reviews.insert_one(review.model_dump())
    await _sync_product_rating(product_id)
    return review.model_dump()
