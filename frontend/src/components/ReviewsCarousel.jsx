import React from "react";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { REVIEWS } from "../data/reviews";

function Stars({ n }) {
  return (
    <div className="flex gap-0.5 text-[#D9A441]" aria-label={`${n} estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={13} fill={i <= n ? "currentColor" : "none"} strokeWidth={i <= n ? 0 : 1.5} className={i <= n ? "" : "text-bone-300"} />
      ))}
    </div>
  );
}

function ReviewCard({ r }) {
  return (
    <figure className="w-[300px] sm:w-[340px] shrink-0 bg-white border border-bone-200 rounded-xl p-5 flex flex-col gap-3 hover:border-sage-300 transition-colors">
      <Stars n={r.rating} />
      <blockquote className="text-[13.5px] leading-relaxed text-ink-soft font-light flex-1">
        “{r.text}”
      </blockquote>
      <figcaption className="flex items-center gap-3 pt-1">
        {r.photo ? (
          <img
            src={r.photo}
            alt={r.name}
            loading="lazy"
            className="w-9 h-9 rounded-full object-cover shrink-0 border border-bone-200"
            onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling?.classList.remove("hidden"); }}
          />
        ) : null}
        <div className={`w-9 h-9 rounded-full bg-sage-100 text-sage-700 items-center justify-center text-xs font-medium shrink-0 ${r.photo ? "hidden" : "flex"}`}>
          {r.name.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium text-ink truncate">{r.name}</div>
          <div className="text-[11px] text-ink-muted truncate">{r.place}</div>
        </div>
      </figcaption>
    </figure>
  );
}

function Row({ items, reverse, duration }) {
  // Duplicate the list so the marquee loops seamlessly
  const doubled = [...items, ...items];
  return (
    <div className="marquee-row" style={{ "--marquee-duration": `${duration}s` }}>
      <div className={`marquee-track ${reverse ? "marquee-reverse" : ""}`}>
        {doubled.map((r, i) => (
          <ReviewCard key={`${r.name}-${i}`} r={r} />
        ))}
      </div>
    </div>
  );
}

export default function ReviewsCarousel() {
  const { t } = useTranslation();
  const half = Math.ceil(REVIEWS.length / 2);
  const rowA = REVIEWS.slice(0, half);
  const rowB = REVIEWS.slice(half);

  const average = REVIEWS.reduce((acc, r) => acc + r.rating, 0) / REVIEWS.length;

  return (
    <section className="py-20 bg-bone-50 overflow-hidden" data-testid="reviews-carousel">
      <div className="max-w-7xl mx-auto px-6 lg:px-12 mb-10 text-center">
        <div className="overline mb-3">{t("reviews.overline")}</div>
        <h2 className="font-heading text-3xl md:text-4xl font-light">{t("reviews.title")}</h2>
        {/* Promedio general estilo Google */}
        <div className="flex items-center justify-center gap-3 mt-5" data-testid="reviews-average">
          <span className="font-heading text-4xl font-light text-ink leading-none">{average.toFixed(1)}</span>
          <div className="text-left">
            <div className="flex gap-0.5 text-[#D9A441]">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={16} fill={i <= Math.round(average) ? "currentColor" : "none"} strokeWidth={i <= Math.round(average) ? 0 : 1.5} className={i <= Math.round(average) ? "" : "text-bone-300"} />
              ))}
            </div>
            <div className="text-[11px] text-ink-muted mt-1">{t("reviews.basedOn", { count: REVIEWS.length })}</div>
          </div>
        </div>
        <p className="text-ink-soft text-sm mt-4 max-w-xl mx-auto font-light">{t("reviews.subtitle")}</p>
      </div>
      <div className="space-y-5">
        <Row items={rowA} duration={220} />
        <Row items={rowB} reverse duration={240} />
      </div>
    </section>
  );
}
