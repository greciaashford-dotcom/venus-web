import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, formatEUR, resolveAsset } from "../../lib/api";
import { StatusPill } from "./AdminDashboard";
import { originLabel, SOURCE_LABELS } from "../../lib/tracking";
import { Eye, Search, X } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["Pendiente portes", "Pendiente", "Pagado", "Enviado", "Completado", "Cancelado"];

const CHANNELS = [
  ["", "Todos los canales"],
  ["direct", "Directo"],
  ["google", "Orgánico: Google"],
  ["bing", "Orgánico: Bing"],
  ["facebook", "Social: Facebook"],
  ["instagram", "Social: Instagram"],
  ["tiktok", "Social: TikTok"],
  ["x_twitter", "Social: X (Twitter)"],
  ["chatgpt", "IA: ChatGPT"],
  ["gemini", "IA: Gemini"],
  ["whatsapp", "Social: WhatsApp"],
  ["referral", "Referencias (otras webs)"],
];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [tab, setTab] = useState(""); // "" = Todo
  const [draft, setDraft] = useState({ date_from: "", date_to: "", source: "", registered: "", customer_type: "" });
  const [applied, setApplied] = useState({ date_from: "", date_to: "", source: "", registered: "", customer_type: "" });
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [selected, setSelected] = useState({});
  const [bulkAction, setBulkAction] = useState("");
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        status: tab || undefined,
        customer_type: applied.customer_type || undefined,
        source: applied.source || undefined,
        registered: applied.registered || undefined,
        date_from: applied.date_from || undefined,
        date_to: applied.date_to || undefined,
        search: appliedSearch || undefined,
      };
      const [{ data }, { data: cts }] = await Promise.all([
        api.get("/orders/admin/list", { params }),
        api.get("/orders/admin/status-counts"),
      ]);
      setOrders(data);
      setCounts(cts);
      setSelected({});
    } finally {
      setLoading(false);
    }
  }, [tab, applied, appliedSearch]);

  useEffect(() => { load(); }, [load]);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const allChecked = orders.length > 0 && selectedIds.length === orders.length;

  const toggleAll = () => {
    if (allChecked) setSelected({});
    else setSelected(Object.fromEntries(orders.map((o) => [o.id, true])));
  };

  const applyBulk = async () => {
    if (!bulkAction) { toast.info("Selecciona una acción en lote"); return; }
    if (selectedIds.length === 0) { toast.info("Selecciona al menos un pedido"); return; }
    try {
      const { data } = await api.post("/orders/admin/bulk-status", { ids: selectedIds, status: bulkAction });
      toast.success(`${data.updated} pedido${data.updated !== 1 ? "s" : ""} actualizado${data.updated !== 1 ? "s" : ""} a \u201c${bulkAction}\u201d`);
      setBulkAction("");
      load();
    } catch (err) {
      toast.error("Error en la acción en lote", { description: err?.response?.data?.detail });
    }
  };

  const tabs = [
    { key: "", label: "Todo", count: counts.all },
    ...STATUSES.map((s) => ({ key: s, label: s, count: counts[s] })),
  ];

  return (
    <div data-testid="admin-orders-page">
      <div className="overline mb-2">Gestión de pedidos</div>
      <h1 className="font-heading text-3xl font-light mb-5">Pedidos</h1>

      {/* ---- Quick status tabs (WooCommerce style) ---- */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 mb-4 text-sm" data-testid="orders-status-tabs">
        {tabs.map((t, i) => (
          <React.Fragment key={t.key}>
            {i > 0 && <span className="text-bone-300 px-1">|</span>}
            <button
              onClick={() => setTab(t.key)}
              data-testid={`orders-tab-${t.key || "all"}`}
              className={`px-1 py-0.5 transition-colors ${tab === t.key ? "text-ink font-semibold" : "text-sage-700 hover:text-sage-800"}`}
            >
              {t.label} <span className="text-ink-muted font-normal">({t.count ?? 0})</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* ---- Toolbar: bulk actions + filters + search ---- */}
      <div className="bg-white border border-bone-200 rounded-md p-3 mb-0 flex flex-wrap items-center gap-2" data-testid="orders-toolbar">
        <select className="border border-bone-200 rounded-sm px-2.5 py-2 text-sm bg-white" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} data-testid="bulk-action-select">
          <option value="">Acciones en lote</option>
          {STATUSES.map((s) => <option key={s} value={s}>Marcar como {s}</option>)}
        </select>
        <button onClick={applyBulk} className="btn-outline !py-2 !px-4 text-[11px]" data-testid="bulk-apply-btn">Aplicar</button>

        <span className="w-px h-7 bg-bone-200 mx-1 hidden sm:block" />

        <input type="date" className="border border-bone-200 rounded-sm px-2 py-2 text-sm bg-white" value={draft.date_from} onChange={(e) => setDraft((d) => ({ ...d, date_from: e.target.value }))} data-testid="orders-date-from" title="Desde" />
        <input type="date" className="border border-bone-200 rounded-sm px-2 py-2 text-sm bg-white" value={draft.date_to} onChange={(e) => setDraft((d) => ({ ...d, date_to: e.target.value }))} data-testid="orders-date-to" title="Hasta" />
        <select className="border border-bone-200 rounded-sm px-2.5 py-2 text-sm bg-white max-w-[190px]" value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} data-testid="orders-filter-channel">
          {CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="border border-bone-200 rounded-sm px-2.5 py-2 text-sm bg-white" value={draft.registered} onChange={(e) => setDraft((d) => ({ ...d, registered: e.target.value }))} data-testid="orders-filter-registered">
          <option value="">Todos los clientes</option>
          <option value="1">Cliente registrado</option>
          <option value="0">Invitado</option>
        </select>
        <select className="border border-bone-200 rounded-sm px-2.5 py-2 text-sm bg-white" value={draft.customer_type} onChange={(e) => setDraft((d) => ({ ...d, customer_type: e.target.value }))} data-testid="orders-filter-type">
          <option value="">B2C y B2B</option>
          <option value="retail">Retail (B2C)</option>
          <option value="professional">Profesional (B2B)</option>
        </select>
        <button onClick={() => setApplied({ ...draft })} className="btn-outline !py-2 !px-4 text-[11px]" data-testid="orders-filter-btn">Filtrar</button>

        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            className="border border-bone-200 rounded-sm pl-9 pr-3 py-2 text-sm bg-white w-56"
            placeholder="Buscar pedidos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setAppliedSearch(search)}
            data-testid="orders-search"
          />
        </div>
        <button onClick={() => setAppliedSearch(search)} className="btn-outline !py-2 !px-4 text-[11px]" data-testid="orders-search-btn">Buscar pedidos</button>
      </div>

      {/* ---- Data table ---- */}
      <div className="bg-white border border-t-0 border-bone-200 rounded-b-md overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-xs uppercase tracking-[0.14em] text-ink-soft text-left border-b border-bone-200 bg-bone-50">
              <th className="p-3 pl-4 w-10">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} className="accent-sage-500 w-4 h-4 align-middle" data-testid="orders-check-all" />
              </th>
              <th className="p-3">Pedido</th>
              <th className="p-3">Fecha</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Total</th>
              <th className="p-3">Origen</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-ink-soft">Cargando…</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-ink-soft" data-testid="orders-empty">Sin pedidos que coincidan con los filtros.</td></tr>
            ) : orders.map((o) => {
              const name = o.shipping_address?.full_name || o.email;
              return (
                <tr key={o.id} className="border-b border-bone-100 hover:bg-bone-100/40" data-testid={`order-row-${o.order_number}`}>
                  <td className="p-3 pl-4">
                    <input
                      type="checkbox"
                      checked={!!selected[o.id]}
                      onChange={() => setSelected((s) => ({ ...s, [o.id]: !s[o.id] }))}
                      className="accent-sage-500 w-4 h-4 align-middle"
                      data-testid={`order-check-${o.order_number}`}
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Link to={`/admin/pedidos/${o.id}`} className="text-sage-700 font-semibold hover:underline" data-testid={`order-link-${o.order_number}`}>
                        #{o.order_number}
                      </Link>
                      <span className="text-ink">{name}</span>
                      <button
                        onClick={() => setPreview(o)}
                        className="p-1 rounded-sm border border-bone-200 text-ink-muted hover:text-sage-700 hover:border-sage-400 transition-colors"
                        aria-label={`Vista previa ${o.order_number}`}
                        data-testid={`order-preview-${o.order_number}`}
                      >
                        <Eye size={13} />
                      </button>
                    </div>
                    <div className="text-[11px] text-ink-muted mt-0.5 capitalize">{o.customer_type === "professional" ? "Profesional (B2B)" : "Retail"} · {o.payment_method} · {o.payment_status}</div>
                  </td>
                  <td className="p-3 whitespace-nowrap">{new Date(o.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</td>
                  <td className="p-3"><StatusPill status={o.status} /></td>
                  <td className="p-3 font-medium whitespace-nowrap">{formatEUR(o.total)}</td>
                  <td className="p-3 text-xs text-ink-soft" data-testid={`order-origin-${o.order_number}`}>{originLabel(o.acquisition)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-ink-muted mt-2">{orders.length} pedido{orders.length !== 1 ? "s" : ""} mostrados{selectedIds.length > 0 ? ` · ${selectedIds.length} seleccionados` : ""}</div>

      {preview && <OrderPreviewModal order={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function OrderPreviewModal({ order, onClose }) {
  const addr = order.shipping_address || {};
  return (
    <div
      className="fixed inset-0 z-[80] bg-black/40 flex items-start justify-center overflow-y-auto p-4 sm:p-8"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="order-preview-modal"
    >
      <div className="bg-white rounded-md w-full max-w-2xl shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-bone-200">
          <div>
            <div className="overline">Vista previa</div>
            <h3 className="font-heading text-xl font-normal">Pedido #{order.order_number}</h3>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill status={order.status} />
            <button onClick={onClose} className="text-ink-soft hover:text-ink p-1" aria-label="Cerrar" data-testid="order-preview-close"><X size={18} /></button>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-muted mb-1">Cliente</div>
            <div className="text-ink font-medium">{addr.full_name || "—"}</div>
            <div className="text-ink-soft">{order.email}</div>
            {addr.phone && <div className="text-ink-soft">{addr.phone}</div>}
            <div className="text-[11px] uppercase tracking-wide text-ink-muted mt-3 mb-1">Envío</div>
            <div className="text-ink-soft leading-relaxed">
              {addr.street}<br />{addr.postal_code} {addr.city}, {addr.province}<br />{addr.country}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-muted mb-1">Detalles</div>
            <div className="space-y-1 text-ink-soft">
              <div>Fecha: <span className="text-ink">{new Date(order.created_at).toLocaleString("es-ES")}</span></div>
              <div>Tipo: <span className="text-ink capitalize">{order.customer_type === "professional" ? "Profesional (B2B)" : "Retail (B2C)"}</span></div>
              <div>Pago: <span className="text-ink capitalize">{order.payment_method} · {order.payment_status}</span></div>
              <div>Entrega: <span className="text-ink">{order.delivery_method === "pickup" ? "Recogida en tienda" : "Envío a domicilio"}</span></div>
              <div>Origen: <span className="text-ink">{originLabel(order.acquisition)}</span></div>
              {order.acquisition?.landing_page && <div className="truncate">Landing: <span className="text-ink">{order.acquisition.landing_page}</span></div>}
            </div>
          </div>
        </div>
        <div className="px-5 pb-2">
          <div className="text-[11px] uppercase tracking-wide text-ink-muted mb-2">Artículos</div>
          <div className="border border-bone-200 rounded-sm divide-y divide-bone-100">
            {(order.items || []).map((it, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 text-sm">
                <div className="w-9 h-9 bg-bone-100 border border-bone-200 rounded-sm overflow-hidden flex items-center justify-center shrink-0">
                  {it.image_url && <img src={resolveAsset(it.image_url)} alt="" className="max-w-full max-h-full object-contain" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-ink truncate">{it.name}{it.variation_name ? ` · ${it.variation_name}` : ""}</div>
                  <div className="text-[11px] text-ink-muted">SKU {it.sku}</div>
                </div>
                <div className="text-ink-soft whitespace-nowrap">{it.quantity} × {formatEUR(it.unit_price)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="p-5 flex items-center justify-between border-t border-bone-200 mt-3">
          <div className="text-sm text-ink-soft">
            Subtotal {formatEUR(order.subtotal)} · Envío {formatEUR(order.shipping_cost)}{order.discount ? ` · Dto. -${formatEUR(order.discount)}` : ""}
            <span className="text-ink font-semibold ml-2">Total {formatEUR(order.total)}</span>
          </div>
          <Link to={`/admin/pedidos/${order.id}`} className="btn-primary !py-2.5 !px-5 text-[11px]" data-testid="order-preview-open-full">Ver ficha completa</Link>
        </div>
      </div>
    </div>
  );
}
