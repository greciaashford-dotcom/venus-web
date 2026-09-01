import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Leaf, BadgeCheck, Sprout, Package, FileDown, PlayCircle } from "lucide-react";
import { api, resolveAsset } from "../lib/api";

const IMG1 = "/tienda-ecoandes-barcelo.jpg";

const YOUTUBE_ID = "3Hm8EO5udRI";

const DOCS = [
  {
    key: "cert",
    file: "/docs/certificado-bio-ecoandes-2026.pdf",
    testid: "about-cert-pdf",
  },
  {
    key: "catalog",
    file: "/docs/ECOANDES-LISTA-DE-PRODUCTOS-ENERO-2025.pdf",
    testid: "about-catalog-pdf",
  },
];

export default function About() {
  const { t } = useTranslation();
  const [philosophyImg, setPhilosophyImg] = useState(IMG1);

  useEffect(() => {
    api.get("/site-images").then(({ data }) => {
      if (data.images?.philosophy) setPhilosophyImg(data.images.philosophy);
    }).catch(() => {});
  }, []);

  const values = [
    { icon: Leaf, text: t("about.value1") },
    { icon: BadgeCheck, text: t("about.value2") },
    { icon: Sprout, text: t("about.value3") },
    { icon: Package, text: t("about.value4") },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-12 py-20" data-testid="about-page">
      {/* Intro */}
      <div className="overline mb-3">{t("about.overline")}</div>
      <h1 className="font-heading text-4xl md:text-5xl font-light max-w-3xl leading-[1.08]">
        {t("about.title")}
      </h1>
      <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
        <img src={resolveAsset(philosophyImg)} alt="Tienda EcoAndes en el Mercado Barceló" className="w-full aspect-[4/5] object-cover rounded-xl" data-testid="about-philosophy-img" />
        <div className="space-y-6 text-ink-soft font-light leading-relaxed text-base">
          <p className="text-xl text-ink leading-relaxed" data-testid="about-intro">{t("about.intro")}</p>
          <p>{t("about.p2")}</p>
          <Link to="/tienda" className="btn-outline inline-block mt-4">{t("about.explore")}</Link>
        </div>
      </div>

      {/* Nuestros Valores */}
      <div className="mt-24" data-testid="about-values">
        <div className="overline mb-3 text-center">{t("about.valuesOverline")}</div>
        <h2 className="font-heading text-3xl md:text-4xl font-light text-center mb-12">{t("about.valuesTitle")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {values.map((v, i) => (
            <div key={i} className="bg-white border border-bone-200 rounded-xl p-7 text-center hover:border-sage-300 transition-colors" data-testid={`about-value-${i + 1}`}>
              <div className="w-12 h-12 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center mx-auto mb-4">
                <v.icon size={22} strokeWidth={1.6} />
              </div>
              <p className="text-sm text-ink-soft leading-relaxed font-light">{v.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Video: entrevista a Araceli */}
      <div className="mt-24" data-testid="about-video-section">
        <div className="overline mb-3 text-center flex items-center justify-center gap-2">
          <PlayCircle size={14} className="text-sage-600" /> {t("about.videoOverline")}
        </div>
        <h2 className="font-heading text-3xl md:text-4xl font-light text-center mb-10">{t("about.videoTitle")}</h2>
        <div className="max-w-3xl mx-auto rounded-xl overflow-hidden border border-bone-200 shadow-[0_14px_40px_rgba(45,51,47,0.08)]">
          <div className="aspect-video bg-ink">
            <iframe
              src={`https://www.youtube.com/embed/${YOUTUBE_ID}`}
              title={t("about.videoTitle")}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              data-testid="about-youtube-iframe"
            />
          </div>
        </div>
      </div>

      {/* Documentos descargables */}
      <div className="mt-24" data-testid="about-docs">
        <div className="overline mb-3 text-center">{t("about.docsOverline")}</div>
        <h2 className="font-heading text-3xl md:text-4xl font-light text-center mb-10">{t("about.docsTitle")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {DOCS.map((d) => (
            <a
              key={d.key}
              href={d.file}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white border border-bone-200 rounded-xl p-7 flex items-center gap-5 hover:border-sage-500 hover:shadow-sm transition"
              data-testid={d.testid}
            >
              <div className="w-12 h-12 rounded-full bg-terracotta/10 text-terracotta flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FileDown size={22} strokeWidth={1.6} />
              </div>
              <div>
                <div className="text-sm font-medium text-ink leading-snug">{t(`about.${d.key}Doc`)}</div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-sage-600 mt-1.5">{t("about.download")} · PDF</div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Slogan final */}
      <div className="mt-24 bg-sage-700 rounded-2xl py-14 px-8 text-center" data-testid="about-slogan">
        <Leaf size={26} className="mx-auto mb-4 text-bone-100/70" strokeWidth={1.4} />
        <p className="font-heading text-2xl md:text-3xl font-light text-bone-100 max-w-2xl mx-auto leading-snug">
          {t("about.slogan")}
        </p>
      </div>
    </div>
  );
}
