"""Spawn heavy content-generation work as a SEPARATE OS process.

Rationale: LLM calls made inside the API process were blocking the event loop
(single uvicorn worker), freezing every request for the duration of each call.
Running them in an isolated process keeps the API always responsive.
"""
import logging
import subprocess
import sys
from pathlib import Path

from core.config import db

logger = logging.getLogger("ecoandes.jobs")

BACKEND_DIR = Path(__file__).resolve().parent.parent


def spawn_content_generation(translations: bool = True, seo: bool = True,
                             force: bool = False) -> bool:
    """Fire-and-forget subprocess. Returns True if spawned."""
    args = [sys.executable, "-m", "scripts.generate_content"]
    if translations and not seo:
        args.append("--translations")
    elif seo and not translations:
        args.append("--seo")
    else:
        args.append("--all")
    if force:
        args.append("--force")
    try:
        subprocess.Popen(
            args,
            cwd=str(BACKEND_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        logger.info("Content generation subprocess spawned: %s", " ".join(args[2:]))
        return True
    except Exception as e:  # noqa: BLE001
        logger.error("Could not spawn content generation: %s", e)
        return False


async def content_jobs_status() -> dict:
    doc = await db.site_config.find_one({"_id": "content_jobs"}, {"_id": 0}) or {}
    return doc
