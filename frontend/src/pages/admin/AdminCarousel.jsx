import React, { useEffect, useState } from "react";
import { api, resolveAsset } from "../../lib/api";
import UploadButton from "./UploadButton";
import { toast } from "sonner";
import { ArrowUp, ArrowDown, Trash2, Plus, Save, Eye, EyeOff } from "lucide-react";

// Editor del carrusel "Nuestras categorías" de la portada:
// añadir, eliminar, reordenar, activar/desactivar y cambiar imagen/título/categoría.
export default function AdminCarousel() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/admin/carousel-categories"),
      api.get("/products/categories"),
    ])
      .then(([{ data }, { data: cats }]) => {
        setItems(data.items || []);
        setCategories(cats || []);
      })
      .catch(() => toast.error("Error al cargar el carrusel"))
      .finally(() => setLoading(false));
  }, []);

  const update = (idx, patch) => {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const move = (idx, dir) => {
    setItems((arr) => {
      const next = [...arr];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return arr;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const remove = (idx) => setItems((arr) => arr.filter((_, i) => i !== idx));

  const add = () => {
    setItems((arr) => [
      ...arr,
      { id: null, order: arr.length, active: true, title: "", cat: "", img: "", description: "" },
    ]);
  };

  const save = async () => {
    const invalid = items.find((it) => !it.title.trim());
    if (invalid) { toast.error("Todas las categorías necesitan un título"); return; }
    setSaving(true);
    try {
      await api.put("/admin/carousel-categories", { items });
      const { data } = await api.get("/admin/carousel-categories");
      setItems(data.items || []);
      toast.success("Carrusel guardado");
    } catch (e) {
      toast.error("Error al guardar", { description: e?.response?.data?.detail });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-ink-soft py-10">Cargando…</div>;

  return (
    <div data-testid="admin-carousel-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="overline mb-2">Portada · Nuestras categorías</div>
          <h1 className="font-heading text-3xl font-light">Carrusel de categorías</h1>
          <p className="text-sm text-ink-soft mt-2 max-w-2xl">
            Estas tarjetas aparecen en el carrusel de la página principal. Puedes añadir, eliminar,
            reordenar, cambiar la imagen y elegir a qué categoría de la tienda enlaza cada una.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={add} className="btn-outline inline-flex items-center gap-2 !py-2.5" data-testid="carousel-add-item">
            <Plus size={14} /> Añadir
          </button>
          <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 !py-2.5" data-testid="carousel-save">
            <Save size={14} /> {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((it, idx) => (
          <div key={it.id || `new-${idx}`} className={`bg-white border rounded-md p-4 flex flex-wrap items-center gap-4 ${it.active ? "border-bone-200" : "border-bone-200 opacity-60"}`} data-testid={`carousel-item-${idx}`}>
            <div className="flex flex-col gap-1">
              <button onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1 border border-bone-200 rounded-sm text-ink-soft hover:text-sage-700 disabled:opacity-30" aria-label="Subir" data-testid={`carousel-up-${idx}`}><ArrowUp size={13} /></button>
              <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} className="p-1 border border-bone-200 rounded-sm text-ink-soft hover:text-sage-700 disabled:opacity-30" aria-label="Bajar" data-testid={`carousel-down-${idx}`}><ArrowDown size={13} /></button>
            </div>

            <div className="w-20 h-20 rounded-full overflow-hidden bg-bone-100 border border-bone-200 shrink-0 flex items-center justify-center">
              {it.img ? (
                <img src={resolveAsset(it.img)} alt={it.title} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] text-ink-muted text-center px-2">Sin imagen</span>
              )}
            </div>

            <div className="flex-1 min-w-[220px] grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-wide text-ink-muted block mb-1">Título</label>
                <input
                  className="input-eco !py-2 text-sm"
                  value={it.title}
                  onChange={(e) => update(idx, { title: e.target.value })}
                  placeholder="Ej. FRUTOS SECOS"
                  data-testid={`carousel-title-${idx}`}
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide text-ink-muted block mb-1">Enlaza a la categoría</label>
                <select
                  className="input-eco !py-2 text-sm"
                  value={it.cat}
                  onChange={(e) => update(idx, { cat: e.target.value })}
                  data-testid={`carousel-cat-${idx}`}
                >
                  <option value="">Toda la tienda</option>
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] uppercase tracking-wide text-ink-muted block mb-1">
                  Descripción <span className="normal-case tracking-normal">(vacía = automática con los productos de la categoría)</span>
                </label>
                <textarea
                  className="input-eco !py-2 text-sm w-full min-h-[48px]"
                  value={it.description || ""}
                  onChange={(e) => update(idx, { description: e.target.value })}
                  placeholder="Ej. Quinoa Real, Amaranto, Mijo, Trigo Sarraceno y muchos más."
                  data-testid={`carousel-description-${idx}`}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <UploadButton
                kind="image"
                label="Cambiar imagen"
                testid={`carousel-upload-${idx}`}
                onUploaded={(res) => update(idx, { img: res.url })}
              />
              <button
                onClick={() => update(idx, { active: !it.active })}
                className={`p-2 border rounded-sm transition-colors ${it.active ? "border-sage-400 text-sage-700" : "border-bone-200 text-ink-muted"}`}
                title={it.active ? "Visible (click para ocultar)" : "Oculto (click para mostrar)"}
                data-testid={`carousel-toggle-${idx}`}
              >
                {it.active ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button
                onClick={() => remove(idx)}
                className="p-2 border border-bone-200 rounded-sm text-red-600 hover:border-red-400 transition-colors"
                title="Eliminar"
                data-testid={`carousel-delete-${idx}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="bg-white border border-bone-200 rounded-md p-10 text-center text-ink-soft text-sm">
            No hay categorías en el carrusel. Pulsa “Añadir” para crear la primera.
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-ink-muted">
        Recuerda pulsar “Guardar cambios” para publicar. Los cambios se ven al instante en la portada.
      </div>
    </div>
  );
}
