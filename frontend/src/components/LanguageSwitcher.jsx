import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check } from "lucide-react";
import { LANGUAGES } from "../i18n";

export default function LanguageSwitcher({ variant = "default" }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current =
    LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ||
    LANGUAGES.find((l) => l.code === (i18n.language || "").split("-")[0]) ||
    LANGUAGES[0];

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const choose = (code) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  const flagUrl = (f) => `https://flagcdn.com/24x18/${f}.png`;

  return (
    <div className="relative" ref={ref} data-testid="language-switcher">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="language-switcher-btn"
        aria-label="Cambiar idioma"
        className="flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-ink hover:text-sage-600 transition-colors"
      >
        <img src={flagUrl(current.flag)} alt={current.sigla} width={20} height={15} className="rounded-[2px] object-cover shadow-sm" />
        <span className="hidden sm:inline font-medium">{current.sigla}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-44 bg-white border border-bone-200 shadow-lg rounded-sm overflow-hidden z-50"
          data-testid="language-switcher-menu"
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => choose(l.code)}
              data-testid={`lang-option-${l.code}`}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-sage-50 transition-colors ${
                l.code === current.code ? "bg-sage-50/60" : ""
              }`}
            >
              <img src={flagUrl(l.flag)} alt={l.sigla} width={20} height={15} className="rounded-[2px] object-cover shadow-sm" />
              <span className="flex-1 text-ink">{l.label}</span>
              <span className="text-[10px] text-ink-muted tracking-wider">{l.sigla}</span>
              {l.code === current.code && <Check size={14} className="text-sage-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
