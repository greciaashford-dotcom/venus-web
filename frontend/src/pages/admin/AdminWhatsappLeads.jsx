import React, { useEffect, useState } from "react";
import { MessageCircle, Search, Download, Trash2, Users, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../lib/api";

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-ES", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

export default function AdminWhatsappLeads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get("/admin/whatsapp-leads")
      .then(({ data }) => setLeads(data.leads || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const rows = leads.filter(
    (l) =>
      !q ||
      (l.name || "").toLowerCase().includes(q.toLowerCase()) ||
      (l.phone || "").includes(q.replace(/\s/g, ""))
  );

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await api.get("/admin/whatsapp-leads/export", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-whatsapp-ecoandes-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    } finally {
      setExporting(false);
    }
  };

  const deleteLead = async (id) => {
    if (!window.confirm("¿Eliminar este lead?")) return;
    try {
      await api.delete(`/admin/whatsapp-leads/${id}`);
      setLeads((prev) => prev.filter((l) => l.id !== id));
      toast.success("Lead eliminado");
    } catch (e) {
      toast.error("No se pudo eliminar el lead", { description: e?.response?.data?.detail });
    }
  };

  const totalContacts = leads.reduce((acc, l) => acc + (l.contact_count || 1), 0);

  return (
    <div data-testid="admin-whatsapp-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="overline">CRM</div>
          <h1 className="font-heading text-3xl font-light">Leads de WhatsApp</h1>
          <p className="text-ink-soft text-sm mt-2 max-w-2xl">
            Datos de clientes que han contactado por el botón de WhatsApp de la web.
            Útil para seguimiento comercial y marketing.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="btn-outline inline-flex items-center gap-2" data-testid="whatsapp-leads-refresh">
            <RefreshCcw size={15} /> Actualizar
          </button>
          <button
            onClick={exportExcel}
            disabled={exporting || leads.length === 0}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            data-testid="whatsapp-leads-export"
          >
            <Download size={15} /> {exporting ? "Exportando…" : "Exportar Excel"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-bone-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-ink-soft text-xs uppercase tracking-[0.15em] mb-2">
            <Users size={14} className="text-sage-600" /> Leads únicos
          </div>
          <div className="font-heading text-3xl font-light" data-testid="whatsapp-leads-total">{leads.length}</div>
        </div>
        <div className="bg-white border border-bone-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-ink-soft text-xs uppercase tracking-[0.15em] mb-2">
            <MessageCircle size={14} className="text-sage-600" /> Contactos totales
          </div>
          <div className="font-heading text-3xl font-light">{totalContacts}</div>
        </div>
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o teléfono…"
          data-testid="whatsapp-leads-search"
          className="w-full bg-white border border-bone-200 rounded-md pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
        />
      </div>

      <div className="bg-white border border-bone-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="whatsapp-leads-table">
            <thead>
              <tr className="bg-bone-100 text-left">
                <th className="px-5 py-3.5 overline font-medium">Nombre</th>
                <th className="px-5 py-3.5 overline font-medium">Teléfono</th>
                <th className="px-5 py-3.5 overline font-medium">Nº contactos</th>
                <th className="px-5 py-3.5 overline font-medium">Primer contacto</th>
                <th className="px-5 py-3.5 overline font-medium">Último contacto</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bone-200">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-ink-soft">Cargando…</td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-ink-soft" data-testid="whatsapp-leads-empty">
                    <MessageCircle size={28} className="mx-auto mb-3 text-bone-300" />
                    {q ? "Sin resultados para la búsqueda." : "Todavía no hay leads. Aparecerán cuando los clientes contacten por WhatsApp."}
                  </td>
                </tr>
              ) : (
                rows.map((l) => (
                  <tr key={l.id} className="hover:bg-bone-50 transition" data-testid={`whatsapp-lead-row-${l.id}`}>
                    <td className="px-5 py-3.5 text-ink font-medium">{l.name}</td>
                    <td className="px-5 py-3.5">
                      <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-sage-700 hover:underline">
                        {l.phone}
                      </a>
                    </td>
                    <td className="px-5 py-3.5 text-ink-soft">{l.contact_count || 1}</td>
                    <td className="px-5 py-3.5 text-ink-soft">{fmtDate(l.created_at)}</td>
                    <td className="px-5 py-3.5 text-ink-soft">{fmtDate(l.last_contact_at)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => deleteLead(l.id)}
                        aria-label="Eliminar"
                        data-testid={`whatsapp-lead-delete-${l.id}`}
                        className="text-ink-muted hover:text-red-500 transition p-1"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
