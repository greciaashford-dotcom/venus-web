"""Homepage Hero/Portada management: public read (localized) + admin CRUD.

Hero config is a single document in `site_config` (_id="hero"):
{
  "_id": "hero",
  "slides": [ {id, order, active, image, image_alt, overline, h1, subtitle,
               cta_label, cta_link, translations:{lang:{overline,h1,subtitle,cta_label}}} ],
  "b2b": {label, link, translations:{lang:label}},
  "updated_at": iso
}
"""
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.auth import require_admin
from core.config import db
from core.translator import TARGET_LANGS, HERO_FIELDS, generate_hero_translations

logger = logging.getLogger("ecoandes.hero")

router = APIRouter(prefix="/api", tags=["hero"])

LOCALES_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "i18n" / "locales"

# Default slides (Spanish base). `image` = web/horizontal banner (1352x452),
# `image_mobile` = vertical banner (810x1012) shown on portrait devices.
DEFAULT_SLIDES = [
    {"image": "/hero/slide-1.webp", "image_mobile": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/2590fac6-0abb-4752-9b8e-2011506e063a-AFpOyXS9EdXcHiOA.png", "image_alt": "Cacao Nibs", "cta_link": "/tienda?q=cacao"},
    {"image": "/hero/slide-2.webp", "image_mobile": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/2edd6aa5-5892-4d27-b324-90ddd5e6d96c-9FNNDdbX2vC0F87G.png", "image_alt": "Maca Negra", "cta_link": "/tienda?q=maca"},
    {"image": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/quinoa-tricolor-bio-mOJDKRVcBoiDj1kP.svg", "image_mobile": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/3e2e5fbd-363b-435d-b40e-c867b587103c-TbzHNlprrFOyaD9M.png", "image_alt": "Quinoa Real Tricolor", "cta_link": "/tienda?q=quinoa"},
    {"image": "/hero/slide-4.webp", "image_mobile": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/e76dfcc8-922d-4bda-b26e-dbc272d41833-wMgPeXW98mqWtT29.png", "image_alt": "Canela de Ceylán", "cta_link": "/tienda?q=canela"},
    {"image": "/hero/slide-5.webp", "image_mobile": "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/426596d8-7c00-49cb-bc9d-dd8337e44b3e-3dw2ffgiXbdSptJh.png", "image_alt": "Cúrcuma Bio", "cta_link": "/tienda?q=curcuma"},
]


def _load_locale(code: str) -> dict:
    try:
        return json.loads((LOCALES_DIR / f"{code}.json").read_text(encoding="utf-8"))
    except Exception:
        return {}


async def seed_hero_if_empty() -> None:
    """Create the hero config from existing i18n locale JSONs (no LLM needed)."""
    existing = await db.site_config.find_one({"_id": "hero"})
    if existing:
        return
    es = _load_locale("es")
    es_hero = es.get("hero", {}) or {}
    es_slides = es_hero.get("slides", []) or []

    # Preload translations from the other locale files
    loc_cache = {code: _load_locale(code) for code in TARGET_LANGS}

    slides = []
    now = datetime.now(timezone.utc).isoformat()
    for i, base in enumerate(DEFAULT_SLIDES):
        src = es_slides[i] if i < len(es_slides) else {}
        slide = {
            "id": str(uuid.uuid4()),
            "order": i,
            "active": True,
            "image": base["image"],
            "image_mobile": base.get("image_mobile", ""),
            "image_alt": base["image_alt"],
            "overline": src.get("overline", ""),
            "h1": src.get("h1", ""),
            "subtitle": src.get("subtitle", ""),
            "cta_label": src.get("cta", ""),
            "cta_link": base["cta_link"],
            "translations": {},
        }
        for code in TARGET_LANGS:
            l_slides = (loc_cache.get(code, {}).get("hero", {}) or {}).get("slides", []) or []
            if i < len(l_slides):
                t = l_slides[i]
                slide["translations"][code] = {
                    "overline": t.get("overline", ""),
                    "h1": t.get("h1", ""),
                    "subtitle": t.get("subtitle", ""),
                    "cta_label": t.get("cta", ""),
                }
        slides.append(slide)

    b2b = {
        "label": es_hero.get("soyProfesional", "Soy profesional"),
        "link": "/profesional",
        "translations": {
            code: (loc_cache.get(code, {}).get("hero", {}) or {}).get("soyProfesional", "")
            for code in TARGET_LANGS
        },
    }

    await db.site_config.update_one(
        {"_id": "hero"},
        {"$set": {"_id": "hero", "slides": slides, "b2b": b2b, "updated_at": now}},
        upsert=True,
    )
    logger.info("Hero config seeded with %d slides", len(slides))


def _localize_slide(slide: dict, lang: Optional[str]) -> dict:
    out = {
        "id": slide.get("id"),
        "image": slide.get("image", ""),
        "image_mobile": slide.get("image_mobile", ""),
        "image_alt": slide.get("image_alt", ""),
        "overline": slide.get("overline", ""),
        "h1": slide.get("h1", ""),
        "subtitle": slide.get("subtitle", ""),
        "cta_label": slide.get("cta_label", ""),
        "cta_link": slide.get("cta_link", ""),
    }
    if lang and lang != "es" and lang in TARGET_LANGS:
        block = (slide.get("translations") or {}).get(lang) or {}
        for f in HERO_FIELDS:
            if block.get(f):
                out[f] = block[f]
    return out


@router.get("/hero")
async def get_hero(lang: Optional[str] = None):
    doc = await db.site_config.find_one({"_id": "hero"})
    if not doc:
        return {"slides": [], "b2b": {"label": "", "link": "/profesional"}}
    slides = [s for s in (doc.get("slides") or []) if s.get("active", True)]
    slides.sort(key=lambda s: s.get("order", 0))
    b2b = doc.get("b2b") or {}
    b2b_label = b2b.get("label", "")
    if lang and lang != "es" and lang in TARGET_LANGS:
        b2b_label = (b2b.get("translations") or {}).get(lang) or b2b_label
    return {
        "slides": [_localize_slide(s, lang) for s in slides],
        "b2b": {"label": b2b_label, "link": b2b.get("link", "/profesional")},
    }


@router.get("/admin/hero", dependencies=[Depends(require_admin)])
async def admin_get_hero():
    doc = await db.site_config.find_one({"_id": "hero"}, {"_id": 0})
    if not doc:
        await seed_hero_if_empty()
        doc = await db.site_config.find_one({"_id": "hero"}, {"_id": 0})
    return doc or {"slides": [], "b2b": {"label": "", "link": "/profesional"}}


class SlideIn(BaseModel):
    id: Optional[str] = None
    order: int = 0
    active: bool = True
    image: str = ""
    image_mobile: str = ""
    image_alt: str = ""
    overline: str = ""
    h1: str = ""
    subtitle: str = ""
    cta_label: str = ""
    cta_link: str = ""


class B2BIn(BaseModel):
    label: str = "Soy profesional"
    link: str = "/profesional"


class HeroIn(BaseModel):
    slides: List[SlideIn]
    b2b: B2BIn
    autotranslate: bool = True


@router.put("/admin/hero", dependencies=[Depends(require_admin)])
async def admin_save_hero(payload: HeroIn):
    existing = await db.site_config.find_one({"_id": "hero"}) or {}
    existing_slides = {s.get("id"): s for s in (existing.get("slides") or [])}

    slides = []
    for idx, s in enumerate(payload.slides):
        sid = s.id or str(uuid.uuid4())
        prev = existing_slides.get(sid, {})
        prev_tr = prev.get("translations") or {}
        # Detect if any Spanish base text changed -> drop stale translations for that slide
        changed = any(
            (prev.get(f, "") or "") != (getattr(s, f) or "")
            for f in HERO_FIELDS
        )
        slides.append({
            "id": sid,
            "order": idx,
            "active": s.active,
            "image": s.image,
            "image_mobile": s.image_mobile,
            "image_alt": s.image_alt,
            "overline": s.overline,
            "h1": s.h1,
            "subtitle": s.subtitle,
            "cta_label": s.cta_label,
            "cta_link": s.cta_link,
            "translations": {} if changed else prev_tr,
        })

    prev_b2b = existing.get("b2b") or {}
    b2b_changed = (prev_b2b.get("label", "") or "") != (payload.b2b.label or "")
    b2b = {
        "label": payload.b2b.label,
        "link": payload.b2b.link,
        "translations": {} if b2b_changed else (prev_b2b.get("translations") or {}),
    }

    await db.site_config.update_one(
        {"_id": "hero"},
        {"$set": {
            "_id": "hero",
            "slides": slides,
            "b2b": b2b,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )

    if payload.autotranslate:
        asyncio.create_task(generate_hero_translations())

    return {"ok": True, "slides": len(slides), "translating": payload.autotranslate}


@router.post("/admin/hero/translate", dependencies=[Depends(require_admin)])
async def admin_translate_hero():
    asyncio.create_task(generate_hero_translations())
    return {"ok": True, "started": True}
