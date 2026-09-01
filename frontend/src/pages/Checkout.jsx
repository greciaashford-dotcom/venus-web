import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { Truck, Store, Tag, X, Sparkles } from "lucide-react";
import { api, formatEUR } from "../lib/api";
import { getAcquisition } from "../lib/tracking";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { STORE } from "../data/storeInfo";
import { buildCartSnapshot, rememberGuestEmail } from "../components/CartTracker";
import { isSpain, isValidSpanishPostalCode, provinceForPostalCode } from "../lib/esPostal";
// Logos de medios de pago (SVG inline, sin peticiones externas)
const CardLogos = () => (
  <span className="inline-flex items-center gap-1.5 align-middle" data-testid="card-logos">
    <svg viewBox="0 0 38 24" className="h-5 w-8 rounded-[3px] border border-bone-200 bg-white" aria-label="Visa" role="img">
      <text x="19" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fontStyle="italic" fill="#1A1F71" fontFamily="Arial, sans-serif">VISA</text>
    </svg>
    <svg viewBox="0 0 38 24" className="h-5 w-8 rounded-[3px] border border-bone-200 bg-white" aria-label="MasterCard" role="img">
      <circle cx="15.5" cy="12" r="7" fill="#EB001B" />
      <circle cx="22.5" cy="12" r="7" fill="#F79E1B" fillOpacity="0.92" />
    </svg>
    <svg viewBox="0 0 38 24" className="h-5 w-8 rounded-[3px]" aria-label="American Express" role="img">
      <rect width="38" height="24" rx="3" fill="#2E77BC" />
      <text x="19" y="15.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#FFFFFF" fontFamily="Arial, sans-serif">AMEX</text>
    </svg>
  </span>
);

const PaypalLogo = () => (
  <svg viewBox="0 0 44 24" className="h-5 w-9 rounded-[3px] border border-bone-200 bg-white align-middle" aria-label="PayPal" role="img" data-testid="paypal-logo">
    <text x="22" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fontStyle="italic" fontFamily="Arial, sans-serif">
      <tspan fill="#003087">Pay</tspan><tspan fill="#009CDE">Pal</tspan>
    </text>
  </svg>
);

export default function Checkout() {
  const { items, subtotal, subtotalExVat, subtotalWithVat, vatAmount, totalWeightKg, hasBulk, bulkWeightKg, clearCart } = useCart();
  const { user } = useAuth();
  const nav = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [shipping, setShipping] = useState(null);
  const [method, setMethod] = useState("stripe");
  const [delivery, setDelivery] = useState("shipping");
  const [coupon, setCoupon] = useState("");
  const [couponState, setCouponState] = useState({ applied: false, discount: 0, message: "", checking: false });
  const [form, setForm] = useState({
    email: user?.email || "",
    full_name: user ? `${user.first_name} ${user.last_name}` : "",
    phone: user?.phone || "",
    street: "",
    city: "",
    province: "",
    postal_code: "",
    country: "España",
    notes: "",
  });

  // Solo profesionales VERIFICADOS compran con condiciones B2B (precios/envío/pagos)
  const isVerifiedPro = !!user && user.role === "professional" && user.approved !== false;
  const customerType = isVerifiedPro ? "professional" : "retail";
  const isPickup = delivery === "pickup";
  const isPro = customerType === "professional";

  // Recuperación de carritos: en cuanto un invitado escribe un email válido,
  // se guarda y se envía un snapshot del carrito con ese email (debounce).
  useEffect(() => {
    const em = (form.email || "").trim();
    if (!em || !/\S+@\S+\.\S+/.test(em) || items.length === 0) return undefined;
    const t = setTimeout(() => {
      rememberGuestEmail(em);
      api.post("/cart/track", buildCartSnapshot(items, subtotal, em.toLowerCase())).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [form.email, items, subtotal]);

  useEffect(() => {
    if (items.length === 0) return undefined;
    let active = true;
    if (isPickup) {
      setShipping({ shipping_cost: 0, total: subtotalWithVat, free_shipping: true, status: "ok", method: "pickup" });
      return () => { active = false; };
    }
    api
      .post("/orders/shipping-quote", {
        customer_type: customerType,
        country: form.country,
        postal_code: form.postal_code,
        subtotal_with_vat: subtotalWithVat,
        subtotal_ex_vat: subtotalExVat,
        total_weight_kg: totalWeightKg,
        has_bulk: hasBulk,
        bulk_weight_kg: bulkWeightKg,
      })
      .then((r) => { if (active) setShipping(r.data); })
      .catch(() => {});
    return () => { active = false; };
  }, [subtotalWithVat, subtotalExVat, totalWeightKg, hasBulk, bulkWeightKg, customerType, items.length, isPickup, form.country, form.postal_code]);

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Verificación de dirección: autocompletar provincia desde el CP (coherencia CP↔provincia)
  // y resetear el estado de verificación cuando cambia cualquier campo de la dirección.
  const [addressWarn, setAddressWarn] = useState(null); // null | "warn"
  useEffect(() => {
    const prov = provinceForPostalCode(form.postal_code, form.country);
    if (prov && form.province !== prov) {
      setForm((f) => ({ ...f, province: prov }));
    }
    setAddressWarn(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.postal_code, form.country, form.street, form.city]);

  // If pickup is chosen, offline methods (transfer / domiciliación) do not apply -> reset to card.
  const selectDelivery = (v) => {
    setDelivery(v);
    if (v === "pickup" && (method === "transfer" || method === "other")) setMethod("stripe");
  };

  // Offline methods are exclusive to verified professionals
  useEffect(() => {
    if (!isVerifiedPro && (method === "transfer" || method === "other")) setMethod("stripe");
  }, [isVerifiedPro, method]);

  const applyCoupon = async () => {
    const code = coupon.trim();
    if (!code) return;
    if (!form.email) {
      toast.error("Introduce tu email primero", { description: "El cupón es válido solo en tu primer pedido." });
      return;
    }
    setCouponState((s) => ({ ...s, checking: true }));
    try {
      const { data } = await api.post("/orders/validate-coupon", {
        code,
        email: form.email,
        subtotal: couponBasis,
        customer_type: customerType,
      });
      if (data.valid) {
        setCouponState({ applied: true, discount: data.discount, message: data.message, checking: false });
        toast.success(data.message);
      } else {
        setCouponState({ applied: false, discount: 0, message: data.message, checking: false });
        toast.error(data.message);
      }
    } catch (err) {
      setCouponState({ applied: false, discount: 0, message: "No se pudo validar el cupón.", checking: false });
      toast.error("No se pudo validar el cupón.");
    }
  };

  const removeCoupon = () => {
    setCoupon("");
    setCouponState({ applied: false, discount: 0, message: "", checking: false });
  };

  const couponBasis = isPro ? subtotalExVat : subtotalWithVat;
  const discount = couponState.applied ? couponState.discount : 0;
  const isBlocked = shipping?.status === "blocked";
  const isManual = shipping?.status === "manual_quote";
  const isManualQuote = isManual && !isPickup;
  const shippingCost = shipping && typeof shipping.shipping_cost === "number" ? shipping.shipping_cost : 0;
  const grandTotal = Math.max(0, subtotalWithVat + shippingCost - discount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) return;
    if (!isPickup && isBlocked) {
      toast.error("Envío no disponible", { description: shipping?.message || "No realizamos envíos a tu zona." });
      return;
    }
    // Validación de dirección (datos verídicos)
    if (!isPickup) {
      if (isSpain(form.country) && !isValidSpanishPostalCode(form.postal_code)) {
        toast.error("Código postal no válido", { description: "Introduce un código postal español de 5 dígitos (01–52)." });
        return;
      }
      const phoneDigits = (form.phone || "").replace(/\D/g, "");
      if (phoneDigits.length < 9) {
        toast.error("Teléfono no válido", { description: "Introduce un teléfono de contacto válido (mínimo 9 dígitos)." });
        return;
      }
      if ((form.street || "").trim().length < 5) {
        toast.error("Dirección incompleta", { description: "Introduce la calle y el número completos." });
        return;
      }
    }
    setSubmitting(true);
    try {
      // Verificación 'soft' de la dirección (OpenStreetMap). Si no se encuentra,
      // avisamos y pedimos una segunda confirmación; nunca bloquea si el servicio falla.
      if (!isPickup && addressWarn !== "warn") {
        try {
          const { data: ver } = await api.get("/orders/verify-address", {
            params: { street: form.street, city: form.city, postal_code: form.postal_code, country: form.country },
          });
          if (ver?.found === false) {
            setAddressWarn("warn");
            toast.warning("No hemos podido verificar tu dirección", {
              description: "Revisa calle, ciudad y código postal. Si es correcta, pulsa de nuevo el botón para confirmarla.",
            });
            return;
          }
        } catch { /* servicio no disponible: continuar */ }
      }
      const shipping_address = isPickup
        ? {
            full_name: form.full_name,
            phone: form.phone,
            street: `${STORE.market} · ${STORE.addressLine1}`,
            city: "Madrid",
            province: "Madrid",
            postal_code: "28004",
            country: "España",
            notes: form.notes ? `Recogida en tienda · ${form.notes}` : "Recogida en tienda",
          }
        : {
            full_name: form.full_name,
            phone: form.phone,
            street: form.street,
            city: form.city,
            province: form.province,
            postal_code: form.postal_code,
            country: form.country,
            notes: form.notes,
          };
      const payload = {
        email: form.email,
        items: items.map((i) => ({
          product_id: i.product_id,
          sku: i.sku,
          name: i.name,
          variation_name: i.variation_name,
          unit_price: i.unit_price,
          quantity: i.quantity,
          image_url: i.image_url,
        })),
        shipping_address,
        customer_type: customerType,
        payment_method: isManualQuote ? "pending_quote" : method,
        delivery_method: delivery,
        coupon_code: couponState.applied ? coupon.trim() : null,
        acquisition: getAcquisition(),
      };
      const { data: order } = await api.post("/orders", payload);

      if (isManualQuote) {
        // Canarias / fuera de península: pedido registrado SIN pago, pendiente de presupuesto de portes
        clearCart();
        toast.success("Pedido registrado", {
          description: "Calcularemos los portes y te enviaremos un correo con el importe total para realizar el pago.",
        });
        nav(`/pago/success?order_number=${order.order_number}&quote=1`);
        return;
      }
      if (method === "stripe") {
        const { data: sess } = await api.post("/payments/stripe/checkout", {
          order_id: order.id,
          origin_url: window.location.origin,
        });
        clearCart();
        window.location.href = sess.url;
        return;
      }
      if (method === "paypal") {
        const { data: pp } = await api.post("/payments/paypal/create", {
          order_id: order.id,
          origin_url: window.location.origin,
        });
        clearCart();
        window.location.href = pp.approve_url;
        return;
      }
      // offline methods: transfer / domiciliación-confirming
      clearCart();
      const offlineMsg = method === "other"
        ? "Nos pondremos en contacto contigo para gestionar el pago acordado (confirming)."
        : "Te hemos enviado las instrucciones de transferencia por email.";
      toast.success("Pedido registrado", { description: offlineMsg });
      nav(`/pago/success?order_number=${order.order_number}&offline=1&method=${method}`);
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message;
      toast.error("No se pudo crear el pedido", { description: String(msg) });
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-6 text-center" data-testid="checkout-empty">
        <div className="overline mb-3">Checkout</div>
        <h1 className="font-heading text-3xl font-light">Tu cesta está vacía</h1>
        <p className="mt-3 text-ink-soft">Descubre el catálogo y vuelve al checkout cuando tengas productos.</p>
        <button className="btn-primary mt-8" onClick={() => nav("/tienda")} data-testid="checkout-empty-shop-btn">Ir a la tienda</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-12 py-14" data-testid="checkout-page">
      <div className="overline mb-3">Finalizar compra</div>
      <h1 className="font-heading text-4xl font-light text-ink">Checkout</h1>
      {customerType === "professional" && (
        <div className="mt-4 inline-block px-4 py-1.5 text-xs uppercase tracking-[0.2em] bg-sage-100 text-sage-700 rounded-sm" data-testid="pro-badge">
          Cuenta profesional B2B
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-10 grid grid-cols-1 lg:grid-cols-5 gap-10">
        <div className="lg:col-span-3 space-y-8">
          <section>
            <h2 className="font-heading text-xl font-normal mb-5">Contacto</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input className="input-eco md:col-span-2" type="email" placeholder="Email" required value={form.email} onChange={onChange("email")} data-testid="checkout-email" />
              <input className="input-eco" placeholder="Nombre y apellidos" required value={form.full_name} onChange={onChange("full_name")} data-testid="checkout-name" />
              <input className="input-eco" placeholder="Teléfono" value={form.phone} onChange={onChange("phone")} data-testid="checkout-phone" />
            </div>
          </section>

          <section>
            <h2 className="font-heading text-xl font-normal mb-5">Método de entrega</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="delivery-methods">
              {[
                { v: "shipping", label: "Envío a domicilio", desc: "Recíbelo en tu dirección.", Icon: Truck },
                { v: "pickup", label: "Recoger en tienda", desc: "Paga ahora y recoge en la tienda. Sin gastos de envío.", Icon: Store },
              ].map((d) => (
                <label
                  key={d.v}
                  className={`flex items-start gap-3 p-4 border cursor-pointer rounded-sm transition ${
                    delivery === d.v ? "border-sage-500 bg-sage-50" : "border-bone-200 hover:border-sage-300"
                  }`}
                  data-testid={`dm-${d.v}`}
                >
                  <input type="radio" name="delivery" checked={delivery === d.v} onChange={() => selectDelivery(d.v)} className="mt-1 accent-sage-500" />
                  <div>
                    <div className="text-sm text-ink font-medium flex items-center gap-2"><d.Icon size={15} className="text-sage-600" /> {d.label}</div>
                    <div className="text-xs text-ink-soft mt-1">{d.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {!isPickup ? (
            <section>
              <h2 className="font-heading text-xl font-normal mb-5">Dirección de envío</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input className="input-eco md:col-span-2" placeholder="Calle y número" required value={form.street} onChange={onChange("street")} data-testid="checkout-street" />
                <input className="input-eco" placeholder="Código postal" required value={form.postal_code} onChange={onChange("postal_code")} data-testid="checkout-postal" />
                <input className="input-eco" placeholder="Ciudad" required value={form.city} onChange={onChange("city")} data-testid="checkout-city" />
                <input className="input-eco" placeholder="Provincia" required value={form.province} onChange={onChange("province")} data-testid="checkout-province" />
                <input className="input-eco" placeholder="País" value={form.country} onChange={onChange("country")} data-testid="checkout-country" />
                <textarea className="input-eco md:col-span-2" placeholder="Notas para el envío (opcional)" value={form.notes} onChange={onChange("notes")} data-testid="checkout-notes" />
              </div>
              {addressWarn === "warn" && (
                <div className="mt-3 text-xs bg-amber-50 border border-amber-300 text-amber-800 rounded-sm px-3 py-2.5 leading-relaxed" data-testid="address-warning">
                  ⚠️ No hemos podido verificar esta dirección. Revisa la calle, ciudad y código postal;
                  si estás seguro de que es correcta, pulsa de nuevo el botón de confirmar pedido.
                </div>
              )}
            </section>
          ) : (
            <section>
              <h2 className="font-heading text-xl font-normal mb-5">Punto de recogida</h2>
              <div className="border border-sage-200 bg-sage-50 p-5 rounded-sm flex items-start gap-3" data-testid="pickup-store-card">
                <Store size={20} className="text-sage-600 shrink-0 mt-0.5" />
                <div className="text-sm text-ink leading-relaxed">
                  <div className="font-medium">{STORE.name} · {STORE.market}</div>
                  {STORE.addressLine1}<br />
                  {STORE.addressLine2}<br />
                  {STORE.addressLine3}
                  <div className="text-xs text-ink-soft mt-2">Te avisaremos cuando tu pedido esté listo para recoger.</div>
                </div>
              </div>
              <textarea className="input-eco mt-4" placeholder="Notas para la recogida (opcional)" value={form.notes} onChange={onChange("notes")} data-testid="checkout-pickup-notes" />
            </section>
          )}

          <section>
            <h2 className="font-heading text-xl font-normal mb-5">Método de pago</h2>
            {isManualQuote ? (
              <div className="border border-terracotta/40 bg-terracotta/5 rounded-xl p-5" data-testid="manual-quote-notice">
                <div className="text-sm text-ink font-medium">Portes pendientes de presupuesto</div>
                <p className="text-xs text-ink-soft mt-2 leading-relaxed">
                  {shipping?.message || "Los portes para Canarias y destinos fuera de la península se calculan según peso, volumen y destino."}
                </p>
                <p className="text-xs text-ink-soft mt-2 leading-relaxed">
                  Tu pedido se registrará <strong>sin pago</strong>. Nuestra administración lo revisará y te
                  enviaremos un correo con el importe total (portes incluidos) para que realices el pago.
                </p>
              </div>
            ) : (
            <div className="space-y-3" data-testid="payment-methods">
              {[
                { v: "stripe", label: "Pago con Tarjeta", desc: "Pago seguro con tarjeta Visa, MasterCard o American Express.", logos: <CardLogos /> },
                { v: "paypal", label: "PayPal", desc: "Finaliza con tu cuenta PayPal.", logos: <PaypalLogo /> },
                isVerifiedPro && !isPickup && { v: "transfer", label: "Transferencia bancaria", desc: "Recibirás nuestras instrucciones por email para realizar la transferencia." },
                isVerifiedPro && !isPickup && { v: "other", label: "Otro (Confirming, solo para clientes que llegan a un acuerdo con EcoAndes)", desc: "Nos pondremos en contacto contigo para gestionar el pago acordado." },
              ].filter(Boolean).map((m) => (
                <label
                  key={m.v}
                  className={`flex items-start gap-4 p-4 border cursor-pointer rounded-xl transition-colors duration-200 ${
                    method === m.v ? "border-sage-500 bg-sage-50" : "border-bone-200 hover:border-sage-300"
                  }`}
                  data-testid={`pm-${m.v}`}
                >
                  <input type="radio" name="method" checked={method === m.v} onChange={() => setMethod(m.v)} className="mt-1 accent-sage-500" />
                  <div>
                    <div className="text-sm text-ink font-medium flex items-center gap-2 flex-wrap">
                      {m.label}
                      {m.logos}
                    </div>
                    <div className="text-xs text-ink-soft mt-1">{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            )}
          </section>
        </div>

        <aside className="lg:col-span-2 h-fit bg-white border border-bone-200 p-6 lg:sticky lg:top-24" data-testid="checkout-summary">
          <h3 className="font-heading text-xl font-normal mb-5">Resumen del pedido</h3>
          <ul className="space-y-3 mb-5 max-h-72 overflow-y-auto eco-scroll pr-2">
            {items.map((it, i) => (
              <li key={i} className="flex gap-3 items-start">
                <div className="w-12 h-12 bg-bone-100 overflow-hidden shrink-0">
                  {it.image_url && <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 text-xs">
                  <div className="text-ink">{it.name}</div>
                  {it.variation_name && <div className="text-ink-soft">{it.variation_name}</div>}
                  <div className="text-ink-soft">{it.quantity} × {formatEUR(it.unit_price)}</div>
                </div>
                <div className="text-xs text-ink">{formatEUR(it.unit_price * it.quantity)}</div>
              </li>
            ))}
          </ul>
          <div className="border-t border-bone-200 pt-4 space-y-2 text-sm">
            {isPro ? (
              <>
                <div className="flex justify-between"><span className="text-ink-soft">Base imponible (sin IVA)</span><span data-testid="summary-subtotal-exvat">{formatEUR(subtotalExVat)}</span></div>
                <div className="flex justify-between"><span className="text-ink-soft">IVA</span><span data-testid="summary-vat">{formatEUR(vatAmount)}</span></div>
              </>
            ) : (
              <div className="flex justify-between"><span className="text-ink-soft">Subtotal <span className="text-[10px] text-ink-muted">(IVA incl.)</span></span><span data-testid="summary-subtotal">{formatEUR(subtotalWithVat)}</span></div>
            )}
            <div className="flex justify-between">
              <span className="text-ink-soft">
                {isPickup ? "Recogida en tienda" : "Envío"}
                {!isPickup && shippingCost > 0 && <span className="text-[10px] text-ink-muted"> (IVA 21% incl.)</span>}
              </span>
              <span data-testid="summary-shipping">
                {!shipping ? "…" : isBlocked ? "No disponible" : isManual ? "A presupuestar" : shipping.free_shipping ? "Gratis" : formatEUR(shippingCost)}
              </span>
            </div>
            {!isPickup && shipping && typeof shipping.shipping_cost_ex_vat === "number" && shipping.shipping_cost_ex_vat > 0 && (
              <div className="text-[11px] text-ink-muted" data-testid="summary-shipping-vat">
                Portes: {formatEUR(shipping.shipping_cost_ex_vat)} + IVA 21% ({formatEUR(shipping.shipping_vat)})
              </div>
            )}
            {!isPickup && shipping && shipping.weight_tier && (
              <div className="text-[11px] text-ink-muted" data-testid="summary-weight-tier">
                Tramo {shipping.weight_tier.from_kg}–{shipping.weight_tier.to_kg ?? "+"} kg ·{" "}
                {shipping.bulk_only_shipping
                  ? `peso a granel ${(shipping.charged_weight_kg ?? bulkWeightKg).toFixed(2)} kg`
                  : `peso total ${totalWeightKg.toFixed(2)} kg`}
              </div>
            )}
            {!isPickup && shipping?.bulk_only_shipping && (
              <div className="text-[11px] text-sage-700" data-testid="summary-bulk-note">
                Portes gratuitos en formatos de hasta 1 kg. Los formatos a granel (más de 1 kg) llevan portes según su peso.
              </div>
            )}
            {!isPickup && shipping && !shipping.free_shipping && shipping.remaining_for_free_shipping > 0 && !isBlocked && !isManual && (
              <div className="text-[11px] text-sage-700" data-testid="summary-free-remaining">
                {isPro
                  ? `Te faltan ${formatEUR(shipping.remaining_for_free_shipping)} (base imponible) para portes gratuitos`
                  : `Te faltan ${formatEUR(shipping.remaining_for_free_shipping)} para el envío gratis`}
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-sage-700" data-testid="summary-discount-row">
                <span className="flex items-center gap-1.5"><Tag size={13} /> Cupón {coupon.trim().toUpperCase()}</span>
                <span data-testid="summary-discount">-{formatEUR(discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium text-base pt-3 border-t border-bone-200">
              <span>Total {isManual && <span className="text-[10px] text-ink-muted">(sin portes)</span>}</span>
              <span data-testid="summary-total">{formatEUR(grandTotal)}</span>
            </div>
            {isManualQuote && (
              <p className="text-[11px] text-terracotta" data-testid="summary-manual-note">
                Portes pendientes de presupuesto (peso, volumen y destino). Te enviaremos un correo con el total para realizar el pago.
              </p>
            )}
            {isBlocked && !isPickup && (
              <p className="text-[11px] text-terracotta" data-testid="summary-blocked-note">{shipping?.message}</p>
            )}
          </div>

          {/* Coupon */}
          <div className="mt-5 pt-5 border-t border-bone-200" data-testid="coupon-block">
            <label className="text-xs uppercase tracking-[0.16em] text-ink-soft">Cupón de descuento</label>
            {couponState.applied ? (
              <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-sage-50 border border-sage-200 px-3 py-2.5" data-testid="coupon-applied">
                <span className="text-sm text-sage-700 flex items-center gap-2"><Tag size={14} /> {coupon.trim().toUpperCase()} aplicado</span>
                <button type="button" onClick={removeCoupon} className="text-ink-muted hover:text-terracotta" aria-label="Quitar cupón" data-testid="coupon-remove"><X size={15} /></button>
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <input
                  className="input-eco flex-1"
                  placeholder="Ej. ECOBONUS"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }}
                  data-testid="coupon-input"
                />
                <button type="button" onClick={applyCoupon} disabled={couponState.checking} className="btn-outline shrink-0 disabled:opacity-60" data-testid="coupon-apply">
                  {couponState.checking ? "..." : "Aplicar"}
                </button>
              </div>
            )}
            {!couponState.applied && couponState.message && (
              <p className="mt-2 text-xs text-terracotta" data-testid="coupon-error">{couponState.message}</p>
            )}
            <p className="mt-2 text-[11px] text-ink-muted">Cupón <strong>ECOBONUS</strong>: 5€ de descuento en tu primer pedido (mínimo 60€).</p>
          </div>

          {!user && (
            <div className="mt-5 rounded-md bg-bone-50 border border-bone-300 px-4 py-3 flex items-start gap-2.5" data-testid="register-hint">
              <Sparkles size={16} className="text-sage-600 shrink-0 mt-0.5" />
              <div className="text-xs text-ink-soft leading-relaxed">
                Puedes comprar sin registrarte. Pero si <Link to="/registro" className="text-sage-700 font-medium hover:underline">creas una cuenta</Link> accedes a beneficios: historial de pedidos, ofertas y proceso más rápido.
              </div>
            </div>
          )}
          <button type="submit" disabled={submitting || (!isPickup && isBlocked)} className="btn-primary w-full mt-6 disabled:opacity-50 disabled:pointer-events-none" data-testid="checkout-submit">
            {submitting
              ? "Procesando..."
              : (!isPickup && isBlocked)
              ? "Envío no disponible"
              : isManualQuote
              ? "Confirmar pedido (portes a presupuestar)"
              : "Pagar y confirmar pedido"}
          </button>
        </aside>
      </form>
    </div>
  );
}
