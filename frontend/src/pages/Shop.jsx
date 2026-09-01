import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import ProductCard from "../components/ProductCard";
import SearchBar from "../components/SearchBar";
import Seo from "../components/Seo";

const PAGE_SIZE = 28; // ≈6 páginas con el catálogo actual

export default function Shop() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catsOpen, setCatsOpen] = useState(false); // desplegable móvil
  const [page, setPage] = useState(1);
  const gridTopRef = useRef(null);
  const cat = params.get("cat") || "";
  const search = params.get("q") || "";

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: cats } = await api.get("/products/categories");
        setCategories(cats);
        const { data } = await api.get("/products", {
          params: { category: cat || undefined, search: search || undefined, limit: 200 },
        });
        setProducts(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [cat, search, i18n.resolvedLanguage]);

  // Reset de página al cambiar filtros/búsqueda
  useEffect(() => { setPage(1); }, [cat, search]);

  const chips = useMemo(
    () => [{ value: "", label: t("shop.all") }, ...categories.map((c) => ({ value: c.value, label: c.label }))],
    [categories, t]
  );

  const setCat = (value) => {
    setParams((prev) => {
      const n = new URLSearchParams(prev);
      if (value) n.set("cat", value);
      else n.delete("cat");
      return n;
    });
    setCatsOpen(false);
  };

  // Paginación
  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageProducts = products.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const goToPage = (p) => {
    const next = Math.max(1, Math.min(p, totalPages));
    setPage(next);
    requestAnimationFrame(() => {
      gridTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const activeChip = chips.find((c) => (c.value || "") === (cat || ""));

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-12 py-16" data-testid="shop-page">
      <Seo
        title={t("shop.title", "Tienda")}
        description={t("shop.seoDesc", "Compra superalimentos, semillas, harinas, legumbres y especias ecológicas (BIO) a granel en EcoAndes. Formatos para hogar y profesionales.")}
        keywords={["tienda ecológica", "comprar bio a granel", "superalimentos", "semillas ecológicas", "harinas bio"]}
      />
      <div className="mb-10">
        <div className="overline mb-3">{t("shop.overline")}</div>
        <h1 className="font-heading text-4xl md:text-5xl font-light text-ink">{t("shop.title")}</h1>
        <p className="mt-4 text-sm text-ink-soft max-w-xl font-light">
          {t("shop.intro")}
        </p>
      </div>

      <div className="mb-6 max-w-xl" data-testid="shop-search-form">
        <SearchBar />
        {search && (
          <div className="mt-3 flex items-center gap-2 text-xs text-ink-soft" data-testid="shop-active-query">
            <span>{t("shop.resultsFor")}</span>
            <span className="text-sage-700 font-medium">“{search}”</span>
            <button
              type="button"
              onClick={() => setParams((prev) => { const n = new URLSearchParams(prev); n.delete("q"); return n; })}
              data-testid="shop-clear-query"
              className="text-sage-700 underline hover:text-sage-800"
            >
              {t("shop.clear")}
            </button>
          </div>
        )}
      </div>

      {/* Móvil: categorías en desplegable */}
      <div className="lg:hidden mb-8" data-testid="shop-categories-mobile">
        <button
          type="button"
          onClick={() => setCatsOpen((v) => !v)}
          data-testid="shop-categories-toggle"
          className="w-full flex items-center justify-between bg-white border border-bone-200 rounded-xl px-4 py-3.5 text-sm text-ink"
          aria-expanded={catsOpen}
        >
          <span className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">{t("shop.categoriesTitle", "Categorías")}</span>
            <span className="font-medium text-sage-700">{activeChip?.label || t("shop.all")}</span>
          </span>
          <ChevronDown size={17} className={`text-ink-soft transition-transform duration-200 ${catsOpen ? "rotate-180" : ""}`} />
        </button>
        {catsOpen && (
          <div className="mt-2 bg-white border border-bone-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto eco-scroll divide-y divide-bone-100" data-testid="shop-categories-panel">
            {chips.map((c) => {
              const active = (c.value || "") === (cat || "");
              return (
                <button
                  key={c.value || "all"}
                  onClick={() => setCat(c.value)}
                  data-testid={`cat-chip-${c.value || "all"}`}
                  className={`w-full text-left text-sm px-4 py-3 transition ${
                    active ? "bg-sage-50 text-sage-700 font-medium" : "text-ink-soft active:bg-bone-100"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Escritorio: chips de categorías */}
      <div className="hidden lg:flex flex-wrap gap-2 mb-10" data-testid="category-chips">
        {chips.map((c) => {
          const active = (c.value || "") === (cat || "");
          return (
            <button
              key={c.value || "all"}
              onClick={() => setCat(c.value)}
              data-testid={`cat-chip-desktop-${c.value || "all"}`}
              className={`text-xs uppercase tracking-[0.18em] px-4 py-2 border rounded-sm transition ${
                active ? "bg-sage-500 text-white border-sage-500" : "bg-transparent text-ink border-bone-200 hover:border-sage-500"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-20 text-ink-soft">{t("common.loading")}</div>
      ) : (
        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-10">
          <div ref={gridTopRef} className="scroll-mt-28">
            {products.length === 0 ? (
              <div className="text-center py-20 text-ink-soft" data-testid="no-products">{t("shop.noResults")}</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
                  {pageProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>

                {/* Paginación (todas las vistas) */}
                {totalPages > 1 && (
                  <nav className="mt-10 flex items-center justify-center gap-1.5 flex-wrap" data-testid="shop-pagination" aria-label="Paginación">
                    <button
                      onClick={() => goToPage(safePage - 1)}
                      disabled={safePage <= 1}
                      data-testid="shop-page-prev"
                      aria-label="Página anterior"
                      className="h-10 w-10 rounded-full border border-bone-200 flex items-center justify-center text-ink-soft hover:border-sage-500 hover:text-sage-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p}
                        onClick={() => goToPage(p)}
                        data-testid={`shop-page-${p}`}
                        aria-current={p === safePage ? "page" : undefined}
                        className={`h-10 min-w-[40px] px-2 rounded-full text-sm transition-colors ${
                          p === safePage
                            ? "bg-sage-500 text-white font-medium"
                            : "border border-bone-200 text-ink-soft hover:border-sage-500 hover:text-sage-700"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => goToPage(safePage + 1)}
                      disabled={safePage >= totalPages}
                      data-testid="shop-page-next"
                      aria-label="Página siguiente"
                      className="h-10 w-10 rounded-full border border-bone-200 flex items-center justify-center text-ink-soft hover:border-sage-500 hover:text-sage-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </nav>
                )}
                <div className="mt-3 text-center text-[11px] text-ink-muted" data-testid="shop-page-info">
                  {products.length} {t("shop.title").toLowerCase()} · {safePage}/{totalPages}
                </div>
              </>
            )}
          </div>

          {/* Right categories sidebar */}
          <aside className="hidden lg:block" data-testid="shop-categories-sidebar">
            <div className="sticky top-24 border border-bone-200 rounded-md bg-white p-5 flex flex-col max-h-[calc(100vh-8rem)]">
              <div className="overline mb-4">{t("shop.categoriesTitle", "Categorías")}</div>
              <ul className="space-y-1 overflow-y-auto eco-scroll pr-1 flex-1 min-h-0">
                {chips.map((c) => {
                  const active = (c.value || "") === (cat || "");
                  return (
                    <li key={c.value || "all"}>
                      <button
                        onClick={() => setCat(c.value)}
                        data-testid={`cat-side-${c.value || "all"}`}
                        className={`w-full text-left text-sm px-3 py-2 rounded-sm transition ${
                          active ? "bg-sage-100 text-sage-700 font-medium" : "text-ink-soft hover:bg-bone-100 hover:text-sage-700"
                        }`}
                      >
                        {c.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
