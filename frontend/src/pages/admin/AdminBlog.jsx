import React, { useEffect, useState } from "react";
import { Newspaper, Plus, Pencil, Trash2, X, Save, ArrowUp, ArrowDown, Eye, EyeOff, Link2 } from "lucide-react";
import { toast } from "sonner";
import { api, resolveAsset } from "../../lib/api";
import UploadButton from "./UploadButton";

const emptyPost = () => ({
  id: null,
  title: "",
  slug: "",
  excerpt: "",
  cover: "",
  category: "",
  read_time: "5 min",
  date: new Date().toISOString().slice(0, 10),
  author: "Equipo Ecoandes",
  related_query: "",
  body: [{ h: "", p: "" }],
  sources: [],
  seo: { meta_title: "", meta_description: "", keywords: [] },
  published: true,
});

function counterClass(len, min, max) {
  if (len === 0) return "text-ink-muted";
  return len >= min && len <= max ? "text-sage-700" : "text-terracotta";
}

export default function AdminBlog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // post en edición (o nuevo)
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/blog/admin/list");
      setPosts(data || []);
    } catch (e) {
      toast.error("Error al cargar el blog", { description: e?.response?.data?.detail });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (p) => {
    if (!window.confirm(`¿Eliminar definitivamente el artículo "${p.title}"?`)) return;
    try {
      await api.delete(`/blog/admin/${p.id}`);
      setPosts((prev) => prev.filter((x) => x.id !== p.id));
      toast.success("Artículo eliminado");
    } catch (e) {
      toast.error("No se pudo eliminar", { description: e?.response?.data?.detail });
    }
  };

  const save = async () => {
    if (!editing.title.trim()) { toast.error("El título es obligatorio"); return; }
    setSaving(true);
    try {
      const payload = { ...editing };
      if (editing.id) {
        await api.put(`/blog/admin/${editing.id}`, payload);
      } else {
        await api.post("/blog/admin", payload);
      }
      toast.success("Artículo guardado", { description: editing.title });
      setEditing(null);
      load();
    } catch (e) {
      toast.error("Error al guardar", { description: e?.response?.data?.detail });
    } finally {
      setSaving(false);
    }
  };

  const setF = (field, value) => setEditing((prev) => ({ ...prev, [field]: value }));
  const setSeoF = (field, value) => setEditing((prev) => ({ ...prev, seo: { ...prev.seo, [field]: value } }));
  const setSection = (i, field, value) =>
    setEditing((prev) => ({ ...prev, body: prev.body.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)) }));
  const moveSection = (i, dir) =>
    setEditing((prev) => {
      const b = [...prev.body];
      const j = i + dir;
      if (j < 0 || j >= b.length) return prev;
      [b[i], b[j]] = [b[j], b[i]];
      return { ...prev, body: b };
    });
  const setSource = (i, field, value) =>
    setEditing((prev) => ({ ...prev, sources: prev.sources.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)) }));

  return (
    <div data-testid="admin-blog-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="overline">Contenidos</div>
          <h1 className="font-heading text-3xl font-light">Blog</h1>
          <p className="text-ink-soft text-sm mt-2 max-w-2xl">
            Gestiona los artículos del blog: contenido, portada, fuentes y SEO. Los artículos
            despublicados dejan de mostrarse en la web sin borrarse.
          </p>
        </div>
        <button onClick={() => setEditing(emptyPost())} className="btn-primary inline-flex items-center gap-2" data-testid="blog-new-post">
          <Plus size={15} /> Nuevo artículo
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-ink-soft">Cargando…</div>
      ) : (
        <div className="bg-white border border-bone-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-muted border-b border-bone-200">
                <th className="px-5 py-3 font-medium">Artículo</th>
                <th className="px-5 py-3 font-medium">Categoría</th>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">SEO</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => {
                const seoOk = (p.seo?.meta_title || "").length > 0 && (p.seo?.meta_description || "").length > 0;
                return (
                  <tr key={p.id} className="border-b border-bone-100 hover:bg-bone-50/60" data-testid={`blog-row-${p.slug}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-9 rounded overflow-hidden bg-bone-100 shrink-0">
                          {p.cover && <img src={resolveAsset(p.cover)} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-ink font-medium truncate max-w-[300px]">{p.title}</div>
                          <div className="text-[11px] text-ink-muted truncate">/blog/{p.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-soft text-xs uppercase tracking-wide">{p.category}</td>
                    <td className="px-5 py-3 text-ink-soft whitespace-nowrap">{p.date}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${seoOk ? "bg-sage-500" : "bg-amber-400"}`} title={seoOk ? "SEO manual completo" : "SEO automático (título/extracto)"} />
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border ${p.published ? "bg-sage-50 text-sage-700 border-sage-200" : "bg-bone-100 text-ink-muted border-bone-200"}`}>
                        {p.published ? <Eye size={11} /> : <EyeOff size={11} />} {p.published ? "Publicado" : "Borrador"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setEditing({ ...emptyPost(), ...p, seo: { ...emptyPost().seo, ...(p.seo || {}) } })} aria-label={`Editar ${p.title}`} className="text-ink-muted hover:text-sage-700 p-1.5" data-testid={`blog-edit-${p.slug}`}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => remove(p)} aria-label={`Eliminar ${p.title}`} className="text-ink-muted hover:text-red-500 p-1.5" data-testid={`blog-delete-${p.slug}`}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {posts.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-14 text-center text-ink-soft"><Newspaper size={26} className="mx-auto mb-3 text-bone-300" />No hay artículos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-ink/40 flex items-start justify-center p-2 sm:p-4 py-6 overflow-y-auto" onMouseDown={(e) => { if (e.target === e.currentTarget) setEditing(null); }} data-testid="blog-editor-modal">
          <div className="bg-white border border-bone-200 rounded-md max-w-3xl w-full max-h-[94vh] overflow-y-auto eco-scroll">
            <div className="flex items-center justify-between p-5 border-b border-bone-200 sticky top-0 bg-white z-10">
              <h2 className="font-heading text-xl font-light">{editing.id ? "Editar artículo" : "Nuevo artículo"}</h2>
              <button onClick={() => setEditing(null)} aria-label="Cerrar" className="text-ink-muted hover:text-ink" data-testid="blog-editor-close"><X size={20} /></button>
            </div>

            <div className="p-5 space-y-6">
              {/* Básicos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-xs text-ink-soft sm:col-span-2">
                  Título *
                  <input className="input-eco w-full mt-1" value={editing.title} onChange={(e) => setF("title", e.target.value)} data-testid="blog-f-title" />
                </label>
                <label className="block text-xs text-ink-soft">
                  Slug (URL) <span className="text-ink-muted">— vacío = automático desde el título</span>
                  <input className="input-eco w-full mt-1" value={editing.slug || ""} onChange={(e) => setF("slug", e.target.value)} placeholder="mi-articulo" data-testid="blog-f-slug" />
                </label>
                <label className="block text-xs text-ink-soft">
                  Categoría
                  <input className="input-eco w-full mt-1" value={editing.category} onChange={(e) => setF("category", e.target.value)} placeholder="SUPERALIMENTOS" data-testid="blog-f-category" />
                </label>
                <label className="block text-xs text-ink-soft">
                  Fecha
                  <input type="date" className="input-eco w-full mt-1" value={editing.date} onChange={(e) => setF("date", e.target.value)} data-testid="blog-f-date" />
                </label>
                <label className="block text-xs text-ink-soft">
                  Tiempo de lectura
                  <input className="input-eco w-full mt-1" value={editing.read_time} onChange={(e) => setF("read_time", e.target.value)} placeholder="5 min" data-testid="blog-f-readtime" />
                </label>
                <label className="block text-xs text-ink-soft">
                  Autor
                  <input className="input-eco w-full mt-1" value={editing.author} onChange={(e) => setF("author", e.target.value)} data-testid="blog-f-author" />
                </label>
                <label className="block text-xs text-ink-soft">
                  Búsqueda de productos relacionados
                  <input className="input-eco w-full mt-1" value={editing.related_query} onChange={(e) => setF("related_query", e.target.value)} placeholder="quinoa" data-testid="blog-f-related" />
                </label>
                <label className="block text-xs text-ink-soft sm:col-span-2">
                  Extracto
                  <textarea className="input-eco w-full mt-1 min-h-[64px]" value={editing.excerpt} onChange={(e) => setF("excerpt", e.target.value)} data-testid="blog-f-excerpt" />
                </label>
              </div>

              {/* Portada */}
              <div>
                <div className="text-xs text-ink-soft mb-2">Imagen de portada</div>
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="w-40 aspect-[4/3] rounded-lg overflow-hidden bg-bone-100 border border-bone-200 flex items-center justify-center">
                    {editing.cover ? <img src={resolveAsset(editing.cover)} alt="" className="w-full h-full object-cover" /> : <Newspaper size={22} className="text-bone-300" />}
                  </div>
                  <div className="space-y-2">
                    <UploadButton kind="image" label="Subir portada" testid="blog-upload-cover" onUploaded={(r) => setF("cover", r.url)} />
                    <input className="input-eco w-full min-w-[280px]" placeholder="…o pega aquí la URL de la imagen" value={editing.cover} onChange={(e) => setF("cover", e.target.value)} data-testid="blog-f-cover" />
                  </div>
                </div>
              </div>

              {/* Contenido por secciones */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-ink-soft">Contenido (secciones con subtítulo + párrafo)</div>
                  <button onClick={() => setF("body", [...editing.body, { h: "", p: "" }])} className="text-xs text-sage-700 hover:underline inline-flex items-center gap-1" data-testid="blog-add-section">
                    <Plus size={12} /> Añadir sección
                  </button>
                </div>
                <div className="space-y-3">
                  {editing.body.map((s, i) => (
                    <div key={i} className="border border-bone-200 rounded-lg p-3 space-y-2" data-testid={`blog-section-edit-${i}`}>
                      <div className="flex gap-2">
                        <input className="input-eco flex-1" placeholder={`Subtítulo ${i + 1}`} value={s.h} onChange={(e) => setSection(i, "h", e.target.value)} data-testid={`blog-section-h-${i}`} />
                        <button onClick={() => moveSection(i, -1)} disabled={i === 0} aria-label="Subir" className="p-1.5 border border-bone-200 rounded text-ink-soft disabled:opacity-40"><ArrowUp size={13} /></button>
                        <button onClick={() => moveSection(i, 1)} disabled={i === editing.body.length - 1} aria-label="Bajar" className="p-1.5 border border-bone-200 rounded text-ink-soft disabled:opacity-40"><ArrowDown size={13} /></button>
                        <button onClick={() => setF("body", editing.body.filter((_, idx) => idx !== i))} aria-label="Eliminar sección" className="p-1.5 border border-bone-200 rounded text-ink-muted hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                      <textarea className="input-eco w-full min-h-[84px]" placeholder="Párrafo…" value={s.p} onChange={(e) => setSection(i, "p", e.target.value)} data-testid={`blog-section-p-${i}`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Fuentes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-ink-soft">Fuentes (credibilidad + SEO)</div>
                  <button onClick={() => setF("sources", [...editing.sources, { label: "", url: "" }])} className="text-xs text-sage-700 hover:underline inline-flex items-center gap-1" data-testid="blog-add-source">
                    <Plus size={12} /> Añadir fuente
                  </button>
                </div>
                <div className="space-y-2">
                  {editing.sources.map((s, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input className="input-eco flex-1" placeholder="Etiqueta (ej. FAO — Quinoa)" value={s.label} onChange={(e) => setSource(i, "label", e.target.value)} data-testid={`blog-source-label-${i}`} />
                      <input className="input-eco flex-[1.4]" placeholder="https://…" value={s.url} onChange={(e) => setSource(i, "url", e.target.value)} data-testid={`blog-source-url-${i}`} />
                      <button onClick={() => setF("sources", editing.sources.filter((_, idx) => idx !== i))} aria-label="Eliminar fuente" className="p-1.5 text-ink-muted hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  ))}
                  {editing.sources.length === 0 && <div className="text-[11px] text-ink-muted">Sin fuentes.</div>}
                </div>
              </div>

              {/* SEO */}
              <div className="border border-sage-200 bg-sage-50/50 rounded-lg p-4 space-y-3">
                <div className="text-xs font-medium text-sage-700 uppercase tracking-[0.14em]">SEO del artículo</div>
                <label className="block text-xs text-ink-soft">
                  <span className="flex items-center justify-between">Meta título <span className={counterClass((editing.seo.meta_title || "").length, 30, 65)}>{(editing.seo.meta_title || "").length}/65</span></span>
                  <input className="input-eco w-full mt-1" value={editing.seo.meta_title} onChange={(e) => setSeoF("meta_title", e.target.value)} placeholder={`${editing.title || "Título"} | Blog EcoAndes`} data-testid="blog-f-seo-title" />
                </label>
                <label className="block text-xs text-ink-soft">
                  <span className="flex items-center justify-between">Meta descripción <span className={counterClass((editing.seo.meta_description || "").length, 80, 170)}>{(editing.seo.meta_description || "").length}/170</span></span>
                  <textarea className="input-eco w-full mt-1 min-h-[64px]" value={editing.seo.meta_description} onChange={(e) => setSeoF("meta_description", e.target.value)} placeholder="Si se deja vacío se usa el extracto." data-testid="blog-f-seo-description" />
                </label>
                <label className="block text-xs text-ink-soft">
                  Keywords <span className="text-ink-muted">(separadas por comas)</span>
                  <input className="input-eco w-full mt-1" value={(editing.seo.keywords || []).join(", ")} onChange={(e) => setSeoF("keywords", e.target.value.split(",").map((k) => k.trim()).filter(Boolean))} data-testid="blog-f-seo-keywords" />
                </label>
              </div>

              <label className="inline-flex items-center gap-2.5 text-sm text-ink-soft cursor-pointer select-none">
                <input type="checkbox" checked={editing.published} onChange={(e) => setF("published", e.target.checked)} className="accent-sage-500 w-4 h-4" data-testid="blog-f-published" />
                Publicado (visible en la web)
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 p-5 border-t border-bone-200 sticky bottom-0 bg-white">
              {editing.id && (
                <a href={`/blog/${editing.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-sage-700 hover:underline inline-flex items-center gap-1 mr-auto" data-testid="blog-view-live">
                  <Link2 size={12} /> Ver en la web
                </a>
              )}
              <button onClick={() => setEditing(null)} className="btn-outline" data-testid="blog-editor-cancel">Cancelar</button>
              <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2 disabled:opacity-60" data-testid="blog-editor-save">
                <Save size={15} /> {saving ? "Guardando…" : "Guardar artículo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
