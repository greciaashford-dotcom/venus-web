import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Mail, Send } from "lucide-react";
import { api } from "../lib/api";

export default function NewsletterForm({ variant = "footer" }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error(t("newsletter.invalid"));
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/newsletter/subscribe", { email });
      toast.success(data.already ? t("newsletter.already") : t("newsletter.success"));
      setEmail("");
    } catch (err) {
      toast.error(t("newsletter.error"));
    } finally {
      setLoading(false);
    }
  };

  const dark = variant === "footer";
  return (
    <form onSubmit={submit} className="w-full" data-testid="newsletter-form">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Mail
            size={16}
            className={`absolute left-3 top-1/2 -translate-y-1/2 ${dark ? "text-sage-300" : "text-ink-muted"}`}
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("newsletter.placeholder")}
            data-testid="newsletter-email-input"
            className={
              dark
                ? "w-full bg-sage-900/40 border border-sage-100/25 rounded-sm pl-9 pr-4 py-3 text-sm text-bone-100 placeholder:text-sage-200/60 focus:border-sage-200 focus:outline-none transition-colors"
                : "input-eco pl-9"
            }
            aria-label={t("newsletter.placeholder")}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          data-testid="newsletter-submit-button"
          className={
            dark
              ? "bg-bone-100 text-sage-800 hover:bg-white transition-colors px-6 py-3 text-xs uppercase tracking-[0.22em] rounded-sm inline-flex items-center justify-center gap-2 disabled:opacity-60"
              : "btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-60"
          }
        >
          <Send size={14} /> {t("newsletter.subscribe")}
        </button>
      </div>
      <p className={`mt-2 text-[11px] ${dark ? "text-sage-200/60" : "text-ink-muted"}`}>
        {t("newsletter.privacy")}
      </p>
    </form>
  );
}
