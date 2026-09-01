"""Enriquecimiento de productos desde las fichas técnicas PDF subidas.

1. Empareja cada PDF de `db.files` con su producto por nombre de archivo.
2. Extrae el texto del PDF (pypdf) y pide a Gemini los datos estructurados
   (descripción, bloques, nutrición, origen...).
3. Rellena SOLO los campos vacíos del producto y asigna la ficha técnica.
4. Exporta todo a /app/backend/data/product_enrichment.json para que los datos
   viajen con el código a nuevos entornos (se aplican en el arranque).

Uso:  python scripts/enrich_from_pdfs.py [--limit N] [--only-match]
"""
import asyncio
import io
import json
import logging
import os
import re
import sys
import unicodedata
import uuid
from datetime import datetime, timezone
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from core.config import db  # noqa: E402
from core.storage import get_object  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("enrich")

ENRICH_PATH = Path(__file__).resolve().parent.parent / "data" / "product_enrichment.json"

BLOCK_KEYS = ["ingredients", "origin", "benefits", "usage", "storage", "certifications"]


# ---------------- matching ----------------
def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", (s or "").upper())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"\.PDF$", "", s)
    s = re.sub(r"FICHA[ _-]*TECNICA|FT[ _-]*ECOANDES|ECOANDES|FT\b", " ", s)
    s = re.sub(r"20\d\d", " ", s)
    s = re.sub(r"COMPRESSED|DEFINITIVA?|REV(?:ISADA)?|V\d+", " ", s)
    s = re.sub(r"\bBIO\b|\bECO(?:LOGICO)?\b|\bSIN GLUTEN\b", " ", s)
    s = re.sub(r"[^A-Z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def match_score(file_norm: str, prod_norm: str) -> float:
    if not file_norm or not prod_norm:
        return 0.0
    ratio = SequenceMatcher(None, file_norm, prod_norm).ratio()
    ftoks, ptoks = set(file_norm.split()), set(prod_norm.split())
    if not ftoks or not ptoks:
        return ratio
    overlap = len(ftoks & ptoks) / max(1, len(ftoks | ptoks))
    contain = 0.25 if (file_norm in prod_norm or prod_norm in file_norm) else 0.0
    return 0.5 * ratio + 0.5 * overlap + contain


async def llm_match(files: list, products: list) -> dict:
    """Empareja con IA los PDFs que el matching determinista no resolvió.
    Devuelve {original_filename: slug|None}."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    if not files:
        return {}
    catalog = "\n".join(f"- {p['slug']} :: {p['name']}" for p in products)
    fl = "\n".join(f"- {f['original_filename']}" for f in files)
    prompt = f"""Empareja cada ficha técnica PDF con su producto del catálogo. Los nombres pueden variar
(orden de palabras, sinónimos: 'en polvo'='molida', 'orejones'='orejón', 'pasas sultanas'='pasas', etc.).

CATÁLOGO (slug :: nombre):
{catalog}

ARCHIVOS PDF:
{fl}

Devuelve SOLO JSON válido: {{"<nombre de archivo>": "<slug del producto o null si no existe en el catálogo>"}}
Usa null si no hay un producto claramente correspondiente. No inventes slugs."""
    chat = LlmChat(
        api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
        session_id=f"match-{uuid.uuid4().hex[:8]}",
        system_message="Emparejas archivos con productos y respondes únicamente con JSON válido.",
    ).with_model("gemini", "gemini-2.5-flash")
    resp = await chat.send_message(UserMessage(text=prompt))
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", (resp or "").strip(), flags=re.S)
    try:
        return json.loads(raw)
    except Exception:  # noqa: BLE001
        logger.error("LLM match: JSON inválido")
        return {}


async def build_matches():
    files = await db.files.find(
        {"content_type": "application/pdf", "is_deleted": {"$ne": True}}, {"_id": 0}
    ).to_list(1000)
    products = await db.products.find({}, {"_id": 0, "id": 1, "slug": 1, "name": 1}).to_list(2000)
    by_slug = {p["slug"]: p for p in products}
    for p in products:
        p["norm"] = norm(p["name"])

    strong, uncertain = [], []
    for f in files:
        fn = norm(f["original_filename"])
        best, best_s = None, 0.0
        for p in products:
            s = match_score(fn, p["norm"])
            if s > best_s:
                best, best_s = p, s
        if best and best_s >= 0.75:
            strong.append({"file": f, "product": best, "score": round(best_s, 2)})
        else:
            uncertain.append({"file": f, "best": best, "score": round(best_s, 2)})

    # IA para los dudosos (una sola llamada)
    llm_map = await llm_match([u["file"] for u in uncertain], products)
    for u in uncertain:
        slug = llm_map.get(u["file"]["original_filename"])
        if slug and slug in by_slug:
            strong.append({"file": u["file"], "product": by_slug[slug], "score": u["score"], "via": "llm"})
            u["resolved"] = True
        else:
            u["llm"] = slug

    # deduplicar: mejor PDF por producto (prioriza mayor score / sin sufijo '(1)')
    matches, unmatched = [], []
    per_product = {}
    for m in sorted(strong, key=lambda x: (-(x["score"]), "(" in x["file"]["original_filename"])):
        slug = m["product"]["slug"]
        if slug in per_product:
            unmatched.append({"file": m["file"]["original_filename"], "reason": f"duplicado de {slug}", "score": m["score"]})
            continue
        per_product[slug] = m
        matches.append(m)
    for u in uncertain:
        if u.get("resolved"):
            continue
        unmatched.append({"file": u["file"]["original_filename"], "reason": "sin producto", "score": u["score"]})
    return matches, unmatched


# ---------------- pdf text ----------------
def pdf_text(data: bytes) -> str:
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data))
        chunks = []
        for page in reader.pages[:6]:
            try:
                chunks.append(page.extract_text() or "")
            except Exception:  # noqa: BLE001
                continue
        return re.sub(r"\n{3,}", "\n\n", "\n".join(chunks)).strip()
    except Exception as e:  # noqa: BLE001
        logger.warning("pypdf failed: %s", e)
        return ""


# ---------------- llm extraction ----------------
async def llm_extract(product_name: str, text: str) -> dict:
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    prompt = f"""Eres un técnico de calidad alimentaria. A partir del texto de la ficha técnica del producto
"{product_name}" (alimentación ecológica BIO), extrae los datos en JSON. Texto de la ficha:

---
{text[:9000]}
---

Devuelve SOLO JSON válido (sin markdown) con esta estructura (usa "" si un dato no aparece; escribe en español, tono comercial claro):
{{
  "description": "<descripción comercial del producto en 2-4 frases basada en la ficha>",
  "short_description": "<frase corta de resumen (máx 120 caracteres)>",
  "highlights": "<3-5 puntos clave separados por ' · ' (ej. certificación, origen, propiedades)>",
  "origin_country": "<país de origen si aparece>",
  "description_blocks": {{
    "ingredients": "<ingredientes / composición>",
    "origin": "<origen y proceso>",
    "benefits": "<propiedades y beneficios>",
    "usage": "<modo de uso / aplicaciones culinarias>",
    "storage": "<conservación y vida útil>",
    "certifications": "<certificaciones (ecológico, IFS, alérgenos...)>"
  }},
  "nutrition": [
    {{"label": "Valor energético", "value": "<ej. 1500 kJ / 356 kcal>"}},
    {{"label": "Grasas", "value": "..."}},
    {{"label": "de las cuales saturadas", "value": "..."}},
    {{"label": "Hidratos de carbono", "value": "..."}},
    {{"label": "de los cuales azúcares", "value": "..."}},
    {{"label": "Fibra alimentaria", "value": "..."}},
    {{"label": "Proteínas", "value": "..."}},
    {{"label": "Sal", "value": "..."}}
  ]
}}
En "nutrition" incluye solo las filas presentes en la ficha (por 100 g). No inventes datos."""

    chat = LlmChat(
        api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
        session_id=f"enrich-{uuid.uuid4().hex[:8]}",
        system_message="Extraes datos de fichas técnicas alimentarias y respondes únicamente con JSON válido.",
    ).with_model("gemini", "gemini-2.5-flash")
    resp = await chat.send_message(UserMessage(text=prompt))
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", (resp or "").strip(), flags=re.S)
    return json.loads(raw)


# ---------------- apply ----------------
def _empty(v) -> bool:
    if v is None:
        return True
    if isinstance(v, str):
        return not v.strip()
    if isinstance(v, (list, dict)):
        return len(v) == 0
    return False


async def apply_to_product(product_id: str, slug: str, extracted: dict, tech_url: str, tech_name: str) -> dict:
    """Rellena solo campos vacíos. Devuelve el patch aplicado."""
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    patch = {}
    if _empty((p.get("tech_sheet") or {}).get("url")):
        patch["tech_sheet"] = {"url": tech_url, "filename": tech_name}
    for field in ("description", "short_description", "highlights", "origin_country"):
        if _empty(p.get(field)) and not _empty(extracted.get(field)):
            patch[field] = extracted[field].strip()
    blocks = dict(p.get("description_blocks") or {})
    ext_blocks = extracted.get("description_blocks") or {}
    changed_blocks = False
    for k in BLOCK_KEYS:
        if _empty(blocks.get(k)) and not _empty(ext_blocks.get(k)):
            blocks[k] = str(ext_blocks[k]).strip()
            changed_blocks = True
    if changed_blocks:
        patch["description_blocks"] = blocks
    nut = extracted.get("nutrition") or []
    nut = [n for n in nut if isinstance(n, dict) and n.get("label") and n.get("value")]
    if _empty(p.get("nutrition")) and nut:
        patch["nutrition"] = nut
    if patch:
        patch["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.products.update_one({"id": product_id}, {"$set": patch})
    return patch


def load_enrichment() -> dict:
    if ENRICH_PATH.exists():
        try:
            return json.loads(ENRICH_PATH.read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001
            pass
    return {"generated_at": None, "products": {}}


def save_enrichment(store: dict) -> None:
    store["generated_at"] = datetime.now(timezone.utc).isoformat()
    ENRICH_PATH.parent.mkdir(parents=True, exist_ok=True)
    ENRICH_PATH.write_text(json.dumps(store, ensure_ascii=False, indent=1), encoding="utf-8")


async def main():
    limit = None
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])
    only_match = "--only-match" in sys.argv

    matches, unmatched = await build_matches()
    logger.info("PDFs emparejados: %d · sin emparejar: %d", len(matches), len(unmatched))
    for u in unmatched:
        logger.info("  SIN MATCH: %s (%s, score %s)", u["file"], u["reason"], u["score"])
    if only_match:
        for m in sorted(matches, key=lambda x: x["score"]):
            logger.info("  %.2f  %s -> %s", m["score"], m["file"]["original_filename"], m["product"]["name"])
        return

    store = load_enrichment()
    done = 0
    for m in matches:
        if limit and done >= limit:
            break
        slug = m["product"]["slug"]
        rec = store["products"].get(slug) or {}
        if rec.get("status") == "ok":
            continue  # ya procesado en una ejecución anterior
        f = m["file"]
        url = f"/api/files/{f['storage_path']}"
        try:
            data, _ctype = get_object(f["storage_path"])
            text = pdf_text(bytes(data))
            extracted = {}
            if len(text) >= 200:
                extracted = await llm_extract(m["product"]["name"], text)
            else:
                logger.warning("%s: PDF sin texto extraíble (%d chars); solo se asigna la ficha", slug, len(text))
            patch = await apply_to_product(m["product"]["id"], slug, extracted, url, f["original_filename"])
            store["products"][slug] = {
                "status": "ok",
                "file": f["original_filename"],
                "storage_path": f["storage_path"],
                "tech_sheet": {"url": url, "filename": f["original_filename"]},
                "extracted": extracted,
                "applied_fields": sorted(patch.keys()),
                "match_score": m["score"],
                "text_chars": len(text),
            }
            done += 1
            logger.info("[%d/%d] %s ← %s (campos: %s)", done, len(matches), slug,
                        f["original_filename"], ", ".join(sorted(patch.keys())) or "ninguno nuevo")
        except Exception as e:  # noqa: BLE001
            logger.error("%s: ERROR %s", slug, e)
            store["products"][slug] = {"status": "error", "file": f["original_filename"], "error": str(e)}
        if done % 5 == 0:
            save_enrichment(store)
    save_enrichment(store)
    ok = sum(1 for r in store["products"].values() if r.get("status") == "ok")
    logger.info("FINALIZADO: %d productos enriquecidos (registro en %s)", ok, ENRICH_PATH)


if __name__ == "__main__":
    asyncio.run(main())
