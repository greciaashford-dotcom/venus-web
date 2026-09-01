import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Sparkles, RefreshCcw, TrendingUp, History } from "lucide-react";

// Apartado SEO: análisis con IA (semanal automático + bajo demanda).
const PRIORITY_STYLES = {
  alta: "bg-red-100 text-red-700",
  media: "bg-amber-100 text-amber-800",
  baja: "bg-sage-100 text-sage-700",
};

export default function AdminSeo() {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = () => {
    Promise.all([api.get("/admin/seo/latest"), api.get("/admin/seo/reports", { params: { limit: 8 } })])
      .then(([{ data: l }, { data: h }]) => {
        setLatest(l.report);
        setHistory(h.reports || []);
      })
      .catch(() => toast.error("Error al cargar informes SEO"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const analyze = async () => {
    setRunning(true);
    toast.info("Analizando la web con IA…", { description: "Puede tardar hasta un minuto." });
    try {
      const { data } = await api.post("/admin/seo/analyze");
      setLatest(data);
      load();
      toast.success("Análisis SEO completado");
    } catch (e) {
      toast.error("Error en el análisis", { description: e?.response?.data?.detail });
    } finally {
      setRunning(false);
    }
  };

  const report = latest?.report;
  const score = report?.overall_score;
  const scoreColor = score == null ? "text-ink-muted" : score >= 75 ? "text-sage-700" : score >= 45 ? "text-amber-600" : "text-red-600";

  return (
    <div data-testid="admin-seo-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="overline mb-2">Posicionamiento</div>
          <h1 className="font-heading text-3xl font-light">SEO con IA</h1>
          <p className="text-sm text-ink-soft mt-2 max-w-2xl">
            La IA analiza tu web cada semana (productos, contenidos, tráfico real) y te propone
            mejoras concretas de posicionamiento. También puedes lanzar un análisis ahora mismo.
          </p>
        </div>
        <button onClick={analyze} disabled={running} className="btn-primary inline-flex items-center gap-2 !py-2.5" data-testid="seo-analyze-btn">
          {running ? <RefreshCcw size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {running ? "Analizando…" : "Analizar ahora"}
        </button>
      </div>

      {loading ? (
        <div className="text-ink-soft py-10">Cargando…</div>
      ) : !latest ? (
        <div className="bg-white border border-bone-200 rounded-md p-12 text-center" data-testid="seo-empty">
          <Sparkles className="mx-auto text-sage-500 mb-3" size={28} />
          <div className="font-medium text-ink mb-1">Aún no hay informes SEO</div>
          <p className="text-sm text-ink-soft max-w-md mx-auto">
            Pulsa “Analizar ahora” para generar tu primer informe con recomendaciones de la IA.
            Después, se generará uno automáticamente cada semana.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-bone-200 rounded-md p-6 text-center" data-testid="seo-score-card">
              <div className="overline mb-2">Salud SEO global</div>
              <div className={`font-heading text-6xl font-light ${scoreColor}`}>{score ?? "—"}</div>
              <div className="text-xs text-ink-muted mt-1">sobre 100</div>
              <div className="text-[11px] text-ink-muted mt-4">
                Último análisis: {new Date(latest.created_at).toLocaleString("es-ES")} · {latest.trigger === "weekly" ? "automático (semanal)" : "manual"}
              </div>
            </div>
            <div className="lg:col-span-2 bg-white border border-bone-200 rounded-md p-6">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={15} className="text-sage-600" />
                <h2 className="font-heading text-lg font-normal">Resumen ejecutivo</h2>
              </div>
              <p className="text-sm text-ink-soft leading-relaxed" data-testid="seo-summary">{report?.summary || "—"}</p>
              {latest.site_data && (
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-ink-soft">
                  <span className="bg-bone-100 px-2 py-1 rounded-sm">{latest.site_data.products_total} productos</span>
                  <span className="bg-bone-100 px-2 py-1 rounded-sm">SEO medio: {latest.site_data.avg_seo_score}/100</span>
                  <span className="bg-bone-100 px-2 py-1 rounded-sm">{latest.site_data.products_seo_low} con SEO bajo</span>
                  <span className="bg-bone-100 px-2 py-1 rounded-sm">{latest.site_data.blog_posts} posts de blog</span>
                  <span className="bg-bone-100 px-2 py-1 rounded-sm">{latest.site_data.traffic_7d?.pageviews ?? 0} visitas (7 d)</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 bg-white border border-bone-200 rounded-md p-6" data-testid="seo-recommendations">
            <h2 className="font-heading text-lg font-normal mb-4">Recomendaciones de la IA</h2>
            {(report?.recommendations || []).length === 0 ? (
              <div className="text-sm text-ink-soft">Este informe no incluye recomendaciones.</div>
            ) : (
              <div className="space-y-3">
                {report.recommendations.map((r, i) => (
                  <div key={i} className="border border-bone-200 rounded-md p-4" data-testid={`seo-rec-${i}`}>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm ${PRIORITY_STYLES[r.priority] || "bg-bone-100 text-ink"}`}>
                        {r.priority}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-sm bg-bone-100 text-ink-soft">{r.area}</span>
                      <span className="font-medium text-ink text-sm">{r.title}</span>
                    </div>
                    <p className="text-sm text-ink-soft leading-relaxed">{r.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 bg-white border border-bone-200 rounded-md p-6">
            <div className="flex items-center gap-2 mb-3">
              <History size={15} className="text-sage-600" />
              <h2 className="font-heading text-lg font-normal">Histórico de análisis</h2>
            </div>
            <div className="divide-y divide-bone-100 text-sm">
              {history.map((h) => (
                <div key={h.id} className="py-2.5 flex items-center justify-between">
                  <span className="text-ink-soft">{new Date(h.created_at).toLocaleString("es-ES")} · {h.trigger === "weekly" ? "automático" : "manual"}</span>
                  <span className="text-ink font-medium">{h.report?.overall_score ?? "—"}/100</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
