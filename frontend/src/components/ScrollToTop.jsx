import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Asegura que al navegar a cualquier ruta la página se abra en la parte superior.
 * Si la URL incluye un hash (#ancla), hace scroll suave hasta ese elemento.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        // Pequeño retraso para que el contenido esté montado
        setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);

  return null;
}
