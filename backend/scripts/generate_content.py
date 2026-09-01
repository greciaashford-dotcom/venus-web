"""Standalone content generator (translations + SEO) meant to run as a
SEPARATE PROCESS so LLM calls can never block the API event loop.

The API (server.py / routes/products.py) spawns this with:
    python -m scripts.generate_content --translations --seo

Progress is written to Mongo (site_config._id="content_jobs") so the API can
report status from any process.

Usage:
    python -m scripts.generate_content --translations          # only translations
    python -m scripts.generate_content --seo                   # only SEO
    python -m scripts.generate_content --translations --seo    # both (default)
    python -m scripts.generate_content --all --force           # regenerate everything
"""
import asyncio
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.config import db  # noqa: E402


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _set_status(**fields):
    await db.site_config.update_one(
        {"_id": "content_jobs"}, {"$set": fields}, upsert=True
    )


async def main() -> None:
    args = set(sys.argv[1:])
    do_all = "--all" in args or not ({"--translations", "--seo"} & args)
    do_translations = do_all or "--translations" in args
    do_seo = do_all or "--seo" in args
    only_missing = "--force" not in args

    from core.translator import (
        generate_all_product_translations,
        generate_product_seo,
    )

    await _set_status(
        running=True, pid=None, started_at=_now(), finished_at=None, error=None,
        tasks={"translations": do_translations, "seo": do_seo},
        phase="starting",
    )
    error = None
    try:
        if do_translations:
            await _set_status(phase="translations")
            await generate_all_product_translations(only_missing=only_missing)
        if do_seo:
            await _set_status(phase="seo")
            await generate_product_seo(only_missing=only_missing)
    except Exception as e:  # noqa: BLE001
        error = str(e)
    await _set_status(running=False, finished_at=_now(), error=error, phase="done")
    if error:
        print(f"ERROR: {error}")
        sys.exit(1)
    print("OK: content generation finished")


if __name__ == "__main__":
    asyncio.run(main())
