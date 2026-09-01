import React from "react";

// Renders certification badge images scraped from source (with graceful fallback).
export default function TrustBadges({ badges = [], className = "" }) {
  if (!badges || badges.length === 0) return null;
  const BACKEND = process.env.REACT_APP_BACKEND_URL || "";
  const resolve = (src) => (src && src.startsWith("/api/") ? `${BACKEND}${src}` : src);
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`} data-testid="trust-badges">
      {badges.map((b, i) => (
        <div
          key={i}
          className="h-12 w-12 sm:h-14 sm:w-14 rounded-md border border-bone-200 bg-white p-1.5 flex items-center justify-center"
          title={b.alt || "Certificación"}
        >
          <img
            src={resolve(b.src)}
            alt={b.alt || "Certificación"}
            className="max-h-full max-w-full object-contain"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}
