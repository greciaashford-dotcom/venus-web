import React, { useEffect, useState } from "react";
import { ShoppingBasket, Send, CheckCircle2, Trash2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { api, formatEUR } from "../../lib/api";

const STATUS_BADGE = {
  active: { label: "Activo", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  reminded: { label: "Recordatorio enviado", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  converted: { label: "Compró", cls: "bg-sage-50 text-sage-700 border-sage-200" },
  emptied: { label: "Vaciado", cls: "bg-bone-100 text-ink-muted border-bone-200" },
};

export default function AdminAbandonedCarts() {
  const [data, setData] = useState({ carts: [], stats: { active: 0, reminded: 0, converted: 0 } });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/cart/admin/list");
      setData(data);
    } catch (e) {
      toast.error("Error al cargar carritos", { description: e?.response?.data?.detail });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const remove = async (cart) => {
    if (!window.confirm(`¿Eliminar este carrito${cart.email ? ` (${cart.email})` : ""} de la lista?`)) return;
    try {
      await api.delete(`/cart/admin/${cart.cart_id}`);
      setData((prev) => ({ ...prev, carts: prev.carts.filter((c) => c.cart_id !== cart.cart_id) }));
      toast.success("Carrito eliminado");
    } catch (e) {
      toast.error("No se pudo eliminar", { description: e?.response?.data?.detail });
    }
  };

  const fmtDate = (iso) => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : "—");

  const cards = [
    { label: "Activos (sin recordar)", value: data.stats.active, icon: ShoppingBasket, tone: "text-amber-600" },
    { label: "Recordatorio enviado", value: data.stats.reminded, icon: Send, tone: "text-sky-600" },
    { label: "Recuperados (compraron)", value: data.stats.converted, icon: CheckCircle2, tone: "text-sage-600" },
  ];

  return (
    <div className="space-y-6" data-testid="admin-abandoned-carts">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-light">Carritos abandonados</h1>
          <p className="text-xs text-ink-muted mt-1">
            Recordatorios automáticos por email: 1º a las 4 h y 2º (último) a las 24 h de inactividad,
            con cupón ECOBONUS. Se rastrean usuarios logueados y también invitados en cuanto escriben
            su email en el checkout.
          </p>
        </div>
        <button onClick={load} className="btn-outline inline-flex items-center gap-2" data-testid="carts-reload">
          <RefreshCcw size={14} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card-soft border border-bone-200 rounded-xl bg-white p-4 flex items-center gap-3">
            <c.icon size={20} className={c.tone} />
            <div>
              <div className="text-xl font-heading">{c.value}</div>
              <div className="text-[11px] text-ink-muted uppercase tracking-[0.12em]">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="border border-bone-200 rounded-xl bg-white overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-ink-muted border-b border-bone-200">
              <th className="px-5 py-3 font-medium">Email</th>
              <th className="px-5 py-3 font-medium">Productos</th>
              <th className="px-5 py-3 font-medium">Total</th>
              <th className="px-5 py-3 font-medium">Últ. actividad</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3 font-medium">Recordatorio</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-ink-soft">Cargando…</td></tr>
            ) : data.carts.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-ink-soft">No hay carritos registrados todavía.</td></tr>
            ) : (
              data.carts.map((c) => {
                const badge = STATUS_BADGE[c.status] || STATUS_BADGE.active;
                const itemsTxt = (c.items || []).map((i) => `${i.name} ×${i.quantity}`).join(", ");
                return (
                  <tr key={c.cart_id} className="border-b border-bone-100 hover:bg-bone-50/60" data-testid={`cart-row-${c.cart_id}`}>
                    <td className="px-5 py-3">
                      {c.email
                        ? <span className="text-ink">{c.email}</span>
                        : <span className="text-ink-muted italic">Invitado sin email</span>}
                    </td>
                    <td className="px-5 py-3 text-ink-soft max-w-[320px]">
                      <span className="line-clamp-2" title={itemsTxt}>{itemsTxt || "—"}</span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">{formatEUR(c.subtotal || 0)}</td>
                    <td className="px-5 py-3 text-ink-soft whitespace-nowrap">{fmtDate(c.updated_at)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block text-[11px] px-2.5 py-1 rounded-full border ${badge.cls}`}>
                        {badge.label}
                        {c.status === "converted" && c.converted_order ? ` · ${c.converted_order}` : ""}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-ink-soft whitespace-nowrap text-xs">
                      {c.reminder_sent_at ? `1º ${fmtDate(c.reminder_sent_at)}` : "—"}
                      {c.reminder2_sent_at ? <><br />2º {fmtDate(c.reminder2_sent_at)}</> : null}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => remove(c)}
                        aria-label="Eliminar carrito"
                        className="text-ink-muted hover:text-red-500 transition-colors p-1"
                        data-testid={`cart-delete-${c.cart_id}`}
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
  );
}
