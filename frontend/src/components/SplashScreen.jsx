import React, { useEffect, useState } from "react";

const KEY = "eco_splash_seen";
const MAX_MS = 11000; // failsafe: nunca bloquear más de 11 s

/**
 * Pantalla de bienvenida (splash) con el vídeo de marca.
 * Se muestra una vez por sesión de navegación, se puede saltar y desaparece
 * sola al terminar el vídeo (8 s) con un fundido suave.
 */
export default function SplashScreen() {
  const [show, setShow] = useState(() => {
    try {
      return !sessionStorage.getItem(KEY);
    } catch {
      return false;
    }
  });
  const [fading, setFading] = useState(false);

  const dismiss = () => {
    try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setFading(true);
    setTimeout(() => setShow(false), 600);
  };

  useEffect(() => {
    if (!show) return undefined;
    document.body.style.overflow = "hidden";
    const t = setTimeout(dismiss, MAX_MS);
    return () => {
      document.body.style.overflow = "";
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[999] bg-[#F4F2EC] flex items-center justify-center transition-opacity duration-[600ms] ${fading ? "opacity-0 pointer-events-none" : "opacity-100"}`}
      data-testid="splash-screen"
      aria-label="Pantalla de bienvenida EcoAndes"
    >
      <video
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={dismiss}
        className="w-full h-full object-contain sm:object-cover"
        data-testid="splash-video"
      >
        <source src="/splash-bienvenida.mp4" type="video/mp4" />
        {/* onError solo en el ÚLTIMO source: si ningún formato es reproducible,
            el splash se cierra solo (además del failsafe de 11 s). */}
        <source src="/splash-bienvenida.webm" type="video/webm" onError={dismiss} />
      </video>
      <button
        onClick={dismiss}
        className="absolute bottom-6 right-6 bg-white/85 backdrop-blur text-ink text-[11px] uppercase tracking-[0.2em] px-5 py-2.5 rounded-full border border-bone-200 hover:bg-white transition-colors duration-200"
        data-testid="splash-skip"
        aria-label="Saltar pantalla de bienvenida"
      >
        Saltar
      </button>
    </div>
  );
}
