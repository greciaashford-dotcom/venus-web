"""Siembra de reseñas para todos los productos activos.

Reglas (confirmadas por el cliente):
- Mínimo 11 reseñas por producto (aquí 11–19, aleatorio).
- ~97% de las reseñas son de 5 estrellas y el resto de 4, repartidas
  indistintamente (algunos productos quedan con todas 5★).
- Actualiza `web_rating` y `web_reviews` de cada producto para que las
  cartas muestren estrellas y nº de valoraciones.

Idempotente: si un producto ya tiene >= 11 reseñas, no añade más
(solo recalcula web_rating/web_reviews).

Uso: python -m scripts.seed_product_reviews
"""
import asyncio
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.config import db  # noqa: E402

FIRST_NAMES = [
    "María", "Carmen", "Lucía", "Paula", "Laura", "Marta", "Sara", "Ana", "Elena", "Claudia",
    "Isabel", "Nuria", "Cristina", "Patricia", "Raquel", "Silvia", "Rocío", "Beatriz", "Alba", "Irene",
    "Javier", "Carlos", "David", "Daniel", "Pablo", "Álvaro", "Sergio", "Jorge", "Miguel", "Rubén",
    "Antonio", "Manuel", "Francisco", "José", "Luis", "Alejandro", "Adrián", "Diego", "Iván", "Óscar",
    "Marina", "Teresa", "Pilar", "Sofía", "Andrea", "Natalia", "Eva", "Julia", "Mercedes", "Gloria",
]
LAST_INITIALS = list("ABCDEFGHJLMNPRSTV")

COMMENTS_5 = [
    "Calidad excelente, se nota que es ecológico de verdad. Repetiré seguro.",
    "Muy buen producto y envío rapidísimo. Encantada con la compra.",
    "Sabor auténtico y frescura increíble. De lo mejor que he probado.",
    "Llegó perfectamente embalado y antes de lo esperado. Recomendado 100%.",
    "Relación calidad-precio inmejorable. Ya es un básico en mi despensa.",
    "Producto BIO de primera. Se nota la diferencia con los del supermercado.",
    "Compro habitualmente y nunca decepciona. Atención al cliente estupenda.",
    "Perfecto para mis recetas. Textura y aroma de gran calidad.",
    "Excelente. El formato grande sale genial de precio.",
    "Muy contenta, el producto es tal cual se describe. Volveré a comprar.",
    "Rapidez, buen precio y calidad ecológica certificada. ¿Qué más se puede pedir?",
    "Impresionante frescura. Se ha convertido en imprescindible en casa.",
    "Todo perfecto: pedido fácil, envío rápido y producto de gran calidad.",
    "De las mejores tiendas ecológicas online. Producto top.",
    "Sabor espectacular y muy buena conservación. Repetiré sin duda.",
    "Ideal para mi dieta saludable. Calidad excelente.",
    "El mejor que he encontrado online, y he probado unos cuantos.",
    "Producto fresco, natural y con un sabor buenísimo.",
]
COMMENTS_4 = [
    "Muy buen producto, aunque el envío tardó un día más de lo previsto.",
    "Buena calidad. El envase podría ser algo más resistente, pero el contenido perfecto.",
    "Contento con la compra. Buen sabor, repetiré.",
    "Buen producto ecológico, precio razonable.",
    "Cumple lo que promete. Volveré a pedir.",
    "Buena relación calidad-precio. Recomendable.",
]

MIN_REVIEWS = 11
MAX_REVIEWS = 19
P_FIVE_STARS = 0.97


def _random_date_iso() -> str:
    days_ago = random.randint(2, 420)
    dt = datetime.now(timezone.utc) - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))
    return dt.isoformat()


def _make_review(product_id: str) -> dict:
    rating = 5 if random.random() < P_FIVE_STARS else 4
    name = f"{random.choice(FIRST_NAMES)} {random.choice(LAST_INITIALS)}."
    # ~85% con comentario, el resto solo estrellas
    comment = None
    if random.random() < 0.85:
        comment = random.choice(COMMENTS_5 if rating == 5 else COMMENTS_4)
    created = _random_date_iso()
    return {
        "id": str(uuid.uuid4()),
        "product_id": product_id,
        "user_id": f"seed-{uuid.uuid4().hex[:12]}",
        "user_name": name,
        "rating": rating,
        "comment": comment,
        "created_at": created,
        "updated_at": created,
        "seeded": True,
    }


async def recompute_product_rating(product_id: str):
    total = 0
    weighted = 0
    async for row in db.reviews.aggregate([
        {"$match": {"product_id": product_id}},
        {"$group": {"_id": "$rating", "count": {"$sum": 1}}},
    ]):
        total += int(row["count"])
        weighted += int(row["_id"]) * int(row["count"])
    avg = round(weighted / total, 1) if total else 0.0
    await db.products.update_one(
        {"id": product_id}, {"$set": {"web_rating": avg, "web_reviews": total}}
    )
    return avg, total


async def main():
    seeded_products = 0
    seeded_reviews = 0
    all_five = 0
    async for p in db.products.find({"active": True}, {"id": 1, "name": 1}):
        pid = p["id"]
        existing = await db.reviews.count_documents({"product_id": pid})
        if existing < MIN_REVIEWS:
            n = random.randint(MIN_REVIEWS, MAX_REVIEWS) - existing
            docs = [_make_review(pid) for _ in range(n)]
            await db.reviews.insert_many(docs)
            seeded_products += 1
            seeded_reviews += n
        avg, total = await recompute_product_rating(pid)
        if avg == 5.0:
            all_five += 1
    print(f"Productos con reseñas nuevas: {seeded_products}")
    print(f"Reseñas creadas: {seeded_reviews}")
    print(f"Productos con 5.0 exacto: {all_five}")
    # distribución global
    dist = {}
    async for row in db.reviews.aggregate([{"$group": {"_id": "$rating", "count": {"$sum": 1}}}]):
        dist[int(row["_id"])] = int(row["count"])
    total = sum(dist.values()) or 1
    print("Distribución global:", {k: f"{v} ({v*100/total:.1f}%)" for k, v in sorted(dist.items(), reverse=True)})


if __name__ == "__main__":
    asyncio.run(main())
