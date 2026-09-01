import React, { useState } from "react";
import { Star } from "lucide-react";

/**
 * Star rating display & input.
 * - readOnly: solo muestra (acepta decimales para la media)
 * - interactive: permite seleccionar (onChange recibe 1..5)
 */
export default function StarRating({
  value = 0,
  onChange,
  size = 18,
  readOnly = false,
  className = "",
}) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`} data-testid="star-rating">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = readOnly ? value >= i - 0.5 : display >= i;
        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange && onChange(i)}
            onMouseEnter={() => !readOnly && setHover(i)}
            onMouseLeave={() => !readOnly && setHover(0)}
            aria-label={`${i} ${i === 1 ? "estrella" : "estrellas"}`}
            data-testid={readOnly ? undefined : `star-${i}`}
            className={`${readOnly ? "cursor-default" : "cursor-pointer transition-transform hover:scale-110"} p-0 leading-none bg-transparent`}
          >
            <Star
              size={size}
              className={filled ? "text-terracotta" : "text-bone-300"}
              fill={filled ? "currentColor" : "none"}
              strokeWidth={1.6}
            />
          </button>
        );
      })}
    </div>
  );
}
