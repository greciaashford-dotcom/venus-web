import React, { useEffect, useState } from "react";
import { Users, Store, UserCheck, Briefcase, Search, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, formatEUR } from "../../lib/api";

const TYPE_LABEL = {
  guest: { label: "Invitado", cls: "bg-bone-200 text-ink-soft", Icon: Store },
  registered: { label: "Registrado", cls: "bg-sage-100 text-sage-700", Icon: UserCheck },
  professional: { label: "Profesional", cls: "bg-terracotta/15 text-terracotta", Icon: Briefcase },
};

export default function AdminBuyers() {
  const [data, setData] = useState({ buyers: [], stats: { total: 0, guest: 0, registered: 0, professional: 0 } });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let active = true;
    api
      .get("/orders/admin/buyers", { params: filter ? { type: filter } : {} })
      .then(({ data: d }) => {
        if (active) setData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filter]);

  const rows = data.buyers.filter(
    (b) => !q || b.email.toLowerCase().includes(q.toLowerCase()) || (b.name || "").toLowerCase().includes(q.toLowerCase())
  );

  const deleteBuyer = async (b) => {
    if (!window.confirm(`¿Eliminar al comprador "${b.email}" del CRM?\n\nSus pedidos NO se borran; solo desaparece de esta lista.`)) return;
    try {
      await api.delete(`/orders/admin/buyers/${encodeURIComponent(b.email)}`);
      setData((prev) => ({
        ...prev,
        buyers: prev.buyers.filter((x) => x.email !== b.email),
        stats: { ...prev.stats, total: Math.max(0, prev.stats.total - 1), [b.type]: Math.max(0, (prev.stats[b.type] || 1) - 1) },
      }));
      toast.success("Comprador eliminado", { description: b.email });
    } catch (e) {
      toast.error("No se pudo eliminar", { description: e?.response?.data?.detail });
    }
  };

  const exportCsv = () => {
    const header = "email,nombre,tipo,pedidos,total_gastado,ultimo_pedido\n";
    const body = rows
      .map((b) => `${b.email},"${b.name || ""}",${b.type},${b.orders_count || 0},${(b.total_spent || 0).toFixed(2)},${(b.last_order_at || "").slice(0, 10)}`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compradores-ecoandes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const cards = [
    { key: "", label: "Todos", value: data.stats.total, Icon: Users },
    { key: "guest", label: "Invitados", value: data.stats.guest, Icon: Store },
    { key: "registered", label: "Registrados", value: data.stats.registered, Icon: UserCheck },
    { key: "professional", label: "Profesionales", value: data.stats.professional, Icon: Briefcase },
  ];

  return (
    <div data-testid="admin-buyers-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="overline">CRM</div>
          <h1 className="font-heading text-3xl font-light">Compradores</h1>
          <p className="text-ink-soft text-sm mt-2 max-w-2xl">
            Todos los correos que han comprado (con o sin registrarse). Sirve para controlar el cupón
            de primer pedido y para marketing.
          </p>
        </div>
        <button onClick={exportCsv} className="btn-outline inline-flex items-center gap-2" data-testid="buyers-export">
          <Download size={15} /> Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            data-testid={`buyers-filter-${c.key || "all"}`}
            className={`text-left bg-white border rounded-xl p-5 transition hover:shadow-sm ${
              filter === c.key ? "border-sage-400 ring-1 ring-sage-200" : "border-bone-200"
            }`}
          >
            <c.Icon size={18} className="text-sage-600 mb-3" />
            <div className="text-2xl font-heading">{c.value}</div>
            <div className="text-xs text-ink-soft uppercase tracking-[0.14em] mt-1">{c.label}</div>
          </button>
        ))}
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          className="input-eco pl-9"
          placeholder="Buscar por email o nombre…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          data-testid="buyers-search"
        />
      </div>

      <div className="bg-white border border-bone-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="buyers-table">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.14em] text-ink-soft border-b border-bone-200 bg-bone-50">
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium text-center">Pedidos</th>
                <th className="px-5 py-3 font-medium text-right">Total gastado</th>
                <th className="px-5 py-3 font-medium">Último pedido</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-ink-soft">Cargando…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-ink-soft">Aún no hay compradores.</td></tr>
              ) : (
                rows.map((b) => {
                  const tl = TYPE_LABEL[b.type] || TYPE_LABEL.guest;
                  return (
                    <tr key={b.email} className="border-b border-bone-100 last:border-0 hover:bg-bone-50/60 transition-colors" data-testid="buyer-row">
                      <td className="px-5 py-3 text-ink">{b.email}</td>
                      <td className="px-5 py-3 text-ink-soft">{b.name || "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] ${tl.cls}`}>
                          <tl.Icon size={12} /> {tl.label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">{b.orders_count || 0}</td>
                      <td className="px-5 py-3 text-right">{formatEUR(b.total_spent || 0)}</td>
                      <td className="px-5 py-3 text-ink-soft">{(b.last_order_at || "").slice(0, 10)}</td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => deleteBuyer(b)}
                          aria-label={`Eliminar ${b.email}`}
                          data-testid={`buyer-delete-${b.email}`}
                          className="text-ink-muted hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
