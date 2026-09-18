import React, { useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { X, Lock, ShieldCheck } from "lucide-react";
import { stripePromise } from "../lib/stripe";
import { formatEUR } from "../lib/api";

function InnerForm({ amount, orderNumber, onSuccess, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [ready, setReady] = useState(false);

  const pay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/pago/success?order_number=${encodeURIComponent(orderNumber)}`,
      },
      redirect: "if_required",
    });
    if (error) {
      toast.error("Pago no completado", { description: error.message || "Revisa los datos de tu tarjeta e inténtalo de nuevo." });
      setPaying(false);
      return;
    }
    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
      onSuccess(paymentIntent.id);
      return;
    }
    setPaying(false);
  };

  return (
    <form onSubmit={pay} data-testid="stripe-payment-form">
      <PaymentElement onReady={() => setReady(true)} options={{ layout: "tabs" }} />
      <button
        type="submit"
        disabled={!stripe || paying || !ready}
        className="btn-primary w-full mt-6 disabled:opacity-50 disabled:pointer-events-none"
        data-testid="stripe-pay-button"
      >
        {paying ? "Procesando..." : (
          <span className="inline-flex items-center gap-2"><Lock size={15} /> Pagar {formatEUR(amount)}</span>
        )}
      </button>
      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-ink-muted" data-testid="stripe-secure-note">
        <ShieldCheck size={13} className="text-sage-600" /> Pago cifrado y procesado de forma segura por Stripe
      </div>
    </form>
  );
}

export default function StripeCardModal({ clientSecret, amount, orderNumber, onSuccess, onClose }) {
  const options = {
    clientSecret,
    appearance: {
      theme: "stripe",
      variables: {
        colorPrimary: "#72A638",
        colorText: "#2D332F",
        fontFamily: "Manrope, system-ui, sans-serif",
        borderRadius: "8px",
        spacingUnit: "4px",
      },
    },
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-start sm:items-center justify-center p-4 overflow-y-auto" data-testid="stripe-card-modal">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} data-testid="stripe-modal-backdrop" />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl my-8 border border-bone-200 animate-[fadeIn_.2s_ease]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-bone-200">
          <div>
            <div className="overline text-[10px]">Pago seguro</div>
            <h3 className="font-heading text-lg font-normal text-ink">Pedido {orderNumber}</h3>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-terracotta transition-colors" aria-label="Cerrar" data-testid="stripe-modal-close">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-6">
          {clientSecret ? (
            <Elements stripe={stripePromise} options={options}>
              <InnerForm amount={amount} orderNumber={orderNumber} onSuccess={onSuccess} onClose={onClose} />
            </Elements>
          ) : (
            <div className="py-10 text-center text-ink-soft text-sm">Cargando pasarela de pago…</div>
          )}
        </div>
      </div>
    </div>
  );
}
