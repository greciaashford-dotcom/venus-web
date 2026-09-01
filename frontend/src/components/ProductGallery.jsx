import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { resolveAsset } from "../lib/api";

// Gallery with main image + per-format thumbnails.
// If a format has no dedicated image, the thumbnail shows the main image with a
// weight-label overlay so the user knows which package size it represents.
export default function ProductGallery({ mainImage, gallery = [], variations = [], selectedSku, onSelectVariation, name }) {
  const main = resolveAsset(mainImage) || resolveAsset(gallery[0]) || "";

  const thumbs = useMemo(() => {
    const list = [];
    if (variations && variations.length) {
      variations.forEach((v, vi) => {
        list.push({
          key: `v-${v.sku}-${vi}`,
          img: resolveAsset(v.image_url) || main,
          label: v.name,
          sku: v.sku,
          variation: v,
          hasOwn: !!v.image_url,
        });
      });
      // additional non-format gallery photos
      gallery.slice(1).forEach((g, i) => list.push({ key: `g-${i}`, img: resolveAsset(g), label: null }));
    } else {
      (gallery.length ? gallery : [mainImage]).forEach((g, i) =>
        list.push({ key: `g-${i}`, img: resolveAsset(g), label: null })
      );
    }
    return list.filter((t) => t.img);
  }, [variations, gallery, mainImage, main]);

  const [active, setActive] = useState(main);

  useEffect(() => {
    // when selected variation changes externally, sync image if it has one
    const v = variations.find((x) => x.sku === selectedSku);
    if (v && v.image_url) setActive(resolveAsset(v.image_url));
  }, [selectedSku, variations]);

  useEffect(() => {
    setActive(main);
  }, [main]);

  return (
    <div data-testid="product-gallery">
      <div className="relative aspect-square w-full overflow-hidden rounded-md border border-bone-200 bg-white">
        <AnimatePresence mode="wait">
          <motion.img
            key={active}
            src={active}
            alt={name}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="h-full w-full object-contain p-6"
            data-testid="gallery-main-image"
          />
        </AnimatePresence>
      </div>

      {thumbs.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 eco-scroll" data-testid="gallery-thumbnails">
          {thumbs.map((tb) => {
            const isActive = active === tb.img;
            return (
              <button
                key={tb.key}
                type="button"
                onClick={() => {
                  setActive(tb.img);
                  if (tb.variation && onSelectVariation) onSelectVariation(tb.variation);
                }}
                aria-label={tb.label ? `Formato ${tb.label}` : "Ver imagen"}
                data-testid={`gallery-thumb-${tb.key}`}
                className={`relative shrink-0 w-16 h-16 sm:w-20 sm:h-20 overflow-hidden rounded-sm border bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-500 ${
                  isActive ? "border-sage-500 ring-1 ring-sage-500" : "border-bone-200 hover:border-sage-300"
                }`}
              >
                <img src={tb.img} alt={tb.label || name} className="h-full w-full object-contain p-1.5" loading="lazy" />
                {tb.label && (
                  <span className="absolute bottom-0 inset-x-0 bg-ink/70 text-white text-[9px] uppercase tracking-wide py-0.5 text-center">
                    {tb.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
