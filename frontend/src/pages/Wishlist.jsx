import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import { api } from "../lib/api";
import { useWishlist } from "../context/WishlistContext";
import ProductCard from "../components/ProductCard";

export default function Wishlist() {
  const { t, i18n } = useTranslation();
  const { wishlist } = useWishlist();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        if (wishlist.length === 0) { setItems([]); return; }
        const { data } = await api.post("/products/by-ids", { ids: wishlist });
        if (alive) setItems(data);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [wishlist, i18n.resolvedLanguage]);

  return (
    <div className="max-w-[72rem] mx-auto px-4 sm:px-6 lg:px-8 py-12 min-h-[60vh]">
      <div className="overline">{t("wishlist.overline")}</div>
      <h1 className="font-heading text-3xl sm:text-4xl font-light text-ink mt-2 mb-8 flex items-center gap-3">
        <Heart className="text-terracotta" /> {t("wishlist.title")}
      </h1>
      {loading ? (
        <div className="text-ink-soft text-sm">{t("common.loading")}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-20" data-testid="wishlist-empty">
          <p className="text-ink-soft mb-6">{t("wishlist.empty")}</p>
          <Link to="/tienda" className="btn-primary inline-block">{t("wishlist.browse")}</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6" data-testid="wishlist-grid">
          {items.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
