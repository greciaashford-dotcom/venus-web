import React from "react";
import { Mail, Phone, Truck, RefreshCcw, HelpCircle, Clock, MapPin } from "lucide-react";
import { Link } from "react-router-dom";

const FAQS = [
  {
    q: "¿En cuánto tiempo recibo mi pedido?",
    a: "Los pedidos en península se entregan en 24-72 horas laborables. Los pedidos profesionales (B2B) tienen entregas dedicadas que se confirman al momento de procesar el pedido."
  },
  {
    q: "¿Cuál es el coste de envío?",
    a: "Para particulares: 4,99 € (IVA incluido) en pedidos inferiores a 50 €, y envío GRATIS a partir de 50 € (España/Portugal peninsular y Baleares). Para profesionales: portes por peso (desde 4 € + IVA hasta un máximo de 29 € + IVA) y envío gratuito a partir de 150 € (base imponible). Para Canarias y destinos fuera de la península, los portes se presupuestan manualmente según peso, volumen y destino: te enviaremos un correo con el importe total antes del pago."
  },
  {
    q: "¿Puedo devolver un producto?",
    a: "Sí, dispones de 14 días naturales desde la recepción del pedido para ejercer el derecho de desistimiento (RDL 1/2007). Los productos deben devolverse precintados y sin haber sido abiertos."
  },
  {
    q: "¿Cómo solicito una factura con IVA?",
    a: "Si te registras como cuenta profesional B2B con CIF/NIF, recibirás automáticamente la factura. Los clientes retail pueden solicitarla escribiendo a info@productosecoandes.com."
  },
  {
    q: "¿Qué medios de pago aceptáis?",
    a: "Tarjeta (Visa, Mastercard, Amex) vía Stripe, PayPal y, exclusivamente para cuentas B2B verificadas, transferencia bancaria con plazo de 7 días."
  },
  {
    q: "¿Mis productos están realmente certificados?",
    a: "Sí, todos llevan sellos BIO europeos (Eurohoja) y certificación nacional (ES-ECO-023-MA). Puedes consultar la página de Certificaciones para más detalle."
  }
];

export default function CustomerService() {
  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-12 py-14 sm:py-20" data-testid="customer-service-page">
      <div className="overline mb-3">Atención al cliente</div>
      <h1 className="font-heading text-4xl md:text-5xl font-light leading-[1.05]">
        Estamos a tu lado en cada pedido
      </h1>
      <p className="mt-5 text-ink-soft font-light leading-relaxed max-w-2xl">
        Resolvemos tus dudas en menos de 24 horas laborables. Aquí tienes los canales y las
        respuestas más frecuentes.
      </p>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-bone-200 p-6" data-testid="cs-email">
          <Mail size={18} className="text-sage-600 mb-3" />
          <div className="overline mb-1">Email</div>
          <a href="mailto:info@productosecoandes.com" className="text-ink hover:text-sage-700 break-all">info@productosecoandes.com</a>
        </div>
        <div className="bg-white border border-bone-200 p-6" data-testid="cs-phone">
          <Phone size={18} className="text-sage-600 mb-3" />
          <div className="overline mb-1">Teléfono</div>
          <a href="tel:+34918307266" className="text-ink hover:text-sage-700">918 30 72 66</a>
          <div className="text-xs text-ink-soft mt-2">WhatsApp: <a href="https://wa.me/34696173094" target="_blank" rel="noopener noreferrer" className="text-sage-700">+34 696 17 30 94</a></div>
        </div>
        <div className="bg-white border border-bone-200 p-6" data-testid="cs-hours">
          <Clock size={18} className="text-sage-600 mb-3" />
          <div className="overline mb-1">Horario</div>
          <div className="text-ink text-sm">Lunes a viernes<br />9:00 – 18:00 h</div>
        </div>
        <div className="bg-white border border-bone-200 p-6 md:col-span-3" data-testid="cs-address">
          <MapPin size={18} className="text-sage-600 mb-3" />
          <div className="overline mb-1">Dirección</div>
          <a
            href="https://maps.app.goo.gl/Pa47rYqdjCzs62vX6"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink hover:text-sage-700 text-sm"
          >
            C. Ferrocarril, 16, Edificio 12 Nave 4 · 28880 Meco, Madrid
          </a>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          { I: Truck, t: "Envíos", d: "24-72 h península. Gratis desde 60 €.", to: "/atencion-cliente#faqs" },
          { I: RefreshCcw, t: "Devoluciones", d: "14 días para desistir, sin abrir el producto.", to: "/atencion-cliente#faqs" },
          { I: HelpCircle, t: "Preguntas frecuentes", d: "Las respuestas más solicitadas.", to: "#faqs" }
        ].map((b) => (
          <div key={b.t} className="border border-bone-200 p-6 hover:border-sage-300 transition-colors">
            <b.I size={18} className="text-sage-600 mb-3" />
            <h3 className="font-heading text-lg font-normal">{b.t}</h3>
            <p className="text-sm text-ink-soft mt-1 font-light">{b.d}</p>
          </div>
        ))}
      </div>

      <div id="faqs" className="mt-20" data-testid="cs-faqs">
        <div className="overline mb-3">Preguntas frecuentes</div>
        <h2 className="font-heading text-3xl font-light mb-8">Lo que más nos preguntáis</h2>
        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <details key={i} className="bg-white border border-bone-200 group" data-testid={`faq-${i}`}>
              <summary className="cursor-pointer flex items-center justify-between p-5 list-none">
                <span className="text-ink font-medium">{f.q}</span>
                <span className="text-sage-600 group-open:rotate-180 transition-transform">⌄</span>
              </summary>
              <div className="px-5 pb-5 text-ink-soft text-sm font-light leading-relaxed">{f.a}</div>
            </details>
          ))}
        </div>
      </div>

      <div className="mt-16 bg-sage-100 p-8 sm:p-10 rounded-sm border border-sage-200">
        <div className="overline mb-2">¿No encuentras lo que buscas?</div>
        <h3 className="font-heading text-2xl font-light">Cuéntanos qué necesitas y te respondemos hoy.</h3>
        <Link to="/contacto" className="btn-primary mt-6 inline-block">Contactar con nosotros</Link>
      </div>
    </div>
  );
}
