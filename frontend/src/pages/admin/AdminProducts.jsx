import React, { useEffect, useState, useCallback } from "react";
import { api, formatEUR, resolveAsset } from "../../lib/api";
import { toast } from "sonner";
import { Save, Pencil, Search, Star, Trash2, Globe2 } from "lucide-react";
import ProductEditorModal from "./ProductEditorModal";
import SeoEditorModal from "./SeoEditorModal";

// WooCommerce-style SEO score: green (alta) / orange (media) / red (baja).
function seoScore(p) {
  const seo = p.seo || {};
  const checks = [];
  let score = 0;
  const t = (seo.meta_title || "").length;
  if (t >= 30 && t <= 65) { score += 30; checks.push("Meta título óptimo"); }
  else if (t > 0) { score += 15; checks.push("Meta título mejorable (30-65 caracteres)"); }
  else checks.push("Falta meta título");
  const d = (seo.meta_description || "").length;
  if (d >= 80 && d <= 170) { score += 30; checks.push("Meta descripción óptima"); }
  else if (d > 0) { score += 15; checks.push("Meta descripción mejorable (80-170 caracteres)"); }
  else checks.push("Falta meta descripción");
  const k = (seo.keywords || []).length;
  if (k >= 3) { score += 20; checks.push(`${k} keywords`); }
  else if (k > 0) { score += 10; checks.push("Pocas keywords (mínimo 3)"); }
  else checks.push("Faltan keywords");
  if (p.description || p.short_description) { score += 10; checks.push("Descripción presente"); }
  else checks.push("Falta descripción");
  if (p.image_url) { score += 10; checks.push("Imagen principal presente"); }
  else checks.push("Falta imagen principal");
  return { score, checks };
}

function SeoDot({ product }) {
  const { score, checks } = seoScore(product);
  const level = score >= 75 ? "alta" : score >= 45 ? "media" : "baja";
  const color = level === "alta" ? "bg-green-500" : level === "media" ? "bg-orange-400" : "bg-red-500";
  const label = level === "alta" ? "Alta" : level === "media" ? "Media" : "Baja";
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`SEO ${label} (${score}/100)\n· ${checks.join("\n· ")}`}
      data-testid={`seo-score-${product.sku}`}
      data-seo-level={level}
    >
      <span className={`w-3 h-3 rounded-full ${color} ring-2 ring-offset-1 ring-transparent`} />
      <span className="text-[11px] text-ink-soft">{score}</span>
    </span>
  );
}

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | bestseller | lowstock
  const [editing, setEditing] = useState(null);
  const [seoEditing, setSeoEditing] = useState(null);
  const [applyingLegacy, setApplyingLegacy] = useState(false);
  const [stockEdits, setStockEdits] = useState({}); // id -> value
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 300, lang: "es" };
      if (search) params.search = search;
      if (filter === "bestseller") params.best_seller = true;
      const { data } = await api.get("/products", { params });
      let list = data;
      if (filter === "lowstock") list = data.filter((p) => (p.stock ?? 0) <= 5);
      setProducts(list);
      setStockEdits({});
    } finally {
      setLoading(false);
    }
  }, [search, filter]);

  useEffect(() => { load(); }, [load]);

  const saveStock = async (p) => {
    const val = stockEdits[p.id];
    if (val === undefined) return;
    try {
      await api.patch(`/products/${p.id}/stock`, { stock: Number(val) });
      toast.success("Stock actualizado", { description: p.name });
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, stock: Number(val) } : x)));
      setStockEdits((prev) => { const n = { ...prev }; delete n[p.id]; return n; });
    } catch (err) {
      toast.error("Error", { description: err?.response?.data?.detail });
    }
  };

  const removeProduct = async (p) => {
    if (!window.confirm(`¿Eliminar el producto "${p.name}"? Dejará de mostrarse en la tienda.`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
      toast.success("Producto eliminado", { description: p.name });
    } catch (err) {
      toast.error("Error al eliminar", { description: err?.response?.data?.detail });
    }
  };

  const applyLegacyNames = async () => {
    if (!window.confirm(
      "¿Aplicar los nombres SEO de la web antigua?\n\n" +
      "· El nombre visible y la URL de 162 productos pasarán al nombre legacy exacto.\n" +
      "· Las URLs actuales seguirán funcionando (redirigen a la nueva).\n" +
      "· La operación es idempotente: los ya aplicados se saltan."
    )) return;
    setApplyingLegacy(true);
    try {
      const { data } = await api.post("/products/legacy-names/apply");
      toast.success("Nombres legacy aplicados", {
        description: `${data.applied} renombrados · ${data.skipped_already_applied} ya aplicados · ${(data.not_found || []).length} no encontrados`,
      });
      load();
    } catch (err) {
      toast.error("Error al aplicar nombres legacy", { description: err?.response?.data?.detail || err.message });
    } finally {
      setApplyingLegacy(false);
    }
  };

  return (
    <div data-testid="admin-products-page">
      <div className="overline mb-2">Catálogo</div>
      <h1 className="font-heading text-3xl font-light mb-1">Gestión de productos</h1>
      <p className="text-sm text-ink-soft mb-6">{products.length} productos · edita stock, precios, imágenes por formato, ficha técnica, nutrición y descripciones.</p>

      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input className="input-eco !pl-10 w-72" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="Buscar por nombre o SKU" data-testid="products-search" />
        </div>
        <button onClick={load} className="btn-outline">Buscar</button>
        <button
          onClick={applyLegacyNames}
          disabled={applyingLegacy}
          className="btn-outline inline-flex items-center gap-2 disabled:opacity-60"
          title="Renombra los productos al nombre exacto de la web antigua (mapeo SEO aprobado) manteniendo redirecciones desde las URLs actuales"
          data-testid="apply-legacy-names-btn"
        >
          <Globe2 size={14} /> {applyingLegacy ? "Aplicando…" : "Aplicar nombres legacy"}
        </button>
        <div className="flex gap-2 ml-auto">
          {[["all", "Todos"], ["bestseller", "Más vendidos"], ["lowstock", "Stock bajo"]].map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} className={`text-xs uppercase tracking-[0.14em] px-3 py-2 rounded-sm border transition-colors ${filter === k ? "border-sage-500 text-sage-700 bg-sage-50" : "border-bone-200 text-ink-soft bg-white"}`} data-testid={`filter-${k}`}>{label}</button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-bone-200 rounded-md overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-xs uppercase tracking-[0.14em] text-ink-soft text-left border-b border-bone-200">
              <th className="p-3 pl-4">Producto</th>
              <th className="p-3">SKUs (por formato)</th>
              <th className="p-3">Categoría</th>
              <th className="p-3">SEO</th>
              <th className="p-3">PVP</th>
              <th className="p-3">B2B</th>
              <th className="p-3 w-44">Stock</th>
              <th className="p-3">Top</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="p-8 text-center text-ink-soft">Cargando…</td></tr>
            ) : products.map((p) => (
              <tr key={p.id} className="border-b border-bone-100 hover:bg-bone-50" data-testid={`product-row-${p.sku}`}>
                <td className="p-3 pl-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-sm border border-bone-200 bg-bone-100 overflow-hidden shrink-0 flex items-center justify-center">
                      {p.image_url && <img src={resolveAsset(p.image_url)} alt="" className="max-h-full max-w-full object-contain" />}
                    </div>
                    <span className="font-medium text-ink line-clamp-1 max-w-[220px]">{p.name}</span>
                  </div>
                </td>
                <td className="p-3 font-mono text-xs">
                  {(p.variations && p.variations.length > 0)
                    ? <div className="flex flex-wrap gap-1 max-w-[220px]">{p.variations.map((v) => (
                        <span key={v.sku} className={`px-1.5 py-0.5 rounded-sm border text-[10px] ${v.active === false ? "border-bone-200 text-ink-muted line-through" : "border-sage-200 text-sage-700 bg-sage-50"}`}>{v.sku}</span>
                      ))}</div>
                    : <span>{p.sku || "—"}</span>}
                </td>
                <td className="p-3 text-ink-soft text-xs">{p.category}</td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <SeoDot product={p} />
                    <button
                      onClick={() => setSeoEditing({ ...p })}
                      className="text-ink-muted hover:text-sage-700"
                      title="Editar SEO (7 idiomas)"
                      aria-label={`Editar SEO de ${p.name}`}
                      data-testid={`edit-seo-${p.sku}`}
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                </td>
                <td className="p-3">{formatEUR(p.price_retail)}</td>
                <td className="p-3">{formatEUR(p.price_professional)}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      className={`w-20 border rounded-sm px-2 py-1.5 text-sm bg-white ${(p.stock ?? 0) <= 5 ? "border-terracotta/60" : "border-bone-200"}`}
                      value={stockEdits[p.id] ?? p.stock ?? 0}
                      onChange={(e) => setStockEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      data-testid={`stock-input-${p.sku}`}
                    />
                    {stockEdits[p.id] !== undefined && (
                      <button onClick={() => saveStock(p)} className="text-white bg-sage-500 hover:bg-sage-600 rounded-sm p-1.5" aria-label="Guardar stock" data-testid={`save-stock-${p.sku}`}>
                        <Save size={14} />
                      </button>
                    )}
                  </div>
                </td>
                <td className="p-3">{p.best_seller ? <Star size={15} className="text-terracotta" fill="currentColor" /> : "—"}</td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEditing({ ...p })} className="inline-flex items-center gap-1.5 text-sage-700 text-xs uppercase tracking-[0.14em] hover:text-sage-800" data-testid={`edit-product-${p.sku}`}>
                      <Pencil size={13} /> Editar
                    </button>
                    <button onClick={() => removeProduct(p)} className="inline-flex items-center gap-1.5 text-ink-muted text-xs uppercase tracking-[0.14em] hover:text-terracotta" data-testid={`delete-product-${p.sku}`}>
                      <Trash2 size={13} /> Borrar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductEditorModal product={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
      {seoEditing && (
        <SeoEditorModal product={seoEditing} onClose={() => setSeoEditing(null)} onSaved={() => load()} />
      )}
    </div>
  );
}
