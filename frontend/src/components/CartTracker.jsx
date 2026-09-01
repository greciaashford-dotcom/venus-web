import { useEffect, useRef } from "react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const CART_ID_KEY = "eco_cart_tracker_id";
const GUEST_EMAIL_KEY = "eco_guest_email";

export function getCartTrackerId() {
  let id = localStorage.getItem(CART_ID_KEY);
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(CART_ID_KEY, id);
  }
  return id;
}

export function rememberGuestEmail(email) {
  if (email && /\S+@\S+\.\S+/.test(email)) {
    localStorage.setItem(GUEST_EMAIL_KEY, email.toLowerCase());
  }
}

export function buildCartSnapshot(items, subtotal, email) {
  return {
    cart_id: getCartTrackerId(),
    email: email || null,
    items: items.map((i) => ({
      product_id: i.product_id,
      name: i.name,
      variation_name: i.variation_name || null,
      quantity: i.quantity,
      unit_price: i.unit_price,
      image_url: i.image_url || "",
    })),
    subtotal,
  };
}

/**
 * Recuperación de carritos abandonados: envía snapshots del carrito al backend
 * (con debounce) para que el scheduler pueda mandar el recordatorio por email.
 * Usuarios logueados: siempre con su email. Invitados: en cuanto lo escriben
 * en el checkout (se recuerda en localStorage).
 */
export default function CartTracker() {
  const { items, subtotal } = useCart();
  const { user } = useAuth();
  const timer = useRef(null);
  const firstRun = useRef(true);

  useEffect(() => {
    // evitar un POST en cada carga de página si el carrito está vacío
    if (firstRun.current) {
      firstRun.current = false;
      if (items.length === 0) return undefined;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const email = user?.email || localStorage.getItem(GUEST_EMAIL_KEY) || null;
      api.post("/cart/track", buildCartSnapshot(items, subtotal, email)).catch(() => {});
    }, 1800);
    return () => clearTimeout(timer.current);
  }, [items, subtotal, user?.email]);

  return null;
}
