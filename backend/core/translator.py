"""Product & category translation engine (Gemini via emergentintegrations).

Translates product name / short_description / description and the category
catalogue into the 6 non-Spanish supported languages, storing results back in
MongoDB so they can be served instantly per request.
"""
import asyncio
import json
import logging
import os
from typing import Dict, List, Optional

from core.config import db

logger = logging.getLogger("ecoandes.translator")

EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# code -> human language name passed to the model
LANG_NAMES: Dict[str, str] = {
    "en": "English",
    "zh": "Mandarin Chinese (Simplified)",
    "fr": "French",
    "ja": "Japanese",
    "it": "Italian",
    "pt": "Portuguese (Portugal)",
}
TARGET_LANGS = list(LANG_NAMES.keys())

PRODUCT_FIELDS = ("name", "short_description", "description")

SYSTEM = (
    "You are a professional e-commerce localization translator for EcoAndes, an "
    "organic (BIO) food brand. Translate product names and descriptions naturally, "
    "preserving meaning and a premium, trustworthy tone."
)

_PRODUCT_RULES = """Translate the following list of products from Spanish into {lang}.
STRICT RULES:
- Input is a JSON array of objects: [{{"i": <index>, "name": ..., "short_description": ..., "description": ...}}]
- Return ONLY a valid JSON array with the SAME "i" indexes and translated "name", "short_description", "description". No markdown, no commentary.
- Keep these tokens UNCHANGED: EcoAndes, Ecoandes, BIO, SKU, B2B.
- Keep all numbers, units and currency symbols exactly as-is (e.g. 500 g, 1 kg, 2.22 Eur/kg, 60€).
- Translate common food words (harina=flour, etc.) but keep proper ingredient names that are used internationally.
- Preserve any HTML tags if present. If a field is empty, return it empty.
JSON to translate:
"""

_CATEGORY_RULES = """Translate the following list of e-commerce product CATEGORY names from Spanish into {lang}.
STRICT RULES:
- Input is a JSON array of strings.
- Return ONLY a valid JSON object mapping each ORIGINAL Spanish string to its translation. No markdown, no commentary.
- Keep tokens UNCHANGED: BIO, SKU.
- Keep it concise (these are menu/filter labels).
JSON to translate:
"""

# ---- simple shared status (for admin polling) ----
STATUS: Dict[str, object] = {
    "running": False,
    "total": 0,
    "done": 0,
    "lang": None,
    "finished_at": None,
    "error": None,
}


def _clean_json(raw: str, expect: str = "array"):
    raw = (raw or "").strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip().rstrip("`").strip()
    if expect == "array":
        a, b = raw.find("["), raw.rfind("]")
    else:
        a, b = raw.find("{"), raw.rfind("}")
    if a != -1 and b != -1:
        raw = raw[a : b + 1]
    return json.loads(raw)


async def _call_model(prompt: str, session: str) -> str:
    """Single Gemini call with retry/backoff (handles transient budget/ratelimit)."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    last_err = None
    for attempt in range(4):
        try:
            chat = LlmChat(
                api_key=EMERGENT_KEY, session_id=session, system_message=SYSTEM
            ).with_model("gemini", "gemini-2.5-flash")
            resp = await chat.send_message(UserMessage(text=prompt))
            return resp if isinstance(resp, str) else str(resp)
        except Exception as e:  # noqa: BLE001
            last_err = e
            wait = 4 * (attempt + 1)
            logger.warning("LLM call failed (attempt %d): %s -> retry in %ss", attempt + 1, e, wait)
            await asyncio.sleep(wait)
    raise RuntimeError(f"LLM call failed after retries: {last_err}")


async def _translate_product_batch(items: List[dict], lang_code: str) -> Dict[int, dict]:
    prompt = _PRODUCT_RULES.format(lang=LANG_NAMES[lang_code]) + json.dumps(items, ensure_ascii=False)
    raw = await _call_model(prompt, f"prod-{lang_code}")
    arr = _clean_json(raw, "array")
    out: Dict[int, dict] = {}
    for r in arr:
        if "i" in r:
            out[int(r["i"])] = {f: (r.get(f) or "") for f in PRODUCT_FIELDS}
    return out


async def generate_category_translations() -> None:
    cats = sorted([c for c in await db.products.distinct("category", {"active": True}) if c])
    if not cats:
        return
    result: Dict[str, Dict[str, str]] = {}
    for code in TARGET_LANGS:
        try:
            prompt = _CATEGORY_RULES.format(lang=LANG_NAMES[code]) + json.dumps(cats, ensure_ascii=False)
            raw = await _call_model(prompt, f"cat-{code}")
            mapping = _clean_json(raw, "object")
            result[code] = {k: str(v) for k, v in mapping.items()}
            await asyncio.sleep(1)
        except Exception as e:  # noqa: BLE001
            logger.error("Category translation failed for %s: %s", code, e)
    await db.meta.update_one(
        {"_id": "category_translations"},
        {"$set": {"_id": "category_translations", "data": result}},
        upsert=True,
    )
    logger.info("Category translations stored for %d languages", len(result))


async def get_category_translations() -> Dict[str, Dict[str, str]]:
    doc = await db.meta.find_one({"_id": "category_translations"})
    return (doc or {}).get("data", {}) if doc else {}


def _missing_langs(product: dict) -> List[str]:
    tr = product.get("translations") or {}
    missing = []
    for code in TARGET_LANGS:
        block = tr.get(code) or {}
        if not block.get("name"):
            missing.append(code)
    return missing


async def generate_all_product_translations(only_missing: bool = True, batch_size: int = 10) -> None:
    """Translate every product into all target languages. Idempotent when only_missing."""
    if STATUS["running"]:
        logger.info("Translation already running; skip.")
        return
    if not EMERGENT_KEY:
        logger.error("No EMERGENT_LLM_KEY; cannot translate products.")
        return

    STATUS.update({"running": True, "done": 0, "error": None, "finished_at": None})
    try:
        # categories first (cheap, used everywhere)
        cat_doc = await db.meta.find_one({"_id": "category_translations"})
        if not only_missing or not cat_doc:
            await generate_category_translations()

        products = await db.products.find(
            {"active": True}, {"_id": 0, "id": 1, "name": 1, "short_description": 1, "description": 1, "translations": 1}
        ).to_list(length=2000)

        # Build the per-language work set
        STATUS["total"] = len(products)
        for code in TARGET_LANGS:
            STATUS["lang"] = code
            # products still needing this language
            pending = [
                p for p in products
                if (not only_missing) or (code in _missing_langs(p))
            ]
            logger.info("[%s] translating %d products", code, len(pending))
            for start in range(0, len(pending), batch_size):
                chunk = pending[start : start + batch_size]
                items = [
                    {
                        "i": i,
                        "name": p.get("name", ""),
                        "short_description": p.get("short_description", ""),
                        "description": p.get("description", ""),
                    }
                    for i, p in enumerate(chunk)
                ]
                try:
                    translated = await _translate_product_batch(items, code)
                except Exception as e:  # noqa: BLE001
                    logger.error("[%s] batch %d failed: %s", code, start, e)
                    continue
                # persist each
                for i, p in enumerate(chunk):
                    block = translated.get(i)
                    if not block or not block.get("name"):
                        continue
                    await db.products.update_one(
                        {"id": p["id"]},
                        {"$set": {f"translations.{code}": block}},
                    )
                await asyncio.sleep(1)  # gentle pacing
            STATUS["done"] = int(STATUS["done"]) + 1
        logger.info("Product translation generation complete.")
    except Exception as e:  # noqa: BLE001
        STATUS["error"] = str(e)
        logger.exception("Product translation generation crashed: %s", e)
    finally:
        from datetime import datetime, timezone
        STATUS["running"] = False
        STATUS["lang"] = None
        STATUS["finished_at"] = datetime.now(timezone.utc).isoformat()


async def has_complete_translations() -> bool:
    """True if no active product is missing any target language name."""
    total = await db.products.count_documents({"active": True})
    if total == 0:
        return True
    # a product is incomplete if any target lang name is missing
    missing = await db.products.count_documents(
        {
            "active": True,
            "$or": [{f"translations.{code}.name": {"$in": [None, ""]}} for code in TARGET_LANGS]
            + [{f"translations.{code}": {"$exists": False}} for code in TARGET_LANGS],
        }
    )
    return missing == 0


async def has_complete_seo() -> bool:
    """True if no active product is missing SEO metadata in ES or any target language."""
    total = await db.products.count_documents({"active": True})
    if total == 0:
        return True
    missing = await db.products.count_documents(
        {
            "active": True,
            "$or": [{"seo.meta_title": {"$in": [None, ""]}}, {"seo": {"$exists": False}}]
            + [{f"translations.{code}.seo.meta_title": {"$in": [None, ""]}} for code in TARGET_LANGS]
            + [{f"translations.{code}.seo": {"$exists": False}} for code in TARGET_LANGS],
        }
    )
    return missing == 0


# ---------- Rich product content translation (highlights + description blocks) ----------
CONTENT_FIELDS = ("highlights", "ingredients", "origin", "benefits", "usage", "storage", "certifications")

_CONTENT_RULES = """Translate the following list of product content objects from Spanish into {lang}.
STRICT RULES:
- Input is a JSON array: [{{"i": <index>, "highlights": ..., "ingredients": ..., "origin": ..., "benefits": ..., "usage": ..., "storage": ..., "certifications": ...}}]
- Return ONLY a valid JSON array with the SAME "i" indexes and the SAME keys translated. No markdown, no commentary.
- Keep UNCHANGED: EcoAndes, Ecoandes, BIO, SKU, B2B, certification codes like ES-ECO-023-MA, CAEM.
- Keep numbers, units, currency and percentages exactly (e.g. 100%, 500 g, 2.22 Eur/kg).
- If a field is empty string, keep it empty.
- Preserve line breaks.
JSON to translate:
"""


def _content_payload(p: dict) -> dict:
    blocks = p.get("description_blocks") or {}
    return {
        "highlights": p.get("highlights", "") or "",
        "ingredients": blocks.get("ingredients", "") or "",
        "origin": blocks.get("origin", "") or "",
        "benefits": blocks.get("benefits", "") or "",
        "usage": blocks.get("usage", "") or "",
        "storage": blocks.get("storage", "") or "",
        "certifications": blocks.get("certifications", "") or "",
    }


def _has_content(p: dict) -> bool:
    payload = _content_payload(p)
    return any(v.strip() for v in payload.values())


async def generate_product_content_translations(only_missing: bool = True, batch_size: int = 6) -> None:
    """Translate highlights + description blocks into all target languages."""
    if not EMERGENT_KEY:
        logger.error("No EMERGENT_LLM_KEY; cannot translate product content.")
        return
    products = await db.products.find(
        {"active": True},
        {"_id": 0, "id": 1, "highlights": 1, "description_blocks": 1, "translations": 1},
    ).to_list(length=2000)
    products = [p for p in products if _has_content(p)]
    logger.info("Content translation: %d products with content", len(products))

    for code in TARGET_LANGS:
        pending = []
        for p in products:
            if only_missing:
                tr = (p.get("translations") or {}).get(code) or {}
                if tr.get("highlights") or (tr.get("description_blocks") or {}).get("benefits"):
                    continue
            pending.append(p)
        logger.info("[content/%s] %d pending", code, len(pending))
        for start in range(0, len(pending), batch_size):
            chunk = pending[start : start + batch_size]
            items = [{"i": i, **_content_payload(p)} for i, p in enumerate(chunk)]
            try:
                prompt = _CONTENT_RULES.format(lang=LANG_NAMES[code]) + json.dumps(items, ensure_ascii=False)
                raw = await _call_model(prompt, f"content-{code}")
                arr = _clean_json(raw, "array")
                by_i = {int(r["i"]): r for r in arr if "i" in r}
            except Exception as e:  # noqa: BLE001
                logger.error("[content/%s] batch %d failed: %s", code, start, e)
                continue
            for i, p in enumerate(chunk):
                r = by_i.get(i)
                if not r:
                    continue
                await db.products.update_one(
                    {"id": p["id"]},
                    {"$set": {
                        f"translations.{code}.highlights": r.get("highlights", ""),
                        f"translations.{code}.description_blocks": {
                            "ingredients": r.get("ingredients", ""),
                            "origin": r.get("origin", ""),
                            "benefits": r.get("benefits", ""),
                            "usage": r.get("usage", ""),
                            "storage": r.get("storage", ""),
                            "certifications": r.get("certifications", ""),
                        },
                    }},
                )
            await asyncio.sleep(1)
    logger.info("Product content translation complete.")



# ---------- SEO / GEO metadata generation (multilingual) ----------
SEO_STATUS: Dict[str, object] = {
    "running": False, "total": 0, "done": 0, "lang": None, "finished_at": None, "error": None,
}

# code -> hreflang/region hint for GEO
SEO_LANG_REGION = {
    "es": "España", "en": "international", "zh": "China",
    "fr": "France", "ja": "Japan", "it": "Italia", "pt": "Portugal",
}

_SEO_RULES = """You are an SEO + GEO copywriter for EcoAndes, an organic (BIO) bulk food e-commerce that ships from Spain.
Generate search-optimised metadata in {lang} for the following products.
Input is a JSON array: [{{"i": <index>, "name": ..., "category": ..., "origin": ...}}]
Return ONLY a valid JSON array (no markdown) with objects: {{"i": <index>, "meta_title": ..., "meta_description": ..., "keywords": [..]}}
STRICT RULES:
- meta_title: <= 60 characters, compelling, include the product name and the word for "organic/BIO" naturally, and the brand "EcoAndes" when it fits.
- meta_description: 130-155 characters, persuasive, mention it is organic/BIO, bulk-available ("a granel"/equivalent), and reference the country of origin ({origin}) for GEO relevance. Encourage buying.
- keywords: array of 5-8 localized search terms (lowercase) including the product, "ecológico/bio" equivalent, "comprar"/buy equivalent, "a granel"/bulk equivalent, and origin.
- Write naturally in {lang}. Keep UNCHANGED: EcoAndes, BIO.
- Keep numbers/units exact. No emojis.
JSON:
"""


async def _seo_batch(items: List[dict], lang_code: str) -> Dict[int, dict]:
    prompt = _SEO_RULES.format(lang=LANG_NAMES.get(lang_code, "Spanish"), origin="su país de origen") + json.dumps(items, ensure_ascii=False)
    raw = await _call_model(prompt, f"seo-{lang_code}")
    arr = _clean_json(raw, "array")
    out: Dict[int, dict] = {}
    for r in arr:
        if "i" in r:
            kw = r.get("keywords") or []
            if isinstance(kw, str):
                kw = [k.strip() for k in kw.split(",") if k.strip()]
            out[int(r["i"])] = {
                "meta_title": str(r.get("meta_title", ""))[:70],
                "meta_description": str(r.get("meta_description", ""))[:170],
                "keywords": [str(k) for k in kw][:8],
            }
    return out


def _seo_missing(p: dict, lang: str) -> bool:
    if lang == "es":
        return not ((p.get("seo") or {}).get("meta_title"))
    block = (p.get("translations") or {}).get(lang) or {}
    return not ((block.get("seo") or {}).get("meta_title"))


def _seo_manual(p: dict, lang: str) -> bool:
    """True si el SEO de ese idioma fue editado a mano en el admin: la IA no
    debe sobrescribirlo nunca (ni siquiera con force)."""
    if lang == "es":
        return bool((p.get("seo") or {}).get("manual"))
    block = (p.get("translations") or {}).get(lang) or {}
    return bool((block.get("seo") or {}).get("manual"))


async def generate_product_seo(only_missing: bool = True, batch_size: int = 8) -> None:
    """Generate SEO/GEO metadata (meta_title/description/keywords) for every product
    in Spanish + all target languages. Idempotent when only_missing."""
    if SEO_STATUS["running"]:
        logger.info("SEO generation already running; skip.")
        return
    if not EMERGENT_KEY:
        logger.error("No EMERGENT_LLM_KEY; cannot generate SEO.")
        return
    SEO_STATUS.update({"running": True, "done": 0, "error": None, "finished_at": None})
    try:
        products = await db.products.find(
            {"active": True},
            {"_id": 0, "id": 1, "name": 1, "category": 1, "origin_country": 1, "seo": 1, "translations": 1},
        ).to_list(length=2000)
        all_langs = ["es"] + TARGET_LANGS
        SEO_STATUS["total"] = len(all_langs)
        for code in all_langs:
            SEO_STATUS["lang"] = code
            pending = [p for p in products
                       if not _seo_manual(p, code)
                       and ((not only_missing) or _seo_missing(p, code))]
            logger.info("[seo/%s] %d pending", code, len(pending))
            for start in range(0, len(pending), batch_size):
                chunk = pending[start:start + batch_size]
                items = [
                    {"i": i, "name": p.get("name", ""), "category": p.get("category", ""),
                     "origin": p.get("origin_country", "") or "su país de origen"}
                    for i, p in enumerate(chunk)
                ]
                try:
                    res = await _seo_batch(items, code)
                except Exception as e:  # noqa: BLE001
                    logger.error("[seo/%s] batch %d failed: %s", code, start, e)
                    continue
                for i, p in enumerate(chunk):
                    block = res.get(i)
                    if not block or not block.get("meta_title"):
                        continue
                    seo_doc = {
                        "meta_title": block["meta_title"],
                        "meta_description": block["meta_description"],
                        "keywords": block["keywords"],
                        "geo_region": p.get("origin_country", "") or SEO_LANG_REGION.get(code, ""),
                    }
                    if code == "es":
                        await db.products.update_one({"id": p["id"]}, {"$set": {"seo": seo_doc}})
                    else:
                        await db.products.update_one({"id": p["id"]}, {"$set": {f"translations.{code}.seo": seo_doc}})
                await asyncio.sleep(1)
            SEO_STATUS["done"] = int(SEO_STATUS["done"]) + 1
        logger.info("SEO generation complete.")
    except Exception as e:  # noqa: BLE001
        SEO_STATUS["error"] = str(e)
        logger.exception("SEO generation crashed: %s", e)
    finally:
        from datetime import datetime, timezone
        SEO_STATUS["running"] = False
        SEO_STATUS["lang"] = None
        SEO_STATUS["finished_at"] = datetime.now(timezone.utc).isoformat()


# ---------- Hero / homepage banner translation ----------
HERO_FIELDS = ("overline", "h1", "subtitle", "cta_label")

_HERO_RULES = """Translate the following website HERO banner slides from Spanish into {lang}.
STRICT RULES:
- Input is a JSON array: [{{"i": <index>, "overline": ..., "h1": ..., "subtitle": ..., "cta_label": ...}}]
- Return ONLY a valid JSON array with the SAME "i" indexes and translated keys. No markdown, no commentary.
- Keep UNCHANGED: EcoAndes, Ecoandes, BIO, B2B.
- Keep numbers, units and currency exactly (e.g. 100%, 500 g, 60€).
- Marketing tone: punchy and premium. "h1" is a headline, "overline" a small eyebrow label, "subtitle" one short sentence, "cta_label" a short button label.
- If a field is empty, keep it empty.
JSON to translate:
"""


async def translate_hero_payload(slides: List[dict], b2b_label: str) -> Dict[str, dict]:
    """Translate hero slides + b2b label into all target languages.

    Returns: {lang: {"slides": {i: {fields}}, "b2b": <label>}}
    """
    if not EMERGENT_KEY:
        logger.error("No EMERGENT_LLM_KEY; cannot translate hero.")
        return {}
    items = [
        {"i": i, **{f: (s.get(f) or "") for f in HERO_FIELDS}}
        for i, s in enumerate(slides)
    ]
    # append a synthetic item for the b2b button label so it gets translated too
    b2b_index = len(items)
    items.append({"i": b2b_index, "overline": "", "h1": "", "subtitle": "", "cta_label": b2b_label or ""})

    result: Dict[str, dict] = {}
    for code in TARGET_LANGS:
        try:
            prompt = _HERO_RULES.format(lang=LANG_NAMES[code]) + json.dumps(items, ensure_ascii=False)
            raw = await _call_model(prompt, f"hero-{code}")
            arr = _clean_json(raw, "array")
            by_i = {int(r["i"]): r for r in arr if "i" in r}
            slide_tr: Dict[int, dict] = {}
            for i in range(len(slides)):
                r = by_i.get(i) or {}
                slide_tr[i] = {f: (r.get(f) or "") for f in HERO_FIELDS}
            b2b_tr = (by_i.get(b2b_index) or {}).get("cta_label", "") or (b2b_label or "")
            result[code] = {"slides": slide_tr, "b2b": b2b_tr}
            await asyncio.sleep(0.5)
        except Exception as e:  # noqa: BLE001
            logger.error("[hero/%s] translation failed: %s", code, e)
    return result


async def generate_hero_translations() -> None:
    """Read the hero config doc, translate all slides + b2b, persist translations back."""
    doc = await db.site_config.find_one({"_id": "hero"})
    if not doc:
        return
    slides = doc.get("slides") or []
    b2b = doc.get("b2b") or {}
    b2b_label = b2b.get("label", "")
    translations = await translate_hero_payload(slides, b2b_label)
    if not translations:
        return
    # write back per-slide translations
    new_slides = []
    for i, s in enumerate(slides):
        s = dict(s)
        s_tr = {}
        for code in TARGET_LANGS:
            block = (translations.get(code) or {}).get("slides", {}).get(i)
            if block:
                s_tr[code] = block
        s["translations"] = s_tr
        new_slides.append(s)
    b2b = dict(b2b)
    b2b["translations"] = {code: (translations.get(code) or {}).get("b2b", "") for code in TARGET_LANGS}
    await db.site_config.update_one(
        {"_id": "hero"},
        {"$set": {"slides": new_slides, "b2b": b2b}},
    )
    logger.info("Hero translations stored for %d languages", len(translations))
