import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Package, ShoppingBag, Heart, ArrowRight, LogOut, RotateCcw, FileText, X } from "lucide-react";
import { toast } from "sonner";
import { api, formatEUR } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function Account() {
  const { user, logout } = useAuth();
  const { count, openDrawer } = useCart();
  const [orders, setOrders] = useState([]);
  // Solicitud de reembolso (estilo WooCommerce: 1, varios o todos los productos)
  const [refundOrder, setRefundOrder] = useState(null);
  const [fullOrder, setFullOrder] = useState(true);
  const [refundSel, setRefundSel] = useState({}); // sku -> qty seleccionada (0 = no)
  const [refundReason, setRefundReason] = useState("");
  const [sendingRefund, setSendingRefund] = useState(false);
  const [invoiceSending, setInvoiceSending] = useState(null);

  const loadOrders = async () => {
    try {
      const { data } = await api.get("/orders/mine");
      setOrders(data);
    } catch {}
  };

  useEffect(() => { loadOrders(); }, []);

  const openRefundModal = (order) => {
    setRefundOrder(order);
    setFullOrder(true);
    setRefundSel({});
    setRefundReason("");
  };

  const toggleItem = (sku, maxQty) => {
    setRefundSel((prev) => {
      const next = { ...prev };
      if (next[sku]) delete next[sku];
      else next[sku] = maxQty;
      return next;
    });
  };

  const setItemQty = (sku, qty, maxQty) => {
    const q = Math.max(1, Math.min(Number(qty) || 1, maxQty));
    setRefundSel((prev) => ({ ...prev, [sku]: q }));
  };

  const submitRefundRequest = async () => {
    if (!refundOrder) return;
    const items = fullOrder
      ? null
      : Object.entries(refundSel).map(([sku, quantity]) => ({ sku, quantity }));
    if (!fullOrder && (!items || items.length === 0)) {
      toast.error("Selecciona al menos un producto");
      return;
    }
    setSendingRefund(true);
    try {
      await api.post(`/orders/${refundOrder.id}/refund-request`, {
        full_order: fullOrder,
        items,
        reason: refundReason.trim() || null,
      });
      toast.success("Solicitud enviada", {
        description: "EcoAndes revisará tu solicitud de reembolso y te contactará por email.",
      });
      setRefundOrder(null);
      loadOrders();
    } catch (e) {
      toast.error("No se pudo enviar la solicitud", { description: e?.response?.data?.detail });
    } finally { setSendingRefund(false); }
  };

  const requestInvoice = async (order) => {
    setInvoiceSending(order.id);
    try {
      await api.post(`/orders/${order.id}/invoice-request`);
      toast.success("Factura solicitada", {
        description: "Hemos avisado a EcoAndes. Recibirás tu factura por email.",
      });
      loadOrders();
    } catch (e) {
      toast.error("No se pudo solicitar la factura", { description: e?.response?.data?.detail });
    } finally { setInvoiceSending(null); }
  };

  const myProducts = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      (o.items || []).forEach((it) => {
        const key = `${it.product_id}:${it.variation_name || ""}`;
        const prev = map.get(key);
        if (prev) {
          prev.quantity += it.quantity;
          prev.last_ordered = o.created_at > prev.last_ordered ? o.created_at : prev.last_ordered;
        } else {
          map.set(key, { ...it, quantity: it.quantity, last_ordered: o.created_at });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => (b.last_ordered > a.last_ordered ? 1 : -1));
  }, [orders]);

  const totalOrders = orders.length;
  const totalSpent = orders.reduce((acc, o) => acc + (o.total || 0), 0);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-20 px-6 text-center">
        <p className="text-ink-soft">Debes iniciar sesión.</p>
        <Link to="/login" className="btn-outline mt-6 inline-block">Acceder</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-12 py-12 sm:py-14" data-testid="account-page">
      <div className="overline mb-3">Mi cuenta</div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-light">Hola, {user.first_name}</h1>
        <button
          onClick={logout}
          data-testid="account-logout-btn"
          className="inline-flex items-center gap-2 bg-terracotta text-white px-6 py-3 rounded-full text-[11px] uppercase tracking-[0.2em] font-medium shadow-md hover:bg-terracotta/90 hover:shadow-lg active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-2"
        >
          <LogOut size={15} /> Cerrar sesión
        </button>
      </div>
      <div className="flex items-center gap-3 mt-3 text-sm text-ink-soft flex-wrap">
        <span>{user.email}</span>
        <span>·</span>
        <span className="text-sage-700 uppercase tracking-[0.18em] text-xs">
          {user.role === "professional" ? "Cuenta B2B" : user.role === "admin" ? "Administrador" : "Retail"}
        </span>
      </div>

      {/* 3 tarjetas: Mis Productos · Mis Pedidos · Carrito */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mt-10" data-testid="account-quick-cards">
        <a href="#mis-productos" data-testid="account-card-products" className="group bg-white border border-bone-200 hover:border-sage-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div className="w-11 h-11 rounded-sm bg-sage-100 flex items-center justify-center text-sage-700">
              <Heart size={20} />
            </div>
            <span className="overline">Mis productos</span>
          </div>
          <div className="font-heading text-3xl font-light" data-testid="card-products-count">{myProducts.length}</div>
          <div className="text-sm text-ink-soft mt-1">Productos comprados al menos una vez</div>
          <div className="mt-auto pt-5 text-xs uppercase tracking-[0.2em] text-sage-700 inline-flex items-center gap-2 group-hover:gap-3 transition-all">
            Ver listado <ArrowRight size={12} />
          </div>
        </a>
        <a href="#mis-pedidos" data-testid="account-card-orders" className="group bg-white border border-bone-200 hover:border-sage-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all p-6 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div className="w-11 h-11 rounded-sm bg-sage-100 flex items-center justify-center text-sage-700">
              <Package size={20} />
            </div>
            <span className="overline">Mis pedidos</span>
          </div>
          <div className="font-heading text-3xl font-light" data-testid="card-orders-count">{totalOrders}</div>
          <div className="text-sm text-ink-soft mt-1">Total invertido: {formatEUR(totalSpent)}</div>
          <div className="mt-auto pt-5 text-xs uppercase tracking-[0.2em] text-sage-700 inline-flex items-center gap-2 group-hover:gap-3 transition-all">
            Ver pedidos <ArrowRight size={12} />
          </div>
        </a>
        <button
          type="button"
          onClick={openDrawer}
          data-testid="account-card-cart"
          className="text-left group bg-white border border-bone-200 hover:border-sage-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all p-6 flex flex-col"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="w-11 h-11 rounded-sm bg-sage-100 flex items-center justify-center text-sage-700">
              <ShoppingBag size={20} />
            </div>
            <span className="overline">Carrito</span>
          </div>
          <div className="font-heading text-3xl font-light" data-testid="card-cart-count">{count}</div>
          <div className="text-sm text-ink-soft mt-1">{count === 0 ? "Sin productos en cesta" : "Productos en tu cesta"}</div>
          <div className="mt-auto pt-5 text-xs uppercase tracking-[0.2em] text-sage-700 inline-flex items-center gap-2 group-hover:gap-3 transition-all">
            Abrir cesta <ArrowRight size={12} />
          </div>
        </button>
      </div>

      {/* Mis productos */}
      <section id="mis-productos" className="mt-16" data-testid="account-products-section">
        <div className="flex items-end justify-between mb-5 gap-3">
          <h2 className="font-heading text-2xl sm:text-3xl font-light">Mis productos comprados</h2>
          <Link to="/tienda" className="text-xs uppercase tracking-[0.2em] text-sage-700 whitespace-nowrap">Seguir comprando →</Link>
        </div>
        {myProducts.length === 0 ? (
          <div className="bg-white border border-bone-200 p-8 text-ink-soft text-sm text-center">
            Aún no has comprado productos. <Link to="/tienda" className="text-sage-700">Descubre el catálogo</Link>.
          </div>
        ) : (
          <div className="bg-white border border-bone-200 divide-y divide-bone-100">
            {myProducts.map((it, i) => (
              <div key={i} className="p-4 sm:p-5 flex gap-4 items-center" data-testid={`my-product-${it.sku}`}>
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-bone-100 overflow-hidden shrink-0">
                  {it.image_url && <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm sm:text-base text-ink truncate">{it.name}</div>
                  <div className="text-xs text-ink-soft">
                    {it.variation_name && <span>{it.variation_name} · </span>}
                    SKU {it.sku}
                  </div>
                  <div className="text-xs text-ink-muted mt-1">Comprado {it.quantity} {it.quantity === 1 ? "vez" : "veces"} · último pedido {new Date(it.last_ordered).toLocaleDateString("es-ES")}</div>
                </div>
                <div className="hidden sm:block text-sm text-ink-soft">{formatEUR(it.unit_price)}</div>
                <Link to={`/tienda?q=${encodeURIComponent(it.name)}`} className="btn-outline py-2.5 px-4 text-[10px] hidden md:inline-block whitespace-nowrap">
                  Volver a comprar
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Mis pedidos */}
      <section id="mis-pedidos" className="mt-16" data-testid="account-orders-section">
        <h2 className="font-heading text-2xl sm:text-3xl font-light mb-5">Tus pedidos</h2>
        {orders.length === 0 ? (
          <div className="bg-white border border-bone-200 p-8 text-ink-soft text-sm text-center">Aún no tienes pedidos.</div>
        ) : (
          <div className="space-y-4" data-testid="account-orders-list">
            {orders.map((o) => {
              const refundPending = (o.refund_request || {}).status === "pending";
              const invoicePending = (o.invoice_request || {}).status === "pending";
              const canRequestRefund = !["Cancelado", "Reembolsado", "Pendiente portes"].includes(o.status) && !refundPending;
              return (
                <div key={o.id} className="bg-white border border-bone-200 p-5" data-testid={`account-order-${o.order_number}`}>
                  <div className="flex flex-wrap items-center gap-5 justify-between">
                    <div>
                      <div className="text-xs text-ink-soft uppercase tracking-[0.18em]">{new Date(o.created_at).toLocaleDateString("es-ES")}</div>
                      <div className="font-heading text-lg mt-1">Pedido {o.order_number}</div>
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div><div className="text-ink-soft text-xs">Total</div><div>{formatEUR(o.total)}</div></div>
                      <div>
                        <div className="text-ink-soft text-xs">Estado</div>
                        <div className="text-sage-700">
                          {o.status}
                          {o.partially_refunded && o.status !== "Reembolsado" && (
                            <span className="ml-1.5 text-[10px] uppercase tracking-wide text-terracotta">· Reembolso parcial</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-bone-100 flex flex-wrap items-center gap-2.5">
                    {canRequestRefund && (
                      <button
                        onClick={() => openRefundModal(o)}
                        data-testid={`order-refund-request-btn-${o.order_number}`}
                        className="inline-flex items-center gap-1.5 border border-bone-300 text-ink-soft hover:border-terracotta hover:text-terracotta px-4 py-2 rounded-full text-[10px] uppercase tracking-[0.16em] font-medium transition-colors duration-200"
                      >
                        <RotateCcw size={13} /> Solicitar reembolso
                      </button>
                    )}
                    {refundPending && (
                      <span className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-300 text-amber-800 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.14em]" data-testid={`order-refund-pending-${o.order_number}`}>
                        <RotateCcw size={12} /> Reembolso solicitado · en revisión
                      </span>
                    )}
                    {(user.role === "professional" || user.role === "admin") && (
                      invoicePending ? (
                        <span className="inline-flex items-center gap-1.5 bg-sage-50 border border-sage-200 text-sage-700 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-[0.14em]" data-testid={`order-invoice-pending-${o.order_number}`}>
                          <FileText size={12} /> Factura solicitada
                        </span>
                      ) : (
                        <button
                          onClick={() => requestInvoice(o)}
                          disabled={invoiceSending === o.id}
                          data-testid={`order-invoice-request-btn-${o.order_number}`}
                          className="inline-flex items-center gap-1.5 border border-sage-500 text-sage-700 hover:bg-sage-500 hover:text-white px-4 py-2 rounded-full text-[10px] uppercase tracking-[0.16em] font-medium transition-colors duration-200 disabled:opacity-60"
                        >
                          <FileText size={13} /> {invoiceSending === o.id ? "Enviando…" : "Solicitar Factura"}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-14">
        <button
          onClick={logout}
          data-testid="account-logout-btn-bottom"
          className="inline-flex items-center gap-2 border border-terracotta text-terracotta px-6 py-3 rounded-full text-[11px] uppercase tracking-[0.2em] font-medium hover:bg-terracotta hover:text-white active:scale-[0.98] transition-all duration-200"
        >
          <LogOut size={15} /> Cerrar sesión
        </button>
      </div>

      {/* Modal: solicitar reembolso (1, varios o todos los productos) */}
      {refundOrder && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6" data-testid="refund-request-modal">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={() => setRefundOrder(null)} />
          <div className="relative bg-white w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-heading text-xl font-light">Solicitar reembolso</h3>
                <div className="text-xs text-ink-soft mt-1">Pedido {refundOrder.order_number} · {formatEUR(refundOrder.total)}</div>
              </div>
              <button onClick={() => setRefundOrder(null)} className="text-ink-soft hover:text-ink" data-testid="refund-request-close" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <label className="mt-5 flex items-center gap-2.5 text-sm cursor-pointer" data-testid="refund-request-full-toggle">
              <input
                type="checkbox"
                className="accent-sage-600 h-4 w-4"
                checked={fullOrder}
                onChange={(e) => setFullOrder(e.target.checked)}
              />
              Reembolso de todo el pedido
            </label>

            {!fullOrder && (
              <div className="mt-4 border border-bone-200 rounded-sm divide-y divide-bone-100" data-testid="refund-request-items">
                {(refundOrder.items || []).map((it) => {
                  const selected = refundSel[it.sku] != null;
                  return (
                    <div key={it.sku} className="p-3 flex items-center gap-3">
                      <input
                        type="checkbox"
                        className="accent-sage-600 h-4 w-4 shrink-0"
                        checked={selected}
                        onChange={() => toggleItem(it.sku, it.quantity)}
                        data-testid={`refund-request-item-${it.sku}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-ink truncate">{it.name}</div>
                        <div className="text-xs text-ink-soft">{it.variation_name ? `${it.variation_name} · ` : ""}{formatEUR(it.unit_price)} × {it.quantity}</div>
                      </div>
                      {selected && it.quantity > 1 && (
                        <label className="text-xs text-ink-soft flex items-center gap-1.5">
                          Uds.
                          <input
                            type="number"
                            min={1}
                            max={it.quantity}
                            value={refundSel[it.sku]}
                            onChange={(e) => setItemQty(it.sku, e.target.value, it.quantity)}
                            className="input-eco w-16 py-1.5 text-center"
                            data-testid={`refund-request-qty-${it.sku}`}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <textarea
              className="input-eco w-full min-h-[80px] mt-4"
              placeholder="Cuéntanos el motivo (opcional): producto dañado, error en el pedido…"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              maxLength={1000}
              data-testid="refund-request-reason"
            />
            <p className="text-[11px] text-ink-muted mt-2 leading-relaxed">
              Tu solicitud llegará a EcoAndes para su revisión. Si se aprueba, el reembolso se realizará
              por el mismo método de pago. El coste de envío solo se devuelve en reembolsos del pedido completo.
            </p>
            <button
              onClick={submitRefundRequest}
              disabled={sendingRefund}
              className="btn-primary w-full mt-4 disabled:opacity-60"
              data-testid="refund-request-submit"
            >
              {sendingRefund ? "Enviando…" : "Enviar solicitud de reembolso"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
