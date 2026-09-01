import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, formatEUR } from "../../lib/api";
import { toast } from "sonner";
import { StatusPill } from "./AdminDashboard";

const STATUSES = ["Pendiente portes", "Pendiente", "Pagado", "Enviado", "Completado", "Cancelado", "Reembolsado"];

// Desglose fiscal del pedido: productos (base + IVA por %) y envío (base + IVA siempre 21%)
function computeBreakdown(order) {
  if (!order) return null;
  const groups = {};
  let productsEx = 0;
  (order.items || []).forEach((it) => {
    const rate = Number(it.vat_rate ?? 0);
    const qty = Number(it.quantity || 1);
    let unitEx = it.unit_price_ex_vat;
    if (unitEx == null) {
      const unit = Number(it.unit_price || 0);
      unitEx = rate ? unit / (1 + rate / 100) : unit;
    }
    const lineEx = Math.round(Number(unitEx) * qty * 100) / 100;
    productsEx += lineEx;
    groups[rate] = (groups[rate] || 0) + Math.round(lineEx * rate) / 100;
  });
  const shippingGross = Number(order.shipping_cost || 0);
  let shipEx = order.shipping_cost_ex_vat;
  let shipVat = order.shipping_vat;
  if (shipEx == null || shipVat == null) {
    shipEx = Math.round((shippingGross / 1.21) * 100) / 100;
    shipVat = Math.round((shippingGross - shipEx) * 100) / 100;
  }
  return {
    productsEx: Math.round(productsEx * 100) / 100,
    vatGroups: Object.entries(groups)
      .map(([rate, amount]) => ({ rate: Number(rate), amount: Math.round(amount * 100) / 100 }))
      .filter((g) => g.amount > 0)
      .sort((a, b) => a.rate - b.rate),
    shippingEx: Number(shipEx || 0),
    shippingVat: Number(shipVat || 0),
    shippingGross,
  };
}

export default function AdminOrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [reasons, setReasons] = useState([]);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  // Reembolso por producto (estilo WooCommerce): sku -> {checked, qty, amount}
  const [refundLines, setRefundLines] = useState({});
  const [shipChecked, setShipChecked] = useState(false);
  const [shipAmount, setShipAmount] = useState("0");
  const [quoteNet, setQuoteNet] = useState("");
  const [savingQuote, setSavingQuote] = useState(false);
  const [msgSubject, setMsgSubject] = useState("");
  const [msgBody, setMsgBody] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const initRefundLines = (data, preset = null) => {
    const lines = {};
    (data.items || []).forEach((it) => {
      const presetItem = preset && !preset.full_order
        ? (preset.items || []).find((p) => p.sku === it.sku)
        : null;
      const qty = preset?.full_order ? it.quantity : presetItem ? presetItem.quantity : it.quantity;
      lines[it.sku] = {
        checked: preset ? (preset.full_order || Boolean(presetItem)) : false,
        qty,
        amount: (Math.round(it.unit_price * qty * 100) / 100).toFixed(2),
      };
    });
    setRefundLines(lines);
    setShipAmount(String(data.shipping_cost ?? 0));
    setShipChecked(Boolean(preset?.full_order && Number(data.shipping_cost || 0) > 0));
  };

  const load = async () => {
    const { data } = await api.get(`/orders/admin/${id}`);
    setOrder(data);
    initRefundLines(data);
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    api.get("/admin/refund-reasons").then(({ data }) => {
      const active = (data.reasons || []).filter((r) => r.active);
      setReasons(active);
      if (active.length) setRefundReason(active[0].label);
    }).catch(() => {});
  }, []);

  const breakdown = useMemo(() => computeBreakdown(order), [order]);
  const awaitingQuote = order && (order.shipping_status === "manual_quote" || order.status === "Pendiente portes");
  const quoteNetNum = Number(quoteNet) || 0;
  const quoteVat = Math.round(quoteNetNum * 21) / 100;
  const quoteGross = Math.round((quoteNetNum + quoteVat) * 100) / 100;

  // Derivados del reembolso por producto
  const refundedTotal = Number(order?.refunded_total || 0);
  const remainingRefund = order ? Math.max(0, Math.round((order.total - refundedTotal) * 100) / 100) : 0;
  const selectedLines = Object.entries(refundLines).filter(([, v]) => v.checked);
  const allFullSelected = order
    ? (order.items || []).every((it) => refundLines[it.sku]?.checked && Number(refundLines[it.sku]?.qty) >= it.quantity)
    : false;
  const linesTotal = Math.round(selectedLines.reduce((acc, [, v]) => acc + (Number(v.amount) || 0), 0) * 100) / 100;
  const shippingRefund = shipChecked ? (Number(shipAmount) || 0) : 0;
  const refundTotal = Math.min(Math.round((linesTotal + shippingRefund) * 100) / 100, remainingRefund || Infinity);

  const setLine = (sku, patch) => {
    setRefundLines((prev) => {
      const it = (order.items || []).find((x) => x.sku === sku);
      const cur = prev[sku] || {};
      const next = { ...cur, ...patch };
      if (patch.qty != null && it) {
        const q = Math.max(1, Math.min(Number(patch.qty) || 1, it.quantity));
        next.qty = q;
        next.amount = (Math.round(it.unit_price * q * 100) / 100).toFixed(2);
      }
      return { ...prev, [sku]: next };
    });
  };

  // El envío solo se activa automáticamente en reembolsos del pedido completo
  useEffect(() => {
    if (!order) return;
    if (allFullSelected && Number(order.shipping_cost || 0) > 0 && refundedTotal === 0) {
      setShipChecked(true);
    } else if (!allFullSelected) {
      setShipChecked(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFullSelected]);

  const updateStatus = async (status) => {
    setUpdating(true);
    try {
      const { data } = await api.patch(`/orders/admin/${id}/status`, { status });
      setOrder(data);
      toast.success("Estado actualizado");
    } catch (e) {
      toast.error("Error", { description: e?.response?.data?.detail });
    } finally { setUpdating(false); }
  };

  const saveShippingQuote = async () => {
    if (quoteNet === "" || quoteNetNum < 0) { toast.error("Introduce la base imponible de los portes"); return; }
    setSavingQuote(true);
    try {
      const { data } = await api.patch(`/orders/admin/${id}/shipping`, { shipping_cost_ex_vat: quoteNetNum });
      setOrder(data);
      initRefundLines(data);
      toast.success("Portes fijados", {
        description: `${formatEUR(data.shipping_cost)} (base ${formatEUR(data.shipping_cost_ex_vat)} + IVA 21%). Envía manualmente al cliente el correo con el total para el pago.`,
      });
    } catch (e) {
      toast.error("Error al fijar portes", { description: e?.response?.data?.detail });
    } finally { setSavingQuote(false); }
  };

  const sendCustomerMessage = async () => {
    const msg = msgBody.trim();
    if (!msg) { toast.error("Escribe el mensaje para el cliente"); return; }
    setSendingMsg(true);
    try {
      const { data } = await api.post(`/orders/admin/${id}/message`, {
        subject: msgSubject.trim() || null,
        message: msg,
      });
      if (data.sent) {
        toast.success("Mensaje enviado", { description: `Correo enviado a ${order.email}` });
      } else {
        toast.warning("Mensaje registrado, pero el correo no se pudo enviar", {
          description: "Revisa la configuración de Resend (dominio remitente sin verificar).",
        });
      }
      setMsgSubject("");
      setMsgBody("");
      load();
    } catch (e) {
      toast.error("Error al enviar", { description: e?.response?.data?.detail });
    } finally { setSendingMsg(false); }
  };

  const doRefund = async () => {
    if (!refundReason) { toast.error("Selecciona un motivo"); return; }
    if (selectedLines.length === 0 && !shipChecked) { toast.error("Selecciona al menos un producto o el envío"); return; }
    if (refundTotal <= 0) { toast.error("El importe del reembolso debe ser mayor que 0"); return; }
    const scopeTxt = allFullSelected ? "TODO el pedido" : `${selectedLines.length} producto(s)`;
    if (!window.confirm(`¿Reembolsar ${refundTotal.toFixed(2)}€ (${scopeTxt}) del pedido ${order.order_number}?`)) return;
    setRefunding(true);
    try {
      const items = selectedLines.map(([sku, v]) => ({
        sku,
        quantity: Number(v.qty) || 1,
        amount: Number(v.amount) || 0,
      }));
      const { data } = await api.post(`/admin/orders/${id}/refund`, {
        reason: refundReason,
        items: items.length ? items : null,
        include_shipping: shipChecked,
        shipping_amount: shipChecked ? Number(shipAmount) || 0 : null,
        notify: true,
      });
      const emailNote = data.email_sent ? " · email enviado al cliente" : " · email no enviado (falta configurar Resend)";
      const provNote = data.provider_result?.ok ? `Reembolso procesado vía ${data.refund.provider}` : "Registrado como reembolso manual";
      toast.success(data.fully_refunded ? "Pedido reembolsado por completo" : "Reembolso parcial registrado", { description: provNote + emailNote });
      load();
    } catch (e) {
      toast.error("Error al reembolsar", { description: e?.response?.data?.detail });
    } finally { setRefunding(false); }
  };

  if (!order) return <div className="text-ink-soft">Cargando pedido…</div>;
  const addr = order.shipping_address || {};
  return (
    <div data-testid="admin-order-detail">
      <Link to="/admin/pedidos" className="text-sm text-sage-700" data-testid="back-to-orders">← Volver a pedidos</Link>
      <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
        <div>
          <div className="overline mb-1">Pedido</div>
          <h1 className="font-heading text-3xl font-light">{order.order_number}</h1>
          <div className="text-sm text-ink-soft mt-1">{new Date(order.created_at).toLocaleString("es-ES")}</div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusPill status={order.status} />
          {(order.invoice_request || {}).status === "pending" && (
            <span className="inline-flex items-center gap-1.5 bg-sage-50 border border-sage-300 text-sage-700 px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.14em]" data-testid="invoice-requested-badge">
              🧾 Factura solicitada
            </span>
          )}
          {order.partially_refunded && order.status !== "Reembolsado" && (
            <span className="inline-flex items-center gap-1.5 bg-terracotta/10 border border-terracotta/40 text-terracotta px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.14em]" data-testid="partial-refund-badge">
              Reembolso parcial
            </span>
          )}
        </div>
      </div>

      {awaitingQuote && (
        <div className="mt-6 bg-terracotta/5 border border-terracotta/40 rounded-sm p-5" data-testid="shipping-quote-panel">
          <h2 className="font-heading text-lg font-normal text-ink">Portes pendientes de presupuesto</h2>
          <p className="text-xs text-ink-soft mt-1.5 leading-relaxed">
            Destino: <strong>{addr.postal_code} {addr.city}, {addr.country}</strong> · Peso total: <strong>{Number(order.total_weight_kg || 0).toFixed(2)} kg</strong>.
            Calcula los portes según peso, volumen y destino, fíjalos aquí y después envía manualmente al cliente el correo con el importe total para que realice el pago.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block text-xs text-ink-soft">Portes (base imponible, €)
              <input
                type="number" min="0" step="0.01"
                className="input-eco mt-1 w-44"
                value={quoteNet}
                onChange={(e) => setQuoteNet(e.target.value)}
                data-testid="shipping-quote-input"
              />
            </label>
            <div className="text-xs text-ink-soft pb-2.5" data-testid="shipping-quote-preview">
              + IVA 21% ({formatEUR(quoteVat)}) = <strong className="text-ink">{formatEUR(quoteGross)}</strong>
            </div>
            <button onClick={saveShippingQuote} disabled={savingQuote || quoteNet === ""} className="btn-primary disabled:opacity-60" data-testid="shipping-quote-save">
              {savingQuote ? "Guardando…" : "Fijar portes y actualizar total"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-bone-200 p-6">
          <h2 className="font-heading text-xl font-normal mb-4">Productos</h2>
          <ul className="divide-y divide-bone-100">
            {order.items.map((it, i) => (
              <li key={i} className="py-4 flex gap-4 items-start" data-testid={`order-item-${it.sku}`}>
                <div className="w-16 h-16 bg-bone-100 overflow-hidden shrink-0">
                  {it.image_url && <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-ink">{it.name}</div>
                  {it.variation_name && <div className="text-xs text-ink-soft">{it.variation_name}</div>}
                  <div className="text-xs text-ink-soft">SKU: {it.sku}{it.vat_rate != null ? ` · IVA ${it.vat_rate}%` : ""}</div>
                </div>
                <div className="text-sm">{it.quantity} × {formatEUR(it.unit_price)}</div>
                <div className="text-sm font-medium">{formatEUR(it.unit_price * it.quantity)}</div>
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t border-bone-200 pt-4 text-sm space-y-1.5 max-w-xs ml-auto" data-testid="order-totals">
            {breakdown && (
              <>
                <div className="flex justify-between"><span className="text-ink-soft">Productos (base imponible)</span><span data-testid="totals-products-ex">{formatEUR(breakdown.productsEx)}</span></div>
                {breakdown.vatGroups.map((g) => (
                  <div key={g.rate} className="flex justify-between" data-testid={`totals-products-vat-${g.rate}`}>
                    <span className="text-ink-soft">IVA productos ({g.rate}%)</span><span>{formatEUR(g.amount)}</span>
                  </div>
                ))}
              </>
            )}
            <div className="flex justify-between">
              <span className="text-ink-soft">Envío (base)</span>
              <span data-testid="totals-shipping-ex">{awaitingQuote ? "Pendiente" : formatEUR(breakdown?.shippingEx || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">IVA envío (21%)</span>
              <span data-testid="totals-shipping-vat">{awaitingQuote ? "Pendiente" : formatEUR(breakdown?.shippingVat || 0)}</span>
            </div>
            {Number(order.discount || 0) > 0 && (
              <div className="flex justify-between text-sage-700"><span>Descuento{order.coupon_code ? ` (${order.coupon_code})` : ""}</span><span>-{formatEUR(order.discount)}</span></div>
            )}
            <div className="flex justify-between text-base font-medium pt-2 border-t border-bone-200">
              <span>Total{awaitingQuote ? " (sin portes)" : ""}</span><span data-testid="totals-total">{formatEUR(order.total)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-bone-200 p-6">
            <h3 className="overline mb-3">Cliente</h3>
            <div className="text-sm text-ink">{addr.full_name}</div>
            <div className="text-sm text-ink-soft">{order.email}</div>
            {addr.phone && <div className="text-sm text-ink-soft">{addr.phone}</div>}
            <div className="text-xs uppercase tracking-[0.18em] text-sage-700 mt-2">{order.customer_type}</div>
          </div>
          <div className="bg-white border border-bone-200 p-6">
            <h3 className="overline mb-3">Envío</h3>
            <div className="text-sm text-ink-soft leading-relaxed">
              {addr.street}<br />
              {addr.postal_code} {addr.city}<br />
              {addr.province}, {addr.country}
            </div>
            {order.total_weight_kg != null && (
              <div className="text-xs text-ink-muted mt-2">Peso total: {Number(order.total_weight_kg).toFixed(2)} kg{order.shipping_zone ? ` · Zona: ${order.shipping_zone}` : ""}</div>
            )}
            {addr.notes && <div className="text-xs text-ink-muted mt-3">Notas: {addr.notes}</div>}
          </div>
          <div className="bg-white border border-bone-200 p-6">
            <h3 className="overline mb-3">Pago</h3>
            <div className="text-sm capitalize">{order.payment_method === "pending_quote" ? "Pendiente de presupuesto de portes" : order.payment_method}</div>
            <div className="text-xs text-ink-soft">Estado: {order.payment_status === "awaiting_quote" ? "esperando presupuesto" : order.payment_status}</div>
          </div>
          <div className="bg-white border border-bone-200 p-6">
            <h3 className="overline mb-3">Cambiar estado</h3>
            <select
              className="input-eco"
              value={order.status}
              onChange={(e) => updateStatus(e.target.value)}
              disabled={updating}
              data-testid="order-status-select"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Mensaje personalizado al cliente */}
          <div className="bg-white border border-bone-200 p-6" data-testid="customer-message-panel">
            <h3 className="overline mb-3">Mensaje al cliente</h3>
            <p className="text-[11px] text-ink-muted mb-3 leading-relaxed">
              Se enviará directamente al correo del cliente (<strong>{order.email}</strong>) con la
              plantilla corporativa de EcoAndes. Útil para comunicar portes, reembolsos o incidencias.
            </p>
            <div className="space-y-3">
              <input
                type="text"
                className="input-eco w-full"
                placeholder="Asunto (opcional)"
                value={msgSubject}
                onChange={(e) => setMsgSubject(e.target.value)}
                maxLength={150}
                data-testid="customer-message-subject"
              />
              <textarea
                className="input-eco w-full min-h-[110px]"
                placeholder="Escribe aquí el mensaje personalizado para el cliente…"
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                maxLength={5000}
                data-testid="customer-message-body"
              />
              <button
                onClick={sendCustomerMessage}
                disabled={sendingMsg || !msgBody.trim()}
                className="btn-primary w-full disabled:opacity-60"
                data-testid="customer-message-send"
              >
                {sendingMsg ? "Enviando…" : "Enviar al correo del cliente"}
              </button>
            </div>
            {(order.customer_messages || []).length > 0 && (
              <div className="mt-4 border-t border-bone-200 pt-3 space-y-2" data-testid="customer-message-history">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Mensajes enviados</div>
                {[...order.customer_messages].reverse().slice(0, 3).map((m, i) => (
                  <div key={i} className="text-xs bg-bone-50 border border-bone-200 rounded-sm p-2.5">
                    <div className="flex items-center justify-between text-[10px] text-ink-muted mb-1">
                      <span>{new Date(m.sent_at).toLocaleString("es-ES")}</span>
                      <span className={m.sent ? "text-sage-700" : "text-terracotta"}>{m.sent ? "Enviado" : "No entregado"}</span>
                    </div>
                    {m.subject && <div className="font-medium text-ink">{m.subject}</div>}
                    <div className="text-ink-soft line-clamp-3 whitespace-pre-line">{m.message}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Refund (estilo WooCommerce: por producto, varios o todo el pedido) */}
          <div className="bg-white border border-bone-200 p-6" data-testid="order-refund-panel">
            <h3 className="overline mb-3">Reembolso</h3>

            {/* Solicitud del cliente pendiente */}
            {(order.refund_request || {}).status === "pending" && (
              <div className="mb-4 bg-amber-50 border border-amber-300 rounded-sm p-3 text-xs" data-testid="refund-request-alert">
                <div className="font-medium text-amber-800 mb-1">🔁 Solicitud de reembolso del cliente</div>
                <div className="text-amber-800">
                  {order.refund_request.full_order
                    ? "Solicita el reembolso de TODO el pedido."
                    : `Solicita: ${(order.refund_request.items || []).map((i) => `${i.name}${i.variation_name ? ` (${i.variation_name})` : ""} × ${i.quantity}`).join(" · ")}`}
                </div>
                {order.refund_request.reason && (
                  <div className="mt-1 text-amber-700 italic">Motivo: {order.refund_request.reason}</div>
                )}
                <div className="mt-1 text-[10px] text-amber-700">{new Date(order.refund_request.requested_at).toLocaleString("es-ES")}</div>
                <button
                  onClick={() => initRefundLines(order, order.refund_request)}
                  className="mt-2 text-[10px] uppercase tracking-[0.14em] font-medium text-amber-900 underline underline-offset-2"
                  data-testid="refund-request-prefill"
                >
                  Precargar esta selección
                </button>
              </div>
            )}

            {breakdown && (
              <div className="mb-4 rounded-sm bg-bone-50 border border-bone-200 p-3 text-xs space-y-1" data-testid="refund-breakdown">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted mb-1.5">Desglose del pedido</div>
                <div className="flex justify-between"><span className="text-ink-soft">Productos (base)</span><span data-testid="refund-products-ex">{formatEUR(breakdown.productsEx)}</span></div>
                {breakdown.vatGroups.map((g) => (
                  <div key={g.rate} className="flex justify-between" data-testid={`refund-products-vat-${g.rate}`}>
                    <span className="text-ink-soft">IVA productos ({g.rate}%)</span><span>{formatEUR(g.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between"><span className="text-ink-soft">Envío (base)</span><span data-testid="refund-shipping-ex">{formatEUR(breakdown.shippingEx)}</span></div>
                <div className="flex justify-between"><span className="text-ink-soft">IVA envío (21%)</span><span data-testid="refund-shipping-vat">{formatEUR(breakdown.shippingVat)}</span></div>
                <div className="flex justify-between font-medium text-ink pt-1.5 border-t border-bone-200"><span>Total pedido</span><span>{formatEUR(order.total)}</span></div>
                {refundedTotal > 0 && (
                  <div className="flex justify-between text-terracotta"><span>Ya reembolsado</span><span data-testid="refunded-total">-{formatEUR(refundedTotal)}</span></div>
                )}
              </div>
            )}

            {/* Historial de reembolsos */}
            {(order.refunds || []).length > 0 && (
              <div className="mb-4 space-y-1.5" data-testid="refund-history">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Reembolsos realizados</div>
                {order.refunds.map((r, i) => (
                  <div key={i} className="text-xs bg-sage-50 border border-sage-200 rounded-sm px-2.5 py-2 flex justify-between gap-2">
                    <span className="text-ink-soft">
                      {new Date(r.created_at).toLocaleDateString("es-ES")} · {r.full_refund ? "Pedido completo" : `${(r.items || []).length} línea(s)`}
                      {r.shipping_refund > 0 ? " + envío" : ""}
                    </span>
                    <span className="font-medium text-sage-700">{formatEUR(r.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {order.status === "Reembolsado" || remainingRefund <= 0 ? (
              <div className="text-sm" data-testid="order-refunded-note">
                <div className="inline-flex items-center gap-1.5 text-sage-700 bg-sage-50 border border-sage-200 rounded-full px-3 py-1 text-xs uppercase tracking-wide">Reembolsado por completo</div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Selecciona productos a reembolsar</div>
                <div className="border border-bone-200 rounded-sm divide-y divide-bone-100" data-testid="refund-lines">
                  {(order.items || []).map((it) => {
                    const ln = refundLines[it.sku] || {};
                    return (
                      <div key={it.sku} className="p-2.5">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-sage-600 h-4 w-4 shrink-0"
                            checked={!!ln.checked}
                            onChange={(e) => setLine(it.sku, { checked: e.target.checked })}
                            data-testid={`refund-line-check-${it.sku}`}
                          />
                          <span className="text-xs text-ink flex-1 min-w-0 truncate">
                            {it.name}{it.variation_name ? ` · ${it.variation_name}` : ""} <span className="text-ink-muted">({formatEUR(it.unit_price)} × {it.quantity})</span>
                          </span>
                        </label>
                        {ln.checked && (
                          <div className="mt-2 flex items-center gap-2 pl-6">
                            <label className="text-[10px] text-ink-soft flex items-center gap-1">Uds.
                              <input
                                type="number" min={1} max={it.quantity} value={ln.qty}
                                onChange={(e) => setLine(it.sku, { qty: e.target.value })}
                                className="input-eco w-14 py-1 text-center"
                                data-testid={`refund-line-qty-${it.sku}`}
                              />
                            </label>
                            <label className="text-[10px] text-ink-soft flex items-center gap-1 flex-1">Importe €
                              <input
                                type="number" min={0} step="0.01" value={ln.amount}
                                onChange={(e) => setLine(it.sku, { amount: e.target.value })}
                                className="input-eco w-full py-1 text-right"
                                data-testid={`refund-line-amount-${it.sku}`}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Envío: solo se activa automáticamente en reembolso total (editable por el admin) */}
                  {Number(order.shipping_cost || 0) > 0 && (
                    <div className="p-2.5 bg-bone-50">
                      <label className={`flex items-center gap-2.5 ${allFullSelected ? "cursor-pointer" : "opacity-60"}`}>
                        <input
                          type="checkbox"
                          className="accent-sage-600 h-4 w-4 shrink-0"
                          checked={shipChecked}
                          onChange={(e) => setShipChecked(e.target.checked)}
                          data-testid="refund-shipping-check"
                        />
                        <span className="text-xs text-ink flex-1">Coste de envío <span className="text-ink-muted">({formatEUR(order.shipping_cost)})</span></span>
                      </label>
                      {shipChecked && (
                        <div className="mt-2 pl-6">
                          <label className="text-[10px] text-ink-soft flex items-center gap-1">Importe €
                            <input
                              type="number" min={0} step="0.01" value={shipAmount}
                              onChange={(e) => setShipAmount(e.target.value)}
                              className="input-eco w-28 py-1 text-right"
                              data-testid="refund-shipping-amount"
                            />
                          </label>
                        </div>
                      )}
                      {!allFullSelected && (
                        <div className="text-[10px] text-ink-muted mt-1 pl-6">El envío se devuelve solo en reembolsos del pedido completo (puedes forzarlo manualmente).</div>
                      )}
                    </div>
                  )}
                </div>

                <label className="block text-xs text-ink-soft">Motivo del reembolso
                  <select className="input-eco mt-1" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} data-testid="refund-reason-select">
                    {reasons.length === 0 && <option value="">(Configura motivos en Reembolsos)</option>}
                    {reasons.map((r) => <option key={r.id} value={r.label}>{r.label}</option>)}
                  </select>
                </label>
                <div className="flex justify-between text-sm font-medium pt-2 border-t border-bone-200">
                  <span>Total a reembolsar</span>
                  <span data-testid="refund-total-preview">{formatEUR(refundTotal || 0)}</span>
                </div>
                {refundedTotal > 0 && (
                  <div className="text-[10px] text-ink-muted">Pendiente máximo: {formatEUR(remainingRefund)}</div>
                )}
                <button onClick={doRefund} disabled={refunding || !refundReason || (selectedLines.length === 0 && !shipChecked)} className="btn-primary w-full disabled:opacity-60" data-testid="refund-submit-btn">
                  {refunding ? "Procesando…" : `Reembolsar ${formatEUR(refundTotal || 0)} y avisar al cliente`}
                </button>
                <p className="text-[11px] text-ink-muted">Se intentará el reembolso automático (Stripe/PayPal) si el pedido se pagó online; en caso contrario quedará como reembolso manual. Se enviará un email al cliente.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
