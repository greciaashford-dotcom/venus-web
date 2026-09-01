import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Cookie, X } from "lucide-react";

const STORAGE_KEY = "eco_cookie_consent_v1";

export default function CookieBanner() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [prefs, setPrefs] = useState({ necessary: true, analytics: false, marketing: false });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // Show banner immediately (RGPD: must be visible from the start)
        setVisible(true);
      }
    } catch {}
  }, []);

  const save = (data) => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...data, ts: new Date().toISOString() })
      );
    } catch {}
    setVisible(false);
    setShowSettings(false);
  };

  const acceptAll = () => save({ necessary: true, analytics: true, marketing: true });
  const rejectAll = () => save({ necessary: true, analytics: false, marketing: false });
  const saveCustom = () => save(prefs);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-20 sm:px-6 sm:pb-24 lg:pb-6 pointer-events-none"
      data-testid="cookie-banner"
    >
      <div className="pointer-events-auto relative max-w-5xl mx-auto bg-white border border-bone-200 shadow-[0_-4px_30px_rgba(0,0,0,0.08)] rounded-sm overflow-hidden">
        <button
          onClick={() => setVisible(false)}
          aria-label={t("nav.close")}
          className="absolute top-2 right-2 p-1.5 text-ink-soft hover:text-ink transition-colors"
          data-testid="cookie-dismiss"
        >
          <X size={16} />
        </button>
        <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-4 items-start">
          <div className="hidden md:flex w-12 h-12 bg-sage-100 items-center justify-center rounded-sm shrink-0">
            <Cookie size={20} className="text-sage-700" />
          </div>
          <div className="text-sm text-ink leading-relaxed">
            <div className="overline mb-1.5">{t("cookie.badge")}</div>
            <p className="text-ink-soft font-light">
              {t("cookie.text")}{" "}
              <Link to="/legal/politica-cookies" className="text-sage-700 underline">{t("cookie.cookiePolicy")}</Link> {t("cookie.and")}{" "}
              <Link to="/legal/politica-privacidad" className="text-sage-700 underline">{t("cookie.privacyPolicy")}</Link>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:flex-col md:gap-2 md:min-w-[200px]" data-testid="cookie-banner-actions">
            <button onClick={acceptAll} className="btn-primary py-3 px-5 text-[11px]" data-testid="cookie-accept-all">
              {t("cookie.acceptAll")}
            </button>
            <button onClick={rejectAll} className="btn-outline py-3 px-5 text-[11px]" data-testid="cookie-reject-all">
              {t("cookie.onlyNecessary")}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs uppercase tracking-[0.2em] text-sage-700 hover:text-sage-800 px-2 py-2"
              data-testid="cookie-settings-btn"
            >
              {t("cookie.configure")}
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="border-t border-bone-200 p-5 sm:p-6 bg-bone-100/50" data-testid="cookie-settings">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-lg font-normal">{t("cookie.preferences")}</h3>
              <button onClick={() => setShowSettings(false)} aria-label={t("nav.close")} className="text-ink-soft hover:text-ink">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <ToggleRow
                title={t("cookie.necessary")}
                desc={t("cookie.necessaryDesc")}
                checked={true}
                disabled
              />
              <ToggleRow
                title={t("cookie.analytics")}
                desc={t("cookie.analyticsDesc")}
                checked={prefs.analytics}
                onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
                testId="cookie-toggle-analytics"
              />
              <ToggleRow
                title={t("cookie.marketing")}
                desc={t("cookie.marketingDesc")}
                checked={prefs.marketing}
                onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))}
                testId="cookie-toggle-marketing"
              />
            </div>
            <div className="mt-5 flex gap-3 justify-end">
              <button onClick={rejectAll} className="btn-outline px-5 py-3 text-[11px]">{t("cookie.onlyNecessary")}</button>
              <button onClick={saveCustom} className="btn-primary px-5 py-3 text-[11px]" data-testid="cookie-save-custom">
                {t("cookie.saveSelection")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({ title, desc, checked, onChange, disabled = false, testId }) {
  return (
    <label className="flex items-start justify-between gap-4 p-3 bg-white border border-bone-200 rounded-sm cursor-pointer">
      <div className="flex-1">
        <div className="font-medium text-ink">{title}</div>
        <div className="text-xs text-ink-soft mt-0.5 font-light">{desc}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-1.5 accent-sage-500 w-4 h-4"
        data-testid={testId}
      />
    </label>
  );
}
