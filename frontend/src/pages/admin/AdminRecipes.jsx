import React, { useEffect, useState } from "react";
import { Clapperboard, Plus, Trash2, ArrowUp, ArrowDown, Save, Link2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";

const emptyItem = () => ({
  id: null,
  active: true,
  video_url: "",
  title: "",
  description: "",
});

export default function AdminRecipes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/recipes/admin")
      .then(({ data }) => setItems(data.items || []))
      .catch(() => toast.error("Error al cargar los vídeos"))
      .finally(() => setLoading(false));
  }, []);

  const setField = (idx, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };

  const move = (idx, dir) => {
    setItems((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const remove = (idx) => {
    if (!window.confirm("¿Quitar este vídeo de la sección?")) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    const invalid = items.filter((it) => !(it.video_url || "").trim());
    if (invalid.length) {
      toast.error("Hay vídeos sin URL", { description: "Añade el enlace del vídeo o elimínalos antes de guardar." });
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put("/recipes/admin", { items });
      setItems(data.items || []);
      toast.success("Sección de recetas guardada", { description: `${data.items.length} vídeo(s)` });
    } catch (e) {
      toast.error("Error al guardar", { description: e?.response?.data?.detail });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="admin-recipes-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="overline">Página principal</div>
          <h1 className="font-heading text-3xl font-light">Recetas (vídeos)</h1>
          <p className="text-ink-soft text-sm mt-2 max-w-2xl">
            Vídeos verticales de la sección “Recetas con nuestros productos” de la home
            (se muestran hasta 3, en el orden de esta lista). Puedes pegar el enlace del
            vídeo desde tu nube o subir el archivo. La metadescripción se usa como texto
            visible y para el SEO del vídeo.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setItems((prev) => [...prev, emptyItem()])}
            className="btn-outline inline-flex items-center gap-2"
            data-testid="recipes-add"
          >
            <Plus size={15} /> Añadir vídeo
          </button>
          <button
            onClick={save}
            disabled={saving || loading}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
            data-testid="recipes-save"
          >
            <Save size={15} /> {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-ink-soft">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-bone-200 rounded-xl py-20 text-center text-ink-soft" data-testid="recipes-empty">
          <Clapperboard size={32} className="mx-auto mb-4 text-bone-300" />
          Aún no hay vídeos. Pulsa “Añadir vídeo” para crear el primero.
          <p className="text-xs text-ink-muted mt-2">La sección no se muestra en la home hasta que haya al menos un vídeo activo.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((it, idx) => (
            <div key={it.id || `new-${idx}`} className="bg-white border border-bone-200 rounded-xl p-5" data-testid={`recipe-item-${idx}`}>
              <div className="flex flex-col lg:flex-row gap-5">
                <div className="w-full lg:w-40 shrink-0">
                  <div className="aspect-[9/16] rounded-lg overflow-hidden bg-bone-100 border border-bone-200 flex items-center justify-center">
                    {it.video_url ? (
                      <video src={it.video_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                    ) : (
                      <Clapperboard size={26} className="text-bone-300" />
                    )}
                  </div>
                </div>
                <div className="flex-1 space-y-3 min-w-0">
                  <label className="block text-xs text-ink-soft">
                    <span className="inline-flex items-center gap-1.5"><Link2 size={12} /> URL del vídeo (tu nube o archivo subido)</span>
                    <div className="flex gap-2 mt-1">
                      <input
                        className="input-eco w-full"
                        placeholder="https://…/receta.mp4"
                        value={it.video_url}
                        onChange={(e) => setField(idx, "video_url", e.target.value)}
                        data-testid={`recipe-url-${idx}`}
                      />
                    </div>
                  </label>
                  <label className="block text-xs text-ink-soft">
                    Título
                    <input
                      className="input-eco w-full mt-1"
                      placeholder="Ej. Porridge de avena con maca"
                      value={it.title}
                      onChange={(e) => setField(idx, "title", e.target.value)}
                      data-testid={`recipe-title-${idx}`}
                    />
                  </label>
                  <label className="block text-xs text-ink-soft">
                    <span className="flex items-center justify-between">
                      Metadescripción
                      <span className={(it.description || "").length > 300 ? "text-terracotta" : "text-ink-muted"}>{(it.description || "").length}/300</span>
                    </span>
                    <textarea
                      className="input-eco w-full mt-1 min-h-[64px]"
                      placeholder="Describe la receta y los productos EcoAndes que aparecen (visible bajo el vídeo y usada para SEO)."
                      value={it.description}
                      onChange={(e) => setField(idx, "description", e.target.value)}
                      data-testid={`recipe-description-${idx}`}
                    />
                  </label>
                </div>
                <div className="flex lg:flex-col items-center gap-2 shrink-0">
                  <label className="inline-flex items-center gap-2 text-xs text-ink-soft cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={it.active !== false}
                      onChange={(e) => setField(idx, "active", e.target.checked)}
                      className="accent-sage-500 w-4 h-4"
                      data-testid={`recipe-active-${idx}`}
                    />
                    Activo
                  </label>
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Subir" className="p-1.5 rounded border border-bone-200 text-ink-soft hover:border-sage-500 disabled:opacity-40" data-testid={`recipe-up-${idx}`}><ArrowUp size={14} /></button>
                  <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} aria-label="Bajar" className="p-1.5 rounded border border-bone-200 text-ink-soft hover:border-sage-500 disabled:opacity-40" data-testid={`recipe-down-${idx}`}><ArrowDown size={14} /></button>
                  <button onClick={() => remove(idx)} aria-label="Eliminar vídeo" className="p-1.5 rounded border border-bone-200 text-ink-muted hover:text-red-500 hover:border-red-300" data-testid={`recipe-delete-${idx}`}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
          <p className="text-xs text-ink-muted">
            Consejo: para máxima velocidad usa enlaces de tu nube/CDN (también puedes subir el
            vídeo en <strong>Archivos</strong> y copiar su URL). Recuerda pulsar “Guardar cambios”.
          </p>
        </div>
      )}
    </div>
  );
}
