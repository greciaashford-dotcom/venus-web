import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, resolveAsset } from "../lib/api";
import { CoverflowCarousel } from "./CoverflowCarousel";

/**
 * Sección "Nuestras Categorías" de la home.
 * Los items se gestionan desde /admin/carrusel (título, imagen, categoría enlazada
 * y descripción opcional; si la descripción está vacía, el backend la genera
 * automáticamente con los productos de esa categoría).
 * Render: carrusel 3D tipo coverflow (click -> /tienda?cat=...).
 */
export default function CategoryCarousel() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    api
      .get("/carousel-categories")
      .then(({ data }) => { if (alive) setItems(data.items || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (items.length === 0) return null;

  const slides = items.map((it) => ({
    id: it.id,
    title: it.title,
    cat: it.cat || "",
    img: resolveAsset(it.img),
    description: it.description || "",
    product_count: it.product_count || 0,
  }));

  return (
    <section className="py-10 md:py-12 overflow-hidden" data-testid="category-carousel">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 mb-2 sm:mb-3 text-center">
        <div className="overline">{t("home.collectionsOverline", "Explora")}</div>
        <h2 className="font-heading text-3xl md:text-4xl font-light mt-2">
          {t("home.categoriesTitle", "Nuestras Categorías")}
        </h2>
      </div>
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <CoverflowCarousel slides={slides} />
      </div>
    </section>
  );
}
