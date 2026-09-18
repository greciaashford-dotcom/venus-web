"""Consolida el catálogo a los 163 productos oficiales del cliente.

- Empareja cada producto objetivo (nombre + slug SEO del Excel) con un producto de la BD
  por nombre normalizado (fuzzy). Reasigna el slug SEO EXACTO y el nombre del Excel.
- Los productos de la BD que no estén en la lista se DESACTIVAN (active=False), conservando
  todos sus datos (no se borran).
- Overrides manuales para casos ambiguos (pasta separada por formato, nombres muy distintos).

Uso:
    python -m scripts.consolidate_catalog --dry-run   # sólo informe
    python -m scripts.consolidate_catalog --apply     # aplica cambios
"""
import argparse
import asyncio
import difflib
import os
import re
import sys
import unicodedata
import uuid
from datetime import datetime, timezone
from pathlib import Path

import openpyxl
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

XLSX = Path("/app/lista-productos-ecoandes.xlsx")

# Overrides manuales: target_slug -> SKU exacto del producto en BD.
# Para desambiguar donde el matcher fuzzy falla o hay riesgo de cruce.
MANUAL_BY_SKU = {
    "acai-en-polvo": "ACA70",              # Açaí en polvo
    "acerola-en-polvo": "ACE70",           # Acerola liofilizada en polvo
    "almendras": "ALMP100",                # Almendra con piel
    "avellana": "AVELP100",                # Avellana cruda con piel
    "avellana-tostada-y-troceada": "AVELT-100",
    "cacao-en-grano": "CACG250",           # Cacao en granos
    "arandanos-rojos-sin-azucar": "ARAR100",
    "canela-ceylan-en-polvo": "CAN100",
    "canela-en-rama": "CANR100",           # Canela en rama Ceylán
    "harina-de-maiz": "HMAIZ500",
    "harina-de-mandioca": "HMA500",
    "harina-de-teff": "HTEF500",
    "harina-de-trigo-sarraceno": "HTS500",
    "harina-de-algarroba": "HALG500",
    "harina-de-almendra": "HALM250",
    "harina-de-amaranto": "HAM500",
    "harina-de-arroz-integral": "HARRI500",
    "harina-de-avena-integral": "HAVSG500",
    "harina-de-banana": "HBAN250",
    "harina-de-castana": "HCAST250",
    "harina-de-coco": "HCC500",
    "harina-de-garbanzos": "HGAR500",
    "harina-de-quinoa": "HQ500",
    "harina-integral-de-espelta": "HIESP1",
    "semillas-de-sesamo": "SSEN250",
    "semillas-de-sesamo-blanco-pelado": "SSEP250",
    "semillas-de-sesamo-negro": "SSENN250",
    "semillas-de-alfalfa": "SAA250",
    "semillas-de-amapola": "SAM250",
    "semillas-de-calabaza": "SCA250",
    "semillas-de-chia": "SCH250",
    "semillas-de-canamo": "SCN250",
    "semillas-de-canamo-pelado": "SCNP250",
    "semillas-de-girasol": "SGIR250",
    "semillas-de-guarana": "SGR100",
    "semillas-de-lino-dorado": "SLID250",
    "semillas-de-lino-marron": "SLIM250",
    "semillas-de-lino-marron-molido": "SLMM250",
    "trigo-sarraceno": "TSP500",           # Trigo Sarraceno pelado
    "panela": "PNL500",                    # Panela-Azúcar integral de caña
    "lenteja-verde-verdina": "LENF25-500", # Lenteja verde DUPUY (500 g/1 kg)
    "lenteja-roja": "LRC25-500",           # Lenteja Roja Coral mitades
    # Pasta: cada formato es un producto/página independiente con su URL propia
    "espaguetis-blancos-bio": "ESB3",
    "espaguetis-integrales-bio": "ESPIG",  # Espirales 100% guisante (SG)
    "espirales-integrales-bio": "ESPI3",
    "macarrones-blancos-bio": "MCB3",
    "macarrones-de-lenteja-roja-sin-gluten-1-kg": "MACLR",
    "macarrones-integrales-bio": "MCI3",
}

# Objetivos que NO existen en la BD y hay que CREAR (clonando un producto similar
# como punto de partida; el precio/contenido se revisa después en el admin).
CREATE_MISSING = {
    "harina-de-chia-bio": {"name": "Harina de Chía", "clone_from": "SCH250", "sku": "HCHIA500", "category": "Harinas"},
}


def slug_from_url(u: str) -> str:
    m = re.search(r"/producto/([^/]+)/?", (u or "").strip())
    return m.group(1) if m else ""


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    for junk in ["bio", "sin gluten", "liofilizado", "liofilizada", "nativo", "nativa"]:
        s = s.replace(junk, " ")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def tokens(s: str) -> set:
    return set(norm(s).split())


def score(a: str, b: str) -> float:
    na, nb = norm(a), norm(b)
    ta, tb = set(na.split()), set(nb.split())
    jac = len(ta & tb) / max(1, len(ta | tb))
    ratio = difflib.SequenceMatcher(None, na, nb).ratio()
    # bonus si uno contiene al otro
    contain = 1.0 if (na in nb or nb in na) else 0.0
    return 0.5 * jac + 0.4 * ratio + 0.1 * contain


def load_targets():
    wb = openpyxl.load_workbook(XLSX)
    ws = wb.active
    out = []
    for row in list(ws.iter_rows(values_only=True))[1:]:
        name, url = row[0], row[1]
        if name and url:
            out.append({"name": str(name).strip(), "slug": slug_from_url(str(url))})
    return out


async def build_mapping(db):
    prods = await db.products.find({}, {"_id": 0}).to_list(1000)
    by_sku = {p["sku"]: p for p in prods}
    by_slug = {p["slug"]: p for p in prods}
    targets = load_targets()

    mapping = []          # {target, product, method, score}
    used_ids = set()
    unresolved = []

    # Índice para conservar el orden original de los objetivos en la salida
    order = {id(t): i for i, t in enumerate(targets)}
    result_by_tid = {}

    # Pass 1: overrides manuales por SKU (reservan primero)
    pending = []
    for t in targets:
        ov = MANUAL_BY_SKU.get(t["slug"])
        if ov and ov in by_sku and by_sku[ov]["id"] not in used_ids:
            prod = by_sku[ov]
            used_ids.add(prod["id"])
            result_by_tid[id(t)] = {"target": t, "product": prod, "method": "manual-sku", "score": 1.0}
        else:
            pending.append(t)

    # Pass 2: slug exacto
    still = []
    for t in pending:
        p = by_slug.get(t["slug"])
        if p and p["id"] not in used_ids:
            used_ids.add(p["id"])
            result_by_tid[id(t)] = {"target": t, "product": p, "method": "slug", "score": 1.0}
        else:
            still.append(t)

    # Pass 3: fuzzy por nombre
    for t in still:
        best, best_sc = None, 0.0
        for p in prods:
            if p["id"] in used_ids:
                continue
            s = score(t["name"], p["name"])
            if s > best_sc:
                best, best_sc = p, s
        if best is None or best_sc < 0.34:
            unresolved.append((t, best, best_sc))
            continue
        used_ids.add(best["id"])
        result_by_tid[id(t)] = {"target": t, "product": best, "method": "fuzzy", "score": round(best_sc, 2)}

    for t in targets:
        if id(t) in result_by_tid:
            mapping.append(result_by_tid[id(t)])

    extras = [p for p in prods if p["id"] not in used_ids]
    return mapping, unresolved, extras, prods


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = c[os.environ["DB_NAME"]]
    mapping, unresolved, extras, prods = await build_mapping(db)

    resolved = [m for m in mapping if m.get("product")]
    to_create = [(t, p, sc) for (t, p, sc) in unresolved if t["slug"] in CREATE_MISSING]
    blocking = [(t, p, sc) for (t, p, sc) in unresolved if t["slug"] not in CREATE_MISSING]
    low = [m for m in resolved if m["score"] < 0.55]

    print(f"TARGETS: 163 | resolved(db)={len(resolved)} | to_create={len(to_create)} | blocking={len(blocking)}")
    print(f"EXTRA DB products (to deactivate): {len(extras)}")
    print("\n=== LOW-CONFIDENCE MATCHES (score<0.55) ===")
    for m in sorted(low, key=lambda x: x["score"]):
        print(f"  {m['score']:.2f} | {m['target']['name'][:34]:34s} -> {m['product']['name'][:38]} ({m['product']['sku']})")
    print("\n=== TO CREATE (no existe en BD) ===")
    for t, p, sc in to_create:
        print(f"  {t['name']} [{t['slug']}] (clonar de {CREATE_MISSING[t['slug']]['clone_from']})")
    print("\n=== BLOCKING UNRESOLVED ===")
    for t, p, sc in blocking:
        print(f"  {t['name']} [{t['slug']}] best={p['name'] if p else None} ({sc:.2f})")
    print("\n=== EXTRAS TO DEACTIVATE ===")
    for p in sorted(extras, key=lambda x: x["name"]):
        print(f"  {'A' if p['active'] else 'x'} {p['name']} ({p['sku']}) [{p['slug']}]")

    # Sanity: cada producto usado una sola vez
    used = [m["product"]["id"] for m in resolved]
    if len(used) != len(set(used)):
        from collections import Counter
        dup_ids = [i for i, n in Counter(used).items() if n > 1]
        print("\n!!! PRODUCTOS DUPLICADOS EN EL MAPEADO !!!")
        for m in resolved:
            if m["product"]["id"] in dup_ids:
                print(f"  target='{m['target']['name']}' [{m['target']['slug']}] -> {m['product']['name']} ({m['product']['sku']}) via {m['method']}")
        return

    if not args.apply:
        print("\n(dry-run; usa --apply para aplicar)")
        return

    if blocking:
        print("\nABORTADO: hay objetivos sin resolver (blocking). Revisa los overrides.")
        return

    now = datetime.now(timezone.utc).isoformat()
    target_slugs = {m["target"]["slug"] for m in resolved} | {t["slug"] for t, _, _ in to_create}
    mapped_ids = set(used)

    # Fase A: desactivar extras y liberar cualquier slug objetivo que ocupen
    deactivated = 0
    for p in prods:
        if p["id"] in mapped_ids:
            continue
        upd = {"active": False, "updated_at": now}
        if p["slug"] in target_slugs:
            upd["slug"] = f"arch-{p['sku']}".lower()
        await db.products.update_one({"id": p["id"]}, {"$set": upd})
        deactivated += 1

    # Fase B: mover todos los mapeados a un slug temporal único (evita colisiones)
    for m in resolved:
        await db.products.update_one({"id": m["product"]["id"]}, {"$set": {"slug": f"tmp-{m['product']['id']}"}})

    # Fase C: asignar slug SEO + nombre exactos del cliente y activar
    updated = 0
    for m in resolved:
        await db.products.update_one(
            {"id": m["product"]["id"]},
            {"$set": {
                "slug": m["target"]["slug"],
                "name": m["target"]["name"],
                "active": True,
                "updated_at": now,
            }},
        )
        updated += 1

    # Fase D: crear objetivos ausentes (clonando un producto similar)
    created = 0
    for t, _, _ in to_create:
        spec = CREATE_MISSING[t["slug"]]
        tmpl = await db.products.find_one({"sku": spec["clone_from"]}, {"_id": 0})
        if not tmpl:
            print(f"  ! No se pudo clonar {t['slug']} (falta {spec['clone_from']})")
            continue
        doc = dict(tmpl)
        doc["id"] = str(uuid.uuid4())
        doc["sku"] = spec["sku"]
        doc["slug"] = t["slug"]
        doc["name"] = spec.get("name", t["name"])
        doc["category"] = spec.get("category", doc.get("category", "General"))
        doc["active"] = True
        doc["tech_sheet"] = {"url": "", "filename": ""}
        doc["translations"] = {}
        doc["best_seller"] = False
        doc["featured"] = False
        doc["created_at"] = now
        doc["updated_at"] = now
        vars_new = []
        for i, v in enumerate(doc.get("variations") or []):
            v = dict(v)
            v["sku"] = f"{spec['sku']}-{i+1}"
            vars_new.append(v)
        doc["variations"] = vars_new
        await db.products.insert_one(doc)
        created += 1

    total = await db.products.count_documents({})
    active = await db.products.count_documents({"active": True})
    print(f"\nAPLICADO: {updated} actualizados, {created} creados, {deactivated} desactivados.")
    print(f"BD ahora: total={total}, activos={active} (objetivo 163).")


asyncio.run(main())
