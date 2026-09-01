import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./CoverflowCarousel.css";

/**
 * Carrusel 3D tipo coverflow para las categorías de la tienda.
 * slides: [{ id, title, cat, img, description, product_count }]
 * - Click en la tarjeta central o laterales -> /tienda?cat=...
 * - Arrastre con ratón/dedo (el click se suprime si hubo arrastre real)
 * - Movimiento automático hacia la izquierda cada 2 s (pausa en hover/drag)
 */
export const CoverflowCarousel = ({ slides }) => {
  const navigate = useNavigate();
  const count = slides.length;

  const frameRef = useRef(null);
  const cardRefs = useRef([]);
  const posRef = useRef(0);
  const targetRef = useRef(0);
  const widthRef = useRef(0);
  const rafRef = useRef(null);
  const dragRef = useRef(null);
  const hoverRef = useRef(false);
  const suppressClickRef = useRef(false);

  const [selected, setSelected] = useState(0);

  const indexAt = useCallback(
    (pos) => ((Math.round(pos) % count) + count) % count,
    [count],
  );

  const paint = useCallback(() => {
    const width = widthRef.current;
    if (!width) return;

    const pitch = width * 1.07;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;

      let offset = ((index - posRef.current) % count + count) % count;
      if (offset > count / 2) offset -= count;

      const distance = Math.abs(offset);
      const ramp = Math.pow(distance, 0.58);
      const tilt = Math.min(42 * ramp, 80) * Math.sign(offset);

      card.style.transform =
        `translateX(calc(-50% + ${offset * pitch}px)) ` +
        `translateZ(${-0.62 * width * ramp}px) ` +
        `rotateY(${-tilt}deg)`;

      card.style.opacity = String(
        Math.max(0, 1 - 0.11 * distance) *
          Math.min(1, Math.max(0, count / 2 - distance)),
      );

      card.style.zIndex = String(100 - Math.round(distance));
    });
  }, [count]);

  const settle = useCallback(
    (target) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      targetRef.current = target;
      setSelected(indexAt(target));

      const step = () => {
        const remaining = target - posRef.current;
        if (Math.abs(remaining) < 0.0004) {
          posRef.current = target;
          paint();
          rafRef.current = null;
          return;
        }
        posRef.current += remaining * 0.16;
        paint();
        rafRef.current = requestAnimationFrame(step);
      };

      rafRef.current = requestAnimationFrame(step);
    },
    [indexAt, paint],
  );

  const nudge = useCallback(
    (by) => {
      settle(Math.round(targetRef.current) + by);
    },
    [settle],
  );

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const measure = () => {
      if (cardRefs.current[0]) {
        widthRef.current = cardRefs.current[0].offsetWidth;
        paint();
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [paint]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  // Movimiento automático hacia la izquierda cada 2 s (pausa con hover o arrastre).
  useEffect(() => {
    if (count < 2) return undefined;
    const timer = window.setInterval(() => {
      if (!dragRef.current && !hoverRef.current) {
        nudge(1);
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [count, nudge]);

  if (!count) return null;

  const active = slides[selected];

  const goToCategory = (slide) => {
    navigate(slide.cat ? `/tienda?cat=${encodeURIComponent(slide.cat)}` : "/tienda");
  };

  return (
    <div
      className="coverflow"
      role="region"
      aria-label="Nuestras categorías"
      data-testid="category-coverflow"
    >
      <div
        ref={frameRef}
        className="coverflow-frame"
        tabIndex={0}
        onMouseEnter={() => { hoverRef.current = true; }}
        onMouseLeave={() => { hoverRef.current = false; }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") nudge(-1);
          if (event.key === "ArrowRight") nudge(1);
        }}
        onPointerDown={(event) => {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          suppressClickRef.current = false;
          dragRef.current = {
            id: event.pointerId,
            x: event.clientX,
            pos: posRef.current,
          };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.id !== event.pointerId) return;

          if (Math.abs(event.clientX - drag.x) > 6 && !suppressClickRef.current) {
            suppressClickRef.current = true;
            try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* ignore */ }
          }

          posRef.current =
            drag.pos - (event.clientX - drag.x) / (widthRef.current * 1.07);

          setSelected(indexAt(posRef.current));
          paint();
        }}
        onPointerUp={(event) => {
          if (dragRef.current?.id === event.pointerId) {
            dragRef.current = null;
            settle(Math.round(posRef.current));
          }
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          settle(Math.round(posRef.current));
        }}
        data-testid="coverflow-drag-area"
      >
        <div className="coverflow-stage">
          {slides.map((slide, index) => (
            <button
              type="button"
              key={slide.id}
              ref={(node) => { cardRefs.current[index] = node; }}
              className="coverflow-card"
              aria-label={`Ver productos de ${slide.title}`}
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                goToCategory(slide);
              }}
              data-testid={`category-slide-${slide.id}`}
            >
              <img
                src={slide.img}
                alt={`Categoría ${slide.title}`}
                loading={index < 5 ? "eager" : "lazy"}
                draggable={false}
              />
              <span className="coverflow-card-label">{slide.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="coverflow-caption" key={active.id}>
        <span data-testid="active-category-number">
          {String(selected + 1).padStart(2, "0")} / {count}
        </span>

        <div>
          <h3 data-testid="active-category-name">{active.title}</h3>
          {active.description && (
            <small data-testid="active-category-description">{active.description}</small>
          )}
          <button
            type="button"
            className="coverflow-cta"
            onClick={() => goToCategory(active)}
            data-testid="active-category-cta"
          >
            Ver {active.product_count ? `${active.product_count} productos` : "productos"} →
          </button>
        </div>

        <div className="coverflow-nav">
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label="Categoría anterior"
            data-testid="coverflow-previous-button"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label="Categoría siguiente"
            data-testid="coverflow-next-button"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoverflowCarousel;
