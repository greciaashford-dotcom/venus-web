import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatEUR } from "../../lib/api";
import { sourceLabel, SOURCE_COLORS, originLabel } from "../../lib/tracking";
import TrafficMap from "./TrafficMap";
import { Link } from "react-router-dom";
import { ShoppingCart, TrendingUp, Eye, Globe2, MousePointerClick, RefreshCcw } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import countriesLib from "i18n-iso-countries";
import esLocale from "i18n-iso-countries/langs/es.json";

countriesLib.registerLocale(esLocale);

function iso(d) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

const PRESETS = [
  { key: "today", label: "Hoy" },
  { key: "7d", label: "7 días" },
  { key: "30d", label: "30 días" },
  { key: "90d", label: "90 días" },
  { key: "year", label: "Este año" },
];

function presetRange(key) {
  const now = new Date();
  const to = iso(now);
  if (key === "today") return { from: to, to };
  if (key === "7d") return { from: iso(new Date(now.getTime() - 6 * 86400000)), to };
  if (key === "30d") return { from: iso(new Date(now.getTime() - 29 * 86400000)), to };
  if (key === "90d") return { from: iso(new Date(now.getTime() - 89 * 86400000)), to };
  if (key === "year") return { from: `${now.getFullYear()}-01-01`, to };
  return { from: iso(new Date(now.getTime() - 29 * 86400000)), to };
}

function countryName(c) {
  return countriesLib.getName(c.code, "es") || c.name || c.code;
}

export default function AdminDashboard() {
  const [preset, setPreset] = useState("30d");
  const [range, setRange] = useState(presetRange("30d"));
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r) => {
    setLoading(true);
    try {
      const [{ data: sum }, { data: orders }] = await Promise.all([
        api.get("/admin/analytics/summary", { params: { date_from: r.from, date_to: r.to } }),
        api.get("/orders/admin/list", { params: { limit: 5 } }),
      ]);
      setSummary(sum);
      setRecent(orders);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(range); }, [load, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyPreset = (key) => {
    setPreset(key);
    setRange(presetRange(key));
  };

  const totals = summary?.totals || {};
  const sources = summary?.sources || [];
  const countries = summary?.countries || [];
  const series = summary?.series || [];
  const hasTraffic = (totals.pageviews || 0) > 0;
  const maxSource = Math.max(1, ...sources.map((s) => s.pageviews));
  const maxCountry = Math.max(1, ...countries.map((c) => c.pageviews));

  const kpis = [
    { icon: Eye, t: "Visitas (páginas)", v: totals.pageviews ?? "—", sub: `${totals.visitors ?? 0} visitantes únicos` },
    { icon: MousePointerClick, t: "Sesiones", v: totals.sessions ?? "—", sub: `${totals.countries ?? 0} países` },
    { icon: ShoppingCart, t: "Pedidos (rango)", v: totals.orders ?? "—", sub: "En el periodo seleccionado" },
    { icon: TrendingUp, t: "Ingresos (pagados)", v: formatEUR(totals.revenue ?? 0), sub: "En el periodo seleccionado" },
  ];

  return (
    <div data-testid="admin-dashboard">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="overline mb-2">Panel principal</div>
          <h1 className="font-heading text-3xl font-light">Dashboard</h1>
        </div>
        <button onClick={() => load(range)} className="btn-outline inline-flex items-center gap-2 !py-2.5" data-testid="dashboard-refresh">
          <RefreshCcw size={14} /> Actualizar
        </button>
      </div>

      {/* ---- Global date filter ---- */}
      <div className="bg-white border border-bone-200 rounded-md p-4 mb-6 flex flex-wrap items-center gap-3" data-testid="dashboard-date-filter">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyPreset(p.key)}
              data-testid={`date-preset-${p.key}`}
              className={`text-xs uppercase tracking-[0.14em] px-3.5 py-2 rounded-full border transition-colors ${
                preset === p.key
                  ? "bg-sage-600 text-white border-sage-600"
                  : "bg-white text-ink-soft border-bone-200 hover:border-sage-400"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto text-sm">
          <label className="text-xs text-ink-soft uppercase tracking-wide">Desde</label>
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => { setPreset("custom"); setRange((r) => ({ ...r, from: e.target.value })); }}
            className="border border-bone-200 rounded-sm px-2.5 py-1.5 text-sm bg-white"
            data-testid="date-from"
          />
          <label className="text-xs text-ink-soft uppercase tracking-wide">Hasta</label>
          <input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => { setPreset("custom"); setRange((r) => ({ ...r, to: e.target.value })); }}
            className="border border-bone-200 rounded-sm px-2.5 py-1.5 text-sm bg-white"
            data-testid="date-to"
          />
        </div>
      </div>

      {/* ---- KPI cards ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpis.map((c) => (
          <div key={c.t} className="bg-white border border-bone-200 p-5 rounded-md" data-testid={`kpi-${c.t.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
            <c.icon className="text-sage-600" size={18} />
            <div className="overline mt-3 mb-1">{c.t}</div>
            <div className="font-heading text-2xl font-normal text-ink">{loading ? "…" : c.v}</div>
            <div className="text-xs text-ink-soft mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ---- Visits evolution ---- */}
      <div className="mt-6 bg-white border border-bone-200 rounded-md p-5" data-testid="visits-chart">
        <h2 className="font-heading text-lg font-normal mb-1">Evolución de visitas</h2>
        <p className="text-xs text-ink-soft mb-4">Páginas vistas y sesiones por día en el rango seleccionado.</p>
        {hasTraffic ? (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="gradPv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6B826E" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6B826E" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#EFEDE6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#8A8F87" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#8A8F87" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <ReTooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #EAE6DF" }} />
                <Area type="monotone" dataKey="pageviews" name="Visitas" stroke="#6B826E" strokeWidth={2} fill="url(#gradPv)" />
                <Area type="monotone" dataKey="sessions" name="Sesiones" stroke="#B0654F" strokeWidth={1.5} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyTraffic loading={loading} />
        )}
      </div>

      {/* ---- Map + countries ---- */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-bone-200 rounded-md p-5" data-testid="map-panel">
          <div className="flex items-center gap-2 mb-1">
            <Globe2 size={16} className="text-sage-600" />
            <h2 className="font-heading text-lg font-normal">Visitas por país</h2>
          </div>
          <p className="text-xs text-ink-soft mb-4">Origen geográfico de las visitas. Pasa el cursor sobre un país para ver el detalle.</p>
          {hasTraffic ? <TrafficMap countries={countries} /> : <EmptyTraffic loading={loading} />}
        </div>

        <div className="bg-white border border-bone-200 rounded-md p-5" data-testid="countries-panel">
          <h2 className="font-heading text-lg font-normal mb-1">Países con más volumen</h2>
          <p className="text-xs text-ink-soft mb-4">Complemento del mapa: ranking por visitas.</p>
          {countries.length === 0 ? (
            <EmptyTraffic loading={loading} small />
          ) : (
            <div className="space-y-3">
              {countries.slice(0, 10).map((c) => (
                <div key={c.code} data-testid={`country-row-${c.code}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-ink">
                      <img src={`https://flagcdn.com/w20/${c.code.toLowerCase()}.png`} alt="" className="w-4 h-3 object-cover rounded-[2px] border border-bone-200" />
                      {countryName(c)}
                    </span>
                    <span className="text-ink-soft tabular-nums">{c.pageviews}</span>
                  </div>
                  <div className="h-1.5 bg-bone-100 rounded-full mt-1.5 overflow-hidden">
                    <div className="h-full bg-sage-500 rounded-full" style={{ width: `${(c.pageviews / maxCountry) * 100}%` }} />
                  </div>
                </div>
              ))}
              {summary?.unknown_country > 0 && (
                <div className="text-[11px] text-ink-muted pt-1">+ {summary.unknown_country} visitas sin país identificado</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---- Acquisition + top pages ---- */}
      <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white border border-bone-200 rounded-md p-5" data-testid="acquisition-panel">
          <h2 className="font-heading text-lg font-normal mb-1">Resumen de adquisición</h2>
          <p className="text-xs text-ink-soft mb-4">Fuentes de tráfico: buscadores, redes sociales, IA, referencias y tráfico directo.</p>
          {sources.length === 0 ? (
            <EmptyTraffic loading={loading} small />
          ) : (
            <div className="space-y-3.5">
              {sources.map((s) => {
                const pct = totals.pageviews ? Math.round((s.pageviews / totals.pageviews) * 100) : 0;
                return (
                  <div key={`${s.source}-${s.medium}`} data-testid={`source-row-${s.source}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-ink">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: SOURCE_COLORS[s.source] || "#C2A878" }} />
                        {sourceLabel(s.source)}
                        <span className="text-[10px] uppercase tracking-wide text-ink-muted bg-bone-100 px-1.5 py-0.5 rounded-sm">{s.medium}</span>
                      </span>
                      <span className="text-ink-soft tabular-nums">{s.sessions} ses. · {s.pageviews} visitas · {pct}%</span>
                    </div>
                    <div className="h-1.5 bg-bone-100 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(s.pageviews / maxSource) * 100}%`, background: SOURCE_COLORS[s.source] || "#C2A878" }} />
                    </div>
                  </div>
                );
              })}
              {(summary?.referrers || []).length > 0 && (
                <div className="pt-2 border-t border-bone-100">
                  <div className="text-[11px] uppercase tracking-wide text-ink-muted mb-1.5">Dominios de referencia</div>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.referrers.map((r) => (
                      <span key={r.host} className="text-[11px] bg-bone-100 text-ink-soft px-2 py-1 rounded-sm">{r.host} · {r.pageviews}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-bone-200 rounded-md p-5" data-testid="pages-panel">
          <h2 className="font-heading text-lg font-normal mb-1">Páginas más vistas</h2>
          <p className="text-xs text-ink-soft mb-4">Top 10 en el rango.</p>
          {(summary?.pages || []).length === 0 ? (
            <EmptyTraffic loading={loading} small />
          ) : (
            <div className="space-y-2">
              {summary.pages.map((p) => (
                <div key={p.path} className="flex items-center justify-between text-sm border-b border-bone-100 pb-2">
                  <span className="text-ink truncate max-w-[75%]" title={p.path}>{p.path}</span>
                  <span className="text-ink-soft tabular-nums">{p.pageviews}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- Recent orders ---- */}
      <div className="mt-6 bg-white border border-bone-200 rounded-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-normal">Últimos pedidos</h2>
          <Link to="/admin/pedidos" className="text-xs uppercase tracking-[0.2em] text-sage-700">Ver todos →</Link>
        </div>
        {recent.length === 0 ? (
          <div className="text-ink-soft text-sm py-6 text-center">Aún no hay pedidos.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.14em] text-ink-soft text-left border-b border-bone-200">
                  <th className="py-3">Pedido</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Origen</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id} className="border-b border-bone-100" data-testid={`recent-order-${o.order_number}`}>
                    <td className="py-3"><Link className="text-sage-700 font-medium" to={`/admin/pedidos/${o.id}`}>#{o.order_number}</Link></td>
                    <td>{o.email}</td>
                    <td>{formatEUR(o.total)}</td>
                    <td className="text-ink-soft text-xs">{originLabel(o.acquisition)}</td>
                    <td><StatusPill status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyTraffic({ loading, small }) {
  return (
    <div className={`text-center text-ink-soft text-sm ${small ? "py-8" : "py-14"}`} data-testid="traffic-empty">
      {loading ? "Cargando…" : (
        <>
          <div className="font-medium text-ink mb-1">Sin datos de visitas en este rango</div>
          <div className="text-xs text-ink-muted max-w-sm mx-auto">
            Las visitas se registran desde la activación de la analítica propia. Navega por la tienda o espera tráfico real para ver datos aquí.
          </div>
        </>
      )}
    </div>
  );
}

export function StatusPill({ status }) {
  const map = {
    "Pendiente portes": "bg-terracotta/15 text-terracotta",
    Pendiente: "bg-amber-100 text-amber-800",
    Pagado: "bg-sage-100 text-sage-700",
    Enviado: "bg-sky-100 text-sky-700",
    Completado: "bg-sage-200 text-sage-800",
    Cancelado: "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-[10px] uppercase tracking-[0.18em] px-2 py-1 rounded-sm ${map[status] || "bg-bone-200 text-ink"}`}>
      {status}
    </span>
  );
}
