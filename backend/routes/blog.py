"""Blog gestionable desde el dashboard, con SEO por artículo.

Colección `blog_posts`. Se siembra una sola vez desde data/blog_seed.json
(los 12 artículos existentes de la web) si la colección está vacía.

Estructura de post:
{ id, slug, title, excerpt, cover, category, read_time, date (YYYY-MM-DD),
  author, related_query, body: [{h, p}], sources: [{label, url}],
  seo: {meta_title, meta_description, keywords[]}, published,
  created_at, updated_at }
"""
import json
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.auth import require_admin
from core.config import db
from core.utils import slugify

logger = logging.getLogger("ecoandes.blog")

router = APIRouter(prefix="/api/blog", tags=["blog"])

SEED_FILE = Path(__file__).resolve().parent.parent / "data" / "blog_seed.json"

_LIST_PROJECTION = {"_id": 0, "body": 0}


class BodySection(BaseModel):
    h: str = ""
    p: str = ""


class SourceLink(BaseModel):
    label: str = ""
    url: str = ""


class BlogSeo(BaseModel):
    meta_title: str = ""
    meta_description: str = ""
    keywords: List[str] = []


class BlogPostIn(BaseModel):
    title: str
    slug: Optional[str] = None
    excerpt: str = ""
    cover: str = ""
    category: str = ""
    read_time: str = "5 min"
    date: str = ""
    author: str = "Equipo Ecoandes"
    related_query: str = ""
    body: List[BodySection] = []
    sources: List[SourceLink] = []
    seo: BlogSeo = BlogSeo()
    published: bool = True


def _with_seo_defaults(post: dict) -> dict:
    """SEO efectivo: usa lo editado y cae al título/extracto si falta algo."""
    seo = dict(post.get("seo") or {})
    seo.setdefault("meta_title", "")
    seo.setdefault("meta_description", "")
    seo.setdefault("keywords", [])
    if not seo["meta_title"]:
        title = (post.get("title") or "").strip()
        suffix = " | Blog EcoAndes"
        if len(title) + len(suffix) > 70:
            title = title[: 70 - len(suffix) - 1].rstrip()
        seo["meta_title"] = f"{title}{suffix}"
    if not seo["meta_description"]:
        seo["meta_description"] = (post.get("excerpt") or "")[:170]
    post["seo"] = seo
    return post


async def seed_blog_posts() -> None:
    """Migra los artículos estáticos existentes a la BD (solo si está vacía)."""
    count = await db.blog_posts.count_documents({})
    if count > 0 or not SEED_FILE.exists():
        return
    now = datetime.now(timezone.utc).isoformat()
    posts = json.loads(SEED_FILE.read_text(encoding="utf-8"))
    docs = []
    for p in posts:
        docs.append({
            "id": str(uuid.uuid4()),
            "slug": p["slug"],
            "title": p.get("title", ""),
            "excerpt": p.get("excerpt", ""),
            "cover": p.get("cover", ""),
            "category": p.get("category", ""),
            "read_time": p.get("read_time", "5 min"),
            "date": p.get("date", ""),
            "author": p.get("author", "Equipo Ecoandes"),
            "related_query": p.get("related_query", ""),
            "body": p.get("body", []),
            "sources": p.get("sources", []),
            "seo": {"meta_title": "", "meta_description": "", "keywords": []},
            "published": True,
            "created_at": now,
            "updated_at": now,
        })
    if docs:
        await db.blog_posts.insert_many(docs)
        logger.info("Blog seeded with %s posts", len(docs))


async def _unique_slug(base: str, exclude_id: Optional[str] = None) -> str:
    slug = slugify(base) or f"post-{uuid.uuid4().hex[:6]}"
    candidate = slug
    n = 2
    while True:
        q = {"slug": candidate}
        if exclude_id:
            q["id"] = {"$ne": exclude_id}
        if not await db.blog_posts.find_one(q, {"_id": 0, "id": 1}):
            return candidate
        candidate = f"{slug}-{n}"
        n += 1


def _sanitize(payload: BlogPostIn) -> dict:
    return {
        "title": payload.title.strip()[:180],
        "excerpt": payload.excerpt.strip()[:400],
        "cover": payload.cover.strip(),
        "category": payload.category.strip()[:60],
        "read_time": payload.read_time.strip()[:20] or "5 min",
        "date": (payload.date or datetime.now(timezone.utc).date().isoformat())[:10],
        "author": payload.author.strip()[:80] or "Equipo Ecoandes",
        "related_query": payload.related_query.strip()[:80],
        "body": [{"h": s.h.strip()[:200], "p": s.p.strip()[:4000]} for s in payload.body if (s.h.strip() or s.p.strip())],
        "sources": [{"label": s.label.strip()[:150], "url": s.url.strip()[:400]} for s in payload.sources if s.url.strip()],
        "seo": {
            "meta_title": payload.seo.meta_title.strip()[:80],
            "meta_description": payload.seo.meta_description.strip()[:200],
            "keywords": [k.strip() for k in payload.seo.keywords if k.strip()][:15],
        },
        "published": payload.published,
    }


# ---------- Público ----------
@router.get("")
async def list_posts():
    posts = (
        await db.blog_posts.find({"published": True}, _LIST_PROJECTION)
        .sort("date", -1)
        .to_list(200)
    )
    return [_with_seo_defaults(p) for p in posts]


# ---------- Admin (definir ANTES de /{slug}) ----------
@router.get("/admin/list", dependencies=[Depends(require_admin)])
async def admin_list_posts():
    posts = await db.blog_posts.find({}, {"_id": 0}).sort("date", -1).to_list(300)
    return posts


@router.post("/admin", dependencies=[Depends(require_admin)])
async def create_post(payload: BlogPostIn):
    now = datetime.now(timezone.utc).isoformat()
    doc = _sanitize(payload)
    doc["id"] = str(uuid.uuid4())
    doc["slug"] = await _unique_slug(payload.slug or payload.title)
    doc["created_at"] = now
    doc["updated_at"] = now
    await db.blog_posts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.put("/admin/{post_id}", dependencies=[Depends(require_admin)])
async def update_post(post_id: str, payload: BlogPostIn):
    existing = await db.blog_posts.find_one({"id": post_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    doc = _sanitize(payload)
    new_slug = payload.slug.strip() if payload.slug else existing["slug"]
    if new_slug != existing["slug"]:
        doc["slug"] = await _unique_slug(new_slug, exclude_id=post_id)
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.blog_posts.update_one({"id": post_id}, {"$set": doc})
    updated = await db.blog_posts.find_one({"id": post_id}, {"_id": 0})
    return updated


@router.delete("/admin/{post_id}", dependencies=[Depends(require_admin)])
async def delete_post(post_id: str):
    res = await db.blog_posts.delete_one({"id": post_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    return {"ok": True}


# ---------- Público: detalle (SIEMPRE al final) ----------
@router.get("/{slug}")
async def get_post(slug: str):
    post = await db.blog_posts.find_one({"slug": slug, "published": True}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Artículo no encontrado")
    return _with_seo_defaults(post)
