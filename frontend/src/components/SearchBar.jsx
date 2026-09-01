import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, X } from "lucide-react";
import { api, formatEUR } from "../lib/api";

let CACHE = null; // simple in-memory cache for snappy autocomplete

async function loadAllProducts() {
  if (CACHE) return CACHE;
  const { data } = await api.get("/products", { params: { limit: 500 } });
  CACHE = data;
  return data;
}

function normalize(s = "") {
  return s
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function SearchBar({ compact = false, onNavigate }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    let active = true;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const all = await loadAllProducts();
        const q = normalize(query);
        const tokens = q.split(/\s+/).filter(Boolean);
        const matched = all.filter((p) => {
          const hay = normalize(`${p.name} ${p.sku} ${p.category} ${(p.tags || []).join(" ")}`);
          return tokens.every((tok) => hay.includes(tok));
        });
        const ranked = matched.slice(0, 8);
        if (active) setResults(ranked);
      } finally {
        if (active) setLoading(false);
      }
    }, 100);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setOpen(false);
    onNavigate?.();
    navigate(`/tienda?q=${encodeURIComponent(query.trim())}`);
  };

  const handleKeyDown = (e) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(results.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(-1, h - 1));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      const p = results[highlight];
      navigate(`/producto/${p.slug}`);
      setOpen(false);
      onNavigate?.();
      setQuery("");
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${compact ? "w-full" : "w-full lg:max-w-md"}`} data-testid="searchbar-wrap">
      <form onSubmit={handleSubmit} className="relative" data-testid="searchbar-form">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(-1); }}
          onKeyDown={handleKeyDown}
          placeholder={t("nav.searchPlaceholder")}
          data-testid="searchbar-input"
          className="w-full bg-white border border-bone-200 focus:border-sage-500 focus:ring-2 focus:ring-sage-500/30 rounded-full pl-9 pr-9 py-2.5 text-base lg:text-sm text-ink placeholder:text-ink-muted transition-all duration-200 outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
            data-testid="searchbar-clear"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-soft hover:text-sage-600 p-1"
            aria-label={t("search.clear")}
          >
            <X size={14} />
          </button>
        )}
      </form>

      {open && query.trim() && (
        <div
          className="absolute z-50 left-0 right-0 mt-2 bg-white border border-bone-200 shadow-[0_12px_40px_rgba(45,51,47,0.12)] rounded-2xl overflow-hidden reveal-scale"
          data-testid="searchbar-results"
        >
          {loading && (
            <div className="px-4 py-3 text-xs text-ink-soft">{t("search.searching")}</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-4 py-4 text-sm text-ink-soft" data-testid="searchbar-empty">
              {t("search.noResults", { query })}
            </div>
          )}
          {!loading && results.length > 0 && (
            <ul className="max-h-[60vh] overflow-y-auto eco-scroll">
              {results.map((p, i) => (
                <li key={p.id}>
                  <Link
                    to={`/producto/${p.slug}`}
                    onClick={() => { setOpen(false); setQuery(""); onNavigate?.(); }}
                    data-testid={`search-result-${p.sku}`}
                    className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                      highlight === i ? "bg-sage-50" : "hover:bg-bone-100"
                    }`}
                  >
                    <div className="w-10 h-10 bg-bone-100 rounded-lg overflow-hidden shrink-0">
                      {p.image_url && (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-ink truncate">{p.name}</div>
                      <div className="text-[11px] text-ink-soft">{p.category} · {p.sku}</div>
                    </div>
                    <div className="text-sm text-sage-700 font-medium whitespace-nowrap">
                      {p.display_price > 0 ? formatEUR(p.display_price) : "—"}
                    </div>
                  </Link>
                </li>
              ))}
              <li>
                <button
                  onClick={handleSubmit}
                  className="w-full px-3 py-3 text-xs uppercase tracking-[0.2em] text-sage-700 hover:bg-sage-100 border-t border-bone-200 text-left"
                  data-testid="searchbar-see-all"
                >
                  {t("search.seeAll")}
                </button>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
