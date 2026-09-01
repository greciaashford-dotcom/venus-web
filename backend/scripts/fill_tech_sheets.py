"""One-time script: fill description_blocks, nutrition, origin_country and
tech_sheet for the first block of products whose ficha técnica (PDF) was
provided. Idempotent: safe to re-run. Preserved across catalog reconciliation
(import_catalog keeps description_blocks/nutrition/tech_sheet).
"""
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.config import db  # noqa: E402


def n(key, label, value):
    return {"key": key, "label": label, "value": value}


PRODUCTS = {
    # ---------------- Açaí en polvo ----------------
    "ACA70": {
        "origin_country": "Brasil",
        "tech_sheet": {"url": "/docs/ACAI-FT-ECOANDES.pdf", "filename": "ACAI-FT-ECOANDES.pdf"},
        "description_blocks": {
            "ingredients": "100% açaí de cultivo ecológico.",
            "origin": "Brasil (Amazonía). El açaí es una pequeña baya púrpura que crece en la "
                      "Amazonía de Sudamérica. Se cosecha dos veces al año; estas bayas de color "
                      "púrpura casi negro son un auténtico tesoro de nutrientes.",
            "benefits": "Antocianinas (HPLC): 385 mg/100 g.\n"
                        "Polifenoles totales: 3.300 mg de ácido gálico/100 g.\n"
                        "Capacidad antioxidante: >70.000 µmol TE/100 g.\n"
                        "Pureza total: 99,99%.",
            "usage": "3-5 g por vaso, diluido en zumos, batidos, yogures, etc. También apto para "
                     "repostería y panadería.\n"
                     "Reconstitución: 1 L de agua + 100 g de açaí liofilizado EcoAndes = 1 L de açaí "
                     "puro tipo B.\n"
                     "Equivalencia: 1 kg de açaí en polvo EcoAndes = 9 kg de açaí puro tipo B.",
            "storage": "Conservar bajo condiciones ambientales (<21 °C – HR 70%), protegido del sol. "
                       "Vida media: 24 meses respetando las condiciones de almacenamiento.",
        },
        "nutrition": [
            n("energy", "Energía", "2263 kJ / 541 kcal"),
            n("fat", "Grasas", "54 g"),
            n("saturates", "de las cuales saturadas", "15 g"),
            n("carbohydrate", "Hidratos de carbono", "8,5 g"),
            n("sugars", "de los cuales azúcares", "1 g"),
            n("fibre", "Fibra", "27 g"),
            n("protein", "Proteínas", "9,8 g"),
            n("salt", "Sal", "0,16 g"),
        ],
    },
    # ---------------- Acerola liofilizada en polvo ----------------
    "ACE70": {
        "origin_country": "Brasil",
        "tech_sheet": {"url": "/docs/ACEROLA-FT-ECOANDES-2023.pdf", "filename": "ACEROLA-FT-ECOANDES-2023.pdf"},
        "description_blocks": {
            "ingredients": "100% acerola liofilizada en polvo procedente de cultivo ecológico.",
            "origin": "Brasil. La acerola proviene de América Central y del Sur. Es un fruto famoso "
                      "por su altísimo contenido en vitamina C, hasta 40 veces superior al de las "
                      "naranjas. La recolección se realiza cuando las bayas aún están verdes, por su "
                      "mayor concentración de vitamina C.",
            "benefits": "Alto contenido en vitamina C.\n"
                        "Producto de producción ecológica.\n"
                        "NO modificado genéticamente.\n"
                        "NO irradiado.\n"
                        "SIN aditivos.\n"
                        "SIN estabilizantes.",
            "usage": "3-5 g por vaso, diluido en zumos, batidos, yogures, etc. También apto para "
                     "repostería y panadería según las concentraciones requeridas.",
            "storage": "Conservar en un lugar fresco y seco (<21 °C – HR 70%), protegido del sol. "
                       "Mantener el envase bien cerrado (riesgo de endurecimiento). Vida media: "
                       "24 meses respetando las condiciones de almacenamiento.",
        },
        "nutrition": [
            n("energy", "Energía", "1443 kJ / 345 kcal"),
            n("fat", "Grasas", "0 g"),
            n("saturates", "de las cuales saturadas", "0 g"),
            n("carbohydrate", "Hidratos de carbono", "87 g"),
            n("sugars", "de los cuales azúcares", "31 g"),
            n("fibre", "Fibra", "8,2 g"),
            n("protein", "Proteínas", "7,6 g"),
            n("salt", "Sal", "0,018 g"),
            n("vitc", "Vitamina C", ">10 g"),
        ],
    },
    # ---------------- Almendra ----------------
    "ALMP100": {
        "origin_country": "España",
        "tech_sheet": {"url": "/docs/FICHA-TECNICA-ALMENDRA-PELADA-2025.pdf", "filename": "FICHA-TECNICA-ALMENDRA-PELADA-2025.pdf"},
        "description_blocks": {
            "ingredients": "100% almendra de producción ecológica.",
            "origin": "España. Otros orígenes posibles según la disponibilidad de stock.",
            "benefits": "Las almendras son frutos secos nutritivos, de sabor delicado y dulzón. "
                        "Ayudan a fortalecer los huesos, el cabello y la piel, y son beneficiosas "
                        "para el corazón (recomendadas por la Fundación Española del Corazón). "
                        "Son ricas en fibra, proteínas, vitaminas B y E, grasas saludables, hierro, "
                        "calcio y fósforo.",
            "usage": "No requiere cocción. Se consume como aperitivo.",
            "storage": "Conservar bajo condiciones ambientales (<21 °C – HR 70%), protegido del sol.",
        },
        "nutrition": [
            n("energy", "Energía", "1670 kJ / 399 kcal"),
            n("fat", "Grasas", "5,7 g"),
            n("saturates", "de las cuales saturadas", "0,7 g"),
            n("carbohydrate", "Hidratos de carbono", "60,9 g"),
            n("sugars", "de los cuales azúcares", "0,8 g"),
            n("fibre", "Fibra", "7,6 g"),
            n("protein", "Proteínas", "21,6 g"),
            n("salt", "Sal", "0,002 g"),
        ],
    },
    # ---------------- Almidón de Maíz Nativo ----------------
    "AMM400": {
        "origin_country": "Austria",
        "tech_sheet": {"url": "/docs/ALMIDON-DE-MAIZ-NATIVO-FT-ECOANDES.pdf", "filename": "ALMIDON-DE-MAIZ-NATIVO-FT-ECOANDES.pdf"},
        "description_blocks": {
            "ingredients": "100% maíz nativo de cultivo ecológico.",
            "origin": "Austria. El almidón de maíz nativo es un polisacárido natural que se extrae "
                      "de los granos de maíz.",
            "benefits": "El almidón de maíz nativo es un polisacárido natural extraído de los granos "
                        "de maíz. Su sabor es neutro, por lo que no suele dominar las recetas, aunque "
                        "en grandes cantidades puede llegar a detectarse. Destaca por su textura "
                        "esponjosa y sus propiedades espesantes.\n\n"
                        "Pureza total: 99,99%. Libre de pesticidas. Sin OGM, no irradiado, sin "
                        "aditivos ni estabilizantes.",
            "usage": "Espesante. Empleado en sopas y purés. Gelatiniza en agua a unos 80 °C hasta "
                     "obtener una pasta de alta viscosidad; al enfriar forma un gel semisólido "
                     "(el característico pudding de almidón de maíz).",
            "storage": "Conservar bajo condiciones ambientales (<21 °C – HR 70%), protegido del sol.",
        },
        "nutrition": [
            n("energy", "Energía", "1481 kJ / 354 kcal"),
            n("fat", "Grasas", "0,1 g"),
            n("saturates", "de las cuales saturadas", "<0,1 g"),
            n("carbohydrate", "Hidratos de carbono", "87 g"),
            n("sugars", "de los cuales azúcares", "—"),
            n("fibre", "Fibra", "0 g"),
            n("protein", "Proteínas", "<0,5 g"),
            n("salt", "Sal", "0,0225 g"),
        ],
    },
    # ---------------- Almidón de Mandioca ----------------
    "AMT400": {
        "origin_country": "Brasil",
        "tech_sheet": {"url": "/docs/ALMIDON-DE-MANDIOCA-FT-ECOANDES.pdf", "filename": "ALMIDON-DE-MANDIOCA-FT-ECOANDES.pdf"},
        "description_blocks": {
            "ingredients": "100% almidón de mandioca de cultivo ecológico.",
            "origin": "Brasil. El almidón de mandioca se extrae de las raíces de la mandioca "
                      "(tapioca, yuca o casave).",
            "benefits": "El almidón de mandioca se extrae de las raíces de la mandioca (tapioca, yuca "
                        "o casave). Su sabor es neutro, por lo que no suele dominar las recetas, aunque "
                        "en grandes cantidades puede llegar a detectarse. Destaca por su textura "
                        "esponjosa y sus propiedades espesantes.\n\n"
                        "Certificación ecológica (ES-ECO-023-MA). Pureza total: 99,99%. Apto para "
                        "vegetarianos, veganos y lactovegetarianos. Libre de pesticidas. Sin OGM, no "
                        "irradiado, sin aditivos ni estabilizantes.",
            "usage": "Espesante. Empleado en sopas y purés.",
            "storage": "Conservar bajo condiciones ambientales (<21 °C – HR 70%), protegido del sol.",
        },
        "nutrition": [
            n("energy", "Energía", "1498 kJ / 358 kcal"),
            n("fat", "Grasas", "0,02 g"),
            n("saturates", "de las cuales saturadas", "0,01 g"),
            n("carbohydrate", "Hidratos de carbono", "88,69 g"),
            n("sugars", "de los cuales azúcares", "3,35 g"),
            n("fibre", "Fibra", "0,9 g"),
            n("protein", "Proteínas", "0,19 g"),
            n("salt", "Sal", "0,0025 g"),
        ],
    },
}


async def main():
    now = datetime.now(timezone.utc).isoformat()
    for sku, data in PRODUCTS.items():
        prod = await db.products.find_one({"sku": sku})
        if not prod:
            print(f"[WARN] Product not found by SKU={sku}")
            continue
        updates = {
            "origin_country": data["origin_country"],
            "tech_sheet": data["tech_sheet"],
            "nutrition": data["nutrition"],
            "updated_at": now,
        }
        # Merge description blocks onto existing (keep certifications if present)
        existing_blocks = prod.get("description_blocks") or {}
        merged = {**existing_blocks, **data["description_blocks"]}
        updates["description_blocks"] = merged
        # Drop stale translations for these fields so the worker regenerates them
        res = await db.products.update_one(
            {"sku": sku},
            {"$set": updates, "$unset": {
                "translations.en.description_blocks": "",
                "translations.fr.description_blocks": "",
                "translations.de.description_blocks": "",
                "translations.it.description_blocks": "",
                "translations.pt.description_blocks": "",
            }},
        )
        print(f"[OK] {sku} ({prod.get('name')}) updated matched={res.matched_count} "
              f"origin={data['origin_country']} nutri_rows={len(data['nutrition'])}")


if __name__ == "__main__":
    asyncio.run(main())
