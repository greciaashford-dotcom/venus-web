import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";

export default function Professional() {
  const { t } = useTranslation();
  const { user } = useAuth();
  return (
    <div className="max-w-5xl mx-auto px-6 lg:px-12 py-20" data-testid="b2b-page">
      <div className="overline mb-3">{t("professional.overline")}</div>
      <h1 className="font-heading text-4xl md:text-5xl font-light max-w-3xl leading-[1.08]">
        {t("professional.title")}
      </h1>
      <p className="mt-6 text-ink-soft font-light leading-relaxed max-w-2xl">
        {t("professional.intro")}
      </p>
      <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { t: t("professional.adv1Title"), d: t("professional.adv1Desc") },
          { t: t("professional.adv2Title"), d: t("professional.adv2Desc") },
          { t: t("professional.adv3Title"), d: t("professional.adv3Desc") },
        ].map((x) => (
          <div key={x.t} className="border border-bone-200 p-6 bg-white">
            <div className="overline mb-3">{t("professional.advantage")}</div>
            <h3 className="font-heading text-xl font-normal mb-2">{x.t}</h3>
            <p className="text-sm text-ink-soft font-light leading-relaxed">{x.d}</p>
          </div>
        ))}
      </div>
      <div className="mt-12 flex gap-4 flex-wrap">
        {!user && (
          <Link to="/registro" className="btn-primary" data-testid="b2b-register-cta">{t("professional.openAccount")}</Link>
        )}
        {user?.role === "retail" && (
          <div className="text-ink-soft text-sm">
            {t("professional.convertNote")} <Link to="/contacto" className="text-sage-700">{t("professional.goContact")}</Link>.
          </div>
        )}
        {user?.role === "professional" && (
          <Link to="/tienda" className="btn-primary">{t("professional.viewB2B")}</Link>
        )}
      </div>
    </div>
  );
}
