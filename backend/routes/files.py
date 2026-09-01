"""File upload (admin) + public file serving via Emergent Object Storage."""
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from core.auth import require_admin
from core.storage import IMAGE_EXTS, get_object, upload_bytes

logger = logging.getLogger("ecoandes.files")

router = APIRouter(prefix="/api", tags=["files"])

MAX_IMAGE = 8 * 1024 * 1024     # 8 MB
MAX_PDF = 20 * 1024 * 1024      # 20 MB


@router.post("/admin/uploads", dependencies=[Depends(require_admin)])
async def admin_upload(file: UploadFile = File(...), kind: str = Form("image")):
    filename = file.filename or "file"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    data = await file.read()

    if kind == "pdf":
        if ext != "pdf":
            raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")
        if len(data) > MAX_PDF:
            raise HTTPException(status_code=400, detail="PDF demasiado grande (máx 20 MB)")
    else:
        if ext not in IMAGE_EXTS:
            raise HTTPException(status_code=400, detail="Formato de imagen no soportado")
        if len(data) > MAX_IMAGE:
            raise HTTPException(status_code=400, detail="Imagen demasiado grande (máx 8 MB)")

    try:
        info = upload_bytes(data, filename, kind="pdf" if kind == "pdf" else "image")
    except Exception as e:  # noqa: BLE001
        logger.exception("upload failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Error al subir: {e}")

    from core.config import db
    from datetime import datetime, timezone
    import uuid

    await db.files.insert_one(
        {
            "id": str(uuid.uuid4()),
            "storage_path": info["storage_path"],
            "original_filename": info["original_filename"],
            "content_type": info["content_type"],
            "size": info["size"],
            "is_deleted": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    # Public URL routed through this backend
    return {
        "url": f"/api/files/{info['storage_path']}",
        "storage_path": info["storage_path"],
        "filename": info["original_filename"],
        "content_type": info["content_type"],
    }


@router.get("/files/{path:path}")
async def serve_file(path: str):
    """Public serving of catalog assets (images + tech sheets)."""
    from core.config import db

    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if record is None:
        # If a record exists but is soft-deleted, stop serving it
        deleted = await db.files.find_one({"storage_path": path, "is_deleted": True})
        if deleted:
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
    try:
        data, content_type = get_object(path)
    except Exception:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    ct = (record or {}).get("content_type") or content_type
    return Response(
        content=data,
        media_type=ct,
        headers={"Cache-Control": "public, max-age=86400"},
    )


# ---------- Admin: añadir archivo por enlace externo (CDN/nube del cliente) ----------
@router.post("/admin/files/external", dependencies=[Depends(require_admin)])
async def add_external_file(payload: dict):
    """Registra en la biblioteca una imagen/vídeo/PDF alojado en una nube externa
    (CDN rápido del cliente). No descarga el archivo: guarda el enlace directo."""
    import uuid
    from datetime import datetime, timezone
    from urllib.parse import urlparse

    url = (payload.get("url") or "").strip()
    if not url.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Introduce una URL válida (http/https)")
    parsed = urlparse(url)
    filename = (parsed.path.rsplit("/", 1)[-1] or parsed.netloc)[:150] or "archivo-externo"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    ct_map = {
        "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp",
        "gif": "image/gif", "avif": "image/avif", "svg": "image/svg+xml",
        "mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime",
        "pdf": "application/pdf",
    }
    content_type = ct_map.get(ext, "")
    size = None
    # HEAD ligero para validar y completar metadatos (no bloqueante si falla)
    try:
        import httpx

        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            resp = await client.head(url)
            if resp.status_code < 400:
                content_type = resp.headers.get("content-type", content_type).split(";")[0] or content_type
                cl = resp.headers.get("content-length")
                size = int(cl) if cl and cl.isdigit() else None
    except Exception:  # noqa: BLE001
        pass
    if not content_type:
        content_type = "application/octet-stream"

    record = {
        "id": str(uuid.uuid4()),
        "external": True,
        "external_url": url,
        "storage_path": None,
        "original_filename": payload.get("name") or filename,
        "content_type": content_type,
        "size": size,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    from core.config import db

    await db.files.insert_one(record)
    record.pop("_id", None)
    return {"url": url, "external": True, "filename": record["original_filename"],
            "content_type": content_type, "id": record["id"]}


# ---------- Admin: media library ----------
@router.get("/admin/files", dependencies=[Depends(require_admin)])
async def list_files(kind: str = ""):
    """List uploaded files (DB is the source of truth, per storage playbook)."""
    from core.config import db

    query = {"is_deleted": False}
    if kind == "image":
        query["content_type"] = {"$regex": "^image/"}
    elif kind == "pdf":
        query["content_type"] = "application/pdf"
    elif kind == "video":
        query["content_type"] = {"$regex": "^video/"}
    files = (
        await db.files.find(query, {"_id": 0})
        .sort("created_at", -1)
        .to_list(1000)
    )
    for f in files:
        f["url"] = f["external_url"] if f.get("external") else f"/api/files/{f['storage_path']}"
    return {"files": files, "total": len(files)}


@router.delete("/admin/files/{file_id}", dependencies=[Depends(require_admin)])
async def soft_delete_file(file_id: str):
    """Soft-delete (storage has no delete API; DB flag hides the file)."""
    from core.config import db

    res = await db.files.update_one({"id": file_id}, {"$set": {"is_deleted": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return {"ok": True}
