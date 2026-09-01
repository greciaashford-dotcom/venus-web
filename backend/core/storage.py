"""Emergent Object Storage helpers (uploads for product images + tech-sheet PDFs)."""
import logging
import os
import time
import uuid

import requests

logger = logging.getLogger("ecoandes.storage")

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
APP_NAME = "ecoandes"

_storage_key = None

MIME_TYPES = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "png": "image/png",
    "gif": "image/gif",
    "webp": "image/webp",
    "pdf": "application/pdf",
}

IMAGE_EXTS = {"jpg", "jpeg", "png", "gif", "webp"}


def init_storage():
    """Call once; returns a session-scoped reusable storage key."""
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_KEY:
        raise RuntimeError("EMERGENT_LLM_KEY missing; cannot init object storage")
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    logger.info("Object storage initialized")
    return _storage_key


def _put(path: str, data: bytes, content_type: str) -> dict:
    last = None
    for attempt in range(3):
        try:
            key = init_storage()
            resp = requests.put(
                f"{STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key, "Content-Type": content_type},
                data=data,
                timeout=120,
            )
            if resp.status_code == 403:
                # expired key -> force re-init
                global _storage_key
                _storage_key = None
                raise RuntimeError("403 storage key expired")
            resp.raise_for_status()
            return resp.json()
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 ** attempt)
    raise RuntimeError(f"put_object failed: {last}")


def get_object(path: str):
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


def upload_bytes(data: bytes, filename: str, kind: str = "image") -> dict:
    """Upload raw bytes; returns {storage_path, content_type, original_filename, size}."""
    ext = (filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin")
    content_type = MIME_TYPES.get(ext, "application/octet-stream")
    sub = "tech-sheets" if kind == "pdf" else "images"
    path = f"{APP_NAME}/{sub}/{uuid.uuid4().hex}.{ext}"
    result = _put(path, data, content_type)
    return {
        "storage_path": result["path"],
        "content_type": content_type,
        "original_filename": filename,
        "size": result.get("size", len(data)),
    }
