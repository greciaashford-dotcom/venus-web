import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const SUPPORTED = ["es", "en", "zh", "fr", "ja", "it", "pt"];
const SITE_NAME = "EcoAndes";

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    el.setAttribute("data-seo", "1");
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href, hreflang) {
  if (!href) return;
  const sel = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]:not([hreflang])`;
  let el = document.head.querySelector(sel);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    if (hreflang) el.setAttribute("hreflang", hreflang);
    el.setAttribute("data-seo", "1");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(id, data) {
  let el = document.getElementById(id);
  if (data == null) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    el.setAttribute("data-seo", "1");
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/**
 * Lightweight SEO/GEO head manager (no external deps).
 * Renders title, meta description/keywords, OpenGraph, Twitter, canonical,
 * hreflang alternates and optional JSON-LD structured data.
 */
export const Seo = ({
  title,
  description,
  keywords,
  image,
  type = "website",
  jsonLd = null,
  noindex = false,
}) => {
  const { i18n } = useTranslation();
  const lang = i18n.language || "es";

  useEffect(() => {
    const fullTitle = title
      ? (title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`)
      : `${SITE_NAME} · Ingredientes ecológicos a granel`;
    document.title = fullTitle;
    document.documentElement.setAttribute("lang", lang);

    const url = typeof window !== "undefined" ? window.location.href : "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const path = typeof window !== "undefined" ? window.location.pathname + window.location.search : "";

    upsertMeta("name", "description", description);
    upsertMeta("name", "keywords", Array.isArray(keywords) ? keywords.join(", ") : keywords);
    upsertMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");

    // OpenGraph
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:locale", lang);
    if (image) upsertMeta("property", "og:image", image);

    // Twitter
    upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", description);
    if (image) upsertMeta("name", "twitter:image", image);

    // canonical + hreflang (GEO/i18n)
    upsertLink("canonical", url);
    if (origin && path) {
      SUPPORTED.forEach((code) => {
        const sep = path.includes("?") ? "&" : "?";
        upsertLink("alternate", `${origin}${path}${sep}lang=${code}`, code);
      });
      upsertLink("alternate", `${origin}${path}`, "x-default");
    }

    setJsonLd("ld-page", jsonLd);

    return () => {
      // keep tags (they get overwritten by next page); only clear page-specific JSON-LD
    };
  }, [title, description, keywords, image, type, jsonLd, noindex, lang]);

  return null;
};

export default Seo;
