import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, Clock, BookOpen, ExternalLink } from "lucide-react";
import { api, resolveAsset } from "../lib/api";
import ProductCard from "../components/ProductCard";
import { Seo } from "../components/Seo";

export default function BlogPost() {
  const { slug } = useParams();
  const [post, setPost] = useState(undefined); // undefined = cargando, null = no encontrado
  const [others, setOthers] = useState([]);
  const [related, setRelated] = useState([]);

  useEffect(() => {
    let alive = true;
    setPost(undefined);
    api
      .get(`/blog/${slug}`)
      .then(({ data }) => { if (alive) setPost(data); })
      .catch(() => { if (alive) setPost(null); });
    api
      .get("/blog")
      .then(({ data }) => { if (alive) setOthers((data || []).filter((p) => p.slug !== slug).slice(0, 3)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  useEffect(() => {
    (async () => {
      if (!post?.related_query) { setRelated([]); return; }
      try {
        const { data } = await api.get("/products", {
          params: { search: post.related_query, limit: 4 },
        });
        setRelated(data);
      } catch {}
    })();
  }, [post?.related_query]);

  if (post === undefined) {
    return (
      <div className="max-w-3xl mx-auto py-24 px-6 space-y-5 animate-pulse" data-testid="blog-post-loading">
        <div className="h-4 bg-bone-200 rounded w-1/4" />
        <div className="h-10 bg-bone-200 rounded w-3/4" />
        <div className="aspect-[16/9] bg-bone-200 rounded-2xl" />
      </div>
    );
  }

  if (post === null) {
    return (
      <div className="max-w-2xl mx-auto py-24 px-6 text-center" data-testid="blog-not-found">
        <p>Artículo no encontrado.</p>
        <Link to="/blog" className="btn-outline mt-6 inline-block">Volver al blog</Link>
      </div>
    );
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.seo?.meta_description || post.excerpt,
    image: post.cover ? [resolveAsset(post.cover)] : undefined,
    datePublished: post.date,
    author: { "@type": "Organization", name: post.author || "Equipo Ecoandes" },
    publisher: { "@type": "Organization", name: "EcoAndes" },
  };

  return (
    <article className="bg-bone-100" data-testid="blog-post-page">
      <Seo
        title={post.seo?.meta_title || post.title}
        description={post.seo?.meta_description || post.excerpt}
        keywords={post.seo?.keywords}
        image={post.cover ? resolveAsset(post.cover) : undefined}
        type="article"
        jsonLd={jsonLd}
      />
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-6 text-xs text-ink-soft uppercase tracking-[0.18em] flex items-center gap-2 flex-wrap">
        <Link to="/" className="hover:text-sage-600">Inicio</Link>
        <ChevronRight size={12} />
        <Link to="/blog" className="hover:text-sage-600">Blog</Link>
        <ChevronRight size={12} />
        <span className="text-ink truncate max-w-[60%]">{post.title}</span>
      </div>

      <header className="max-w-3xl mx-auto px-6 lg:px-12 pt-6 pb-10">
        <div className="overline mb-3">{post.category}</div>
        <h1 className="font-heading text-3xl md:text-5xl font-light leading-[1.05]">{post.title}</h1>
        <div className="flex items-center gap-5 text-xs text-ink-muted mt-6">
          <span>{post.date ? new Date(post.date).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" }) : ""}</span>
          <span>{post.author}</span>
          <span className="flex items-center gap-1.5"><Clock size={12} /> {post.read_time}</span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 lg:px-12">
        <img src={resolveAsset(post.cover)} alt={post.title} className="w-full aspect-[16/9] object-cover rounded-2xl shadow-[0_18px_50px_rgba(45,51,47,0.10)]" />
      </div>

      <div className="max-w-3xl mx-auto px-6 lg:px-12 py-14 space-y-10">
        <p className="text-lg text-ink leading-relaxed font-light italic">{post.excerpt}</p>
        {(post.body || []).map((section, i) => (
          <section key={i} data-testid={`blog-section-${i}`}>
            <h2 className="font-heading text-2xl md:text-3xl font-light text-sage-700 mb-4">{section.h}</h2>
            <p className="text-base text-ink-soft leading-relaxed font-light">{section.p}</p>
          </section>
        ))}

        {Array.isArray(post.sources) && post.sources.length > 0 && (
          <section className="bg-white border border-bone-200 rounded-2xl p-6 md:p-7" data-testid="blog-sources">
            <div className="overline mb-3 flex items-center gap-2">
              <BookOpen size={13} /> Fuentes
            </div>
            <ul className="space-y-2.5">
              {post.sources.map((s, i) => (
                <li key={i} className="text-sm">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`blog-source-${i}`}
                    className="inline-flex items-center gap-1.5 text-sage-700 hover:text-sage-800 hover:underline transition-colors"
                  >
                    {s.label || s.url}
                    <ExternalLink size={12} className="opacity-60" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-ink-muted mt-4 leading-relaxed">
              La información de este artículo tiene carácter divulgativo y no sustituye el consejo de un profesional sanitario.
            </p>
          </section>
        )}

        <div className="border-t border-bone-200 pt-8 flex items-center justify-between">
          <Link to="/blog" className="text-sm text-sage-700 inline-flex items-center gap-2 hover:text-sage-800 hover:gap-3 transition-all" data-testid="blog-back">
            <ArrowLeft size={14} /> Volver al blog
          </Link>
          {post.related_query && (
            <Link to={`/tienda?q=${encodeURIComponent(post.related_query)}`} className="btn-primary py-3 px-6 text-[11px]" data-testid="blog-shop-related">
              Comprar productos relacionados
            </Link>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 lg:px-12 py-14 border-t border-bone-200" data-testid="blog-related-products">
          <div className="overline mb-3">Productos relacionados</div>
          <h3 className="font-heading text-2xl md:text-3xl font-light mb-8">
            Lleva esta historia a tu despensa
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-8">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="max-w-7xl mx-auto px-6 lg:px-12 py-14 border-t border-bone-200" data-testid="blog-recommendations">
          <div className="overline mb-3">Sigue leyendo</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-6">
            {others.map((p) => (
              <Link key={p.slug} to={`/blog/${p.slug}`} className="group">
                <div className="aspect-[4/3] overflow-hidden bg-bone-200 rounded-2xl">
                  <img src={resolveAsset(p.cover)} alt={p.title} className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700" loading="lazy" />
                </div>
                <div className="overline mt-4 mb-2">{p.category}</div>
                <h4 className="font-heading text-lg font-light leading-snug transition-colors duration-200 group-hover:text-sage-700">{p.title}</h4>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
