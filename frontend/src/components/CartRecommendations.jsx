import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, formatEUR, resolveAsset } from "../lib/api";
import { useCart } from "../context/CartContext";

const getRecentViews = () => {
  try {
    return JSON.parse(localStorage.getItem("eco_recent_views") || "[]");
  } catch {
    return [];
  }
};

function MiniCard({ product, onOpen }) {
  const img = resolveAsset(product.image_url) || resolveAsset((product.gallery || [])[0]);
  const price = product.display_price || 0;
  const compareAt = Number(product.compare_at_price || 0);
  const hasOffer = product.price_includes_vat && compareAt > price && price > 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(product)}
      data-testid={`cart-reco-${product.id}`}
      className="w-[124px] shrink-0 snap-start text-left bg-white border border-bone-200 rounded-xl overflow-hidden hover:border-sage-400 hover:shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500"
    >
      <div className="relative aspect-square bg-bone-50">
        {img ? (
          <img src={img} alt={product.name} loading="lazy" className="w-full h-full object-contain p-2" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-ink-muted">EcoAndes</div>
        )}
        {hasOffer && (
          <span className="absolute top-1.5 left-1.5 bg-terracotta text-white text-[9px] font-medium px-1.5 py-0.5 rounded-full">
            -{Math.round(((compareAt - price) / compareAt) * 100)}%
          </span>
        )}
      </div>
      <div className="p-2">
        <div className="text-[11px] text-ink leading-tight line-clamp-2 min-h-[2rem]">{product.name}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-xs text-ink font-medium">{price > 0 ? formatEUR(price) : ""}</span>
          {hasOffer && <span className="text-[10px] text-ink-muted line-through">{formatEUR(compareAt)}</span>}
        </div>
      </div>
    </button>
  );
}

function Row({ title, products, onOpen, testid }) {
  if (!products || products.length === 0) return null;
  return (
    <div className="mt-5" data-testid={testid}>
      <h4 className="text-[11px] uppercase tracking-[0.18em] text-ink-soft font-medium mb-2.5">{title}</h4>
      <div className="flex gap-2.5 overflow-x-auto pb-2 snap-x eco-scroll">
        {products.map((p) => (
          <MiniCard key={p.id} product={p} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

export default function CartRecommendations({ seedProductId }) {
  const { t } = useTranslation();
  const { closeDrawer } = useCart();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get("/products/recommendations", {
        params: {
          product_id: seedProductId || undefined,
          viewed: getRecentViews().join(",") || undefined,
          limit: 8,
        },
      })
      .then((r) => { if (active) setData(r.data); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [seedProductId]);

  const openProduct = (p) => {
    closeDrawer();
    navigate(`/producto/${p.slug}`);
  };

  if (loading) {
    return (
      <div className="mt-6 space-y-3" data-testid="cart-reco-loading">
        <div className="h-3 w-40 bg-bone-200 rounded animate-pulse" />
        <div className="flex gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-[124px] shrink-0">
              <div className="aspect-square bg-bone-200 rounded-xl animate-pulse" />
              <div className="h-2.5 bg-bone-200 rounded mt-2 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="border-t border-bone-200 mt-6 pt-1" data-testid="cart-recommendations">
      <Row title={t("cart.related")} products={data.related} onOpen={openProduct} testid="cart-reco-related" />
      <Row title={t("cart.recommended")} products={data.recommended} onOpen={openProduct} testid="cart-reco-recommended" />
      <Row title={t("cart.explore")} products={data.explore} onOpen={openProduct} testid="cart-reco-explore" />
      {/* Ofertas: aparece automáticamente cuando existan productos con descuento (compare_at_price) */}
      <Row
        title={t("cart.offersIn", { category: data.category || "" })}
        products={data.offers}
        onOpen={openProduct}
        testid="cart-reco-offers"
      />
    </div>
  );
}
