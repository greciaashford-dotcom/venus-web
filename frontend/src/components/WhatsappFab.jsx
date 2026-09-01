import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

const WA_NUMBER = "34696173094";
const LS_KEY = "eco_wa_lead";

function WhatsappIcon({ size = 22 }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} className="shrink-0 drop-shadow" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.11 17.205c-.372 0-1.088 1.39-1.518 1.39a.63.63 0 0 1-.315-.1c-.802-.402-1.504-.817-2.163-1.447-.545-.516-1.146-1.29-1.46-1.963a.426.426 0 0 1-.073-.215c0-.33.99-.945.99-1.49 0-.143-.73-2.09-.832-2.335-.143-.372-.214-.487-.6-.487-.187 0-.36-.043-.53-.043-.302 0-.53.115-.746.315-.688.645-1.032 1.318-1.06 2.264v.114c-.015.99.472 1.977 1.017 2.78 1.23 1.82 2.506 3.41 4.554 4.34.616.287 2.035.803 2.72.803.688 0 2.64-.374 2.64-1.347 0-.156-.043-.31-.073-.452-.255-.57-1.635-1.193-2.1-1.29-.128-.028-.27-.042-.4-.042"
      />
      <path
        fill="currentColor"
        d="M16 0C7.163 0 0 7.163 0 16c0 2.837.747 5.5 2.055 7.81L.39 31.45a.506.506 0 0 0 .618.618l7.81-1.666A15.922 15.922 0 0 0 16 32c8.837 0 16-7.163 16-16S24.837 0 16 0m0 29c-2.55 0-4.95-.69-7-1.895l-.5-.3-4.9 1.05 1.05-4.9-.3-.5A12.94 12.94 0 0 1 3 16C3 8.83 8.83 3 16 3s13 5.83 13 13-5.83 13-13 13"
      />
    </svg>
  );
}

export default function WhatsappFab() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const nameRef = useRef(null);

  // Prefill from previous submission for returning visitors
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (saved?.name) setName(saved.name);
      if (saved?.phone) setPhone(saved.phone);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (open && nameRef.current) {
      setTimeout(() => nameRef.current?.focus(), 250);
    }
  }, [open]);

  const validate = () => {
    const errs = {};
    if (!name.trim() || name.trim().length < 2) errs.name = t("whatsapp.errorName");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6 || digits.length > 15) errs.phone = t("whatsapp.errorPhone");
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSending(true);
    try {
      await api.post("/whatsapp-leads", { name: name.trim(), phone: phone.trim() });
      localStorage.setItem(LS_KEY, JSON.stringify({ name: name.trim(), phone: phone.trim() }));
    } catch {
      // Even if lead capture fails, don't block the customer from contacting us
    } finally {
      setSending(false);
    }

    const msg = `${t("whatsapp.greeting", { name: name.trim() })} ${t("whatsapp.message")}`;
    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="wa-form"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "tween", duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-[8.75rem] right-4 sm:right-6 lg:bottom-28 lg:right-6 z-50 w-[calc(100vw-2.5rem)] max-w-[340px] bg-white border border-bone-200 rounded-2xl shadow-[0_18px_50px_rgba(45,51,47,0.18)] overflow-hidden"
            data-testid="whatsapp-form"
          >
            <div className="bg-sage-700 text-bone-100 px-5 py-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <WhatsappIcon size={26} />
                <div>
                  <div className="text-sm font-medium leading-tight">{t("whatsapp.formTitle")}</div>
                  <div className="text-[11px] text-bone-100/80 mt-0.5 leading-snug">{t("whatsapp.formSubtitle")}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("whatsapp.close")}
                data-testid="whatsapp-form-close"
                className="text-bone-100/80 hover:text-white transition shrink-0 mt-0.5"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4" noValidate>
              <div>
                <label htmlFor="wa-name" className="overline block mb-1.5">{t("whatsapp.nameLabel")}</label>
                <input
                  id="wa-name"
                  ref={nameRef}
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: null })); }}
                  placeholder={t("whatsapp.namePlaceholder")}
                  data-testid="whatsapp-form-name"
                  className={`w-full bg-bone-50 border rounded-md px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-sage-500 transition ${errors.name ? "border-red-400" : "border-bone-200"}`}
                  maxLength={120}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1.5" data-testid="whatsapp-error-name">{errors.name}</p>}
              </div>
              <div>
                <label htmlFor="wa-phone" className="overline block mb-1.5">{t("whatsapp.phoneLabel")}</label>
                <input
                  id="wa-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); if (errors.phone) setErrors((p) => ({ ...p, phone: null })); }}
                  placeholder={t("whatsapp.phonePlaceholder")}
                  data-testid="whatsapp-form-phone"
                  className={`w-full bg-bone-50 border rounded-md px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-sage-500 transition ${errors.phone ? "border-red-400" : "border-bone-200"}`}
                  maxLength={25}
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1.5" data-testid="whatsapp-error-phone">{errors.phone}</p>}
              </div>
              <button
                type="submit"
                disabled={sending}
                data-testid="whatsapp-form-submit"
                className="w-full bg-sage-700 hover:bg-sage-800 disabled:opacity-60 text-bone-100 rounded-full py-3 text-xs uppercase tracking-[0.2em] font-medium flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98]"
              >
                {sending ? t("whatsapp.sending") : (<><Send size={14} /> {t("whatsapp.submit")}</>)}
              </button>
              <p className="text-[10.5px] text-ink-muted leading-snug text-center">{t("whatsapp.privacy")}</p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="whatsapp-fab"
        aria-label={t("whatsapp.aria")}
        aria-expanded={open}
        className="fixed bottom-[4.75rem] right-4 sm:right-6 lg:bottom-6 lg:right-6 z-50 flex items-center gap-2 sm:gap-3 bg-sage-700 hover:bg-sage-800 text-bone-100 shadow-[0_10px_30px_rgba(44,64,46,0.35)] rounded-full pl-4 pr-5 py-3 sm:pl-5 sm:pr-6 sm:py-4 transition-all duration-300 hover:scale-[1.03] group"
      >
        <WhatsappIcon />
        <span className="hidden sm:inline text-xs uppercase tracking-[0.2em] font-medium">
          {t("whatsapp.label")}
        </span>
      </button>
    </>
  );
}
