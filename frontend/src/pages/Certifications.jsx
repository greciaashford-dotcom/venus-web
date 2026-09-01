import React from "react";
import { Award, ShieldCheck, Globe2, Leaf } from "lucide-react";

const SEALS = [
  {
    title: "Eurohoja BIO",
    code: "ES-ECO-023-MA",
    desc: "Sello obligatorio europeo para productos ecológicos. Garantiza un mínimo del 95% de ingredientes de origen ecológico, ausencia de OGM y trazabilidad completa desde el origen hasta el consumidor."
  },
  {
    title: "CAE Andalucía",
    code: "Comité Andaluz de Agricultura Ecológica",
    desc: "Autoridad de control acreditada por ENAC para certificar la producción ecológica conforme al Reglamento (UE) 2018/848. Realiza auditorías anuales y muestreos imprevistos."
  },
  {
    title: "Sin gluten",
    code: "Análisis de lote",
    desc: "Productos como quinoa, harina de garbanzo y trigo sarraceno se certifican como aptos para celíacos cuando los análisis de laboratorio confirman menos de 20 ppm de gluten."
  },
  {
    title: "Comercio justo",
    code: "Trazabilidad ecológica",
    desc: "Los productos de cultivo ecológico (quinoa, chía, maca, cacao) provienen de cooperativas que pagan a los productores precios estables y reinvierten en proyectos comunitarios."
  }
];

export default function Certifications() {
  return (
    <div className="bg-bone-100" data-testid="certifications-page">
      <div className="max-w-6xl mx-auto px-6 lg:px-12 py-14 sm:py-20">
        <div className="overline mb-3">Certificaciones</div>
        <h1 className="font-heading text-4xl md:text-5xl font-light leading-[1.05] max-w-3xl">
          Cada lote, certificado · Cada producto, trazado hasta el origen
        </h1>
        <p className="mt-6 text-ink-soft font-light leading-relaxed max-w-2xl text-base">
          En Ecoandes solo trabajamos con productos que cumplen los estándares más exigentes de
          agricultura ecológica europea. Estos son los sellos y controles que respaldan cada
          referencia de nuestro catálogo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12" data-testid="certifications-grid">
          {SEALS.map((s) => (
            <div key={s.title} className="bg-white border border-bone-200 p-7" data-testid={`seal-${s.title.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className="flex items-center gap-3 mb-4">
                <Award size={18} className="text-sage-600" />
                <span className="overline">{s.code}</span>
              </div>
              <h3 className="font-heading text-2xl font-light mb-3">{s.title}</h3>
              <p className="text-sm text-ink-soft font-light leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { I: ShieldCheck, t: "Auditorías anuales", d: "Todos nuestros proveedores son auditados al menos una vez al año por la entidad de control correspondiente." },
            { I: Globe2, t: "Trazabilidad total", d: "Cada lote tiene un código que permite rastrear su origen, fecha de cosecha y procesado." },
            { I: Leaf, t: "Sin pesticidas", d: "Cumplimos con los límites máximos de residuos del Reglamento (UE) 2018/848. La mayoría de lotes da no detectado en análisis." }
          ].map((b) => (
            <div key={b.t} className="border-t border-bone-200 pt-8">
              <b.I size={20} className="text-sage-600 mb-4" />
              <h4 className="font-heading text-lg mb-2">{b.t}</h4>
              <p className="text-sm text-ink-soft font-light leading-relaxed">{b.d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
