import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Minus, Plus, ChevronRight, ChevronDown, Heart, Scale, MessageCircle, Share2,
  Check, Leaf, FileDown, AlertCircle, Link as LinkIcon,
} from "lucide-react";
import { api, formatEUR, resolveAsset } from "../lib/api";
import { getPriceRange, sortVariations, variationPrice } from "../lib/price";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import ProductGallery from "../components/ProductGallery";
import TrustBadges from "../components/TrustBadges";
import ProductCarousel from "../components/ProductCarousel";
import ProductReviews from "../components/ProductReviews";
import StarRating from "../components/StarRating";
import Seo from "../components/Seo";

const WHATSAPP = "34696173094";

// Organic-farming certification badges shown on every product (ES-ECO-023-MA).
const CERTIFICATIONS = [
  "/certifications/cert-1.svg",
  "/certifications/cert-2.svg",
  "/certifications/cert-3.svg",
  "/certifications/cert-4.svg",
];

export default function ProductDetail() {
  const { t, i18n } = useTranslation();
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariation, setSelectedVariation] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [related, setRelated] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [catsOpen, setCatsOpen] = useState(false); // desplegable "Explora más categorías"
  const [shareOpen, setShareOpen] = useState(false);
  const { addItem } = useCart();
  const { user } = useAuth();
  const { isWished, isCompared, toggleWishlist, toggleCompare } = useWishlist();
  const isPro = user?.role === "professional" || user?.role === "admin";

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/products/slug/${slug}`);
        if (!alive) return;
        // Redirección SEO: si se entró por un slug antiguo (alias), reemplazar
        // la URL por la canónica sin añadir entrada al historial.
        if (data.redirected_from && data.slug && data.slug !== slug) {
          navigate(`/producto/${data.slug}`, { replace: true });
          return;
        }
        setProduct(data);
        // Historial de navegación para "Explorar más artículos" (recomendaciones del carrito)
        try {
          const key = "eco_recent_views";
          const prev = JSON.parse(localStorage.getItem(key) || "[]").filter((id) => id !== data.id);
          localStorage.setItem(key, JSON.stringify([data.id, ...prev].slice(0, 12)));
        } catch { /* ignore */ }
        const sorted = sortVariations(data.variations || []);
        setSelectedVariation(sorted.length ? sorted[0] : null);
        setQuantity(1);
        // cross-sell
        const [rel, bs] = await Promise.all([
          api.get("/products", { params: { category: data.category, limit: 12 } }),
          api.get("/products", { params: { best_seller: true, limit: 12 } }),
        ]);
        if (!alive) return;
        setRelated((rel.data || []).filter((p) => p.id !== data.id).slice(0, 10));
        setBestSellers((bs.data || []).filter((p) => p.id !== data.id).slice(0, 10));
      } catch {
        // Producto/slug inexistente o error de red: mostrar estado "no encontrado"
        if (alive) setProduct(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [slug, i18n.resolvedLanguage]);

  useEffect(() => {
    let alive = true;
    api.get("/products/categories").then(({ data }) => { if (alive) setAllCategories(data || []); }).catch(() => {});
    return () => { alive = false; };
  }, [i18n.resolvedLanguage]);

  const sortedVariations = useMemo(() => {
    const seen = new Set();
    const uniq = (product?.variations || []).filter((v) => {
      if (v.active === false) return false;  // hide disabled formats from storefront
      if (seen.has(v.sku)) return false;
      seen.add(v.sku);
      return true;
    });
    return sortVariations(uniq);
  }, [product]);
  const range = useMemo(() => getPriceRange(product, isPro), [product, isPro]);

  if (loading) {
    return <div className="max-w-7xl mx-auto px-6 py-24 text-center text-ink-soft">{t("product.loading")}</div>;
  }
  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-24 text-center">
        <p>{t("product.notFound")}</p>
        <Link to="/tienda" className="btn-outline mt-6 inline-block">{t("product.backToShop")}</Link>
      </div>
    );
  }

  const currentPrice = selectedVariation
    ? variationPrice(selectedVariation, isPro)
    : (isPro ? product.price_professional : product.price_retail);
  const inStock = selectedVariation ? (selectedVariation.stock ?? 1) !== 0 : (product.stock ?? 1) !== 0;
  const blocks = product.description_blocks || {};
  const blockOrder = ["ingredients", "origin", "benefits", "usage", "storage", "certifications"];
  const hasBlocks = blockOrder.some((k) => blocks[k]);
  const nutrition = product.nutrition || [];
  const techUrl = product.tech_sheet?.url ? resolveAsset(product.tech_sheet.url) : "";
  const categories = (product.category || "").split(",").map((c) => c.trim()).filter(Boolean);

  const handleAdd = () => {
    if (!inStock) return;
    addItem(product, selectedVariation, quantity, isPro);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t("product.shareCopied"));
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
    setShareOpen(false);
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `${product.name} · EcoAndes BIO`;
  const shareLinks = [
    { name: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
    { name: "X (Twitter)", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}` },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}` },
    { name: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}` },
    { name: "Pinterest", href: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&description=${encodeURIComponent(shareText)}` },
  ];

  const askLink = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
    `Hola, tengo una pregunta sobre: ${product.name} (SKU ${product.sku})`
  )}`;

  const secondaryBtn = "inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] px-3 py-2 rounded-sm border border-bone-200 bg-white text-ink hover:border-sage-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500";

  // --- SEO / GEO ---
  const seo = product.seo || {};
  const seoTitle = seo.meta_title || product.name;
  const seoDesc = seo.meta_description || product.short_description || product.description || `${product.name} ecológico (BIO) a granel en EcoAndes.`;
  const seoImage = product.image_url ? resolveAsset(product.image_url) : (product.gallery && product.gallery[0] ? resolveAsset(product.gallery[0]) : "");
  const offerPrices = (product.variations || []).map((v) => variationPrice(v, isPro)).filter((p) => p > 0);
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: seoDesc,
    sku: product.sku,
    category: product.category,
    ...(seoImage ? { image: [seoImage] } : {}),
    brand: { "@type": "Brand", name: "EcoAndes" },
    ...(product.origin_country ? { countryOfOrigin: product.origin_country } : {}),
    ...(offerPrices.length
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "EUR",
            lowPrice: Math.min(...offerPrices).toFixed(2),
            highPrice: Math.max(...offerPrices).toFixed(2),
            offerCount: offerPrices.length,
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        }
      : currentPrice > 0
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "EUR",
            price: currentPrice.toFixed(2),
            availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
        }
      : {}),
  };

  return (
    <div className="bg-bone-100 pb-10">
      <Seo
        title={seoTitle}
        description={seoDesc}
        keywords={seo.keywords}
        image={seoImage}
        type="product"
        jsonLd={productJsonLd}
      />
      {/* Breadcrumbs */}
      <div className="max-w-[72rem] mx-auto px-4 sm:px-6 lg:px-8 py-5 text-xs text-ink-soft uppercase tracking-[0.16em] flex items-center gap-2 flex-wrap" data-testid="breadcrumbs">
        <Link to="/" className="hover:text-sage-600">{t("product.breadcrumbHome")}</Link>
        <ChevronRight size={12} />
        <Link to="/tienda" className="hover:text-sage-600">{t("product.breadcrumbShop")}</Link>
        <ChevronRight size={12} />
        <span className="text-ink normal-case tracking-normal">{product.name}</span>
      </div>

      {/* Hero */}
      <div className="max-w-[72rem] mx-auto px-4 sm:px-6 lg:px-8 lg:grid lg:grid-cols-12 lg:gap-x-10">
        {/* Móvil: categoría + nombre + estrellas + descripción ANTES de la imagen */}
        <div className="lg:hidden" data-testid="pdp-mobile-header">
          <div className="overline text-sage-600">{product.category}</div>
          <h1 className="font-heading text-3xl sm:text-4xl font-light text-ink mt-2 leading-tight">{product.name}</h1>
          {product.web_rating > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <StarRating value={product.web_rating} readOnly size={15} />
              {product.web_reviews > 0 && <span className="text-xs text-ink-muted">({product.web_reviews})</span>}
            </div>
          )}
          {product.highlights && (
            <p className="text-ink-soft mt-4 leading-relaxed">{product.highlights}</p>
          )}
        </div>

        <div className="lg:col-span-7 mt-6 lg:mt-0">
          <ProductGallery
            mainImage={product.image_url}
            gallery={product.gallery || []}
            variations={sortedVariations}
            selectedSku={selectedVariation?.sku}
            onSelectVariation={(v) => setSelectedVariation(v)}
            name={product.name}
          />
        </div>

        <div className="lg:col-span-5 mt-6 lg:mt-0 flex flex-col">
          {/* Escritorio: cabecera en la columna derecha (en móvil va antes de la imagen) */}
          <div className="hidden lg:block">
            <div className="overline text-sage-600">{product.category}</div>
            <h2 className="font-heading text-3xl sm:text-4xl font-light text-ink mt-2 leading-tight">{product.name}</h2>

            {product.web_rating > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <StarRating value={product.web_rating} readOnly size={15} />
                {product.web_reviews > 0 && <span className="text-xs text-ink-muted">({product.web_reviews})</span>}
              </div>
            )}

            {product.highlights && (
              <p className="text-ink-soft mt-4 leading-relaxed">{product.highlights}</p>
            )}
          </div>

          <TrustBadges badges={product.badges} className="mt-5 order-3 lg:order-none" />

          {/* Price (en móvil va justo debajo de la imagen) */}
          <div className="order-1 lg:order-none">
          <div className="mt-0 lg:mt-6 flex items-baseline gap-3 flex-wrap">
            <span className="font-heading text-3xl font-light text-ink" data-testid="product-price">
              {currentPrice > 0 ? formatEUR(currentPrice) : t("common.consult")}
            </span>
            {range.min !== range.max && (
              <span className="text-sm text-ink-muted">
                {t("product.priceRange")}: {formatEUR(range.min)} → {formatEUR(range.max)}
              </span>
            )}
            {isPro && currentPrice > 0 && (
              <span className="text-xs uppercase tracking-[0.18em] text-terracotta">{t("product.proPrice")}</span>
            )}
          </div>
          {currentPrice > 0 && (
            <div className="mt-1.5 text-xs text-ink-muted" data-testid="product-vat-note">
              {isPro
                ? `Precio sin IVA · IVA ${product.vat_rate ?? 10}% no incluido`
                : `IVA (${product.vat_rate ?? 10}%) incluido`}
            </div>
          )}
          {!isPro && product.price_professional > 0 && (
            <Link to="/login" className="text-xs uppercase tracking-[0.18em] text-sage-600 hover:text-sage-700 mt-1 inline-block" data-testid="pdp-login-b2b">
              {t("product.accessB2B")}
            </Link>
          )}
          </div>

          {/* Variation selector: one-click format pills */}
          {sortedVariations.length > 0 && (
            <div className="mt-6 max-lg:mt-4 order-2 lg:order-none">
              <div className="overline mb-2">{t("product.format")}</div>
              <div className="flex flex-wrap gap-2" data-testid="product-variant-pills">
                {sortedVariations.map((v) => {
                  const active = selectedVariation?.sku === v.sku;
                  return (
                    <button
                      key={v.sku}
                      type="button"
                      onClick={() => setSelectedVariation(v)}
                      data-testid={`variant-option-${v.sku}`}
                      aria-pressed={active}
                      className={`px-4 py-2.5 rounded-xl border text-sm transition-all ${
                        active
                          ? "border-sage-600 bg-sage-50 text-sage-800 font-semibold shadow-sm ring-1 ring-sage-500/40"
                          : "border-bone-200 bg-white text-ink-soft hover:border-sage-400 hover:text-sage-700"
                      }`}
                    >
                      <span className="block leading-tight">{v.name}</span>
                      <span className={`block text-[11px] mt-0.5 ${active ? "text-sage-700" : "text-ink-muted"}`}>
                        {formatEUR(variationPrice(v, isPro))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Availability */}
          <div className="mt-5 order-4 lg:order-none">
            <span
              data-testid="product-availability"
              className={`inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] px-3 py-1.5 rounded-full border ${
                inStock ? "text-sage-700 bg-sage-50 border-sage-200" : "text-terracotta bg-bone-100 border-bone-200"
              }`}
            >
              {inStock ? <Check size={13} /> : <AlertCircle size={13} />}
              {inStock ? t("product.inStock") : t("product.outOfStock")}
            </span>
          </div>

          {/* Quantity + Add to cart */}
          <div className="mt-5 order-5 lg:order-none flex flex-col sm:flex-row gap-3">
            <div className="inline-flex items-stretch rounded-sm border border-bone-200 bg-white">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="-" data-testid="quantity-decrement-button" className="px-3 text-ink hover:bg-bone-100 transition-colors">
                <Minus size={16} />
              </button>
              <input
                type="number" min={1} value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || "1", 10)))}
                data-testid="quantity-input"
                className="w-14 text-center border-x border-bone-200 bg-transparent outline-none text-ink"
              />
              <button onClick={() => setQuantity((q) => q + 1)} aria-label="+" data-testid="quantity-increment-button" className="px-3 text-ink hover:bg-bone-100 transition-colors">
                <Plus size={16} />
              </button>
            </div>
            <button onClick={handleAdd} disabled={!inStock || currentPrice <= 0} className="btn-primary flex-1 disabled:opacity-50" data-testid="add-to-cart-button">
              {t("product.addToCart")}
            </button>
          </div>

          {/* Secondary actions */}
          <div className="mt-4 order-6 lg:order-none flex flex-wrap gap-2" data-testid="secondary-actions">
            <button onClick={() => toggleWishlist(product)} className={`${secondaryBtn} ${isWished(product.id) ? "border-terracotta text-terracotta" : ""}`} data-testid="wishlist-button">
              <Heart size={15} fill={isWished(product.id) ? "currentColor" : "none"} /> {t("product.addToWishlist")}
            </button>
            <button onClick={() => toggleCompare(product)} className={`${secondaryBtn} ${isCompared(product.id) ? "border-sage-600 text-sage-700" : ""}`} data-testid="compare-button">
              <Scale size={15} /> {t("product.compare")}
            </button>
            <a href={askLink} target="_blank" rel="noopener noreferrer" className={secondaryBtn} data-testid="ask-about-product-button">
              <MessageCircle size={15} /> {t("product.ask")}
            </a>
            <div className="relative">
              <button onClick={() => setShareOpen((s) => !s)} className={`${secondaryBtn} ${shareOpen ? "border-sage-600 text-sage-700" : ""}`} data-testid="share-button">
                <Share2 size={15} /> {t("product.share")}
              </button>
              {shareOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShareOpen(false)} />
                  <div className="absolute z-40 mt-2 left-0 bg-white border border-bone-200 rounded-xl shadow-lg p-2 w-52" data-testid="share-menu">
                    {shareLinks.map((s) => (
                      <a
                        key={s.name}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShareOpen(false)}
                        className="block px-3 py-2 text-sm text-ink hover:bg-sage-50 hover:text-sage-700 rounded-md transition-colors"
                        data-testid={`share-${s.name.split(" ")[0].toLowerCase()}`}
                      >
                        {s.name}
                      </a>
                    ))}
                    <button
                      onClick={copyLink}
                      className="w-full text-left px-3 py-2 text-sm text-ink hover:bg-sage-50 hover:text-sage-700 rounded-md transition-colors border-t border-bone-100 mt-1 pt-2.5 flex items-center gap-2"
                      data-testid="share-copy-link"
                    >
                      <LinkIcon size={13} /> {t("product.copyLink", "Copiar enlace")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="mt-6 order-7 lg:order-none pt-4 border-t border-bone-200 flex flex-wrap gap-x-6 gap-y-2 text-xs text-ink-muted">
            <span data-testid="product-sku">{t("product.sku")}: {product.sku}</span>
            <span data-testid="product-categories">{t("product.categories")}: {product.category}</span>
          </div>

          {/* Organic certifications (all products) */}
          <div className="mt-5 order-8 lg:order-none pt-4 border-t border-bone-200" data-testid="product-certifications">
            <p className="text-xs text-ink-soft leading-relaxed">
              {t("product.certificationLabel")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {CERTIFICATIONS.map((c, i) => (
                <div
                  key={i}
                  className="h-16 w-16 sm:h-[72px] sm:w-[72px] rounded-md border border-bone-200 bg-white p-2 flex items-center justify-center shrink-0"
                  title={t("product.certificationLabel")}
                  data-testid={`certification-badge-${i + 1}`}
                >
                  <img
                    src={c}
                    alt="Certificación Agricultura Ecológica ES-ECO-023-MA"
                    className="max-h-full max-w-full object-contain"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Explore categories (right column, easy cross-navigation) — desplegable */}
          {allCategories.length > 0 && (
            <div className="mt-5 order-9 lg:order-none pt-4 border-t border-bone-200" data-testid="pdp-categories">
              <button
                type="button"
                onClick={() => setCatsOpen((v) => !v)}
                data-testid="pdp-categories-toggle"
                aria-expanded={catsOpen}
                className="w-full flex items-center justify-between gap-3 bg-white border border-bone-200 rounded-xl px-4 py-3 text-left transition-colors hover:border-sage-500"
              >
                <span className="overline">Explora más categorías</span>
                <ChevronDown
                  size={16}
                  className={`text-ink-soft shrink-0 transition-transform duration-200 ${catsOpen ? "rotate-180" : ""}`}
                />
              </button>
              {catsOpen && (
                <div className="mt-3 flex flex-wrap gap-2" data-testid="pdp-categories-panel">
                  {allCategories.map((c) => (
                    <Link
                      key={c.value}
                      to={`/tienda?cat=${encodeURIComponent(c.value)}`}
                      data-testid={`pdp-cat-${c.value}`}
                      className={`text-[11px] uppercase tracking-[0.14em] px-3 py-1.5 rounded-sm border transition ${
                        categories.includes(c.value) ? "bg-sage-50 border-sage-300 text-sage-700" : "border-bone-200 text-ink-soft hover:border-sage-500 hover:text-sage-700"
                      }`}
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-[72rem] mx-auto px-4 sm:px-6 lg:px-8 mt-12">
        <Tabs defaultValue="description">
          <TabsList className="w-full justify-start gap-2 overflow-x-auto eco-scroll bg-transparent p-0 h-auto flex-wrap">
            <TabsTrigger value="description" className="rounded-full border border-bone-200 bg-white px-4 py-2 text-xs uppercase tracking-[0.16em] data-[state=active]:border-sage-500 data-[state=active]:text-sage-700" data-testid="tab-description">{t("product.tabDescription")}</TabsTrigger>
            <TabsTrigger value="nutrition" className="rounded-full border border-bone-200 bg-white px-4 py-2 text-xs uppercase tracking-[0.16em] data-[state=active]:border-sage-500 data-[state=active]:text-sage-700" data-testid="tab-nutrition">{t("product.tabNutrition")}</TabsTrigger>
            <TabsTrigger value="techsheet" className="rounded-full border border-bone-200 bg-white px-4 py-2 text-xs uppercase tracking-[0.16em] data-[state=active]:border-sage-500 data-[state=active]:text-sage-700" data-testid="tab-techsheet">{t("product.tabTechSheet")}</TabsTrigger>
            <TabsTrigger value="reviews" className="rounded-full border border-bone-200 bg-white px-4 py-2 text-xs uppercase tracking-[0.16em] data-[state=active]:border-sage-500 data-[state=active]:text-sage-700" data-testid="tab-reviews">{t("product.tabReviews")}</TabsTrigger>
          </TabsList>

          {/* Description */}
          <TabsContent value="description" className="mt-6" data-testid="product-description-tab">
            {hasBlocks ? (
              <div className="space-y-6">
                {blockOrder.filter((k) => blocks[k]).map((k) => (
                  <div key={k} className="grid gap-2 lg:grid-cols-12">
                    <div className="lg:col-span-3 overline pt-1">{t(`product.blocks.${k}`)}</div>
                    <div className="lg:col-span-9 text-sm sm:text-base text-ink leading-relaxed whitespace-pre-line">{blocks[k]}</div>
                  </div>
                ))}
              </div>
            ) : product.description ? (
              <div className="text-sm sm:text-base text-ink leading-relaxed whitespace-pre-line">{product.description}</div>
            ) : (
              <div className="text-ink-muted text-sm">—</div>
            )}
          </TabsContent>

          {/* Nutrition */}
          <TabsContent value="nutrition" className="mt-6" data-testid="product-nutrition-tab">
            {nutrition.length > 0 ? (
              <div className="overflow-hidden rounded-md border border-bone-200 bg-white max-w-xl">
                <table className="w-full text-sm">
                  <thead className="bg-bone-100">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs uppercase tracking-[0.16em] text-ink-muted font-medium">{t("product.nutritionColNutrient")}</th>
                      <th className="text-right px-4 py-3 text-xs uppercase tracking-[0.16em] text-ink-muted font-medium">{t("product.nutritionColValue")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nutrition.map((n, i) => (
                      <tr key={i} className="border-t border-bone-200 hover:bg-sage-50/60 transition-colors">
                        <td className="px-4 py-2.5 text-ink">{n.label}</td>
                        <td className="px-4 py-2.5 text-right text-ink">{n.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-md border border-bone-200 bg-white p-8 text-center max-w-xl" data-testid="nutrition-empty-state">
                <Leaf className="mx-auto text-sage-400 mb-3" size={26} />
                <p className="text-ink-soft text-sm">{t("product.nutritionEmpty")}</p>
                <a href={askLink} target="_blank" rel="noopener noreferrer" className="btn-outline inline-block mt-4">{t("product.ask")}</a>
              </div>
            )}
          </TabsContent>

          {/* Tech sheet */}
          <TabsContent value="techsheet" className="mt-6" data-testid="product-technical-sheet-tab">
            {techUrl ? (
              <div className="rounded-2xl border border-bone-200 bg-white p-5 sm:p-6 max-w-xl" data-testid="techsheet-card">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-full bg-sage-50 border border-sage-200 flex items-center justify-center shrink-0">
                    <FileDown className="text-sage-600" size={19} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-heading text-lg text-ink leading-snug">{t("product.techSheetTitle")}</div>
                    <p className="text-sm text-ink-soft mt-1 leading-relaxed">{t("product.techSheetDesc")}</p>
                  </div>
                </div>
                <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
                  <a href={techUrl} target="_blank" rel="noopener noreferrer" className="btn-outline w-full sm:w-auto inline-flex items-center justify-center gap-2" data-testid="technical-sheet-view-button">
                    <FileDown size={15} /> Ver Documento
                  </a>
                  <a href={techUrl} target="_blank" rel="noopener noreferrer" download className="btn-primary w-full sm:w-auto inline-flex items-center justify-center gap-2" data-testid="technical-sheet-download-button">
                    <FileDown size={15} /> {t("product.downloadPdf")}
                  </a>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-bone-200 bg-white p-8 text-center max-w-xl" data-testid="techsheet-empty-state">
                <FileDown className="mx-auto text-sage-400 mb-3" size={26} />
                <p className="text-ink-soft text-sm">{t("product.techSheetEmpty")}</p>
                <a href={askLink} target="_blank" rel="noopener noreferrer" className="btn-outline inline-block mt-4">{t("product.ask")}</a>
              </div>
            )}
          </TabsContent>

          {/* Reviews */}
          <TabsContent value="reviews" className="mt-2" data-testid="product-reviews-tab">
            <ProductReviews productId={product.id} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Cross-selling */}
      {related.length > 0 && (
        <ProductCarousel overline={t("shop.title") || ""} title={t("product.relatedTitle")} products={related} testid="related-products-carousel" />
      )}
      {bestSellers.length > 0 && (
        <ProductCarousel title={t("product.bestSellersTitle")} products={bestSellers} testid="best-sellers-carousel" />
      )}

      {/* Mobile sticky add-to-cart */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-bone-200 px-4 py-3 flex items-center gap-3" style={{ boxShadow: "0 -12px 30px rgba(45,51,47,0.08)" }} data-testid="sticky-add-to-cart-bar">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-ink truncate">{product.name}</div>
          <div className="text-sm font-medium text-ink">{currentPrice > 0 ? formatEUR(currentPrice) : t("common.consult")}</div>
        </div>
        <button onClick={handleAdd} disabled={!inStock || currentPrice <= 0} className="btn-primary disabled:opacity-50" data-testid="sticky-add-to-cart-button">
          {t("product.addToCartShort")}
        </button>
      </div>
    </div>
  );
}
