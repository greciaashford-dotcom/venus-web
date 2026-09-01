import React from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import ProductCard from "./ProductCard";

export default function ProductCarousel({ overline, title, products = [], testid }) {
  const { t } = useTranslation();
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start", dragFree: true, containScroll: "trimSnaps" });

  if (!products || products.length === 0) return null;

  const scroll = (dir) => {
    if (!emblaApi) return;
    dir === "prev" ? emblaApi.scrollPrev() : emblaApi.scrollNext();
  };

  return (
    <section className="max-w-[var(--pdp-max,72rem)] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14" data-testid={testid}>
      <div className="flex items-end justify-between mb-6">
        <div>
          {overline && <div className="overline mb-2">{overline}</div>}
          <h2 className="font-heading text-2xl sm:text-3xl font-light text-ink">{title}</h2>
        </div>
        <div className="hidden sm:flex gap-2">
          <button
            onClick={() => scroll("prev")}
            aria-label="Anterior"
            className="h-10 w-10 rounded-full border border-bone-200 bg-white text-ink hover:border-sage-500 transition-colors flex items-center justify-center"
            data-testid={`${testid}-prev`}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => scroll("next")}
            aria-label="Siguiente"
            className="h-10 w-10 rounded-full border border-bone-200 bg-white text-ink hover:border-sage-500 transition-colors flex items-center justify-center"
            data-testid={`${testid}-next`}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4 sm:gap-6">
          {products.map((p) => (
            <div key={p.id} className="shrink-0 w-[88%] sm:w-[44%] md:w-[31%] lg:w-[23%]">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
