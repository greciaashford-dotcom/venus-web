"""Parse WordPress WooCommerce XML export into Ecoandes Product documents."""
from __future__ import annotations

import html
import re
from pathlib import Path
from typing import Dict, List
import xml.etree.ElementTree as ET

from core.utils import slugify

NS = {
    "wp": "http://wordpress.org/export/1.2/",
    "content": "http://purl.org/rss/1.0/modules/content/",
    "excerpt": "http://wordpress.org/export/1.2/excerpt/",
    "dc": "http://purl.org/dc/elements/1.1/",
}

FALLBACK_IMAGE = (
    "https://images.unsplash.com/photo-1739949154765-f2a23bdfa3f4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzV8MHwxfHNlYXJjaHwxfHxuYXR1cmFsJTIwb3JnYW5pYyUyMHNraW4lMjBjYXJlJTIwcGFja2FnaW5nfGVufDB8fHx8MTc3NjQ2OTMxMXww&ixlib=rb-4.1.0&q=85"
)


def _clean_html(raw: str) -> str:
    if not raw:
        return ""
    text = html.unescape(raw)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _get_postmeta(item, key: str) -> str | None:
    for meta in item.findall("wp:postmeta", NS):
        k_el = meta.find("wp:meta_key", NS)
        v_el = meta.find("wp:meta_value", NS)
        if k_el is not None and k_el.text == key and v_el is not None:
            return (v_el.text or "").strip()
    return None


def _get_postmeta_all(item, key: str) -> List[str]:
    vals = []
    for meta in item.findall("wp:postmeta", NS):
        k_el = meta.find("wp:meta_key", NS)
        v_el = meta.find("wp:meta_value", NS)
        if k_el is not None and k_el.text == key and v_el is not None and v_el.text:
            vals.append(v_el.text.strip())
    return vals


def _get_categories(item) -> Dict[str, List[str]]:
    cats: Dict[str, List[str]] = {}
    for c in item.findall("category"):
        domain = c.get("domain", "")
        val = (c.text or "").strip()
        cats.setdefault(domain, []).append(val)
    return cats


def parse_wordpress_xml(xml_path: str | Path) -> List[dict]:
    """Return list of product dicts ready for insertion."""
    xml_path = Path(xml_path)
    if not xml_path.exists():
        return []

    tree = ET.parse(xml_path)
    root = tree.getroot()
    channel = root.find("channel")
    if channel is None:
        return []

    # Index attachments by post_id -> url
    attachments: Dict[str, str] = {}
    # Index variations by parent_id
    variations_by_parent: Dict[str, List[dict]] = {}
    product_items: List[ET.Element] = []

    for item in channel.findall("item"):
        post_type_el = item.find("wp:post_type", NS)
        if post_type_el is None or not post_type_el.text:
            continue
        post_type = post_type_el.text
        post_id_el = item.find("wp:post_id", NS)
        post_id = post_id_el.text if post_id_el is not None else ""

        if post_type == "attachment":
            guid_el = item.find("guid")
            url_meta = _get_postmeta(item, "_wp_attached_file")
            url = ""
            if guid_el is not None and guid_el.text:
                url = guid_el.text.strip()
            if url_meta and not url:
                url = f"https://productosecoandes.com/wp-content/uploads/{url_meta}"
            if post_id and url:
                attachments[post_id] = url
        elif post_type == "product":
            product_items.append(item)
        elif post_type == "product_variation":
            parent_el = item.find("wp:post_parent", NS)
            parent_id = parent_el.text if parent_el is not None else None
            if not parent_id:
                continue
            sku = _get_postmeta(item, "_sku") or ""
            price = _get_postmeta(item, "_price") or "0"
            regular = _get_postmeta(item, "_regular_price") or price
            sale = _get_postmeta(item, "_sale_price") or ""
            title_el = item.find("title")
            name = (title_el.text or "").strip() if title_el is not None else ""
            # variation name often is parent name; extract size from attributes
            size_name = ""
            for meta in item.findall("wp:postmeta", NS):
                k_el = meta.find("wp:meta_key", NS)
                v_el = meta.find("wp:meta_value", NS)
                if k_el is not None and v_el is not None and k_el.text and k_el.text.startswith("attribute_"):
                    size_name = (v_el.text or "").replace("-", " ").strip()
                    break
            try:
                price_f = float(regular) if regular else 0.0
            except ValueError:
                price_f = 0.0
            try:
                sale_f = float(sale) if sale else 0.0
            except ValueError:
                sale_f = 0.0
            variations_by_parent.setdefault(parent_id, []).append(
                {
                    "sku": sku or f"VAR-{post_id}",
                    "name": size_name or name or "Único",
                    "price_retail": round(price_f, 2),
                    "price_professional": round(sale_f if sale_f else price_f * 0.85, 2),
                    "stock": 0,
                }
            )

    products: List[dict] = []
    for item in product_items:
        post_id_el = item.find("wp:post_id", NS)
        post_id = post_id_el.text if post_id_el is not None else ""
        title_el = item.find("title")
        name = (title_el.text or "").strip() if title_el is not None else ""
        if not name:
            continue
        slug_el = item.find("wp:post_name", NS)
        slug = slug_el.text if slug_el is not None and slug_el.text else slugify(name)
        content_el = item.find("content:encoded", NS)
        excerpt_el = item.find("excerpt:encoded", NS)
        description = _clean_html(content_el.text if content_el is not None else "")
        short_description = _clean_html(excerpt_el.text if excerpt_el is not None else "")

        sku = _get_postmeta(item, "_sku") or f"PROD-{post_id}"
        price_raw = _get_postmeta(item, "_regular_price") or _get_postmeta(item, "_price") or "0"
        try:
            price_retail = float(price_raw)
        except ValueError:
            price_retail = 0.0
        # price collection from variations (min)
        vars_list = variations_by_parent.get(post_id, [])
        if vars_list and price_retail <= 0:
            price_retail = min(v["price_retail"] for v in vars_list if v["price_retail"] > 0) if any(
                v["price_retail"] > 0 for v in vars_list
            ) else 0.0
        price_professional = round(price_retail * 0.85, 2) if price_retail else 0.0

        cats = _get_categories(item)
        category_name = cats.get("product_cat", ["General"])[0] if cats.get("product_cat") else "General"
        tags = cats.get("product_tag", [])

        thumb_id = _get_postmeta(item, "_thumbnail_id") or ""
        gallery_ids = (_get_postmeta(item, "_product_image_gallery") or "").split(",")
        image_url = attachments.get(thumb_id, FALLBACK_IMAGE) if thumb_id else FALLBACK_IMAGE
        gallery = [attachments[g] for g in gallery_ids if g and g in attachments]

        products.append(
            {
                "sku": sku,
                "slug": slug,
                "name": name,
                "category": category_name,
                "description": description or short_description or name,
                "short_description": short_description,
                "price_retail": round(price_retail, 2),
                "price_professional": price_professional,
                "stock": 0,
                "image_url": image_url,
                "gallery": gallery,
                "variations": vars_list,
                "tags": tags,
                "featured": False,
                "active": True,
            }
        )
    return products
