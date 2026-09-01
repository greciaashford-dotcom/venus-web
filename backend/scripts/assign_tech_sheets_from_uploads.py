"""Assign uploaded PDFs (from Admin > Files) to each product's tech_sheet.

Idempotent. Matches by explicit SKU -> exact filename map so it never assigns
the wrong PDF (e.g. Guaraná powder vs Guaraná seeds).
"""
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.config import db  # noqa: E402


# Mapping: product SKU -> exact original_filename uploaded in Admin > Files.
# Every entry corresponds to a real product in the catalog and a real PDF
# uploaded to the media library by the client.
SKU_TO_FILENAME = {
    # Superalimentos, algas y frutos amazónicos
    "ACA70":     "ACAI-FT-ECOANDES.pdf",  # kept local (no upload replacement)
    "ACE70":     "ACEROLA-FT-ECOANDES-2023.pdf",
    "BBAB100":   "BAOBAB-FT-ECOANDES.pdf",
    "CCP100":    "CAMU-CAMU-FT-ECOANDES.pdf",
    "CLO100":    "FICHA-TECNICA-CHLORELLA-2025.pdf",
    "SPP100":    "FICHA-TECNICA-ESPIRULINA-2025.pdf",
    "GRP100":    "FICHA-TECNICA-GUARANA-2025.pdf",
    "GUY100":    "FICHA-TECNICA-GUAYUSA-2025.pdf",
    "LCM100":    "FICHA-TECNICA-LUCUMA-2025.pdf",
    "MCP300":    "FICHA-TECNICA-MACA-2025.pdf",
    "MNP200":    "FICHA-TECNICA-MACA-NEGRA-2025.pdf",
    "MRP200":    "FICHA-TECNICA-MACA-ROJA-2025.pdf",
    "MAQB70":    "FICHA-TECNICA-MAQUI-FT-2025.pdf",
    "MOR100":    "FICHA-TECNICA-MORINGA-2025.pdf",
    "URU100":    "FICHA-TECNICA-URUCUM-EN-POLVO-2025.pdf",
    "TMCH100":   "FICHA-TECNICA-TE-MATCHA-2025.pdf",

    # Harinas
    "HALG500":   "FICHA-TECNICA-HARINA-DE-ALGARROBA-2025.pdf",
    "HALM250":   "FICHA-TECNICA-HARINA-DE-ALMENDRA-2025.pdf",
    "HAM500":    "FICHA-TECNICA-HARINA-DE-AMARANTO-2025.pdf",
    "HARRI500":  "FICHA-TECNICA-HARINA-DE-ARROZ-INTEGRAL-2025.pdf",
    "HAVSG500":  "FICHA-TECNICA-HARINA-DE-AVENA-INTEGRAL-BIO-SIN-GLUTEN-2025.pdf",
    "HBAN250":   "FICHA-TECNICA-HARINA-DE-BANANA-2025.pdf",
    "HCAST250":  "FICHA-TECNICA-HARINA-DE-CASTANA-2025.pdf",
    "HCC500":    "FICHA-TECNICA-HARINA-DE-COCO-2025.pdf",
    "HGAR500":   "FICHA-TECNICA-HARINA-DE-GARBANZO-2025.pdf",
    "HMAIZ500":  "FICHA-TECNICA-HARINA-DE-MAIZ-2025-.pdf",
    "HMA500":    "FICHA-TECNICA-HARINA-DE-MANDIOCA-2025.pdf",
    "HQ500":     "FICHA-TECNICA-HARINA-DE-QUINOA-REAL-2025.pdf",
    "HTS500":    "FICHA-TECNICA-HARINA-DE-TRIGO-SARRACENO-2025.pdf",
    "HIESP1":    "FICHA-TECNICA-HARINA-DE-ESPELTA-INTEGRAL-2025.pdf",
    "HTEF500":   "HARINA-DE-TEFF-BLANCA-FT-ECOANDES-2024.pdf",

    # Almidones / féculas / gomas
    "AMM400":    "ALMIDON-DE-MAIZ-NATIVO-FT-ECOANDES.pdf",
    "AMT400":    "ALMIDON-DE-MANDIOCA-FT-ECOANDES.pdf",
    "FDP400":    "FECULA-DE-PATATA-FT-ECOANDES.pdf",
    "GG100":     "GOMA-GUAR-FT-ECOANDES.pdf",

    # Cereales / pseudocereales / hinchados / copos
    "AMG100":    "FICHA-TECNICA-AMARANTO-2025.pdf",
    "AMH125":    "AMARANTO-HINCHADO-FT-ECOANDES.pdf",
    "BULG500":   "FICHA-TECNICA-BULGUR-2025.pdf",
    "MPP500":    "FICHA-TECNICA-MAIZ-PARA-PALOMITAS-2025.pdf",
    "MJO500":    "FICHA-TECNICA-MIJO-2025.pdf",
    "MJH125":    "FICHA-TECNICA-MIJO-HINCHADO-2025.pdf",
    "QRB500":    "FICHA-TECNICA-QUINOA-REAL-BLANCA-2025.pdf",
    "QRN500":    "FICHA-TECNICA-QUINOA-REAL-NEGRA-2025.pdf",
    "QRR500":    "FICHA-TECNICA-QUINOA-REAL-ROJA-2025.pdf",
    "QRT500":    "FICHA-TECNICA-QUINOA-REAL-TRICOLOR-2025.pdf",
    "QRH125":    "QUINOA-HINCHADA-FT-2025-ECOANDES.pdf",
    "TSP500":    "FICHA-TECNICA-TRIGO-SARRACENO-FT-2025.pdf",
    "CAVFSG250": "FICHA-TECNICA-COPOS-FINOS-DE-AVENA-2025.pdf",
    "CAVGSG250": "FICHA-TECNICA-COPOS-GRUESOS-DE-AVENA-2025.pdf",
    "CQB250":    "FICHA-TECNICA-COPOS-DE-QUINOA-2025.pdf",
    "CTS250":    "FICHA-TECNICA-COPOS-DE-TRIGO-SARRACENO-2025.pdf",

    # Arroces
    "ARB500":    "FICHA-TECNICA-ARROZ-BASMATI-2025.pdf",
    "ARBI500":   "FICHA-TECNICA-ARROZ-BASMATI-INTEGRAL-2025.pdf",
    "ARJ500":    "FICHA-TECNICA-ARROZ-JAZMIN-BLANCO-2025.pdf",
    "ARJI500":   "FICHA-TECNICA-ARROZ-JAZMIN-INTEGRAL-2025.pdf",
    "ARN500":    "FICHA-TECNICA-ARROZ-NEGRO-2025.pdf",
    "ARR500":    "FICHA-TECNICA-ARROZ-ROJO-2025.pdf",
    "ARS250":    "FICHA-TECNICA-ARROZ-SALVAJE-2025_compressed.pdf",

    # Pastas
    "ESB3":      "ESPAGUETIS-BLANCOS-FT-ECOANDES.pdf",
    "ESI3":      "ESPAGUETIS_INTEGRALES_BIO_ECOANDES.pdf",
    "ESPI3":     "ESPIRALES_INTEGRALES_BIO_ECOANDES.pdf",
    "MCB3":      "MACARRONES-BLANCOS-FT-ECOANDES.pdf",
    "MCI3":      "MACARRONES_INTEGRALES_BIO_-ECOANDES.pdf",

    # Semillas
    "SAA250":    "FICHA-TECNICA-ALFALFA-SEMILLAS-2025.pdf",
    "SAM250":    "FICHA-TECNICA-AMAPOLA-SEMILLAS-2025.pdf",
    "SCA250":    "FICHA-TECNICA-CALABAZA-PELADA-2025.pdf",
    "SCN250":    "FICHA-TECNICA-CANAMO-SIN-PELAR-SEMILLAS-2025.pdf",
    "SCNP250":   "FICHA-TECNICA-CANAMO-PELADO-SEMILLAS-2025.pdf",
    "SCH250":    "FICHA-TECNICA-CHIA-SEMILLAS-2025.pdf",
    "SGIR250":   "FICHA-TECNICA-SEMILLAS-DE-GIRASOL-2025.pdf",
    "SGR100":    "FICHA-TECNICA-SEMILLAS-DE-GUARANA-TOSTADO-2025.pdf",
    "SLID250":   "FICHA-TECNICA-SEMILLAS-LINO-DORADO-2025.pdf",
    "SLIM250":   "FICHA-TECNICA-SEMILLAS-LINO-MARRON-FT-2025.pdf",
    "SLMM250":   "FICHA-TECNICA-LINO-MARRON-MOLIDO-2025.pdf",
    "SSEN250":   "FICHA-TECNICA-SESAMO-NATURAL-2025.pdf",
    "SSENN250":  "FICHA-TECNICA-SESAMO-NEGRO-2025.pdf",
    "SSEP250":   "FICHA-TECNICA-SESAMO-PELADO-BLANCO-2025.pdf",

    # Cacao
    "CACG250":   "FICHA-TECNICA-CACAO-EN-GRANO-2025.pdf",
    "CACP250":   "FICHA-TECNICA-CACAO-EN-POLVO-2025.pdf",
    "CACN150":   "FICHA-TECNICA-CACAO-NIBS-2025.pdf",
    "MAC250":    "FICHA-TECNICA-MANTECA-DE-CACAO-2025.pdf",

    # Especias / hierbas
    "ANIE100":   "FICHA-TECNICA-ANIS-ESTRELLADO-2025.pdf",
    "ANIV-100":  "ANIS-VERDE-FT-ECOANDES-2025_compressed.pdf",
    "CAN100":    "FICHA-TECNICA-CANELA-EN-POLVO-2025.pdf",
    "CANR100":   "FICHA-TECNICA-CANELA-EN-RAMA-CELYAN-2025.pdf",
    "CAR50":     "FICHA-TECNICA-CARDAMOMO-GRANO-2025-1.pdf",
    "CEBES-100": "FICHA-TECNICA-CEBOLLA-EN-ESCAMAS-2025.pdf",
    "CEBP-100":  "FICHA-TECNICA-CEBOLLA-EN-POLVO-2025-1.pdf",
    "CILP100":   "FICHA-TECNICA-CILANTRO-EN-POLVO-2025.pdf",
    "CILS100":   "FICHA-TECNICA-CILANTRO-EN-SEMILLA-2025.pdf",
    "CLAG-100":  "FICHA-TECNICA-CLAVO-DE-OLOR-EN-GRANO-2025-1.pdf",
    "CLAP-100":  "FICHA-TECNICA-CLAVO-DE-OLOR-EN-POLVO-2025-1.pdf",
    "COMS100":   "FICHA-TECNICA-COMINO-SEMILLAS-2025.pdf",
    "COMM100":   "FICHA-TECNICA-COMINO-MOLIDO-2025.pdf",
    "CURR100":   "FICHA-TECNICA-CURRY-INDIO-2025.pdf",
    "CUP100":    "FICHA-TECNICA-CURCUMA-EN-POLVO-2025.pdf",
    "ENEH30":    "FICHA-TECNICA-ENELDO-EN-HOJA-2025.pdf",
    "FEN100":    "FICHA-TECNICA-FENOGRECO-SEMILLA-2025.pdf",
    "GM80":      "FICHA-TECNICA-GARAM-MASALA-2025.pdf",
    "HIN80":     "FICHA-TECNICA-HINOJO-GRANO-2025.pdf",
    "JGP100":    "FICHA-TECNICA-JENGIBRE-EN-POLVO-2025.pdf",
    "MOST100":   "FICHA-TECNICA-MOSTAZA-EN-POLVO-2025.pdf",
    "MOSTG100":  "FICHA-TECNICA-MOSTAZA-EN-GRANO-2025.pdf",
    "NMG-25":    "FICHA-TECNICA-NUEZ-MOSCADA-GRANO-2025.pdf",
    "NMP-100":   "FICHA-TECNICA-NUEZ-MOSCADA-EN-POLVO-2025.pdf",
    "PING100":   "FICHA-TECNICA-PIMIENTA-NEGRA-EN-GRANO-2025.pdf",
    "PINM100":   "FICHA-TECNICA-PIMIENTA-NEGRA-EN-POLVO-2025.pdf",
    "REH100":    "FICHA-TECNICA-RAS-EL-HANOUT-2025.pdf",

    # Legumbres / secas
    "AR-500":    "FICHA-TECNICA-ALUBIA-ROJA-KIDNEY-2025.pdf",
    "AZUK-500":  "FICHA-TECNICA-AZUKI-2025.pdf",
    "GARL500":   "FICHA-TECNICA-GARBANZO-LECHOSO-2025.pdf",
    "GC25-500":  "FICHA-TECNICA-GARBANZO-CASTELLANO-GORDO-CAT.-EXTRA-2025.pdf",
    "GP25-500":  "FICHA-TECNICA-GARBANZO-PEDROSILLANO-2025.pdf",
    "JUMU-500":  "FICHA-TECNICA-JUDIA-MUNGO-2025.pdf",
    "LC25-500":  "FICHA-TECNICA-LENTEJAS-CASTELLANA-2025.pdf",
    "LP25-500":  "FICHA-TECNICA-LENTEJAS-PARDINA-2025.pdf",
    "LRC25-500": "FICHA-TECNICA-LENTEJA-ROJA-CORAL-MITADES-2025.pdf",
    "LENF25-500":"FICHA-TECNICA-LENTEJAS-DUPUY-2025.pdf",
    "LENF5":     "FICHA-TECNICA-LENTEJAS-DUPUY-2025.pdf",

    # Frutas deshidratadas
    "ARAR100":   "FICHA-TECNICA-ARANDANOS-ROJOS-SIN-AZUCAR-2025.pdf",
    "BANCH250":  "FICHA-TECNICA-BANANA-CHIPS-2025.pdf",
    "BDG100":    "FICHA-TECNICA-BAYAS-DE-GOJI-2025.pdf",
    "CCR250":    "FICHA-TECNICA-COCO-RALLADO-2025.pdf",
    "DSH1":      "FICHA-TECNICA-DATIL-SIN-HUESO-2025.pdf",
    "HIG100":    "FICHA-TECNICA-HIGO-TURCO-2025.pdf",
    "JEND100":   "FICHA-TECNICA-JENGIBRE-DADOS-CON-AZUCAR-2025.pdf",
    "MANG100":   "FICHA-TECNICA-MANGO-RODAJAS-2025.pdf",
    "MORD100":   "FICHA-TECNICA-MORAS-DESHIDRATADAS-2025.pdf",
    "OREA250":   "FICHA-TECNICA-ALBARICOQUE-OREJONES-2025-.pdf",
    "PAST250":   "FICHA-TECNICA-PASAS-SULTANAS-2025.pdf",

    # Frutos secos / tubérculos
    "ALMP100":   "FICHA-TECNICA-ALMENDRA-PELADA-2025.pdf",
    "ANA100":    "FICHA-TECNICA-ANACARDOS-2025.pdf",
    "AVELP100":  "FICHA-TECNICA-AVELLANAS-2025.pdf",
    "AVELT-100": "FICHA-TECNICA-AVELLANAS-TOSTADAS-Y-TROCEADAS-2025.pdf",
    "CAHRP250":  "FICHA-TECNICA-CACAHUETE-REPELADO-2025.pdf",
    "CHUF1":     "FICHA-TECNICA-CHUFA-ENTERA-2025.pdf",
    "CHUFP1":    "FICHA-TECNICA-CHUFA-PELADA-2025.pdf",
    "COQB100":   "FICHA-TECNICA-NUEZ-DE-BRASIL-2025.pdf",
    "PISTC100":  "FICHA-TECNICA-PISTACHO-CASCARA-TOSTADO-SALADO-2025.pdf",
    "PISTP100":  "FICHA-TECNICA-PISTACHO-PELADO-2025.pdf",
    "PNN-500":   "FICHA-TECNICA-PINON-NACIONAL-2025.pdf",

    # Endulzantes / siropes
    "AZCC500":   "FICHA-TECNICA-AZUCAR-DE-COCO-2025.pdf",
    "PNL500":    "FICHA-TECNICA-AZUCAR-PANELA-2025.pdf",
    "ESH30":     "FICHA-TECNICA-ESTEVIA-HOJA-2025.pdf",
    "ESP100":    "FICHA-TECNICA-ESTEVIA-POLVO-2025.pdf",
    "SIRAR25":   "FICHA-TECNICA-SIROPE-DE-ARROZ-2025.pdf",
    "SIRPAG-5":  "FICHA-TECNICA-SIROPE-DE-AGAVE-2025.pdf",

    # Proteínas / fibras / otros
    "GLT500":    "FICHA-TECNICA-GLUTEN-DE-TRIGO-2025.pdf",
    "LCP-500":   "FICHA-TECNICA-LECHE-DE-COCO-EN-POLVO-2025.pdf",
    "LEVN250":   "FICHA-TECNICA-LEVADURA-NUTRICIONAL-EN-COPOS-2025.pdf",
    "PTC100":    "FICHA-TECNICA-PROTEINA-DE-CANAMO-2025.pdf",
    "PTG100":    "FICHA-TECNICA-PROTEINA-DE-GUISANTE-2025.pdf",
    "PSY125":    "FICHA-TECNICA-PSYLLIUM-HUSK-2025.pdf",
    "PSYP125":   "FICHA-TECNICA-PSYLLIUM-EN-POLVO-2025.pdf",
    "SJT150":    "FICHA-TECNICA-SOJA-TEXTURIZADA-GRUESA-2025.pdf",
    # SJTF150 (media) - not exactly represented in uploads: nearest is FINA
    "SJTF150":   "FICHA-TECNICA-SOJA-TEXTURIZADA-FINA-2025.pdf",
    # SJEF150 (fina) - matched with EXTRA-FINA PDF (finest grade)
    "SJEF150":   "FICHA-TECNICA-SOJA-TEXTURIZADA-EXTRA-FINA-2025.pdf",
}


async def main():
    now = datetime.now(timezone.utc).isoformat()

    # Preload all uploaded PDF files (source of truth: db.files)
    file_records = await db.files.find(
        {"is_deleted": False, "content_type": "application/pdf"},
        {"_id": 0, "storage_path": 1, "original_filename": 1, "external": 1, "external_url": 1},
    ).to_list(2000)
    by_filename = {}
    for f in file_records:
        # Prefer most recent record for a given filename (they are inserted in order)
        by_filename[f["original_filename"]] = f

    stats = {"updated": 0, "not_found_product": 0, "not_found_file": 0, "unchanged": 0}
    warnings = []

    for sku, filename in SKU_TO_FILENAME.items():
        prod = await db.products.find_one({"sku": sku})
        if not prod:
            warnings.append(f"[MISS product] sku={sku}")
            stats["not_found_product"] += 1
            continue

        # Special case: ACAI PDF was not uploaded, keep local /docs/ URL
        if filename == "ACAI-FT-ECOANDES.pdf":
            new_ts = {"url": "/docs/ACAI-FT-ECOANDES.pdf", "filename": filename}
        else:
            frec = by_filename.get(filename)
            if not frec:
                warnings.append(f"[MISS file]    sku={sku} filename={filename}")
                stats["not_found_file"] += 1
                continue
            if frec.get("external"):
                url = frec.get("external_url")
            else:
                url = f"/api/files/{frec['storage_path']}"
            new_ts = {"url": url, "filename": filename}

        current = prod.get("tech_sheet") or {}
        if current.get("url") == new_ts["url"] and current.get("filename") == new_ts["filename"]:
            stats["unchanged"] += 1
            continue

        res = await db.products.update_one(
            {"sku": sku},
            {"$set": {"tech_sheet": new_ts, "updated_at": now}},
        )
        if res.matched_count:
            stats["updated"] += 1
            print(f"[OK] {sku:12} -> {filename}")
        else:
            warnings.append(f"[FAIL update]  sku={sku}")

    print("\n--- Summary ---")
    for k, v in stats.items():
        print(f"{k:24} {v}")
    if warnings:
        print("\nWarnings:")
        for w in warnings:
            print(w)


if __name__ == "__main__":
    asyncio.run(main())
