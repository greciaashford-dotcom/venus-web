import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { X, Save, Sparkles } from "lucide-react";
import { api } from "../../lib/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";

const LANGS = [
  ["es", "Español"],
  ["en", "English"],
  ["fr", "Français"],
  ["it", "Italiano"],
  ["pt", "Português"],
  ["zh", "中文"],
  ["ja", "日本語"],
];

const EMPTY = { meta_title: "", meta_description: "", keywords: [], geo_region: "", manual: false };

function counterClass(len, min, max) {
  if (len === 0) return "text-ink-muted";
  return len >= min && len <= max ? "text-sage-700" : "text-terracotta";
}

export default function SeoEditorModal({ product, onClose, onSaved }) {
  const [seo, setSeo] = useState(null); // { es: {...}, en: {...}, ... }
  const [dirty, setDirty] = useState({}); // lang -> true
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/products/${product.id}/seo`);
        if (!alive) return;
        const norm = {};
        LANGS.forEach(([code]) => {
          const s = data.seo?.[code] || {};
          norm[code] = {
            meta_title: s.meta_title || "",
            meta_description: s.meta_description || "",
            keywords: Array.isArray(s.keywords) ? s.keywords : [],
            geo_region: s.geo_region || "",
            manual: !!s.manual,
          };
        });
        setSeo(norm);
      } catch (err) {
        toast.error("Error al cargar el SEO", { description: err?.response?.data?.detail || err.message });
        onClose();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [product.id, onClose]);

  const setField = (lang, field, value) => {
    setSeo((prev) => ({ ...prev, [lang]: { ...prev[lang], [field]: value } }));
    setDirty((prev) => ({ ...prev, [lang]: true }));
  };

  const save = async () => {
    const langs = Object.keys(dirty);
    if (langs.length === 0) { toast.info("No hay cambios que guardar"); return; }
    setSaving(true);
    try {
      for (const lang of langs) {
        const s = seo[lang];
        await api.put(`/products/${product.id}/seo`, {
          lang,
          seo: {
            meta_title: s.meta_title,
            meta_description: s.meta_description,
            keywords: s.keywords,
            geo_region: s.geo_region,
          },
        });
      }
      toast.success("SEO guardado", { description: `${langs.length} idioma(s) actualizado(s) · protegido frente a la IA` });
      setDirty({});
      onSaved?.();
    } catch (err) {
      toast.error("Error al guardar SEO", { description: err?.response?.data?.detail || err.message });
    } finally {
      setSaving(false);
    }
  };

  const tabBtn = "rounded-full border border-bone-200 bg-white px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] data-[state=active]:border-sage-500 data-[state=active]:text-sage-700";

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-start justify-center p-2 sm:p-4 py-6 sm:py-10 overflow-y-auto" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="seo-editor-modal">
      <div className="bg-white border border-bone-200 rounded-md max-w-2xl w-full max-h-[92vh] overflow-y-auto eco-scroll">
        <div className="flex items-center justify-between p-5 border-b border-bone-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-heading text-xl font-light">Editar SEO · <span className="text-ink-soft">{product.name}</span></h2>
            <p className="text-[11px] text-ink-muted mt-0.5">Lo que edites aquí queda marcado como manual y la generación automática con IA nunca lo sobrescribirá.</p>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="text-ink-muted hover:text-ink" data-testid="seo-editor-close"><X size={20} /></button>
        </div>

        <div className="p-5">
          {loading || !seo ? (
            <div className="py-12 text-center text-ink-soft text-sm">Cargando SEO…</div>
          ) : (
            <Tabs defaultValue="es">
              <TabsList className="flex flex-wrap gap-2 bg-transparent p-0 h-auto justify-start mb-5">
                {LANGS.map(([code, label]) => (
                  <TabsTrigger key={code} value={code} className={tabBtn} data-testid={`seo-tab-${code}`}>
                    {label}{dirty[code] ? " •" : ""}
                  </TabsTrigger>
                ))}
              </TabsList>

              {LANGS.map(([code, label]) => {
                const s = seo[code] || EMPTY;
                return (
                  <TabsContent key={code} value={code} className="space-y-4">
                    {s.manual && (
                      <div className="flex items-center gap-2 text-[11px] text-sage-700 bg-sage-50 border border-sage-200 rounded-sm px-3 py-2">
                        <Sparkles size={13} /> Este idioma ya fue editado manualmente (protegido frente a la IA).
                      </div>
                    )}
                    <label className="block text-xs text-ink-soft">
                      <span className="flex items-center justify-between">
                        Meta título
                        <span className={counterClass(s.meta_title.length, 30, 65)}>{s.meta_title.length}/65</span>
                      </span>
                      <input
                        className="input-eco w-full mt-1"
                        value={s.meta_title}
                        onChange={(e) => setField(code, "meta_title", e.target.value)}
                        placeholder={`Título SEO en ${label}`}
                        data-testid={`seo-meta-title-${code}`}
                      />
                    </label>
                    <label className="block text-xs text-ink-soft">
                      <span className="flex items-center justify-between">
                        Meta descripción
                        <span className={counterClass(s.meta_description.length, 80, 170)}>{s.meta_description.length}/170</span>
                      </span>
                      <textarea
                        className="input-eco w-full mt-1 min-h-[90px]"
                        value={s.meta_description}
                        onChange={(e) => setField(code, "meta_description", e.target.value)}
                        placeholder={`Descripción SEO en ${label} (80-170 caracteres)`}
                        data-testid={`seo-meta-description-${code}`}
                      />
                    </label>
                    <label className="block text-xs text-ink-soft">
                      Keywords <span className="text-ink-muted">(separadas por comas)</span>
                      <input
                        className="input-eco w-full mt-1"
                        value={s.keywords.join(", ")}
                        onChange={(e) => setField(code, "keywords", e.target.value.split(",").map((k) => k.trim()).filter(Boolean))}
                        placeholder="maca bio, comprar maca, superalimento…"
                        data-testid={`seo-keywords-${code}`}
                      />
                    </label>
                    <label className="block text-xs text-ink-soft">
                      Región GEO <span className="text-ink-muted">(p. ej. Perú, PER/COL, ES)</span>
                      <input
                        className="input-eco w-full mt-1 max-w-[240px]"
                        value={s.geo_region}
                        onChange={(e) => setField(code, "geo_region", e.target.value)}
                        data-testid={`seo-geo-region-${code}`}
                      />
                    </label>
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-bone-200 sticky bottom-0 bg-white">
          <button onClick={onClose} className="btn-outline" data-testid="seo-editor-cancel">Cancelar</button>
          <button onClick={save} disabled={saving || loading} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60" data-testid="seo-editor-save">
            <Save size={15} /> {saving ? "Guardando…" : "Guardar SEO"}
          </button>
        </div>
      </div>
    </div>
  );
}
