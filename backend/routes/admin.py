"""Admin-only: users, price import, product seeding, media upload."""
from datetime import datetime, timezone
from io import BytesIO
from typing import List, Optional

import time
import cloudinary
import cloudinary.utils
import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile

from core.auth import require_admin
from core.config import (
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    CLOUDINARY_CLOUD_NAME,
    db,
)
from core.models import ImportSummary, UserPublic, UserUpdate

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------- Catalog sync (Excel del repo -> MongoDB) ----------
@router.post("/catalog/sync", dependencies=[Depends(require_admin)])
async def catalog_sync(force: bool = True):
    """Reconcile the DB catalog with the Excel files that travel in the repo.
    Runs in background; poll GET /api/admin/catalog/sync-status. After the
    import, missing translations + SEO are regenerated automatically."""
    import asyncio

    from core.catalog_sync import SYNC_STATUS, reconcile_catalog_if_needed

    if SYNC_STATUS.get("running"):
        return {"started": False, "reason": "already_running", "status": SYNC_STATUS}

    async def _run():
        try:
            result = await reconcile_catalog_if_needed(force=force)
            if result.get("ran"):
                # New/updated products may need translations + SEO. Spawn in a
                # separate process so LLM calls never block the API.
                from core.jobs import spawn_content_generation
                spawn_content_generation(translations=True, seo=True)
        except Exception:  # noqa: BLE001
            pass  # error is recorded in SYNC_STATUS

    asyncio.create_task(_run())
    return {"started": True, "status": SYNC_STATUS}


@router.get("/catalog/sync-status", dependencies=[Depends(require_admin)])
async def catalog_sync_status():
    from core.catalog_sync import SYNC_STATUS, get_sync_marker

    marker = await get_sync_marker()
    total = await db.products.count_documents({})
    return {"status": SYNC_STATUS, "marker": marker, "products_in_db": total}


if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True,
    )


# ---------- Users (Customers) ----------
@router.get("/users", dependencies=[Depends(require_admin)])
async def list_users(role: Optional[str] = None):
    query: dict = {}
    if role:
        query["role"] = role
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return users


@router.patch("/users/{user_id}", dependencies=[Depends(require_admin)])
async def update_user(user_id: str, payload: UserUpdate):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="Sin cambios")
    res = await db.users.update_one({"id": user_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return user


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_admin)):
    """Elimina definitivamente un usuario (cliente). Protecciones: no permite
    borrar la propia cuenta ni cuentas de administrador."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if user["id"] == admin.get("id"):
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="No se puede eliminar una cuenta de administrador")
    await db.users.delete_one({"id": user_id})
    # Datos asociados personales (wishlist/comparador)
    await db.wishlists.delete_many({"user_id": user_id})
    await db.compares.delete_many({"user_id": user_id})
    return {"ok": True, "deleted": user.get("email")}


@router.patch("/users/{user_id}/approval", dependencies=[Depends(require_admin)])
async def set_user_approval(user_id: str, payload: dict):
    """Approve or reject a (professional) account. Sends an automatic email to
    the applicant on approval."""
    approved = bool(payload.get("approved"))
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    was_approved = bool(user.get("approved"))
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"approved": approved, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    # Send approval email only on the transition to approved (professionals).
    if approved and not was_approved and user.get("role") == "professional":
        import asyncio
        from core.mailer import send_professional_approved
        asyncio.create_task(send_professional_approved({**user, "approved": True}))
    fresh = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return fresh


# ---------- Cloudinary signature ----------
@router.get("/cloudinary/signature", dependencies=[Depends(require_admin)])
async def cloudinary_signature(folder: str = "ecoandes/products"):
    if not CLOUDINARY_API_SECRET:
        raise HTTPException(status_code=400, detail="Cloudinary no está configurado. Añade CLOUDINARY_* en el .env")
    if not folder.startswith("ecoandes/"):
        raise HTTPException(status_code=400, detail="Carpeta inválida")
    timestamp = int(time.time())
    params = {"timestamp": timestamp, "folder": folder}
    signature = cloudinary.utils.api_sign_request(params, CLOUDINARY_API_SECRET)
    return {
        "signature": signature,
        "timestamp": timestamp,
        "cloud_name": CLOUDINARY_CLOUD_NAME,
        "api_key": CLOUDINARY_API_KEY,
        "folder": folder,
    }


# ---------- Excel price import ----------
@router.post("/prices/import", response_model=ImportSummary, dependencies=[Depends(require_admin)])
async def import_prices(file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Formato inválido. Usa .xlsx")

    data = await file.read()
    try:
        wb = openpyxl.load_workbook(BytesIO(data), data_only=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Archivo Excel inválido: {e}")

    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise HTTPException(status_code=400, detail="Excel vacío")

    header_row = [str(c).strip().lower() if c else "" for c in rows[0]]

    def col(*names: str) -> Optional[int]:
        for n in names:
            if n in header_row:
                return header_row.index(n)
        return None

    sku_idx = col("sku", "código", "codigo")
    retail_idx = col("pvp", "price_retail", "precio", "retail", "price")
    pro_idx = col("b2b", "price_professional", "precio_profesional", "professional")
    if sku_idx is None or (retail_idx is None and pro_idx is None):
        raise HTTPException(
            status_code=400,
            detail="Encabezados requeridos: SKU y al menos PVP o B2B",
        )

    total = 0
    updated = 0
    not_found = 0
    not_found_skus: List[str] = []
    errors: List[str] = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for idx, row in enumerate(rows[1:], start=2):
        if not row or all(c is None for c in row):
            continue
        total += 1
        sku = str(row[sku_idx]).strip() if row[sku_idx] is not None else ""
        if not sku:
            errors.append(f"Fila {idx}: SKU vacío")
            continue

        new_retail = None
        new_pro = None
        try:
            if retail_idx is not None and row[retail_idx] not in (None, ""):
                new_retail = float(row[retail_idx])
            if pro_idx is not None and row[pro_idx] not in (None, ""):
                new_pro = float(row[pro_idx])
        except (ValueError, TypeError):
            errors.append(f"Fila {idx}: precio inválido para SKU {sku}")
            continue

        # find product where sku matches the top-level SKU or a variation SKU
        product = await db.products.find_one(
            {"$or": [{"sku": sku}, {"variations.sku": sku}]}, {"_id": 0}
        )
        if not product:
            not_found += 1
            not_found_skus.append(sku)
            continue

        set_fields: dict = {"updated_at": now_iso}
        old_retail = product.get("price_retail")
        old_pro = product.get("price_professional")

        if product["sku"] == sku:
            if new_retail is not None:
                set_fields["price_retail"] = new_retail
            if new_pro is not None:
                set_fields["price_professional"] = new_pro
            await db.products.update_one({"id": product["id"]}, {"$set": set_fields})
        else:
            # variation update
            var_set: dict = {"updated_at": now_iso}
            if new_retail is not None:
                var_set["variations.$[v].price_retail"] = new_retail
            if new_pro is not None:
                var_set["variations.$[v].price_professional"] = new_pro
            await db.products.update_one(
                {"id": product["id"]},
                {"$set": var_set},
                array_filters=[{"v.sku": sku}],
            )
            # keep original values for log
            for v in product.get("variations", []):
                if v["sku"] == sku:
                    old_retail = v.get("price_retail")
                    old_pro = v.get("price_professional")
                    break

        await db.price_logs.insert_one(
            {
                "sku": sku,
                "old_retail": old_retail,
                "new_retail": new_retail,
                "old_professional": old_pro,
                "new_professional": new_pro,
                "source": "excel_import",
                "created_at": now_iso,
            }
        )
        updated += 1

    return {
        "total_rows": total,
        "updated": updated,
        "not_found": not_found,
        "errors": errors[:50],
        "not_found_skus": not_found_skus[:50],
    }


@router.get("/prices/logs", dependencies=[Depends(require_admin)])
async def price_logs(limit: int = Query(100, le=500)):
    logs = await db.price_logs.find({}, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return logs


# ---------- Seed products from WordPress XML ----------
@router.post("/seed/wordpress", dependencies=[Depends(require_admin)])
async def seed_from_wordpress():
    from pathlib import Path
    from core.wp_importer import parse_wordpress_xml

    xml_path = Path(__file__).resolve().parent.parent / "ecoandes.xml"
    products = parse_wordpress_xml(xml_path)
    if not products:
        raise HTTPException(status_code=400, detail="No se pudo parsear el XML")
    inserted = 0
    updated = 0
    now = datetime.now(timezone.utc).isoformat()
    for p in products:
        existing = await db.products.find_one({"sku": p["sku"]}, {"_id": 0})
        if existing:
            await db.products.update_one(
                {"id": existing["id"]}, {"$set": {**p, "updated_at": now}}
            )
            updated += 1
        else:
            import uuid

            p["id"] = str(uuid.uuid4())
            p["created_at"] = now
            p["updated_at"] = now
            await db.products.insert_one(p)
            inserted += 1
    return {"inserted": inserted, "updated": updated, "total": inserted + updated}
