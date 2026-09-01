"""Correlación semántica (fuzzy matching) para la migración SEO.

Mapea los nombres actuales de los productos (con 'BIO' y variaciones) con los
nombres EXACTOS de la web antigua, para conservar nombres/slugs y no perder
posicionamiento. Genera /app/backend/data/seo_name_mapping.json:
  { "<nombre actual en la BD>": "<nombre exacto de la lista original>" }

Reglas:
- El valor es estrictamente uno de los nombres de la lista original.
- Ningún nombre original puede quedar sin mapear (no omitir productos).
Uso: python scripts/seo_name_mapping.py
"""
import asyncio
import json
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

OUT = Path(__file__).resolve().parent.parent / "data" / "seo_name_mapping.json"

ORIGINAL_NAMES = [
    "Acaí", "Acerola", "Camu Camu", "Maqui Berry", "Baobab", "Bayas de Goji", "Lúcuma",
    "Maca", "Maca Negra", "Maca Roja", "Guaraná en polvo", "Semillas de Guaraná", "Guayusa",
    "Moringa en polvo", "Chlorella", "Espirulina", "Té Matcha en polvo", "Levadura Nutricional",
    "Cardamomo en grano", "Canela Ceylán en polvo", "Canela Ceylán en Rama", "Clavo de olor",
    "Clavo de olor en polvo", "Cúrcuma en polvo", "Curry en polvo", "Garam Masala",
    "Ras El Hanout", "Jengibre en polvo", "Jengibre dados con Azúcar de caña",
    "Nuez moscada en polvo", "Nuez moscada entera", "Pimienta Negra en grano",
    "Pimienta Negra molida", "Mostaza en grano", "Mostaza en polvo", "Comino en Semillas",
    "Comino Molido", "Cilantro en polvo", "Cilantro en Semilla", "Anís estrellado",
    "Anís verde", "Hinojo en grano", "Eneldo hoja", "Albahaca", "Fenogreco en semilla",
    "Cebolla en escamas", "Cebolla en polvo", "Urucum en polvo (Achiote)", "Almendras",
    "Avellanas", "Avellana tostada y troceada", "Anacardos", "Nueces de Brasil",
    "Pistacho pelado crudo", "Pistacho tostado y salado", "Piñon Nacional",
    "Cacahuete Repelado", "Chufa Pelada", "Chufa sin pelar", "Dátil Medjoul",
    "Dátil sin hueso", "Pasas Sultanas", "Higos secos", "Orejón de Albaricoque",
    "Mango rodajas", "Mora blanca deshidratada", "Banana chips", "Tomate seco en mitades",
    "Arándanos Rojos Sin Azúcar", "Arroz Basmati", "Arroz Basmati Integral", "Arroz Jazmín",
    "Arroz Jazmín Integral", "Arroz Negro", "Arroz Rojo", "Arroz Salvaje",
    "Arroz Redondo Integral - BIO 5 kg", "Amaranto", "Amaranto Hinchado", "Quinoa Real",
    "Quinoa Real Negra", "Quinoa Real Roja", "Quinoa Real Tricolor", "Quinoa Hinchada",
    "Copos de Quinoa", "Trigo Sarraceno", "Copos de Trigo Sarraceno", "Mijo", "Mijo hinchado",
    "Bulgur Integral", "Avena pelada en grano", "Copos de Avena grandes",
    "Copos de Avena pequeños finos", "Maíz para Palomitas", "Alubias Rojas Kidney", "Azuki",
    "Garbanzo Castellano", "Garbanzo Lechoso", "Garbanzo Pedrosillano", "Lenteja Castellana",
    "Lenteja Pardina", "Lenteja Roja mitades", "Lenteja verde Dupuy", "Judía mungo",
    "Haba de soja", "Soja texturizada extra fina", "Soja texturizada fina",
    "Soja texturizada gruesa", "Harina de Algarroba", "Harina de Almendra",
    "Harina de Amaranto", "Harina de Arroz Integral", "Harina de Avena Integral",
    "Harina de Banana", "Harina de Castaña", "Harina de Chía", "Harina de Coco",
    "Harina de Garbanzos", "Harina de Maíz", "Harina de Mandioca", "Harina de Quinoa",
    "Harina de Teff", "Harina de Trigo Sarraceno", "Harina Integral de Espelta",
    "Almidón de Maíz Nativo", "Almidón de Mandioca", "Arrurruz", "Fécula de Patata",
    "Gluten de Trigo", "Goma de Guar", "Espaguetis Blancos - 3 Kg",
    "Espirales de guisante - Sin gluten 1 kg", "Espirales Integrales - 3 kg",
    "Macarrones Blancos - 3 kg", "Macarrones de Lenteja roja - Sin gluten 1 kg",
    "Macarrones Integrales - 3 kg", "Semillas de Alfalfa", "Semillas de Amapola",
    "Semillas de Calabaza", "Semillas de Cáñamo", "Semillas de Cáñamo pelado",
    "Semillas de Chía", "Semillas de Girasol", "Semillas de Lino Dorado",
    "Semillas de Lino Marrón", "Semillas de Lino marrón molido", "Semillas de Sésamo",
    "Semillas de Sésamo Negro", "Semillas de Sésamo pelado blanco", "Cacao en grano",
    "Cacao en polvo", "Cacao nibs Criollo", "Manteca de cacao", "Proteína de Cáñamo",
    "Proteína de Guisante", "Psyllium Cáscara", "Psyllium polvo", "Coco Rallado",
    "Leche de coco en polvo", "Azúcar de Coco", "Panela-Azúcar integral de caña",
    "Estevia en hoja", "Estevia en polvo", "Sirope de Agave", "Sirope de Arroz 25 kg",
]


# Nombres originales SIN equivalente en el catálogo actual (decisión del usuario:
# se marcan como "sin equivalente" en vez de forzar un mapeo aproximado).
SIN_EQUIVALENTE = [
    "Albahaca",                    # no existe ningún producto de albahaca en el catálogo
    "Harina de Chía",              # solo existe 'Semillas de Chía - BIO' (producto distinto)
    "Soja texturizada extra fina", # el catálogo tiene fina/media/gruesa, no 'extra fina'
]


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", (s or "").upper())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[-·]?\s*BIO\b|\bECO(?:LOGIC[OA])?\b", " ", s)
    s = re.sub(r"[^A-Z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def score(a: str, b: str) -> float:
    ratio = SequenceMatcher(None, a, b).ratio()
    ta, tb = set(a.split()), set(b.split())
    overlap = len(ta & tb) / max(1, len(ta | tb))
    contain = 0.2 if (a and b and (a in b or b in a)) else 0.0
    return 0.5 * ratio + 0.5 * overlap + contain


async def llm_resolve(pending_originals: list, current_names: list) -> dict:
    """Resuelve con IA los nombres originales que el matching determinista no asignó.
    Devuelve {nombre_original: nombre_actual | None}."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    if not pending_originals:
        return {}
    prompt = f"""Estamos migrando una tienda de alimentación ecológica. Empareja cada NOMBRE ORIGINAL
(web antigua) con el nombre actual EXACTO de la nueva base de datos (suelen llevar 'BIO' u otras
variaciones: sinónimos, orden distinto, 'molida'='en polvo', etc.).

NOMBRES ACTUALES DE LA BASE DE DATOS:
{json.dumps(current_names, ensure_ascii=False)}

NOMBRES ORIGINALES PENDIENTES:
{json.dumps(pending_originals, ensure_ascii=False)}

Devuelve SOLO JSON válido: {{"<nombre original>": "<nombre actual exacto de la lista o null>"}}
El valor debe ser EXACTAMENTE uno de los nombres actuales listados (copia literal) o null si no existe."""
    chat = LlmChat(
        api_key=os.environ.get("EMERGENT_LLM_KEY", ""),
        session_id=f"seomap-{uuid.uuid4().hex[:8]}",
        system_message="Emparejas nombres de productos y respondes únicamente con JSON válido.",
    ).with_model("gemini", "gemini-2.5-flash")
    resp = await chat.send_message(UserMessage(text=prompt))
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", (resp or "").strip(), flags=re.S)
    try:
        return json.loads(raw)
    except Exception:  # noqa: BLE001
        return {}


async def main():
    products = await db.products.find({}, {"_id": 0, "name": 1, "slug": 1}).to_list(2000)
    current = [p["name"] for p in products]
    curr_norm = {p["name"]: norm(p["name"]) for p in products}

    mapping = {}           # nombre_actual -> nombre_original
    used_current = set()
    pending = []
    to_match = [o for o in ORIGINAL_NAMES if o not in SIN_EQUIVALENTE]

    # 0) coincidencia EXACTA (normalizada, sin 'BIO'): tiene prioridad absoluta para que
    #    p.ej. 'Clavo de olor en polvo' -> 'Clavo de olor en polvo - BIO' no sea robado
    #    por el fuzzy de 'Clavo de olor'.
    norm_to_current = {}
    for name in current:
        norm_to_current.setdefault(curr_norm[name], name)
    exact_matched = set()
    for orig in to_match:
        cand = norm_to_current.get(norm(orig))
        if cand and cand not in used_current:
            mapping[cand] = orig
            used_current.add(cand)
            exact_matched.add(orig)

    # 1) matching determinista (mejor candidato por nombre original)
    for orig in to_match:
        if orig in exact_matched:
            continue
        on = norm(orig)
        best, best_s = None, 0.0
        for name in current:
            if name in used_current:
                continue
            s = score(on, curr_norm[name])
            if s > best_s:
                best, best_s = name, s
        if best and best_s >= 0.78:
            mapping[best] = orig
            used_current.add(best)
        else:
            pending.append(orig)

    # 2) IA para los pendientes
    available = [n for n in current if n not in used_current]
    llm_map = await llm_resolve(pending, available)
    unresolved = []
    for orig in pending:
        cand = llm_map.get(orig)
        if cand and cand in curr_norm and cand not in used_current:
            mapping[cand] = orig
            used_current.add(cand)
        else:
            unresolved.append(orig)

    slug_by_name = {p["name"]: p["slug"] for p in products}
    sin_equiv = sorted(set(SIN_EQUIVALENTE) | set(unresolved))
    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "note": "clave = nombre actual en la nueva plataforma · valor = nombre EXACTO de la web antigua",
        "mapping": dict(sorted(mapping.items(), key=lambda kv: kv[1])),
        "slugs": {name: slug_by_name.get(name) for name in mapping},
        "sin_equivalente": sin_equiv,
        "stats": {
            "originals_total": len(ORIGINAL_NAMES),
            "mapped": len(mapping),
            "sin_equivalente": len(sin_equiv),
            "current_products_total": len(current),
        },
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding="utf-8")
    total_cubiertos = len(mapping) + len(sin_equiv)
    print(f"Mapeo guardado en {OUT}")
    print(f"  originales: {len(ORIGINAL_NAMES)} · mapeados: {len(mapping)} · sin equivalente: {len(sin_equiv)}")
    print(f"  cubiertos: {total_cubiertos}/{len(ORIGINAL_NAMES)}")
    for u in sin_equiv:
        print("   SIN EQUIVALENTE:", u)


if __name__ == "__main__":
    asyncio.run(main())
