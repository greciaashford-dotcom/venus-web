import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import ProductCard from "../components/ProductCard";
import HeroCarousel from "../components/HeroCarousel";
import ReviewsCarousel from "../components/ReviewsCarousel";
import CategoryCarousel from "../components/CategoryCarousel";
import RecipesSection from "../components/RecipesSection";
import Seo from "../components/Seo";
import { Leaf, Sprout, ShieldCheck } from "lucide-react";
import { resolveAsset } from "../lib/api";

// Imágenes por defecto (editables desde /admin/imagenes vía /api/site-images)
const COLLECTION_IMG = "/coleccion-principal.webp";
const COLLECTION_IMG_FALLBACK = "/coleccion-principal.jpg";
const B2B_IMG_PORTRAIT = "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/90f2dc95-18ff-4a32-9b26-49c52abf3b38-ixZJMjIJezMiDrOG.png";
const B2B_IMG_LANDSCAPE = "https://assets.zyrosite.com/w7wEiJrqV2hbSrVN/ab2cb895-a966-4f2e-8f75-353d990d0b2a-lKg4iIrIJ2eGA0DY.png";

export default function Home() {
  const { t, i18n } = useTranslation();
  const [featured, setFeatured] = useState([]);
  const [recommendedProds, setRecommendedProds] = useState([]);
  const [categories, setCategories] = useState([]);
  const [siteImgs, setSiteImgs] = useState({});

  useEffect(() => {
    api.get("/site-images").then(({ data }) => setSiteImgs(data.images || {})).catch(() => {});
  }, []);

  const collectionImg = siteImgs.collection_main || COLLECTION_IMG;
  const b2bPortrait = siteImgs.b2b_portrait || B2B_IMG_PORTRAIT;
  const b2bLandscape = siteImgs.b2b_landscape || B2B_IMG_LANDSCAPE;

  useEffect(() => {
    (async () => {
      try {
        const [{ data: feat }, { data: recos }, { data: cats }] = await Promise.all([
          api.get("/products", { params: { featured: true, limit: 8 } }),
          api.get("/products", { params: { recommended: true, limit: 8 } }),
          api.get("/products/categories"),
        ]);
        setFeatured(feat);
        setRecommendedProds(recos);
        setCategories(cats);
      } catch (e) { console.error(e); }
    })();
  }, [i18n.resolvedLanguage]);

  return (
    <div data-testid="home-page" className="bg-bone-100">
      <Seo
        title={t("home.seoTitle", "Ingredientes ecológicos a granel")}
        description={t("home.seoDesc", "EcoAndes: tienda online de superalimentos, semillas, harinas y legumbres ecológicas (BIO) a granel. Calidad certificada y envíos a península y Baleares.")}
        keywords={["ecoandes", "alimentos ecológicos", "bio a granel", "superalimentos", "comprar a granel", "tienda ecológica online"]}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "EcoAndes",
          url: typeof window !== "undefined" ? window.location.origin : "",
          description: "Tienda online de ingredientes y superalimentos ecológicos (BIO) a granel.",
        }}
      />
      <HeroCarousel />

      {/* Carrusel de categorías (editable desde el dashboard) */}
      <CategoryCarousel />

      {/* Values strip */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 py-10 md:py-12 grid grid-cols-1 md:grid-cols-3 gap-8" data-testid="values-strip">
        {[
          { icon: Leaf, title: t("home.value1Title"), desc: t("home.value1Desc") },
          { icon: Sprout, title: t("home.value2Title"), desc: t("home.value2Desc") },
          { icon: ShieldCheck, title: t("home.value3Title"), desc: t("home.value3Desc") },
        ].map((v) => (
          <div key={v.title} className="flex gap-4 items-start border-t border-bone-200 pt-8">
            <v.icon className="text-sage-600 shrink-0 mt-1" size={22} />
            <div>
              <h3 className="font-heading text-lg font-normal mb-2">{v.title}</h3>
              <p className="text-sm text-ink-soft font-light leading-relaxed">{v.desc}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Featured products */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 py-10 md:py-12" data-testid="featured-section">
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="overline mb-3">{t("home.featuredOverline")}</div>
            <h2 className="font-heading text-3xl md:text-4xl font-light text-ink">{t("home.featuredTitle")}</h2>
          </div>
          <Link to="/tienda" className="text-sm uppercase tracking-[0.22em] text-sage-600 hover:text-sage-700" data-testid="see-all-products">
            {t("common.seeAll")}
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Recomendados por EcoAndes (gestionable desde el editor de productos del admin) */}
      {recommendedProds.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 lg:px-12 py-10 md:py-12" data-testid="recommended-section">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="overline mb-3">{t("home.recommendedOverline")}</div>
              <h2 className="font-heading text-3xl md:text-4xl font-light text-ink">{t("home.recommendedTitle")}</h2>
            </div>
            <Link to="/tienda" className="text-sm uppercase tracking-[0.22em] text-sage-600 hover:text-sage-700" data-testid="see-all-recommended">
              {t("common.seeAll")}
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
            {recommendedProds.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Recetas con nuestros productos (vídeos verticales, editable desde admin) */}
      <RecipesSection />

      {/* Collections / categories */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 py-10 md:py-12" data-testid="collections-section">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-8">
          <Link
            to="/tienda"
            className="md:col-span-7 relative group overflow-hidden rounded-2xl min-h-[360px]"
            data-testid="collection-main"
          >
            <picture className="absolute inset-0 block w-full h-full">
              {collectionImg === COLLECTION_IMG && <source type="image/webp" srcSet={COLLECTION_IMG} />}
              <img src={collectionImg === COLLECTION_IMG ? COLLECTION_IMG_FALLBACK : resolveAsset(collectionImg)} alt={t("home.collectionImgAlt")} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
            </picture>
            <div className="relative h-full flex flex-col justify-start p-8 md:p-10">
              <div className="overline mb-2">{t("home.collectionMainOverline")}</div>
              <h3 className="font-heading text-2xl md:text-3xl font-light text-ink">{t("home.collectionMainTitle")}</h3>
            </div>
          </Link>
          <div className="md:col-span-5 grid grid-cols-2 gap-6 lg:gap-8">
            {categories.slice(0, 4).map((cat, i) => (
              <Link
                key={cat.value}
                to={`/tienda?cat=${encodeURIComponent(cat.value)}`}
                data-testid={`collection-chip-${i}`}
                className="bg-bone-200/50 p-6 rounded-2xl hover:bg-sage-100 transition-colors min-h-[170px] flex flex-col justify-between"
              >
                <div className="overline text-sage-600">{t("home.category")}</div>
                <h4 className="font-heading text-xl font-light text-ink">{cat.label}</h4>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* B2B Banner */}
      {/* Reseñas de clientes: carrusel infinito */}
      <div className="mt-6 md:mt-8">
        <ReviewsCarousel />
      </div>

      <section className="relative mt-10 md:mt-12" data-testid="b2b-banner">
        <div className="absolute inset-0">
          <picture className="block w-full h-full">
            <source media="(orientation: portrait)" srcSet={resolveAsset(b2bPortrait)} />
            <img src={resolveAsset(b2bLandscape)} alt="Profesional" className="w-full h-full object-cover" />
          </picture>
          <div className="absolute inset-0 bg-black/30" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-28 text-bone-100">
          <div className="max-w-xl">
            <div className="overline text-sage-200 mb-5">{t("home.b2bOverline")}</div>
            <h2 className="font-heading text-3xl md:text-4xl font-light leading-tight">{t("home.b2bTitle")}</h2>
            <p className="mt-5 text-sage-100/90 font-light leading-relaxed max-w-lg">
              {t("home.b2bDesc")}
            </p>
            <Link to="/profesional" className="btn-primary bg-bone-100 text-sage-800 hover:bg-sage-800 hover:text-white mt-8 inline-block" data-testid="b2b-cta">
              {t("home.b2bCta")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
