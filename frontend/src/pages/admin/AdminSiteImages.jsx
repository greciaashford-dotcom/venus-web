import React, { useEffect, useState } from "react";
import { ImageIcon, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api, resolveAsset } from "../../lib/api";
import UploadButton from "./UploadButton";

/**
 * Gestión de las imágenes globales del sitio (fuera de productos):
 * Colección Principal, Canal Profesional (web/móvil) y Filosofía EcoAndes.
 * Cada una acepta subir archivo o pegar enlace de la nube/CDN.
 */
export default function AdminSiteImages() {
  const [data, setData] = useState(null); // {images, defaults, spots}
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/site-images/admin");
      setData(data);
    } catch (e) {
      toast.error("Error al cargar", { description: e?.response?.data?.detail });
    }
  };

  useEffect(() => { load(); }, []);

  const setImg = (key, url) => setData((prev) => ({ ...prev, images: { ...prev.images, [key]: url } }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/site-images/admin", { images: data.images });
      toast.success("Imágenes del sitio guardadas", { description: "Los cambios ya están visibles en la web" });
    } catch (e) {
      toast.error("Error al guardar", { description: e?.response?.data?.detail });
    } finally {
      setSaving(false);
    }
  };

  if (!data) return <div className="py-20 text-center text-ink-soft">Cargando…</div>;

  return (
    <div data-testid="admin-site-images-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="overline">Apariencia</div>
          <h1 className="font-heading text-3xl font-light">Imágenes del sitio</h1>
          <p className="text-ink-soft text-sm mt-2 max-w-2xl">
            Cambia las imágenes fijas de la web (Colección Principal, Canal Profesional y
            Filosofía EcoAndes) subiendo un archivo o pegando el enlace de tu nube/CDN.
          </p>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60" data-testid="site-images-save">
          <Save size={15} /> {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {data.spots.map((spot) => {
          const url = data.images[spot.key] || "";
          const isDefault = url === data.defaults[spot.key];
          return (
            <div key={spot.key} className="bg-white border border-bone-200 rounded-xl p-5" data-testid={`site-image-${spot.key}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="font-heading text-lg text-ink">{spot.label}</div>
                  <div className="text-[11px] text-ink-muted mt-0.5">{spot.where}</div>
                </div>
                {!isDefault && (
                  <button
                    onClick={() => setImg(spot.key, data.defaults[spot.key])}
                    className="text-[11px] text-ink-muted hover:text-terracotta inline-flex items-center gap-1 shrink-0"
                    title="Volver a la imagen original"
                    data-testid={`site-image-reset-${spot.key}`}
                  >
                    <RotateCcw size={11} /> Restaurar
                  </button>
                )}
              </div>
              <div className="aspect-[16/9] rounded-lg overflow-hidden bg-bone-100 border border-bone-200 flex items-center justify-center mb-3">
                {url ? (
                  <img src={resolveAsset(url)} alt={spot.label} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <ImageIcon size={26} className="text-bone-300" />
                )}
              </div>
              <div className="space-y-2">
                <UploadButton kind="image" label="Subir imagen" testid={`site-image-upload-${spot.key}`} onUploaded={(r) => setImg(spot.key, r.url)} />
                <input
                  className="input-eco w-full"
                  placeholder="…o pega la URL de la imagen"
                  value={url}
                  onChange={(e) => setImg(spot.key, e.target.value)}
                  data-testid={`site-image-url-${spot.key}`}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-ink-muted mt-5">Recuerda pulsar “Guardar cambios” para aplicar en la web.</p>
    </div>
  );
}
