import React, { useState } from "react";
import { toast } from "sonner";
import { X, Plus, Trash2, FileText } from "lucide-react";
import { api, resolveAsset } from "../../lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import UploadButton from "./UploadButton";

const BLOCK_KEYS = ["ingredients", "origin", "benefits", "usage", "storage", "certifications"];
const BLOCK_LABELS = {
  ingredients: "Ingredientes", origin: "Origen", benefits: "Beneficios",
  usage: "Modo de empleo", storage: "Almacenamiento", certifications: "Certificaciones",
};
const slug = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export default function ProductEditorModal({ product, onClose, onSaved }) {
  const [p, setP] = useState(() => ({
    ...product,
    gallery: product.gallery || [],
    variations: (product.variations || []).map((v) => ({ ...v })),
    badges: product.badges || [],
    description_blocks: { ...(product.description_blocks || {}) },
    nutrition: (product.nutrition || []).map((n) => ({ ...n })),
    tech_sheet: product.tech_sheet || { url: "", filename: "" },
  }));
  const [saving, setSaving] = useState(false);

  const set = (patch) => setP((prev) => ({ ...prev, ...patch }));
  const setBlock = (k, v) => setP((prev) => ({ ...prev, description_blocks: { ...prev.description_blocks, [k]: v } }));
  const setVar = (i, patch) => setP((prev) => {
    const variations = [...prev.variations];
    variations[i] = { ...variations[i], ...patch };
    return { ...prev, variations };
  });

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: p.name,
        category: p.category,
        highlights: p.highlights || "",
        price_retail: Number(p.price_retail) || 0,
        price_professional: Number(p.price_professional) || 0,
        stock: Number(p.stock) || 0,
        image_url: p.image_url || "",
        gallery: p.gallery,
        description: p.description || "",
        description_blocks: {
          ingredients: p.description_blocks.ingredients || "",
          origin: p.description_blocks.origin || "",
          benefits: p.description_blocks.benefits || "",
          usage: p.description_blocks.usage || "",
          storage: p.description_blocks.storage || "",
          certifications: p.description_blocks.certifications || "",
        },
        nutrition: p.nutrition
          .filter((n) => n.label && n.value)
          .map((n) => ({ key: n.key || slug(n.label), label: n.label, value: n.value })),
        tech_sheet: p.tech_sheet,
        variations: p.variations.map((v) => ({
          sku: (v.sku || "").trim(), name: v.name,
          price_retail: Number(v.price_retail) || 0,
          price_professional: Number(v.price_professional) || 0,
          stock: Number(v.stock) || 0,
          image_url: v.image_url || "",
          active: v.active !== false,
        })),
        featured: !!p.featured,
        best_seller: !!p.best_seller,
        recommended: !!p.recommended,
        active: p.active !== false,
      };
      await api.patch(`/products/${p.id}`, payload);
      toast.success("Producto actualizado");
      onSaved();
    } catch (err) {
      toast.error("Error al guardar", { description: err?.response?.data?.detail || err.message });
    } finally {
      setSaving(false);
    }
  };

  const tabBtn = "rounded-full border border-bone-200 bg-white px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] data-[state=active]:border-sage-500 data-[state=active]:text-sage-700";

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-start justify-center p-2 sm:p-4 py-6 sm:py-10 overflow-y-auto" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="edit-product-modal">
      <div className="bg-white border border-bone-200 rounded-md max-w-3xl w-full max-h-[92vh] overflow-y-auto eco-scroll">
        <div className="flex items-center justify-between p-5 border-b border-bone-200 sticky top-0 bg-white z-10">
          <h2 className="font-heading text-xl font-light">Editar producto · <span className="text-ink-soft">{p.name}</span></h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-ink-muted hover:text-ink"><X size={20} /></button>
        </div>

        <div className="p-5">
          <Tabs defaultValue="general">
            <TabsList className="flex flex-wrap gap-2 bg-transparent p-0 h-auto justify-start mb-5">
              <TabsTrigger value="general" className={tabBtn} data-testid="editor-tab-general">General</TabsTrigger>
              <TabsTrigger value="media" className={tabBtn} data-testid="editor-tab-media">Imágenes</TabsTrigger>
              <TabsTrigger value="variations" className={tabBtn} data-testid="editor-tab-variations">Formatos</TabsTrigger>
              <TabsTrigger value="description" className={tabBtn} data-testid="editor-tab-description">Descripción</TabsTrigger>
              <TabsTrigger value="nutrition" className={tabBtn} data-testid="editor-tab-nutrition">Nutrición</TabsTrigger>
              <TabsTrigger value="techsheet" className={tabBtn} data-testid="editor-tab-techsheet">Ficha técnica</TabsTrigger>
            </TabsList>

            {/* General */}
            <TabsContent value="general" className="space-y-3">
              <label className="block text-xs text-ink-soft">Nombre
                <input className="input-eco mt-1" value={p.name || ""} onChange={(e) => set({ name: e.target.value })} data-testid="editor-name" /></label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block text-xs text-ink-soft">Categoría
                  <input className="input-eco mt-1" value={p.category || ""} onChange={(e) => set({ category: e.target.value })} /></label>
                <label className="block text-xs text-ink-soft">Stock (general)
                  <input type="number" className="input-eco mt-1" value={p.stock ?? 0} onChange={(e) => set({ stock: e.target.value })} data-testid="editor-stock" /></label>
                <label className="block text-xs text-ink-soft">Precio cliente final (PVP) €
                  <input type="number" step="0.01" className="input-eco mt-1" value={p.price_retail ?? 0} onChange={(e) => set({ price_retail: e.target.value })} data-testid="editor-price-retail" /></label>
                <label className="block text-xs text-ink-soft">Precio profesional (B2B) €
                  <input type="number" step="0.01" className="input-eco mt-1" value={p.price_professional ?? 0} onChange={(e) => set({ price_professional: e.target.value })} data-testid="editor-price-pro" /></label>
              </div>
              <label className="block text-xs text-ink-soft">Subtítulo / características destacadas
                <textarea className="input-eco mt-1" rows={2} value={p.highlights || ""} onChange={(e) => set({ highlights: e.target.value })} /></label>
              <div className="flex flex-wrap gap-5 pt-1">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!p.best_seller} onChange={(e) => set({ best_seller: e.target.checked })} data-testid="editor-bestseller" /> Más vendido</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!p.featured} onChange={(e) => set({ featured: e.target.checked })} /> Destacado</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!p.recommended} onChange={(e) => set({ recommended: e.target.checked })} data-testid="editor-recommended" /> Recomendado por EcoAndes</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={p.active !== false} onChange={(e) => set({ active: e.target.checked })} /> Activo</label>
              </div>
            </TabsContent>

            {/* Media */}
            <TabsContent value="media" className="space-y-4">
              <div>
                <div className="overline mb-2">Imagen principal</div>
                <div className="flex items-center gap-3">
                  <div className="h-20 w-20 border border-bone-200 rounded-sm bg-bone-100 flex items-center justify-center overflow-hidden">
                    {p.image_url ? <img src={resolveAsset(p.image_url)} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[10px] text-ink-muted">Sin imagen</span>}
                  </div>
                  <UploadButton kind="image" label="Subir imagen principal" testid="upload-main-image" onUploaded={(r) => set({ image_url: r.url })} />
                </div>
              </div>
              <div>
                <div className="overline mb-2">Galería</div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(p.gallery || []).map((g, i) => (
                    <div key={i} className="relative h-16 w-16 border border-bone-200 rounded-sm overflow-hidden bg-bone-100">
                      <img src={resolveAsset(g)} alt="" className="h-full w-full object-contain" />
                      <button type="button" onClick={() => set({ gallery: p.gallery.filter((_, idx) => idx !== i) })} className="absolute top-0 right-0 bg-ink/70 text-white p-0.5"><X size={12} /></button>
                    </div>
                  ))}
                </div>
                <UploadButton kind="image" label="Añadir a galería" testid="upload-gallery" onUploaded={(r) => set({ gallery: [...(p.gallery || []), r.url] })} />
              </div>
            </TabsContent>

            {/* Variations */}
            <TabsContent value="variations" className="space-y-3">
              <p className="text-xs text-ink-soft">SKU, imagen, precios y stock por formato/peso. Cada formato tiene su propio SKU (según el Excel). Puedes activar/desactivar o eliminar cada formato.</p>
              {p.variations.length === 0 && <p className="text-sm text-ink-muted">Este producto no tiene formatos (producto simple).</p>}
              {p.variations.map((v, i) => (
                <div key={i} className={`border rounded-sm p-3 ${v.active === false ? "border-bone-200 bg-bone-50 opacity-70" : "border-bone-200"}`} data-testid={`editor-variation-${i}`}>
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 border border-bone-200 rounded-sm bg-bone-100 flex items-center justify-center overflow-hidden shrink-0">
                      {v.image_url ? <img src={resolveAsset(v.image_url)} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[9px] text-ink-muted text-center px-1">{v.name}</span>}
                    </div>
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <input className="input-eco !py-2 text-sm font-mono uppercase" placeholder="SKU" value={v.sku || ""} onChange={(e) => setVar(i, { sku: e.target.value.toUpperCase() })} data-testid={`variation-sku-${i}`} />
                      <input className="input-eco !py-2 text-sm" placeholder="Formato" value={v.name || ""} onChange={(e) => setVar(i, { name: e.target.value })} />
                      <input type="number" step="0.01" className="input-eco !py-2 text-sm" placeholder="PVP" value={v.price_retail ?? 0} onChange={(e) => setVar(i, { price_retail: e.target.value })} />
                      <input type="number" step="0.01" className="input-eco !py-2 text-sm" placeholder="B2B" value={v.price_professional ?? 0} onChange={(e) => setVar(i, { price_professional: e.target.value })} />
                      <input type="number" className="input-eco !py-2 text-sm" placeholder="Stock" value={v.stock ?? 0} onChange={(e) => setVar(i, { stock: e.target.value })} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 flex-wrap">
                    <UploadButton kind="image" label="Imagen del formato" testid={`upload-variation-${i}`} onUploaded={(r) => setVar(i, { image_url: r.url })} />
                    <div className="flex items-center gap-4">
                      <label className="inline-flex items-center gap-2 text-xs text-ink cursor-pointer">
                        <input type="checkbox" checked={v.active !== false} onChange={(e) => setVar(i, { active: e.target.checked })} className="accent-sage-600" data-testid={`variation-active-${i}`} />
                        Activo
                      </label>
                      <button type="button" onClick={() => { if (window.confirm(`¿Eliminar el formato "${v.name || v.sku}"?`)) set({ variations: p.variations.filter((_, idx) => idx !== i) }); }} className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-terracotta" data-testid={`delete-variation-${i}`}>
                        <Trash2 size={14} /> Eliminar formato
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => set({ variations: [...p.variations, { sku: "", name: "", price_retail: 0, price_professional: 0, stock: 0, image_url: "", active: true }] })} className="inline-flex items-center gap-1 text-xs text-sage-700 mt-1" data-testid="editor-add-variation"><Plus size={14} /> Añadir formato</button>
            </TabsContent>

            {/* Description blocks */}
            <TabsContent value="description" className="space-y-3">
              {BLOCK_KEYS.map((k) => (
                <label key={k} className="block text-xs text-ink-soft">{BLOCK_LABELS[k]}
                  <textarea className="input-eco mt-1" rows={2} value={p.description_blocks[k] || ""} onChange={(e) => setBlock(k, e.target.value)} data-testid={`editor-block-${k}`} /></label>
              ))}
            </TabsContent>

            {/* Nutrition */}
            <TabsContent value="nutrition" className="space-y-2">
              <p className="text-xs text-ink-soft">Valores por 100 g. Añade las filas necesarias.</p>
              {p.nutrition.map((n, i) => (
                <div key={i} className="flex gap-2" data-testid={`editor-nutrition-row-${i}`}>
                  <input className="input-eco !py-2 text-sm flex-1" placeholder="Nutriente (ej. Energía)" value={n.label || ""} onChange={(e) => { const nu = [...p.nutrition]; nu[i] = { ...nu[i], label: e.target.value }; set({ nutrition: nu }); }} />
                  <input className="input-eco !py-2 text-sm flex-1" placeholder="Valor (ej. 389 kcal)" value={n.value || ""} onChange={(e) => { const nu = [...p.nutrition]; nu[i] = { ...nu[i], value: e.target.value }; set({ nutrition: nu }); }} />
                  <button type="button" onClick={() => set({ nutrition: p.nutrition.filter((_, idx) => idx !== i) })} className="text-ink-muted hover:text-terracotta px-2"><Trash2 size={15} /></button>
                </div>
              ))}
              <button type="button" onClick={() => set({ nutrition: [...p.nutrition, { key: "", label: "", value: "" }] })} className="inline-flex items-center gap-1 text-xs text-sage-700 mt-1" data-testid="editor-add-nutrition"><Plus size={14} /> Añadir fila</button>
            </TabsContent>

            {/* Tech sheet */}
            <TabsContent value="techsheet" className="space-y-3">
              <div className="overline mb-1">Ficha técnica (PDF)</div>
              {p.tech_sheet?.url ? (
                <div className="flex items-center gap-3 text-sm">
                  <FileText size={18} className="text-sage-600" />
                  <a href={resolveAsset(p.tech_sheet.url)} target="_blank" rel="noopener noreferrer" className="text-sage-700 underline">{p.tech_sheet.filename || "Ver PDF"}</a>
                  <button type="button" onClick={() => set({ tech_sheet: { url: "", filename: "" } })} className="text-ink-muted hover:text-terracotta"><Trash2 size={15} /></button>
                </div>
              ) : <p className="text-sm text-ink-muted">No hay ficha técnica.</p>}
              <UploadButton kind="pdf" label="Subir ficha técnica (PDF)" testid="upload-tech-sheet" onUploaded={(r) => set({ tech_sheet: { url: r.url, filename: r.filename } })} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex gap-3 justify-end p-5 border-t border-bone-200 sticky bottom-0 bg-white">
          <button type="button" onClick={onClose} className="btn-outline">Cancelar</button>
          <button type="button" onClick={save} disabled={saving} className="btn-primary disabled:opacity-60" data-testid="save-product-btn">{saving ? "Guardando..." : "Guardar"}</button>
        </div>
      </div>
    </div>
  );
}
