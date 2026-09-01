import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Scale, X } from "lucide-react";
import { api, formatEUR, resolveAsset } from "../lib/api";
import { getPriceRange } from "../lib/price";
import { useWishlist } from "../context/WishlistContext";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import StarRating from "../components/StarRating";

export default function Compare() {
  const { t, i18n } = useTranslation();
  const { compare, toggleCompare, clearCompare } = useWishlist();
  const { addItem } = useCart();
  const { user } = useAuth();
  const isPro = user?.role === "professional" || user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        if (compare.length === 0) { setItems([]); return; }
        const { data } = await api.post("/products/by-ids", { ids: compare });
        if (alive) setItems(data);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [compare, i18n.resolvedLanguage]);

  const priceLabel = (p) => {
    const { min, max } = getPriceRange(p, isPro);
    if (min <= 0) return t("common.consult");
    return min !== max ? `${formatEUR(min)} – ${formatEUR(max)}` : formatEUR(min);
  };

  return (
    <div className="max-w-[72rem] mx-auto px-4 sm:px-6 lg:px-8 py-12 min-h-[60vh]">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="overline">{t("compare.overline")}</div>
          <h1 className="font-heading text-3xl sm:text-4xl font-light text-ink mt-2 flex items-center gap-3">
            <Scale className="text-sage-600" /> {t("compare.title")}
          </h1>
        </div>
        {items.length > 0 && (
          <button onClick={clearCompare} className="btn-outline" data-testid="compare-clear">{t("compare.clear")}</button>
        )}
      </div>

      {loading ? (
        <div className="text-ink-soft text-sm mt-8">{t("common.loading")}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-20" data-testid="compare-empty">
          <p className="text-ink-soft mb-6">{t("compare.empty")}</p>
          <Link to="/tienda" className="btn-primary inline-block">{t("compare.browse")}</Link>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto eco-scroll" data-testid="compare-table">
          <table className="w-full border-collapse min-w-[640px]">
            <thead>
              <tr>
                <th className="text-left p-3 w-32 align-bottom"></th>
                {items.map((p) => (
                  <th key={p.id} className="p-3 align-top text-left">
                    <div className="relative bg-white border border-bone-200 rounded-md p-3">
                      <button onClick={() => toggleCompare(p)} aria-label={t("compare.remove")} className="absolute top-2 right-2 text-ink-muted hover:text-terracotta" data-testid={`compare-remove-${p.id}`}>
                        <X size={16} />
                      </button>
                      <Link to={`/producto/${p.slug}`} className="block">
                        <div className="aspect-square bg-bone-100 rounded-sm overflow-hidden">
                          {p.image_url && <img src={resolveAsset(p.image_url)} alt={p.name} className="h-full w-full object-contain p-3" />}
                        </div>
                        <div className="font-heading text-sm text-ink mt-2 line-clamp-2">{p.name}</div>
                      </Link>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-t border-bone-200">
                <td className="p-3 overline">{t("compare.price")}</td>
                {items.map((p) => <td key={p.id} className="p-3 text-ink">{priceLabel(p)}</td>)}
              </tr>
              <tr className="border-t border-bone-200">
                <td className="p-3 overline">{t("compare.category")}</td>
                {items.map((p) => <td key={p.id} className="p-3 text-ink-soft">{p.category}</td>)}
              </tr>
              <tr className="border-t border-bone-200">
                <td className="p-3 overline">{t("compare.rating")}</td>
                {items.map((p) => <td key={p.id} className="p-3">{p.web_rating > 0 ? <StarRating value={p.web_rating} readOnly size={13} /> : <span className="text-ink-muted">—</span>}</td>)}
              </tr>
              <tr className="border-t border-bone-200">
                <td className="p-3 overline">{t("compare.stock")}</td>
                {items.map((p) => <td key={p.id} className="p-3 text-ink-soft">{(p.stock ?? 1) !== 0 ? t("product.inStock") : t("product.outOfStock")}</td>)}
              </tr>
              <tr className="border-t border-bone-200">
                <td className="p-3 overline">{t("compare.action")}</td>
                {items.map((p) => (
                  <td key={p.id} className="p-3">
                    {(p.variations || []).length ? (
                      <Link to={`/producto/${p.slug}`} className="btn-outline inline-block text-center">{t("product.viewProduct")}</Link>
                    ) : (
                      <button onClick={() => addItem(p, null, 1, isPro)} className="btn-primary">{t("product.addToCartShort")}</button>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
