import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, Save, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";

// Editor de páginas legales: Aviso Legal, Cookies, Privacidad, Condiciones.
const PAGE_LABELS = {
  "aviso-legal": "Aviso Legal",
  "politica-cookies": "Política de Cookies",
  "politica-privacidad": "Política de Privacidad",
  "condiciones": "Condiciones Generales",
};

function toText(p) {
  if (Array.isArray(p)) return p.join("\n\n");
  return p || "";
}

export default function AdminLegal() {
  const [pages, setPages] = useState([]);
  const [slug, setSlug] = useState("aviso-legal");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/admin/legal").then(({ data }) => setPages(data.pages || [])).catch(() => toast.error("Error al cargar"));
  }, []);

  useEffect(() => {
    const page = pages.find((p) => p.slug === slug);
    if (page) {
      setDraft({
        title: page.title,
        updated: page.updated || "",
        sections: (page.sections || []).map((s) => ({
          h: s.h || "",
          p: toText(s.p),
          ul: (s.ul || []).join("\n"),
        })),
      });
    }
  }, [slug, pages]);

  const updSection = (idx, patch) => {
    setDraft((d) => ({ ...d, sections: d.sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)) }));
  };
  const moveSection = (idx, dir) => {
    setDraft((d) => {
      const next = [...d.sections];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return d;
      [next[idx], next[j]] = [next[j], next[idx]];
      return { ...d, sections: next };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        title: draft.title,
        updated: draft.updated,
        sections: draft.sections.map((s) => {
          const paras = s.p.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
          return {
            h: s.h,
            p: paras.length > 1 ? paras : (paras[0] || ""),
            ul: s.ul.split("\n").map((x) => x.trim()).filter(Boolean),
          };
        }),
      };
      await api.put(`/admin/legal/${slug}`, payload);
      const { data } = await api.get("/admin/legal");
      setPages(data.pages || []);
      toast.success("Página legal guardada");
    } catch (e) {
      toast.error("Error al guardar", { description: e?.response?.data?.detail });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="admin-legal-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="overline mb-2">Contenido</div>
          <h1 className="font-heading text-3xl font-light">Páginas legales</h1>
          <p className="text-sm text-ink-soft mt-2 max-w-2xl">
            Edita el Aviso Legal, la Política de Cookies, la Política de Privacidad y las
            Condiciones Generales. Los cambios se publican al instante.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/legal/${slug}`} target="_blank" rel="noopener noreferrer" className="btn-outline inline-flex items-center gap-2 !py-2.5" data-testid="legal-view-live">
            <ExternalLink size={14} /> Ver en la web
          </a>
          <button onClick={save} disabled={saving || !draft} className="btn-primary inline-flex items-center gap-2 !py-2.5" data-testid="legal-save">
            <Save size={14} /> {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-6" data-testid="legal-tabs">
        {Object.entries(PAGE_LABELS).map(([s, label]) => (
          <button
            key={s}
            onClick={() => setSlug(s)}
            data-testid={`legal-tab-${s}`}
            className={`text-xs uppercase tracking-[0.14em] px-4 py-2.5 rounded-full border transition-colors ${
              slug === s ? "bg-sage-600 text-white border-sage-600" : "bg-white text-ink-soft border-bone-200 hover:border-sage-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {!draft ? (
        <div className="text-ink-soft py-10">Cargando…</div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border border-bone-200 rounded-md p-4 grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-muted block mb-1">Título de la página</label>
              <input className="input-eco !py-2" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} data-testid="legal-title" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-ink-muted block mb-1">Fecha última actualización (texto)</label>
              <input className="input-eco !py-2" value={draft.updated} onChange={(e) => setDraft((d) => ({ ...d, updated: e.target.value }))} placeholder="Ej. Julio 2026" data-testid="legal-updated" />
            </div>
          </div>

          {draft.sections.map((s, idx) => (
            <div key={idx} className="bg-white border border-bone-200 rounded-md p-4" data-testid={`legal-section-${idx}`}>
              <div className="flex items-center gap-2 mb-3">
                <input
                  className="input-eco !py-2 font-medium flex-1"
                  value={s.h}
                  onChange={(e) => updSection(idx, { h: e.target.value })}
                  placeholder="Título de la sección"
                  data-testid={`legal-section-h-${idx}`}
                />
                <button onClick={() => moveSection(idx, -1)} disabled={idx === 0} className="p-2 border border-bone-200 rounded-sm text-ink-soft disabled:opacity-30" aria-label="Subir"><ArrowUp size={13} /></button>
                <button onClick={() => moveSection(idx, 1)} disabled={idx === draft.sections.length - 1} className="p-2 border border-bone-200 rounded-sm text-ink-soft disabled:opacity-30" aria-label="Bajar"><ArrowDown size={13} /></button>
                <button onClick={() => setDraft((d) => ({ ...d, sections: d.sections.filter((_, i) => i !== idx) }))} className="p-2 border border-bone-200 rounded-sm text-red-600 hover:border-red-400" aria-label="Eliminar sección" data-testid={`legal-section-del-${idx}`}><Trash2 size={13} /></button>
              </div>
              <label className="text-[11px] uppercase tracking-wide text-ink-muted block mb-1">Párrafos (separa párrafos con una línea en blanco)</label>
              <textarea
                className="input-eco !py-2 text-sm min-h-[100px]"
                value={s.p}
                onChange={(e) => updSection(idx, { p: e.target.value })}
                data-testid={`legal-section-p-${idx}`}
              />
              <label className="text-[11px] uppercase tracking-wide text-ink-muted block mb-1 mt-3">Lista de puntos (opcional, uno por línea)</label>
              <textarea
                className="input-eco !py-2 text-sm min-h-[60px]"
                value={s.ul}
                onChange={(e) => updSection(idx, { ul: e.target.value })}
                data-testid={`legal-section-ul-${idx}`}
              />
            </div>
          ))}

          <button
            onClick={() => setDraft((d) => ({ ...d, sections: [...d.sections, { h: "", p: "", ul: "" }] }))}
            className="btn-outline inline-flex items-center gap-2 !py-2.5"
            data-testid="legal-add-section"
          >
            <Plus size={14} /> Añadir sección
          </button>
        </div>
      )}
    </div>
  );
}
