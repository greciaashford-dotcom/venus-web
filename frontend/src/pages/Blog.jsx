import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { api, resolveAsset } from "../lib/api";
import { Seo } from "../components/Seo";

export default function Blog() {
  const [posts, setPosts] = useState(null); // null = cargando

  useEffect(() => {
    let alive = true;
    api
      .get("/blog")
      .then(({ data }) => { if (alive) setPosts(data || []); })
      .catch(() => { if (alive) setPosts([]); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 lg:px-12 py-14 sm:py-20" data-testid="blog-page">
      <Seo
        title="Blog EcoAndes · Historias del campo a tu cocina"
        description="Reflexiones, recetas y guías sobre los productos ecológicos más vendidos de EcoAndes: superalimentos, harinas, semillas y legumbres BIO."
      />
      <div className="overline mb-3">Blog</div>
      <h1 className="font-heading text-4xl sm:text-5xl font-light leading-[1.05]">
        Historias del campo a tu cocina
      </h1>
      <p className="mt-4 text-ink-soft font-light text-base max-w-xl">
        Reflexiones, recetas y guías sobre los productos ecológicos más vendidos de Ecoandes.
      </p>

      {posts === null ? (
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white border border-bone-200 rounded-2xl overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-bone-200" />
              <div className="p-6 space-y-3">
                <div className="h-3 bg-bone-200 rounded w-1/3" />
                <div className="h-5 bg-bone-200 rounded w-full" />
                <div className="h-4 bg-bone-200 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="mt-14 py-16 text-center text-ink-soft" data-testid="blog-empty">
          Aún no hay artículos publicados.
        </div>
      ) : (
        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
          {posts.map((p, i) => (
            <Link
              to={`/blog/${p.slug}`}
              key={p.slug}
              data-testid={`blog-card-${p.slug}`}
              className="group bg-white border border-bone-200 rounded-2xl overflow-hidden hover-lift hover:border-sage-300 flex flex-col"
            >
              <div className="aspect-[4/3] overflow-hidden bg-bone-200">
                <img
                  src={resolveAsset(p.cover)}
                  alt={p.title}
                  className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700"
                  loading={i < 3 ? "eager" : "lazy"}
                />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <div className="overline mb-3">{p.category}</div>
                <h3 className="font-heading text-xl font-light text-ink leading-snug min-h-[60px] transition-colors duration-200 group-hover:text-sage-700">
                  {p.title}
                </h3>
                <p className="text-sm text-ink-soft mt-3 line-clamp-3 font-light leading-relaxed">
                  {p.excerpt}
                </p>
                <div className="mt-5 pt-4 border-t border-bone-200 flex items-center justify-between text-xs text-ink-muted">
                  <span>{p.date ? new Date(p.date).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" }) : ""}</span>
                  <span className="flex items-center gap-1.5"><Clock size={12} /> {p.read_time}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
