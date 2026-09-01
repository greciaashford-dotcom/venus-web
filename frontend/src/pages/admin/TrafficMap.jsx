import React, { useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import countriesLib from "i18n-iso-countries";
import esLocale from "i18n-iso-countries/langs/es.json";
import world from "world-atlas/countries-110m.json";

countriesLib.registerLocale(esLocale);

const W = 940;
const H = 460;

function shade(t) {
  // sage scale: bone -> deep sage
  const from = [222, 226, 219]; // #DEE2DB
  const to = [62, 92, 68]; // #3E5C44
  const c = from.map((f, i) => Math.round(f + (to[i] - f) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export default function TrafficMap({ countries = [] }) {
  const wrapRef = useRef(null);
  const [tip, setTip] = useState(null); // {x, y, name, pageviews, sessions}

  const features = useMemo(() => {
    try {
      return feature(world, world.objects.countries).features;
    } catch {
      return [];
    }
  }, []);

  const byId = useMemo(() => {
    const m = {};
    countries.forEach((c) => {
      const num = countriesLib.alpha2ToNumeric(c.code);
      if (num) {
        m[String(num)] = c;
        m[String(Number(num))] = c;
      }
    });
    return m;
  }, [countries]);

  const maxV = Math.max(1, ...countries.map((c) => c.pageviews || 0));

  const pathGen = useMemo(() => {
    const proj = geoNaturalEarth1().fitSize([W, H], { type: "Sphere" });
    return geoPath(proj);
  }, []);

  const onMove = (e, f, data) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const code = data?.code;
    const name =
      (code && (countriesLib.getName(code, "es") || countriesLib.getName(code, "en"))) ||
      f.properties?.name ||
      "\u2014";
    setTip({
      x: Math.min(e.clientX - rect.left + 14, rect.width - 170),
      y: e.clientY - rect.top - 14,
      name,
      pageviews: data?.pageviews || 0,
      sessions: data?.sessions || 0,
      active: !!data,
    });
  };

  return (
    <div ref={wrapRef} className="relative" data-testid="traffic-map">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" role="img" aria-label={"Mapa de visitas por pa\u00eds"}>
        <rect x="0" y="0" width={W} height={H} fill="transparent" />
        {features.map((f) => {
          const data = byId[String(f.id)];
          const t = data ? 0.25 + 0.75 * ((data.pageviews || 0) / maxV) : 0;
          return (
            <path
              key={f.id}
              d={pathGen(f) || ""}
              fill={data ? shade(t) : "#EFEDE6"}
              stroke="#FFFFFF"
              strokeWidth="0.6"
              className="transition-opacity duration-150"
              style={{ opacity: tip && !tip.hoverId ? 1 : 1, cursor: data ? "pointer" : "default" }}
              onMouseMove={(e) => onMove(e, f, data)}
              onMouseLeave={() => setTip(null)}
              data-testid={data ? `map-country-${data.code}` : undefined}
            />
          );
        })}
      </svg>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 bg-white border border-bone-200 shadow-md rounded-md px-3 py-2 text-xs"
          style={{ left: tip.x, top: tip.y }}
          data-testid="map-tooltip"
        >
          <div className="font-medium text-ink">{tip.name}</div>
          {tip.active ? (
            <div className="text-ink-soft mt-0.5">
              {tip.pageviews} visita{tip.pageviews !== 1 ? "s" : ""} · {tip.sessions} sesi{tip.sessions !== 1 ? "ones" : "ón"}
            </div>
          ) : (
            <div className="text-ink-muted mt-0.5">Sin visitas</div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2 text-[11px] text-ink-muted">
        <span>Menos</span>
        <div className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(to right, ${shade(0.15)}, ${shade(1)})` }} />
        <span>Más visitas</span>
      </div>
    </div>
  );
}
