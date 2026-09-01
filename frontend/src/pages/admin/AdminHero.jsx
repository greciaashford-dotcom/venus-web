import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, ImageIcon, Languages, Loader2 } from "lucide-react";
import { api, resolveAsset } from "../../lib/api";
import UploadButton from "./UploadButton";

const emptySlide = () => ({
  id: undefined,
  active: true,
  image: "",
  image_mobile: "",
  image_alt: "",
  overline: "",
  h1: "",
  subtitle: "",
  cta_label: "",
  cta_link: "/tienda",
});

export default function AdminHero() {
  const [slides, setSlides] = useState([]);
  const [b2b, setB2b] = useState({ label: "Soy profesional", link: "/profesional" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const applyData = (data) => {
    setSlides((data.slides || []).map((s) => ({ ...s })));
    if (data.b2b) setB2b({ label: data.b2b.label || "", link: data.b2b.link || "/profesional" });
  };

  // Reload helper (setState happens inside async .then, not synchronously).
  const load = () =>
    api
      .get("/admin/hero")
      .then(({ data }) => applyData(data))
      .catch(() => toast.error("No se pudo cargar la portada"));

  useEffect(() => {
    let active = true;
    api
      .get("/admin/hero")
      .then(({ data }) => {
        if (active) applyData(data);
      })
      .catch(() => {
        if (active) toast.error("No se pudo cargar la portada");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const setSlide = (i, patch) =>
    setSlides((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const move = (i, dir) => {
    setSlides((prev) => {
      const arr = [...prev];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  };

  const remove = (i) => setSlides((prev) => prev.filter((_, idx) => idx !== i));
  const add = () => setSlides((prev) => [...prev, emptySlide()]);

  const save = async () => {
    // basic validation
    for (const s of slides) {
      if (!s.image) {
        toast.error("Cada slide necesita una imagen", { description: s.h1 || s.image_alt || "" });
        return;
      }
    }
    setSaving(true);
    try {
      await api.put("/admin/hero", {
        slides: slides.map((s, idx) => ({
          id: s.id,
          order: idx,
          active: s.active !== false,
          image: s.image,
          image_mobile: s.image_mobile || "",
          image_alt: s.image_alt || "",
          overline: s.overline || "",
          h1: s.h1 || "",
          subtitle: s.subtitle || "",
          cta_label: s.cta_label || "",
          cta_link: s.cta_link || "/tienda",
        })),
        b2b: { label: b2b.label || "Soy profesional", link: b2b.link || "/profesional" },
        autotranslate: true,
      });
      toast.success("Portada guardada", {
        description: "Traduciendo a los demás idiomas en segundo plano…",
      });
      await load();
    } catch (err) {
      toast.error("Error al guardar", { description: err?.response?.data?.detail || err.message });
    } finally {
      setSaving(false);
    }
  };

  const retranslate = async () => {
    try {
      await api.post("/admin/hero/translate");
      toast.success("Re-traducción iniciada", { description: "Se actualizarán los 6 idiomas en segundo plano." });
    } catch (err) {
      toast.error("No se pudo iniciar la traducción");
    }
  };

  if (loading) {
    return <div className="text-ink-soft">Cargando portada…</div>;
  }

  return (
    <div data-testid="admin-hero-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="overline">Portada</div>
          <h1 className="font-heading text-3xl font-light">Hero / Portada</h1>
          <p className="text-ink-soft text-sm mt-2 max-w-2xl">
            Gestiona las imágenes y textos del carrusel principal. Escribe en español;
            al guardar se traducen automáticamente a los otros 6 idiomas con IA.
            Tamaño de imagen recomendado: <strong>1352 × 452 px</strong>.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={retranslate} className="btn-outline inline-flex items-center gap-2" data-testid="hero-retranslate-btn">
            <Languages size={15} /> Re-traducir
          </button>
          <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60" data-testid="hero-save-btn">
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            {saving ? "Guardando…" : "Guardar portada"}
          </button>
        </div>
      </div>

      {/* B2B button */}
      <div className="bg-white border border-bone-200 rounded-md p-5 mb-6">
        <div className="overline mb-3">Botón profesional (compartido en todos los slides)</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs text-ink-soft">Texto del botón
            <input className="input-eco mt-1" value={b2b.label} onChange={(e) => setB2b({ ...b2b, label: e.target.value })} data-testid="hero-b2b-label" /></label>
          <label className="block text-xs text-ink-soft">Enlace
            <input className="input-eco mt-1" value={b2b.link} onChange={(e) => setB2b({ ...b2b, link: e.target.value })} data-testid="hero-b2b-link" /></label>
        </div>
      </div>

      {/* Slides */}
      <div className="space-y-5">
        {slides.map((s, i) => (
          <div key={s.id || i} className={`bg-white border rounded-md p-5 ${s.active === false ? "border-bone-200 opacity-70" : "border-sage-200"}`} data-testid={`hero-slide-card-${i}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-heading text-lg">Slide {i + 1}</div>
              <div className="flex items-center gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-2 text-ink-muted hover:text-ink disabled:opacity-30" title="Subir" data-testid={`hero-up-${i}`}><ArrowUp size={16} /></button>
                <button onClick={() => move(i, 1)} disabled={i === slides.length - 1} className="p-2 text-ink-muted hover:text-ink disabled:opacity-30" title="Bajar" data-testid={`hero-down-${i}`}><ArrowDown size={16} /></button>
                <button onClick={() => setSlide(i, { active: !(s.active !== false) })} className="p-2 text-ink-muted hover:text-sage-700" title={s.active !== false ? "Desactivar" : "Activar"} data-testid={`hero-toggle-${i}`}>
                  {s.active !== false ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button onClick={() => remove(i)} className="p-2 text-ink-muted hover:text-terracotta" title="Eliminar" data-testid={`hero-remove-${i}`}><Trash2 size={16} /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
              {/* Images */}
              <div>
                <div className="text-xs text-ink-soft mb-1.5 font-medium">Imagen web (horizontal)</div>
                <div className="aspect-[1352/452] w-full bg-bone-100 border border-bone-200 rounded-sm overflow-hidden flex items-center justify-center">
                  {s.image ? (
                    <img src={resolveAsset(s.image)} alt={s.image_alt || ""} className="w-full h-full object-cover" data-testid={`hero-img-${i}`} />
                  ) : (
                    <div className="text-ink-muted flex flex-col items-center gap-1 text-xs"><ImageIcon size={22} /> Sin imagen</div>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <UploadButton kind="image" label="Subir imagen" testid={`hero-upload-${i}`} onUploaded={(r) => setSlide(i, { image: r.url })} />
                  {s.image ? (
                    <button onClick={() => setSlide(i, { image: "" })} className="text-xs text-ink-muted hover:text-terracotta">Quitar</button>
                  ) : null}
                </div>

                <div className="text-xs text-ink-soft mb-1.5 mt-4 font-medium">Imagen móvil (vertical)</div>
                <div className="aspect-[810/1012] w-[140px] bg-bone-100 border border-bone-200 rounded-sm overflow-hidden flex items-center justify-center">
                  {s.image_mobile ? (
                    <img src={resolveAsset(s.image_mobile)} alt={s.image_alt || ""} className="w-full h-full object-cover" data-testid={`hero-img-mobile-${i}`} />
                  ) : (
                    <div className="text-ink-muted flex flex-col items-center gap-1 text-xs px-2 text-center"><ImageIcon size={20} /> Sin imagen móvil</div>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <UploadButton kind="image" label="Subir móvil" testid={`hero-upload-mobile-${i}`} onUploaded={(r) => setSlide(i, { image_mobile: r.url })} />
                  {s.image_mobile ? (
                    <button onClick={() => setSlide(i, { image_mobile: "" })} className="text-xs text-ink-muted hover:text-terracotta" data-testid={`hero-remove-mobile-${i}`}>Quitar</button>
                  ) : null}
                </div>
                <p className="text-[10.5px] text-ink-muted mt-1.5 leading-snug">Se muestra en dispositivos verticales (móvil/tablet en vertical). Si falta, se usa la imagen web.</p>

                <label className="block text-xs text-ink-soft mt-2">Texto alternativo (alt)
                  <input className="input-eco mt-1" value={s.image_alt || ""} onChange={(e) => setSlide(i, { image_alt: e.target.value })} data-testid={`hero-alt-${i}`} /></label>
              </div>

              {/* Texts (Spanish base) */}
              <div className="space-y-3">
                <label className="block text-xs text-ink-soft">Sobretítulo (overline)
                  <input className="input-eco mt-1" value={s.overline || ""} onChange={(e) => setSlide(i, { overline: e.target.value })} data-testid={`hero-overline-${i}`} placeholder="Cacao Nibs · Variedad Criollo" /></label>
                <label className="block text-xs text-ink-soft">Título (H1)
                  <textarea className="input-eco mt-1" rows={2} value={s.h1 || ""} onChange={(e) => setSlide(i, { h1: e.target.value })} data-testid={`hero-h1-${i}`} placeholder="Nibs de Cacao Bio para tu Energía y Vitalidad" /></label>
                <label className="block text-xs text-ink-soft">Descripción
                  <textarea className="input-eco mt-1" rows={3} value={s.subtitle || ""} onChange={(e) => setSlide(i, { subtitle: e.target.value })} data-testid={`hero-subtitle-${i}`} /></label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block text-xs text-ink-soft">Texto del botón (CTA)
                    <input className="input-eco mt-1" value={s.cta_label || ""} onChange={(e) => setSlide(i, { cta_label: e.target.value })} data-testid={`hero-cta-label-${i}`} placeholder="Descubrir cacao" /></label>
                  <label className="block text-xs text-ink-soft">Enlace del botón
                    <input className="input-eco mt-1" value={s.cta_link || ""} onChange={(e) => setSlide(i, { cta_link: e.target.value })} data-testid={`hero-cta-link-${i}`} placeholder="/tienda?q=cacao" /></label>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={add} className="mt-6 inline-flex items-center gap-2 text-sm text-sage-700 hover:text-sage-800" data-testid="hero-add-slide">
        <Plus size={16} /> Añadir slide
      </button>

      <div className="mt-8 flex justify-end">
        <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60" data-testid="hero-save-btn-bottom">
          {saving ? <Loader2 size={15} className="animate-spin" /> : null}
          {saving ? "Guardando…" : "Guardar portada"}
        </button>
      </div>
    </div>
  );
}
