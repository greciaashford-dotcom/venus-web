import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("eco_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Attach current UI language so the backend can serve localized product content.
  const lang = (localStorage.getItem("eco_lang") || "es").split("-")[0];
  if (config.method === "get" || !config.method) {
    config.params = { ...(config.params || {}), lang };
  }
  return config;
});

export function formatEUR(value) {
  if (value === null || value === undefined || isNaN(value)) return "—";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

// Resolve an asset URL: backend-served files (/api/files/...) get the backend prefix;
// absolute URLs (scraped from source site) are returned as-is.
export function resolveAsset(url) {
  if (!url) return "";
  if (url.startsWith("/api/")) return `${BACKEND_URL}${url}`;
  return url;
}

// Upload a file (image/pdf) to the admin object-storage endpoint. Returns { url, filename, ... }.
export async function uploadFile(file, kind = "image") {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);
  const token = localStorage.getItem("eco_token");
  const res = await fetch(`${API}/admin/uploads`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    let detail = "Error al subir el archivo";
    try { detail = (await res.json()).detail || detail; } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json();
}
