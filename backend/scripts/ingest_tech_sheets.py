"""Batch AI ingestion of tech-sheet PDFs (Archivos) -> product DESCRIPTION,
NUTRITION and ORIGIN.

- Matches each uploaded PDF (db.files, application/pdf) to a product by name.
- Extracts structured data from the PDF via Gemini (Emergent LLM key).
- Fills description_blocks (ingredients/origin/benefits/usage/storage),
  nutrition rows, origin_country and tech_sheet (downloadable PDF URL).
- Idempotent: progress stored in db.tech_ingest; already-done products skipped.
- Preserves the 5 manually-curated SKUs.

Run:  python -m scripts.ingest_tech_sheets            (all pending)
      python -m scripts.ingest_tech_sheets --limit 15 (test batch)
"""
import argparse
import asyncio
import json
import logging
import os
import re
import sys
import tempfile
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.config import db  # noqa: E402
from core.storage import get_object  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
logger = logging.getLogger("ingest")

EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Manually curated SKUs (skip so we don't clobber them)
SKIP_SKUS = {"ACA70", "ACE70", "ALMP100", "AMM400", "AMT400"}

# Explicit filename-substring -> SKU overrides for tricky matches
# (plural/synonym cases the token matcher can't resolve confidently).
MANUAL_OVERRIDES = {
    "chufa-entera": "CHUF1",
    "garbanzo-castellano": "GC25-500",
    "higo-turco": "HIG100",
    "nuez-de-brasil": "COQB100",
    "psyllium-husk": "PSY125",
    "calabaza-pelada": "SCA250",
    "sesamo-natural": "SSEN250",
}

STOP = {
    "ficha", "tecnica", "técnica", "ft", "ecoandes", "bio", "compressed",
    "de", "en", "y", "la", "el", "los", "las", "del", "con", "sin",
    "gluten", "premium", "2023", "2024", "2025", "2026", "1", "2", "3",
}


def _norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode("ascii")
    return s.lower()


def _stem(t: str) -> str:
    # crude Spanish plural -> singular normalization
    if len(t) > 4:
        if t.endswith("es"):
            return t[:-2]
        if t.endswith("s"):
            return t[:-1]
    return t


def _tokens(s: str) -> set:
    s = _norm(s)
    s = re.sub(r"\(\d+\)", " ", s)          # drop "(1)"
    s = re.sub(r"[^a-z0-9]+", " ", s)
    toks = {_stem(t) for t in s.split() if t and t not in STOP and len(t) > 2}
    return toks


def _clean_filename(fn: str) -> str:
    fn = re.sub(r"\.pdf$", "", fn or "", flags=re.I)
    fn = re.sub(r"_compressed$", "", fn, flags=re.I)
    return fn


SYSTEM = (
    "Eres un asistente que extrae datos de fichas técnicas de producto (PDF) de EcoAndes. "
    "Devuelves SIEMPRE un único objeto JSON válido, en español, sin texto adicional ni markdown."
)

PROMPT = """Extrae la información de esta ficha técnica y devuélvela EXCLUSIVAMENTE como JSON con esta forma exacta:
{
  "origin_country": "país de origen tal cual aparece (ej. 'España', 'Brasil', 'Perú'); vacío si no aparece",
  "ingredients": "ingredientes (ej. '100% ...')",
  "origin": "1-2 frases sobre el origen/descripción del producto",
  "benefits": "beneficios y propiedades principales, separados por saltos de línea",
  "usage": "modo de empleo / recomendaciones de consumo",
  "storage": "conservación / almacenamiento",
  "nutrition": [ {"label": "Energía", "value": "... kJ / ... kcal"}, {"label": "Grasas", "value": "... g"}, {"label": "de las cuales saturadas", "value": "... g"}, {"label": "Hidratos de carbono", "value": "... g"}, {"label": "de los cuales azúcares", "value": "... g"}, {"label": "Fibra", "value": "... g"}, {"label": "Proteínas", "value": "... g"}, {"label": "Sal", "value": "... g"} ]
}
Reglas: valores nutricionales por 100 g EXACTAMENTE como en el documento. Incluye vitaminas/minerales extra si aparecen. Si un campo no está, usa cadena vacía o lista vacía. NO inventes datos."""


async def _extract_pdf(path: str) -> dict:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType

    chat = LlmChat(api_key=EMERGENT_KEY, session_id=f"ingest-{os.path.basename(path)}",
                   system_message=SYSTEM).with_model("gemini", "gemini-2.5-flash")
    pdf = FileContentWithMimeType(mime_type="application/pdf", file_path=path)
    msg = UserMessage(text=PROMPT, file_contents=[pdf])
    raw = await chat.send_message(msg)
    text = raw if isinstance(raw, str) else str(raw)
    # strip code fences
    text = re.sub(r"^```(json)?", "", text.strip())
    text = re.sub(r"```$", "", text.strip()).strip()
    # grab first {...}
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError(f"No JSON in model output: {text[:200]}")
    return json.loads(m.group(0))


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", _norm(s)).strip("_")


async def build_matches():
    """Return list of (file_doc, product) best matches."""
    files = await db.files.find(
        {"content_type": "application/pdf", "is_deleted": False}, {"_id": 0}
    ).to_list(2000)
    products = await db.products.find({}, {"_id": 0, "id": 1, "sku": 1, "name": 1, "slug": 1}).to_list(2000)
    prod_tokens = [(p, _tokens(p["name"])) for p in products]
    by_sku = {p["sku"]: p for p in products}

    matches, unmatched = [], []
    used = {}
    for f in files:
        fname = _clean_filename(f.get("original_filename", ""))
        # explicit overrides first
        nfn = _norm(fname)
        ov = next((sku for key, sku in MANUAL_OVERRIDES.items() if key in nfn), None)
        if ov and ov in by_sku:
            matches.append((f, by_sku[ov], 1.0))
            continue
        ftoks = _tokens(fname)
        if not ftoks:
            unmatched.append((f, None, 0))
            continue
        best, best_score = None, 0.0
        for p, ptoks in prod_tokens:
            if not ptoks:
                continue
            inter = len(ftoks & ptoks)
            if inter == 0:
                continue
            score = inter / len(ftoks)  # fraction of filename tokens found in product
            # bonus if all filename tokens matched
            if ftoks <= ptoks:
                score += 0.3
            if score > best_score:
                best, best_score = p, score
        if best and best_score >= 0.6:
            matches.append((f, best, round(best_score, 2)))
        else:
            unmatched.append((f, best, round(best_score, 2)))
    return matches, unmatched


async def process(limit: int = 0, dry: bool = False):
    if not EMERGENT_KEY:
        logger.error("EMERGENT_LLM_KEY missing; cannot run ingestion.")
        return
    matches, unmatched = await build_matches()
    logger.info("Matched %d PDFs, unmatched %d", len(matches), len(unmatched))
    for f, best, sc in unmatched[:40]:
        logger.info("  UNMATCHED: %s (best guess %s @ %.2f)", f.get("original_filename"),
                    best["name"] if best else "-", sc)

    done = set()
    async for r in db.tech_ingest.find({"status": "ok"}, {"_id": 0, "product_id": 1}):
        done.add(r["product_id"])

    sem = asyncio.Semaphore(3)
    processed = {"ok": 0, "fail": 0, "skip": 0}

    async def _one(f, product, score):
        if product["sku"] in SKIP_SKUS or product["id"] in done:
            processed["skip"] += 1
            return
        async with sem:
            tmp_path = None
            try:
                data, ct = get_object(f["storage_path"])
                with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                    tmp.write(data)
                    tmp_path = tmp.name
                info = await _extract_pdf(tmp_path)
            except Exception as e:  # noqa: BLE001
                logger.warning("FAIL %s (%s): %s", product["sku"], product["name"], str(e)[:160])
                await db.tech_ingest.update_one(
                    {"product_id": product["id"]},
                    {"$set": {"product_id": product["id"], "sku": product["sku"],
                              "status": "fail", "error": str(e)[:300],
                              "file": f.get("original_filename"),
                              "updated_at": datetime.now(timezone.utc).isoformat()}},
                    upsert=True,
                )
                processed["fail"] += 1
                return
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    os.unlink(tmp_path)

            blocks = {
                "ingredients": (info.get("ingredients") or "").strip(),
                "origin": (info.get("origin") or "").strip(),
                "benefits": (info.get("benefits") or "").strip(),
                "usage": (info.get("usage") or "").strip(),
                "storage": (info.get("storage") or "").strip(),
            }
            nutrition = []
            for n in (info.get("nutrition") or []):
                lbl = str(n.get("label", "")).strip()
                val = str(n.get("value", "")).strip()
                if lbl and val:
                    nutrition.append({"key": _slug(lbl), "label": lbl, "value": val})
            origin_country = (info.get("origin_country") or "").strip()

            if dry:
                logger.info("[DRY] %s <- %s | origin=%s | nutri=%d",
                            product["sku"], f.get("original_filename"), origin_country, len(nutrition))
                processed["ok"] += 1
                return

            prod = await db.products.find_one({"id": product["id"]}, {"_id": 0, "description_blocks": 1})
            existing_blocks = (prod or {}).get("description_blocks") or {}
            merged = {**existing_blocks}
            for k, v in blocks.items():
                if v:
                    merged[k] = v
            updates = {
                "description_blocks": merged,
                "tech_sheet": {"url": f"/api/files/{f['storage_path']}",
                               "filename": f.get("original_filename")},
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            if nutrition:
                updates["nutrition"] = nutrition
            if origin_country:
                updates["origin_country"] = origin_country
            await db.products.update_one(
                {"id": product["id"]},
                {"$set": updates, "$unset": {
                    "translations.en.description_blocks": "",
                    "translations.fr.description_blocks": "",
                    "translations.it.description_blocks": "",
                    "translations.pt.description_blocks": "",
                }},
            )
            await db.tech_ingest.update_one(
                {"product_id": product["id"]},
                {"$set": {"product_id": product["id"], "sku": product["sku"],
                          "status": "ok", "score": score,
                          "file": f.get("original_filename"),
                          "nutri_rows": len(nutrition), "origin": origin_country,
                          "updated_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True,
            )
            processed["ok"] += 1
            logger.info("OK %s (%s) origin=%s nutri=%d [%d ok/%d fail]",
                        product["sku"], product["name"], origin_country, len(nutrition),
                        processed["ok"], processed["fail"])

    todo = matches if not limit else matches[:limit]
    await asyncio.gather(*[_one(f, p, sc) for f, p, sc in todo])
    logger.info("DONE. ok=%d fail=%d skip=%d (matched=%d)",
                processed["ok"], processed["fail"], processed["skip"], len(matches))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()
    asyncio.run(process(limit=args.limit, dry=args.dry))
