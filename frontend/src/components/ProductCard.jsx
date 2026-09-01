import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, Minus, Plus, Scale, ShoppingBag } from "lucide-react";
import { formatEUR, resolveAsset } from "../lib/api";
import { sortVariations, variationPrice } from "../lib/price";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import StarRating from "./StarRating";

/**
 * Tarjeta de producto con compra rápida.
 * - Móvil: layout horizontal (imagen izquierda; a la derecha: nombre → estrellas
 *   → formatos con precio → cantidad + botones).
 * - Escritorio: layout vertical clásico.
 * - Píldoras de formato: nombre arriba y precio abajo.
 * - Selector de cantidad en todas las tarjetas.
 */
export default function ProductCard({ product }) {
  const { t } = useTranslation();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { isWished, isCompared, toggleWishlist, toggleCompare } = useWishlist();
  const isPro = user?.role === "professional" || user?.role === "admin";

  const variations = useMemo(() => sortVariations(product.variations || []), [product]);
  const hasVariations = variations.length > 0;
  const [selSku, setSelSku] = useState(hasVariations ? variations[0].sku : null);
  const [qty, setQty] = useState(1);
  const selVar = hasVariations
    ? variations.find((v) => v.sku === selSku) || variations[0]
    : null;

  const singlePrice =
    typeof product.display_price === "number"
      ? product.display_price
      : isPro
      ? product.price_professional
      : product.price_retail;
  const selPrice = selVar ? variationPrice(selVar, isPro) : singlePrice || 0;

  const rating = product.web_rating || 0;
  const reviews = product.web_reviews || 0;
  const img = resolveAsset(product.image_url) || resolveAsset((product.gallery || [])[0]);
  const detailUrl = `/producto/${product.slug}`;

  const onAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (selPrice <= 0) return;
    addItem(product, selVar, qty, isPro);
    setQty(1);
  };

  const selectFormat = (e, sku) => {
    e.preventDefault();
    e.stopPropagation();
    setSelSku(sku);
  };

  const iconBtn =
    "h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-white/95 backdrop-blur border flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500";

  return (
    <div
      data-testid={`product-card-${product.id}`}
      className="group bg-white border border-bone-200 rounded-2xl overflow-hidden hover-lift flex sm:flex-col"
    >
      {/* Imagen (izquierda en móvil, arriba en escritorio) */}
      <Link
        to={detailUrl}
        data-testid={`product-card-img-${product.id}`}
        className="relative w-32 shrink-0 self-stretch sm:w-full sm:aspect-square bg-bone-100 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500"
      >
        {img ? (
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-contain p-2.5 sm:p-4 transition-transform duration-500 group-hover:scale-[1.06]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-ink-muted text-xs">EcoAndes</div>
        )}
        {product.best_seller && (
          <span className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-terracotta text-white text-[8px] sm:text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full shadow-sm">
            {t("productCard.bestSeller")}
          </span>
        )}
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-col gap-1.5 sm:gap-2 opacity-100 lg:opacity-0 lg:translate-x-1 lg:group-hover:opacity-100 lg:group-hover:translate-x-0 transition-all duration-300">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(product); }}
            aria-label={t("productCard.wishlist")}
            data-testid={`product-card-wishlist-${product.id}`}
            className={`${iconBtn} ${isWished(product.id) ? "border-terracotta text-terracotta" : "border-bone-200 text-ink hover:border-sage-500"}`}
          >
            <Heart size={14} fill={isWished(product.id) ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCompare(product); }}
            aria-label={t("productCard.compare")}
            data-testid={`product-card-compare-${product.id}`}
            className={`${iconBtn} hidden sm:flex ${isCompared(product.id) ? "border-sage-600 text-sage-700" : "border-bone-200 text-ink hover:border-sage-500"}`}
          >
            <Scale size={14} />
          </button>
        </div>
      </Link>

      {/* Contenido (derecha en móvil, debajo en escritorio) */}
      <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col">
        {/* Nombre */}
        <Link to={detailUrl} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 rounded-sm">
          <h3 className="font-heading text-sm sm:text-base text-ink leading-snug line-clamp-2 sm:min-h-[2.6rem] transition-colors duration-200 group-hover:text-sage-700">
            {product.name}
          </h3>
        </Link>

        {/* Estrellas */}
        {rating > 0 && (
          <div className="flex items-center gap-1.5 mt-1" data-testid={`product-card-rating-${product.id}`}>
            <StarRating value={rating} readOnly size={12} />
            <span className="text-[11px] text-ink-muted">{rating.toFixed(1)} ({reviews})</span>
          </div>
        )}

        {/* Formatos (nombre arriba, precio abajo) o precio único */}
        <div className="mt-2">
          {hasVariations ? (
            <div className="flex flex-wrap gap-1.5" data-testid={`product-card-formats-${product.id}`}>
              {variations.map((v) => {
                const active = v.sku === selVar?.sku;
                const p = variationPrice(v, isPro);
                return (
                  <button
                    key={v.sku}
                    type="button"
                    onClick={(e) => selectFormat(e, v.sku)}
                    data-testid={`product-card-format-${product.id}-${v.sku}`}
                    aria-pressed={active}
                    className={`px-2 py-1 rounded-lg border text-center transition-colors duration-150 ${
                      active
                        ? "bg-sage-500 border-sage-500 text-white"
                        : "bg-white border-bone-200 text-ink-soft hover:border-sage-500 hover:text-sage-700"
                    }`}
                  >
                    <span className="block text-[10px] leading-tight font-medium">{v.name}</span>
                    <span className={`block text-[10px] leading-tight mt-0.5 ${active ? "text-white/90" : "text-ink-muted"}`}>
                      {p > 0 ? formatEUR(p) : t("common.consult")}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-ink font-medium" data-testid={`product-card-price-${product.id}`}>
              {selPrice > 0 ? formatEUR(selPrice) : t("common.consult")}
            </div>
          )}
        </div>

        {/* Cantidad + añadir + ver producto */}
        <div className="mt-3 sm:mt-auto sm:pt-3 flex flex-col gap-1.5" data-testid={`product-card-actions-${product.id}`}>
          <div className="flex items-stretch gap-1.5">
            <div
              className="inline-flex items-center rounded-full border border-bone-200 bg-white shrink-0"
              data-testid={`product-card-qty-${product.id}`}
            >
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQty((q) => Math.max(1, q - 1)); }}
                aria-label="-"
                data-testid={`product-card-qty-dec-${product.id}`}
                className="px-1.5 py-1.5 text-ink-soft hover:text-sage-700 active:scale-95 transition-all"
              >
                <Minus size={12} />
              </button>
              <span className="w-5 text-center text-xs text-ink" data-testid={`product-card-qty-value-${product.id}`}>
                {qty}
              </span>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQty((q) => q + 1); }}
                aria-label="+"
                data-testid={`product-card-qty-inc-${product.id}`}
                className="px-1.5 py-1.5 text-ink-soft hover:text-sage-700 active:scale-95 transition-all"
              >
                <Plus size={12} />
              </button>
            </div>
            <button
              type="button"
              onClick={onAdd}
              disabled={selPrice <= 0}
              data-testid={`product-card-add-${product.id}`}
              className="flex-1 min-w-0 inline-flex items-center justify-center gap-1 bg-sage-500 text-white rounded-full py-2 px-2 text-[10px] uppercase tracking-[0.08em] font-medium whitespace-nowrap hover:bg-sage-600 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
            >
              <ShoppingBag size={12} className="shrink-0 hidden sm:inline" /> {t("productCard.addToCart")}
            </button>
          </div>
          <Link
            to={detailUrl}
            data-testid={`product-card-view-${product.id}`}
            className="w-full inline-flex items-center justify-center border border-bone-300 text-ink-soft hover:border-sage-500 hover:text-sage-700 rounded-full py-2 text-[10px] uppercase tracking-[0.14em] font-medium transition-colors duration-200"
          >
            {t("product.viewProduct")}
          </Link>
        </div>
      </div>
    </div>
  );
}
