import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api, resolveAsset } from "../lib/api";

// Module-scope component (stable identity across renders).
function HeroText({ s, i, activeIndex, b2b, overlay }) {
  const isActive = i === activeIndex;
  return (
    <div className={overlay ? "max-w-[46%] lg:max-w-[42%]" : "w-full"}>
      <div
        className="text-[10px] sm:text-[11px] uppercase tracking-[0.28em] font-semibold mb-3 sm:mb-4 text-[#7a5a3a]"
        data-testid={isActive ? "hero-overline" : undefined}
      >
        {s.overline}
      </div>
      <h1
        className="font-serif font-medium text-[#2a1d10] tracking-tight leading-[1.07] text-[1.65rem] sm:text-[2.1rem] md:text-[2.6rem] lg:text-[3.1rem] xl:text-[3.5rem]"
        style={{ fontWeight: 600 }}
        data-testid={isActive ? "hero-title" : undefined}
      >
        {s.h1}
      </h1>
      <p
        className="font-body mt-3 sm:mt-4 text-sm sm:text-[15px] md:text-base max-w-md leading-relaxed text-[#3a2a18]/85 font-medium line-clamp-3 sm:line-clamp-none"
        data-testid={isActive ? "hero-subtitle" : undefined}
      >
        {s.subtitle}
      </p>
      <div className="mt-4 sm:mt-6 flex flex-wrap gap-3">
        {s.cta_label ? (
          <Link
            to={s.cta_link || "/tienda"}
            className="bg-[#3a2a18] text-[#F4E9D5] hover:bg-[#2a1d10] transition-colors duration-300 px-6 sm:px-7 py-3 text-[11px] sm:text-xs uppercase tracking-[0.2em] rounded-sm inline-flex items-center gap-2"
            data-testid={isActive ? "hero-shop-cta" : undefined}
          >
            {s.cta_label} <ArrowRight size={14} />
          </Link>
        ) : null}
        <Link
          to={b2b.link || "/profesional"}
          className="border border-[#3a2a18]/60 text-[#3a2a18] hover:bg-[#3a2a18] hover:text-[#F4E9D5] transition-colors duration-300 px-6 sm:px-7 py-3 text-[11px] sm:text-xs uppercase tracking-[0.2em] rounded-sm"
          data-testid={isActive ? "hero-b2b-cta" : undefined}
        >
          {b2b.label}
        </Link>
      </div>
    </div>
  );
}

export default function HeroCarousel({ interval = 5000 }) {
  const { i18n } = useTranslation();
  const [slides, setSlides] = useState([]);
  const [b2b, setB2b] = useState({ label: "", link: "/profesional" });
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  // Fetch hero config; refetch when language changes (interceptor attaches lang).
  // setState happens inside async .then/.catch so it is not a synchronous effect update.
  useEffect(() => {
    let active = true;
    api
      .get("/hero")
      .then(({ data }) => {
        if (!active) return;
        const next = Array.isArray(data.slides) ? data.slides : [];
        next.forEach((s) => {
          const img = new Image();
          img.src = resolveAsset(s.image);
          if (s.image_mobile) {
            const m = new Image();
            m.src = resolveAsset(s.image_mobile);
          }
        });
        setSlides(next);
        if (data.b2b) setB2b(data.b2b);
      })
      .catch(() => {
        if (active) setSlides([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [i18n.language]);

  // Auto-rotate (setState inside the timer callback is async, not a sync effect update).
  useEffect(() => {
    if (slides.length <= 1) return undefined;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, interval);
    return () => clearInterval(timerRef.current);
  }, [interval, slides.length]);

  if (loading) {
    return (
      <section data-testid="hero-carousel">
        <div className="hidden landscape:block relative w-full aspect-[1352/452] max-h-[560px] bg-[#F4E9D5] animate-pulse" />
        <div className="landscape:hidden relative w-full aspect-[810/1012] bg-[#F4E9D5] animate-pulse" />
      </section>
    );
  }
  if (!slides.length) return null;

  const activeIndex = Math.min(index, slides.length - 1);
  const active = slides[activeIndex];

  const dots = (variant = "land") =>
    slides.length > 1 ? (
      <div
        className="absolute right-3 sm:right-5 lg:right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-10"
        data-testid={variant === "land" ? "hero-dots" : "hero-dots-portrait"}
      >
        {slides.map((s, i) => (
          <button
            key={s.id || i}
            onClick={() => setIndex(i)}
            data-testid={variant === "land" ? `hero-dot-${i}` : `hero-pdot-${i}`}
            aria-label={`Slide ${i + 1}`}
            className={`w-[3px] rounded-full transition-all duration-500 ${
              i === activeIndex ? "h-10 bg-[#3a2a18]" : "h-5 bg-[#3a2a18]/30 hover:bg-[#3a2a18]/60"
            }`}
          />
        ))}
      </div>
    ) : null;

  return (
    <section data-testid="hero-carousel" className="relative w-full bg-[#F4E9D5]">
      {/* ============ HORIZONTAL DEVICES (landscape): web banners ============ */}
      <div className="hidden landscape:block">
        {/* Image area — keeps the native banner ratio (1352x452 ~ 3:1), never cropped */}
        <div className="relative w-full aspect-[1352/452] max-h-[560px] overflow-hidden">
          {slides.map((s, i) => (
            <img
              key={s.id || i}
              src={resolveAsset(s.image)}
              alt={s.image_alt || s.h1 || ""}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ opacity: i === activeIndex ? 1 : 0, willChange: "opacity" }}
              loading={i === 0 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : "auto"}
              decoding="async"
            />
          ))}

          {/* Desktop: left text overlay with readability gradient */}
          <div className="hidden sm:block absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-[#F4E9D5]/45 via-[#F4E9D5]/10 to-transparent" />
            <div className="relative h-full max-w-7xl mx-auto px-6 lg:px-12 flex items-center pointer-events-auto">
              <div className="relative w-full">
                {slides.map((s, i) => (
                  <div
                    key={s.id || i}
                    data-testid={`hero-slide-${i}`}
                    className="absolute inset-0 transition-opacity duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{ opacity: i === activeIndex ? 1 : 0, pointerEvents: i === activeIndex ? "auto" : "none" }}
                  >
                    <HeroText s={s} i={i} activeIndex={activeIndex} b2b={b2b} overlay />
                  </div>
                ))}
                {/* spacer to give the absolute layers height */}
                <div className="invisible" aria-hidden="true">
                  <HeroText s={active} i={activeIndex} activeIndex={activeIndex} b2b={b2b} overlay />
                </div>
              </div>
            </div>
          </div>

          {dots()}
        </div>

        {/* Small landscape screens: text below the image for readability */}
        <div className="sm:hidden px-6 pt-6 pb-9 bg-[#F4E9D5]" data-testid="hero-mobile-text">
          <HeroText s={active} i={activeIndex} activeIndex={activeIndex} b2b={b2b} />
        </div>
      </div>

      {/* ============ VERTICAL DEVICES (portrait): mobile banners with text on top ============ */}
      <div className="landscape:hidden relative w-full aspect-[810/1012] overflow-hidden" data-testid="hero-portrait">
        {slides.map((s, i) => (
          <img
            key={s.id || i}
            src={resolveAsset(s.image_mobile || s.image)}
            alt={s.image_alt || s.h1 || ""}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ opacity: i === activeIndex ? 1 : 0, willChange: "opacity" }}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "auto"}
            decoding="async"
          />
        ))}

        {/* Text over the empty upper area of the vertical banners */}
        <div className="absolute inset-x-0 top-0 pt-7 sm:pt-12 px-6 sm:px-10">
          <div className="relative">
            {slides.map((s, i) => (
              <div
                key={s.id || i}
                data-testid={`hero-portrait-slide-${i}`}
                className="absolute inset-0 transition-opacity duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ opacity: i === activeIndex ? 1 : 0, pointerEvents: i === activeIndex ? "auto" : "none" }}
              >
                <HeroText s={s} i={i} activeIndex={activeIndex} b2b={b2b} />
              </div>
            ))}
            {/* spacer to give the absolute layers height */}
            <div className="invisible" aria-hidden="true">
              <HeroText s={active} i={activeIndex} activeIndex={activeIndex} b2b={b2b} />
            </div>
          </div>
        </div>

        {dots("portrait")}
      </div>
    </section>
  );
}
