import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

/**
 * Sección de la home "Recetas con nuestros productos": hasta 3 vídeos verticales
 * gestionados desde el admin (/admin/recetas), con metadescripción por vídeo y
 * datos estructurados VideoObject para SEO.
 */
export default function RecipesSection() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    api
      .get("/recipes")
      .then(({ data }) => { if (alive) setItems(data.items || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (items.length === 0) return null;
  const videos = items.slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": videos.map((v) => ({
      "@type": "VideoObject",
      name: v.title || "Receta EcoAndes",
      description: v.description || "Receta con productos ecológicos EcoAndes",
      contentUrl: v.video_url,
      uploadDate: undefined,
    })),
  };

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-12 py-10 md:py-12" data-testid="recipes-section">
      <div className="text-center mb-8">
        <div className="overline">{t("recipes.overline", "Cocina BIO")}</div>
        <h2 className="font-heading text-3xl md:text-4xl font-light mt-2">
          {t("recipes.title", "Recetas con nuestros productos")}
        </h2>
        <p className="text-ink-soft text-sm mt-3 max-w-xl mx-auto">
          {t("recipes.subtitle", "Ideas fáciles y saludables para disfrutar de nuestros ingredientes ecológicos en tu cocina.")}
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-6 md:gap-8">
        {videos.map((v) => (
          <figure key={v.id} className="group w-[240px] sm:w-[270px] md:w-[290px]" data-testid={`recipe-video-${v.id}`}>
            <div className="aspect-[9/16] rounded-2xl overflow-hidden bg-ink/90 border border-bone-200 shadow-sm">
              <video
                src={v.video_url}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
                title={v.title || "Receta EcoAndes"}
                aria-label={v.description || v.title || "Receta EcoAndes"}
              />
            </div>
            {(v.title || v.description) && (
              <figcaption className="mt-3 px-1">
                {v.title && <div className="font-heading text-lg text-ink leading-snug">{v.title}</div>}
                {v.description && <p className="text-sm text-ink-soft mt-1 leading-relaxed line-clamp-3">{v.description}</p>}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </section>
  );
}
