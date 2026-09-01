import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";

const BOTANICAL_IMG = "https://images.unsplash.com/photo-1592295880235-e276a337ddf1?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Nzd8MHwxfHNlYXJjaHwzfHxib3RhbmljYWwlMjBzcGElMjBsZWF2ZXMlMjBtaW5pbWFsfGVufDB8fHx8MTc3NjQ2OTI4NHww&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/";

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(email, password);
      toast.success(t("login.welcome"), { description: u.first_name });
      nav(u.role === "admin" ? "/admin" : from, { replace: true });
    } catch (err) {
      toast.error(t("login.error"), { description: err?.response?.data?.detail || t("login.badCredentials") });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] grid grid-cols-1 md:grid-cols-2" data-testid="login-page">
      <div className="hidden md:block relative">
        <img src={BOTANICAL_IMG} alt="Botanical" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-sage-800/30" />
        <div className="relative h-full flex items-end p-12 text-bone-100">
          <div>
            <div className="overline text-sage-200 mb-3">{t("login.sideOverline")}</div>
            <h2 className="font-heading text-3xl font-light max-w-md">{t("login.sideTitle")}</h2>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-16">
        <form onSubmit={onSubmit} className="w-full max-w-md" data-testid="login-form">
          <div className="overline mb-3">{t("login.overline")}</div>
          <h1 className="font-heading text-3xl md:text-4xl font-light">{t("login.title")}</h1>
          <p className="mt-3 text-ink-soft text-sm font-light">{t("login.subtitle")}</p>
          <div className="mt-8 space-y-4">
            <input className="input-eco" type="email" placeholder={t("login.email")} required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="login-email" />
            <PasswordInput placeholder={t("login.password")} required value={password} onChange={(e) => setPassword(e.target.value)} testid="login-password" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full mt-6" data-testid="login-submit">
            {loading ? t("login.loading") : t("login.submit")}
          </button>
          <div className="mt-6 text-sm text-ink-soft flex items-center justify-between">
            <Link to="/registro" className="hover:text-sage-700" data-testid="login-to-register">{t("login.createAccount")}</Link>
            <Link to="/profesional" className="hover:text-sage-700" data-testid="login-to-b2b">{t("login.iAmPro")}</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
