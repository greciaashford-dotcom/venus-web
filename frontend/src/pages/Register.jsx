import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";

const BUSINESS_TYPES = [
  "Tienda a Granel",
  "Ecotienda",
  "Herbolario",
  "Grupo de Consumo",
  "HORECA (Hostelería/Restauración)",
  "Obrador / Pastelería",
  "Distribuidor",
  "Otro",
];

export default function Register() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    role: "retail",
    company: "",
    tax_id: "",
    business_type: "",
    phone: "",
    message: "",
  });
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [proResult, setProResult] = useState(null); // "manual" | "failed"

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (payload.role === "retail") {
        delete payload.company;
        delete payload.tax_id;
        delete payload.business_type;
        delete payload.message;
      }
      if (!payload.message || !payload.message.trim()) delete payload.message;
      const u = await register(payload);
      if (form.role === "professional") {
        if (u.verification === "auto" && u.approved) {
          // NIF/CIF verificado automáticamente con BeeL (AEAT): cuenta activa
          toast.success("¡Registro profesional completado!", {
            description: "Hemos verificado tus datos fiscales automáticamente. Ya puedes iniciar sesión con precios profesionales.",
          });
          nav("/login");
        } else {
          setProResult(u.verification === "failed" ? "failed" : "manual");
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      } else {
        toast.success(t("register.created"), { description: `${t("register.welcome")} ${u.first_name}` });
        nav("/");
      }
    } catch (err) {
      toast.error(t("register.error"), { description: err?.response?.data?.detail || t("register.checkData") });
    } finally {
      setLoading(false);
    }
  };

  if (proResult === "failed") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center" data-testid="register-pro-failed">
        <div className="w-16 h-16 rounded-full bg-terracotta/15 text-terracotta flex items-center justify-center mx-auto mb-6">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5v.01"/></svg>
        </div>
        <h1 className="font-heading text-3xl font-light">Verificación no completada</h1>
        <p className="mt-4 text-ink-soft leading-relaxed" data-testid="register-failed-message">
          Su registro no se ha completado automáticamente por que sus datos no han podido ser
          verificados, en caso seas Autónomo o puedas justificar la veracidad de tus datos
          comunícate directamente con soporte al cliente para darte de alta de forma manual.
        </p>
        <p className="mt-3 text-ink-soft text-sm">
          Escríbenos a <a href="mailto:info@productosecoandes.com" className="text-sage-600 hover:text-sage-700">info@productosecoandes.com</a> o
          contáctanos por WhatsApp y te ayudaremos con el alta manual.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <button onClick={() => nav("/atencion-cliente")} className="btn-primary" data-testid="pro-failed-support">Soporte al cliente</button>
          <button onClick={() => nav("/")} className="btn-outline" data-testid="pro-failed-home">Ir al inicio</button>
        </div>
      </div>
    );
  }

  if (proResult === "manual") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center" data-testid="register-pro-pending">
        <div className="w-16 h-16 rounded-full bg-sage-100 text-sage-700 flex items-center justify-center mx-auto mb-6">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
        </div>
        <h1 className="font-heading text-3xl font-light">Solicitud en revisión</h1>
        <p className="mt-4 text-ink-soft leading-relaxed">
          Tu petición para acceder como <strong>profesional</strong> dentro de la plataforma está
          siendo revisada. En un plazo de <strong>24 horas</strong> validaremos tu cuenta y tendrás
          acceso a los precios y condiciones profesionales.
        </p>
        <p className="mt-3 text-ink-soft leading-relaxed">
          Te hemos enviado un correo de confirmación a <strong>{form.email}</strong> con esta misma
          información.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <button onClick={() => nav("/")} className="btn-primary" data-testid="pro-pending-home">Ir al inicio</button>
          <button onClick={() => nav("/tienda")} className="btn-outline" data-testid="pro-pending-shop">Ver la tienda</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16" data-testid="register-page">
      <div className="overline mb-3">{t("register.overline")}</div>
      <h1 className="font-heading text-4xl font-light">{t("register.title")}</h1>
      <p className="mt-3 text-ink-soft text-sm font-light">{t("register.subtitle")}</p>

      <div className="mt-6 flex gap-2" data-testid="register-role-tabs">
        {["retail", "professional"].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setForm((f) => ({ ...f, role: r }))}
            data-testid={`register-role-${r}`}
            className={`text-xs uppercase tracking-[0.22em] px-5 py-3 border rounded-sm transition ${
              form.role === r ? "bg-sage-500 text-white border-sage-500" : "border-bone-200 text-ink hover:border-sage-500"
            }`}
          >
            {r === "retail" ? t("register.retail") : t("register.professional")}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="register-form">
        {form.role === "professional" && (
          <>
            <input className="input-eco" placeholder={t("register.company")} required value={form.company} onChange={onChange("company")} data-testid="register-company" />
            <input className="input-eco" placeholder={t("register.taxId")} required value={form.tax_id} onChange={onChange("tax_id")} data-testid="register-tax-id" />
            <select
              className="input-eco md:col-span-2 text-ink"
              required
              value={form.business_type}
              onChange={onChange("business_type")}
              data-testid="register-business-type"
            >
              <option value="" disabled>{t("register.businessType")}</option>
              {BUSINESS_TYPES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <p className="md:col-span-2 text-xs text-ink-soft bg-sage-50 border border-sage-200 rounded-sm px-3 py-2" data-testid="register-pro-note">
              Verificamos tu NIF/CIF automáticamente contra el censo de la AEAT. Si la verificación
              es correcta, tu cuenta profesional se activa al instante; en caso contrario, quedará
              en revisión manual (máx. 24 h) y te avisaremos por correo.
            </p>
            <label className="md:col-span-2 block" data-testid="register-message-label">
              <span className="text-xs uppercase tracking-[0.16em] text-ink-soft">Escribe tu mensaje (opcional)</span>
              <textarea
                className="input-eco mt-1.5 w-full min-h-[88px]"
                placeholder="Ejemplo: Necesito lista de precios/ Necesito las claves de acceso para ver los precios profesionales en la web."
                value={form.message}
                onChange={onChange("message")}
                maxLength={1000}
                data-testid="register-message"
              />
            </label>
          </>
        )}
        <input className="input-eco" placeholder={t("register.firstName")} required value={form.first_name} onChange={onChange("first_name")} data-testid="register-first-name" />
        <input className="input-eco" placeholder={t("register.lastName")} required value={form.last_name} onChange={onChange("last_name")} data-testid="register-last-name" />
        <input className="input-eco md:col-span-2" type="email" placeholder={t("register.email")} required value={form.email} onChange={onChange("email")} data-testid="register-email" />
        <PasswordInput className="md:col-span-2" placeholder={t("register.password")} minLength={6} required value={form.password} onChange={onChange("password")} testid="register-password" />
        <input className="input-eco" placeholder={t("register.phone")} value={form.phone} onChange={onChange("phone")} data-testid="register-phone" />
        <label className="md:col-span-2 flex items-start gap-2.5 text-sm text-ink-soft cursor-pointer select-none" data-testid="register-privacy-label">
          <input
            type="checkbox"
            required
            checked={acceptPrivacy}
            onChange={(e) => setAcceptPrivacy(e.target.checked)}
            className="mt-0.5 accent-sage-500 w-4 h-4"
            data-testid="register-privacy-checkbox"
          />
          <span>
            {t("register.privacyAccept")}{" "}
            <Link to="/legal/politica-privacidad" target="_blank" className="text-sage-600 hover:text-sage-700 underline" data-testid="register-privacy-link">
              {t("register.privacyPolicy")}
            </Link>{" "}
            {t("register.privacyOf")}
          </span>
        </label>
        <button type="submit" disabled={loading || !acceptPrivacy} className="btn-primary md:col-span-2 w-full disabled:opacity-50" data-testid="register-submit">
          {loading ? t("register.creating") : t("register.submit")}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-soft">
        {t("register.haveAccount")} <Link to="/login" className="text-sage-600 hover:text-sage-700" data-testid="register-to-login">{t("register.login")}</Link>
      </p>
    </div>
  );
}
