import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Password field with a show/hide eye toggle.
 * Forwards all standard input props (value, onChange, placeholder, required...).
 */
export default function PasswordInput({ className = "", testid, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`input-eco !pr-11 ${className}`}
        data-testid={testid}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        data-testid={testid ? `${testid}-toggle` : "password-toggle"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-sage-700 transition-colors"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
