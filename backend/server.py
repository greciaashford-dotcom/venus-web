"""Ecoandes FastAPI main application."""
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

# Ensure local imports work when supervisor starts us with CWD=/app/backend
sys.path.insert(0, str(Path(__file__).resolve().parent))

from core.auth import hash_password  # noqa: E402
from core.config import ADMIN_EMAIL, ADMIN_PASSWORD, db  # noqa: E402
from routes.admin import router as admin_router  # noqa: E402
from routes.analytics import router as analytics_router  # noqa: E402
from routes.carousel import router as carousel_router, seed_carousel_if_empty  # noqa: E402
from routes.legal import router as legal_router, seed_legal_if_empty  # noqa: E402
from routes.seo import router as seo_router  # noqa: E402
from routes.auth import router as auth_router  # noqa: E402
from routes.community import router as community_router  # noqa: E402
from routes.files import router as files_router  # noqa: E402
from routes.hero import router as hero_router, seed_hero_if_empty  # noqa: E402
from routes.orders import router as orders_router  # noqa: E402
from routes.payments import router as payments_router, webhook_router  # noqa: E402
from routes.products import router as products_router  # noqa: E402
from routes.reviews import router as reviews_router  # noqa: E402
from routes.whatsapp import router as whatsapp_router  # noqa: E402
from routes.coupons import router as coupons_router, seed_default_coupon  # noqa: E402
from routes.refunds import router as refunds_router, seed_refund_reasons  # noqa: E402
from routes.carts import router as carts_router  # noqa: E402
from routes.recipes import router as recipes_router  # noqa: E402
from routes.blog import router as blog_router, seed_blog_posts  # noqa: E402
from routes.site_images import router as site_images_router  # noqa: E402
from core.wp_importer import parse_wordpress_xml  # noqa: E402

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("ecoandes")

app = FastAPI(title="Ecoandes API", version="1.0.0")


@app.get("/api")
async def api_root():
    return {"message": "Ecoandes API", "status": "ok"}


@app.get("/api/health")
async def health():
    return {"status": "ok", "ts": datetime.now(timezone.utc).isoformat()}


app.include_router(auth_router)
app.include_router(products_router)
app.include_router(reviews_router)
app.include_router(orders_router)
app.include_router(admin_router)
app.include_router(payments_router)
app.include_router(webhook_router)
app.include_router(files_router)
app.include_router(hero_router)
app.include_router(community_router)
app.include_router(whatsapp_router)
app.include_router(coupons_router)
app.include_router(refunds_router)
app.include_router(carts_router)
app.include_router(recipes_router)
app.include_router(blog_router)
app.include_router(site_images_router)
app.include_router(analytics_router)
app.include_router(carousel_router)
app.include_router(legal_router)
app.include_router(seo_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _ensure_admin():
    existing = await db.users.find_one({"role": "admin"}, {"_id": 0})
    if existing:
        return
    import uuid

    doc = {
        "id": str(uuid.uuid4()),
        "email": ADMIN_EMAIL.lower(),
        "password_hash": hash_password(ADMIN_PASSWORD),
        "first_name": "Admin",
        "last_name": "Ecoandes",
        "role": "admin",
        "company": "Ecoandes",
        "tax_id": None,
        "phone": None,
        "approved": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    logger.info("Admin user created: %s", ADMIN_EMAIL)


async def _ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.products.create_index("sku", unique=True)
    await db.products.create_index("slug", unique=True)
    await db.orders.create_index("order_number", unique=True)
    await db.orders.create_index("email")
    await db.payment_transactions.create_index("session_id")
    await db.reviews.create_index([("product_id", 1), ("user_id", 1)], unique=True)
    await db.reviews.create_index("product_id")
    await db.visits.create_index("date")
    await db.visits.create_index("session_id")
    await db.geoip.create_index("ip", unique=True)


async def _seed_products_if_empty():
    count = await db.products.count_documents({})
    if count > 0:
        logger.info("Products already seeded (%d). Skipping.", count)
        return
    xml_path = Path(__file__).resolve().parent / "ecoandes.xml"
    if not xml_path.exists():
        logger.warning("XML not found at %s; skipping seed.", xml_path)
        return
    logger.info("Seeding products from WordPress XML...")
    products = parse_wordpress_xml(xml_path)
    if not products:
        logger.warning("No products parsed from XML.")
        return
    import uuid

    now = datetime.now(timezone.utc).isoformat()
    batch = []
    featured_assigned = 0
    for p in products:
        p["id"] = str(uuid.uuid4())
        p["created_at"] = now
        p["updated_at"] = now
        if featured_assigned < 8 and p["price_retail"] > 0:
            p["featured"] = True
            featured_assigned += 1
        batch.append(p)
    # insert in one go (ignore duplicates if any)
    try:
        await db.products.insert_many(batch, ordered=False)
    except Exception as e:
        logger.warning("Some products could not be inserted: %s", e)
    logger.info("Seeded %d products.", len(batch))


# ---------------------------------------------------------------------------
# Catalog auto-reconciliation lives in core/catalog_sync.py (shared with the
# admin endpoint). Excel files travel in the repo; DB self-heals on startup.
# ---------------------------------------------------------------------------
from core.catalog_sync import reconcile_catalog_if_needed  # noqa: E402


@app.on_event("startup")
async def on_startup():
    await _ensure_indexes()
    await _ensure_admin()
    try:
        from core.storage import init_storage

        init_storage()
    except Exception as e:  # noqa: BLE001
        logger.error("Object storage init failed: %s", e)
    # run seeding + translation generation in background so startup isn't blocked
    asyncio.create_task(_seed_and_translate())
    # scheduler: reporte diario 08:00 Madrid + análisis SEO semanal
    from core.scheduler import scheduler_loop
    asyncio.create_task(scheduler_loop())


async def _seed_and_translate():
    # 1º: restaurar el snapshot del sitio versionado en el repo (si la BD es nueva)
    try:
        from core.snapshot_seed import apply_site_snapshot
        await apply_site_snapshot()
    except Exception as e:  # noqa: BLE001
        logger.error("Site snapshot restore failed: %s", e)
    await _seed_products_if_empty()
    # Reconcile catalog with the repo Excel files (self-healing on new environments)
    try:
        await reconcile_catalog_if_needed()
    except Exception as e:  # noqa: BLE001
        logger.error("Catalog auto-reconciliation failed: %s", e)
    try:
        await seed_hero_if_empty()
    except Exception as e:  # noqa: BLE001
        logger.error("Hero seed failed: %s", e)
    try:
        await seed_carousel_if_empty()
    except Exception as e:  # noqa: BLE001
        logger.error("Carousel seed failed: %s", e)
    try:
        await seed_legal_if_empty()
    except Exception as e:  # noqa: BLE001
        logger.error("Legal pages seed failed: %s", e)
    try:
        from core.enrichment_seed import apply_enrichment_seed
        await apply_enrichment_seed()
    except Exception as e:  # noqa: BLE001
        logger.error("Enrichment seed failed: %s", e)
    try:
        await seed_default_coupon()
    except Exception as e:  # noqa: BLE001
        logger.error("Coupon seed failed: %s", e)
    try:
        await seed_refund_reasons()
        await seed_blog_posts()
    except Exception as e:  # noqa: BLE001
        logger.error("Refund reasons seed failed: %s", e)
    # Translations + SEO live in Mongo and involve LLM calls. They run in a
    # SEPARATE PROCESS so they can never block/slow down the API event loop.
    try:
        from core.jobs import content_jobs_status, spawn_content_generation
        from core.translator import has_complete_seo, has_complete_translations

        needs_translations = not await has_complete_translations()
        needs_seo = not await has_complete_seo()
        jobs = await content_jobs_status()
        if jobs.get("running"):
            logger.info("Content generation already running in worker process. Skipping.")
        elif needs_translations or needs_seo:
            logger.info(
                "Spawning content worker (translations=%s, seo=%s)...",
                needs_translations, needs_seo,
            )
            spawn_content_generation(translations=needs_translations, seo=needs_seo)
        else:
            logger.info("Translations + SEO complete. No content worker needed.")
    except Exception as e:  # noqa: BLE001
        logger.error("Content bootstrap failed: %s", e)


@app.on_event("shutdown")
async def on_shutdown():
    from core.config import client

    client.close()
