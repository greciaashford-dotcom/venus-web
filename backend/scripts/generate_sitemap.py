"""Genera sitemap.xml + robots.txt en frontend/public a partir de la BD.

- Incluye todas las páginas públicas indexables, los 163 productos activos
  (/producto/<slug>), los posts del blog publicados y las páginas legales.
- Excluye rutas privadas (checkout, cuenta, login, admin, lista de deseos...).
- Dominio canónico: https://productosecoandes.com (URLs SEO que el cliente conserva).

Uso: python -m scripts.generate_sitemap
"""
import asyncio
import os
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BASE = os.environ.get("PUBLIC_SITE_URL", "https://productosecoandes.com").rstrip("/")
PUBLIC_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "public"

STATIC = [
    ("/", "1.0", "daily"),
    ("/tienda", "0.9", "daily"),
    ("/sobre-nosotros", "0.6", "monthly"),
    ("/profesional", "0.7", "monthly"),
    ("/contacto", "0.5", "monthly"),
    ("/certificaciones", "0.5", "monthly"),
    ("/blog", "0.6", "weekly"),
    ("/atencion-cliente", "0.4", "monthly"),
    ("/legal/aviso-legal", "0.2", "yearly"),
    ("/legal/politica-cookies", "0.2", "yearly"),
    ("/legal/politica-privacidad", "0.2", "yearly"),
    ("/legal/condiciones", "0.2", "yearly"),
]


def _url(loc, lastmod, priority, changefreq):
    return (
        "  <url>\n"
        f"    <loc>{escape(BASE + loc)}</loc>\n"
        f"    <lastmod>{lastmod}</lastmod>\n"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        "  </url>"
    )


async def main():
    c = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = c[os.environ["DB_NAME"]]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    entries = [_url(p, today, prio, cf) for p, prio, cf in STATIC]

    prods = await db.products.find(
        {"active": True}, {"_id": 0, "slug": 1, "updated_at": 1}
    ).sort("name", 1).to_list(1000)
    for p in prods:
        lastmod = (p.get("updated_at") or today)[:10]
        entries.append(_url(f"/producto/{p['slug']}", lastmod, "0.8", "weekly"))

    posts = await db.blog_posts.find(
        {"published": True}, {"_id": 0, "slug": 1, "date": 1}
    ).to_list(500)
    for post in posts:
        lastmod = (post.get("date") or today)[:10]
        entries.append(_url(f"/blog/{post['slug']}", lastmod, "0.5", "monthly"))

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(entries)
        + "\n</urlset>\n"
    )
    (PUBLIC_DIR / "sitemap.xml").write_text(xml, encoding="utf-8")

    robots = (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /admin\n"
        "Disallow: /checkout\n"
        "Disallow: /cuenta\n"
        "Disallow: /login\n"
        "Disallow: /registro\n"
        "Disallow: /pago/\n"
        "Disallow: /lista-deseos\n"
        "Disallow: /comparar\n"
        f"\nSitemap: {BASE}/sitemap.xml\n"
    )
    (PUBLIC_DIR / "robots.txt").write_text(robots, encoding="utf-8")

    print(f"sitemap.xml: {len(entries)} URLs ({len(prods)} productos, {len(posts)} posts) -> {PUBLIC_DIR}")
    print(f"robots.txt escrito. BASE={BASE}")


asyncio.run(main())
