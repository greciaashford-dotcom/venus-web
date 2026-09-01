// Información de la tienda física EcoAndes (reutilizable en Footer, Contacto, etc.)
export const STORE = {
  name: "Tienda EcoAndes",
  market: "Mercado Barceló",
  addressLine1: "C. de Barceló, 6 · Primera Planta",
  addressLine2: "Local 204, Centro",
  addressLine3: "28004 Madrid",
  mapsQuery: "Mercado Barceló, C. de Barceló 6, Local 204, 28004 Madrid",
};

// Horarios de atención (formato 24h, estilo España). dayKey se traduce vía i18n.
export const STORE_HOURS = [
  { dayKey: "mon", value: "9:30–14:30 · 17:30–20:00", closed: false },
  { dayKey: "tue", value: "9:30–14:30 · 17:30–20:00", closed: false },
  { dayKey: "wed", value: "9:30–14:30 · 17:30–20:00", closed: false },
  { dayKey: "thu", value: "9:30–14:30 · 17:30–20:00", closed: false },
  { dayKey: "fri", value: "9:30–14:30 · 17:30–20:00", closed: false },
  { dayKey: "sat", value: "9:30–15:00", closed: false },
  { dayKey: "sun", value: "", closed: true },
];

// Enlace exacto de Google Maps a la Tienda EcoAndes en el Mercado Barceló
export const STORE_MAPS_URL = "https://maps.app.goo.gl/8ugUbCCzhZ294igA8";

// Enlace exacto de Google Maps al Almacén (Meco, Madrid)
export const WAREHOUSE_MAPS_URL = "https://maps.app.goo.gl/Pa47rYqdjCzs62vX6";

// URL de mapa embebido (iframe) mostrando la Tienda EcoAndes en el Mercado Barceló
export const STORE_MAP_EMBED_URL = `https://www.google.com/maps?q=${encodeURIComponent(
  STORE.mapsQuery
)}&z=17&output=embed`;
