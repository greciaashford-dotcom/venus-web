import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";

// Páginas legales servidas desde la base de datos (editables en /admin/legal).
function LegalPage({ testId, slug }) {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/legal/${slug}`)
      .then(({ data }) => setPage(data))
      .catch(() => setPage(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div className="max-w-3xl mx-auto px-6 py-24 text-center text-ink-soft">Cargando…</div>;
  }
  if (!page) {
    return <div className="max-w-3xl mx-auto px-6 py-24 text-center text-ink-soft">Página no disponible.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-6 lg:px-12 py-14 sm:py-20" data-testid={testId}>
      <div className="overline mb-3">Información legal</div>
      <h1 className="font-heading text-4xl md:text-5xl font-light leading-[1.05]">{page.title}</h1>
      {page.updated && (
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-ink-muted">Última actualización: {page.updated}</p>
      )}
      <div className="mt-10 space-y-8 text-ink-soft font-light leading-relaxed text-base">
        {(page.sections || []).map((s, i) => (
          <section key={i}>
            <h2 className="font-heading text-xl font-normal text-ink mb-3">{s.h}</h2>
            {Array.isArray(s.p)
              ? s.p.map((para, j) => <p key={j} className="mb-3">{para}</p>)
              : s.p && <p>{s.p}</p>}
            {s.ul && s.ul.length > 0 && (
              <ul className="list-disc pl-6 mt-3 space-y-1.5">
                {s.ul.map((li, k) => <li key={k}>{li}</li>)}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

export function AvisoLegal() {
  return <LegalPage testId="legal-aviso" slug="aviso-legal" />;
}

export function PoliticaCookies() {
  return <LegalPage testId="legal-cookies" slug="politica-cookies" />;
}

export function PoliticaPrivacidad() {
  return <LegalPage testId="legal-privacidad" slug="politica-privacidad" />;
}

export function Condiciones() {
  return <LegalPage testId="legal-condiciones" slug="condiciones" />;
}
