"""Auth routes."""
import asyncio
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from core.auth import (
    create_token,
    get_current_user,
    hash_password,
    verify_password,
)
from core.config import db
from core.models import UserLogin, UserPublic, UserRegister

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _public(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "first_name": u["first_name"],
        "last_name": u["last_name"],
        "role": u["role"],
        "company": u.get("company"),
        "tax_id": u.get("tax_id"),
        "business_type": u.get("business_type"),
        "phone": u.get("phone"),
        "approved": u.get("approved", True),
        "verification": u.get("verification"),
        "created_at": u.get("created_at"),
    }


@router.post("/register", response_model=UserPublic)
async def register(payload: UserRegister):
    existing = await db.users.find_one({"email": payload.email.lower()}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Este email ya está registrado")
    import uuid

    from core.beel import verify_professional_tax_id
    from core.mailer import (
        send_company_registration_notice,
        send_professional_review,
        send_registration_failed_verification,
        send_registration_welcome,
    )

    is_professional = payload.role == "professional"

    # --- Verificación automática del NIF/CIF con BeeL (censo AEAT) ---
    verification = "retail"
    verified_company_name = None
    if is_professional:
        result = await verify_professional_tax_id(payload.tax_id or "")
        verification = result["verification"]  # auto | manual | failed
        verified_company_name = result.get("company_name")

    approved = True if not is_professional else verification == "auto"

    doc = {
        "id": str(uuid.uuid4()),
        "email": payload.email.lower(),
        "password_hash": await asyncio.to_thread(hash_password, payload.password),
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "role": payload.role,
        "company": payload.company,
        "tax_id": payload.tax_id,
        "business_type": payload.business_type,
        "phone": payload.phone,
        "message": (payload.message or "").strip()[:1000] or None,
        "approved": approved,
        "verification": verification if is_professional else None,
        "verified_company_name": verified_company_name,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)

    # --- Emails automáticos (cliente + empresa) en segundo plano ---
    if is_professional:
        if verification == "auto":
            asyncio.create_task(send_registration_welcome(doc))
        elif verification == "failed":
            asyncio.create_task(send_registration_failed_verification(doc))
        else:  # manual review (24 h)
            asyncio.create_task(send_professional_review(doc))
        asyncio.create_task(send_company_registration_notice(doc, verification))
    else:
        asyncio.create_task(send_registration_welcome(doc))
        asyncio.create_task(send_company_registration_notice(doc, "retail"))

    return _public(doc)


@router.post("/login")
async def login(payload: UserLogin):
    user = await db.users.find_one({"email": payload.email.lower()})
    # bcrypt is CPU-bound: run in a thread so it never blocks the event loop
    valid = bool(user) and await asyncio.to_thread(
        verify_password, payload.password, user.get("password_hash", "")
    )
    if not valid:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    token = create_token(user["id"], user["role"])
    return {"access_token": token, "token_type": "bearer", "user": _public(user)}


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return _public(user)

