"""One-time build script: translate the Spanish i18n base (es.json) into the
other supported languages using Gemini (via emergentintegrations).

Usage: python generate_translations.py [key1 key2 ...]
If keys are passed, only those top-level sections are (re)generated/merged.
Otherwise the whole file is translated for every target language.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ENV = Path("/app/backend/.env")
load_dotenv(BACKEND_ENV)

LOCALES_DIR = Path("/app/frontend/src/i18n/locales")
SRC = LOCALES_DIR / "es.json"

TARGETS = {
    "en": "English",
    "zh": "Mandarin Chinese (Simplified)",
    "fr": "French",
    "ja": "Japanese",
    "it": "Italian",
    "pt": "Portuguese (Portugal)",
}

USER_GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "")
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

SYSTEM = (
    "You are a professional UI/UX localization translator for an organic food "
    "(BIO) e-commerce called EcoAndes. Translate user-facing strings naturally and "
    "concisely, suitable for buttons, menus and short notices."
)

RULES = """Translate the JSON VALUES from Spanish into {lang}.
STRICT RULES:
- Return ONLY a valid JSON object with EXACTLY the same keys and nested structure. No markdown, no comments.
- Translate values only, never the keys.
- Keep these tokens/words UNCHANGED: EcoAndes, Ecoandes, BIO, B2B, SKU, WhatsApp, RGPD, LSSI-CE, Google Maps, PayPal, Stripe, productosecoandes.com, ECOBONUS.
- Keep interpolation placeholders EXACTLY as-is, e.g. {{coupon}}, {{amount}}.
- Keep currency symbols and numbers (50€, 5€, 60€) as-is.
- Do not add or remove keys.
Here is the JSON to translate:
"""


async def _translate(text: str, lang_name: str, api_key: str, provider_key_label: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    chat = LlmChat(
        api_key=api_key,
        session_id=f"i18n-{lang_name}",
        system_message=SYSTEM,
    ).with_model("gemini", "gemini-2.5-flash")
    prompt = RULES.format(lang=lang_name) + text
    resp = await chat.send_message(UserMessage(text=prompt))
    return resp if isinstance(resp, str) else str(resp)


def _clean_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("```", 2)[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip().rstrip("`").strip()
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start : end + 1]
    return json.loads(raw)


async def main():
    base = json.loads(SRC.read_text(encoding="utf-8"))
    only_keys = sys.argv[1:]
    payload = {k: base[k] for k in only_keys} if only_keys else base
    text = json.dumps(payload, ensure_ascii=False, indent=2)

    # Decide which key works
    key = None
    label = None
    for candidate, lbl in ((USER_GEMINI_KEY, "user-gemini"), (EMERGENT_KEY, "emergent-universal")):
        if not candidate:
            continue
        try:
            await _translate('{"_t":"hola"}', "English", candidate, lbl)
            key, label = candidate, lbl
            break
        except Exception as e:  # noqa: BLE001
            print(f"[warn] key {lbl} failed probe: {e}")
    if not key:
        print("[fatal] No working LLM key (gemini/emergent). Aborting.")
        sys.exit(1)
    print(f"[info] Using key: {label}")

    for code, lang_name in TARGETS.items():
        dest = LOCALES_DIR / f"{code}.json"
        try:
            raw = await _translate(text, lang_name, key, label)
            translated = _clean_json(raw)
        except Exception as e:  # noqa: BLE001
            print(f"[error] {code}: {e}")
            continue
        # merge into existing file if it exists (so partial re-runs keep other keys)
        existing = {}
        if dest.exists():
            try:
                existing = json.loads(dest.read_text(encoding="utf-8"))
            except Exception:
                existing = {}

        def deep_merge(a, b):
            for k, v in b.items():
                if isinstance(v, dict) and isinstance(a.get(k), dict):
                    deep_merge(a[k], v)
                else:
                    a[k] = v
            return a

        merged = deep_merge(existing, translated)
        dest.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"[ok] wrote {dest.name} ({len(merged)} top-level keys)")


if __name__ == "__main__":
    asyncio.run(main())
