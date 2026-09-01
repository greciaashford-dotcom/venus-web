import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, formatEUR } from "../lib/api";

export default function PaymentSuccess() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const orderNumber = params.get("order_number");
  const provider = params.get("provider");
  const offline = params.get("offline") || params.get("transfer");
  const isQuote = params.get("quote") === "1";
  const payMethod = params.get("method") || "transfer";
  const [status, setStatus] = useState("checking");
  const [order, setOrder] = useState(null);

  useEffect(() => {
    let attempts = 0;
    let active = true;
    const poll = async () => {
      if (!active) return;
      try {
        if (sessionId && !provider) {
          const { data } = await api.get(`/payments/stripe/status/${sessionId}`);
          setOrder(data.order || null);
          if (data.payment_status === "paid" || data.status === "complete") {
            setStatus("success");
            return;
          }
        } else if (orderNumber) {
          const { data } = await api.get(`/orders/by-number/${orderNumber}`);
          setOrder(data);
          if (isQuote) {
            setStatus("quote");
            return;
          }
          if (data.payment_status === "paid" || offline) {
            setStatus(offline ? "transfer" : "success");
            return;
          }
        }
      } catch {}
      attempts += 1;
      if (attempts >= 6) {
        setStatus("pending");
        return;
      }
      setTimeout(poll, 2000);
    };
    poll();
    return () => { active = false; };
  }, [sessionId, orderNumber, provider, offline, isQuote]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center" data-testid="payment-success-page">
      <div className="overline mb-3">{t("paymentSuccess.overline")}</div>
      {status === "success" && (
        <>
          <h1 className="font-heading text-4xl font-light text-sage-700" data-testid="payment-success-title">{t("paymentSuccess.successTitle")}</h1>
          <p className="mt-4 text-ink-soft">{t("paymentSuccess.successDesc")}</p>
        </>
      )}
      {status === "pending" && (
        <>
          <h1 className="font-heading text-4xl font-light text-ink">{t("paymentSuccess.pendingTitle")}</h1>
          <p className="mt-4 text-ink-soft">{t("paymentSuccess.pendingDesc")}</p>
        </>
      )}
      {status === "checking" && (
        <>
          <h1 className="font-heading text-4xl font-light text-ink">{t("paymentSuccess.checkingTitle")}</h1>
          <p className="mt-4 text-ink-soft">{t("paymentSuccess.checkingDesc")}</p>
        </>
      )}
      {status === "transfer" && (
        <>
          <h1 className="font-heading text-4xl font-light text-sage-700">{t("paymentSuccess.transferTitle")}</h1>
          <p className="mt-4 text-ink-soft">
            {payMethod === "other"
              ? "Hemos registrado tu pedido. Nos pondremos en contacto contigo para gestionar la domiciliación / confirming."
              : t("paymentSuccess.transferDesc")}
          </p>
        </>
      )}
      {status === "quote" && (
        <>
          <h1 className="font-heading text-4xl font-light text-sage-700" data-testid="quote-pending-title">Pedido registrado · portes pendientes</h1>
          <p className="mt-4 text-ink-soft" data-testid="quote-pending-desc">
            Tu pedido se ha registrado <strong>sin pago</strong>. Los portes a tu destino se calculan según
            peso, volumen y destino: nuestra administración revisará el pedido y te enviaremos un correo con
            el importe total (portes incluidos) para que realices el pago.
          </p>
        </>
      )}

      {order && (
        <div className="mt-10 bg-white border border-bone-200 p-6 text-left" data-testid="success-order-card">
          <div className="flex justify-between"><span className="text-ink-soft text-sm">{t("paymentSuccess.orderNumber")}</span><span className="font-medium text-ink">{order.order_number}</span></div>
          <div className="flex justify-between mt-2"><span className="text-ink-soft text-sm">{t("paymentSuccess.total")}</span><span className="font-medium text-ink">{formatEUR(order.total)}</span></div>
          <div className="flex justify-between mt-2"><span className="text-ink-soft text-sm">{t("paymentSuccess.status")}</span><span className="font-medium text-sage-700">{order.status}</span></div>
        </div>
      )}

      <Link to="/tienda" className="btn-outline mt-10 inline-block" data-testid="success-continue-btn">{t("paymentSuccess.continue")}</Link>
    </div>
  );
}
