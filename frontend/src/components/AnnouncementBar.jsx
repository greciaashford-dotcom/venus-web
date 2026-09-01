import React from "react";
import { useTranslation } from "react-i18next";
import { Truck, Gift, Facebook, Instagram, Linkedin } from "lucide-react";

const SOCIALS = [
  { href: "https://www.facebook.com/EcoandesBio", I: Facebook, label: "Facebook" },
  { href: "https://www.instagram.com/ecoandesbio", I: Instagram, label: "Instagram" },
  { href: "https://www.linkedin.com/company/ecoandes-import-export-s-l-", I: Linkedin, label: "LinkedIn" },
];

function MarqueeBlock() {
  const { t } = useTranslation();
  const ITEMS = [
    { icon: Truck, text: t("announcement.freeShipping") },
    { icon: Gift, text: t("announcement.discount", { coupon: "ECOBONUS" }) },
    { icon: null, socials: true },
  ];
  return (
    <div className="flex items-center gap-12 sm:gap-16 px-6 sm:px-8 shrink-0">
      {ITEMS.map((it, i) => (
        <div key={i} className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {it.socials ? (
            <div className="flex items-center gap-3" data-testid="announce-socials-block">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="text-bone-100/85 hover:text-white transition-colors"
                >
                  <s.I size={14} strokeWidth={1.6} />
                </a>
              ))}
            </div>
          ) : (
            <>
              <it.icon size={14} strokeWidth={1.6} className="text-sage-200 shrink-0" />
              <span className="whitespace-nowrap text-[11px] sm:text-[12px] tracking-[0.08em] text-bone-100/90 font-medium">
                {it.text}
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AnnouncementBar() {
  return (
    <div
      data-testid="announcement-bar"
      className="relative w-full bg-sage-800 text-bone-100 overflow-hidden border-b border-sage-700/50"
    >
      {/* Faint side gradients to fade content at edges (premium feel) */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-sage-800 to-transparent z-10" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-sage-800 to-transparent z-10" aria-hidden="true" />

      <div
        className="flex w-max items-center py-2 sm:py-2.5 announcement-track"
        style={{ animation: "announcement-scroll 30s linear infinite" }}
      >
        {/* duplicated twice for seamless loop */}
        <MarqueeBlock />
        <MarqueeBlock />
        <MarqueeBlock />
        <MarqueeBlock />
      </div>
    </div>
  );
}
