// First-party traffic analytics: session/visitor ids, first-touch acquisition
// and pageview tracking. No cookies, no external trackers (RGPD-friendly).
import { api } from "./api";

const SID_KEY = "eco_sid";
const VID_KEY = "eco_vid";
const ACQ_KEY = "eco_acq";
const REF_SENT_KEY = "eco_ref_sent";

function genId() {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  } catch { /* ignore */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getSessionId() {
  try {
    let sid = sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid = genId();
      sessionStorage.setItem(SID_KEY, sid);
    }
    return sid;
  } catch {
    return "no-storage";
  }
}

export function getVisitorId() {
  try {
    let vid = localStorage.getItem(VID_KEY);
    if (!vid) {
      vid = genId();
      localStorage.setItem(VID_KEY, vid);
    }
    return vid;
  } catch {
    return "no-storage";
  }
}

// Capture first-touch acquisition once per visitor (referrer + UTM + landing page).
export function captureAcquisition() {
  try {
    const existing = localStorage.getItem(ACQ_KEY);
    if (existing) return JSON.parse(existing);
    const params = new URLSearchParams(window.location.search);
    const acq = {
      referrer: document.referrer || "",
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
      landing_page: window.location.pathname + window.location.search,
      ts: new Date().toISOString(),
    };
    localStorage.setItem(ACQ_KEY, JSON.stringify(acq));
    return acq;
  } catch {
    return {};
  }
}

export function getAcquisition() {
  try {
    return JSON.parse(localStorage.getItem(ACQ_KEY) || "{}");
  } catch {
    return {};
  }
}

export function trackPageview(path) {
  try {
    if (!path || path.startsWith("/admin")) return;
    let refSent = false;
    try { refSent = sessionStorage.getItem(REF_SENT_KEY) === "1"; } catch { /* ignore */ }
    const params = new URLSearchParams(window.location.search);
    const body = {
      session_id: getSessionId(),
      visitor_id: getVisitorId(),
      path,
      referrer: refSent ? "" : (document.referrer || ""),
      utm_source: params.get("utm_source") || "",
      utm_medium: params.get("utm_medium") || "",
      utm_campaign: params.get("utm_campaign") || "",
    };
    try { sessionStorage.setItem(REF_SENT_KEY, "1"); } catch { /* ignore */ }
    api.post("/track/pageview", body).catch(() => {});
  } catch {
    /* tracking must never break the app */
  }
}

// ---- Shared labels for acquisition sources (dashboard + orders table) ----
export const SOURCE_LABELS = {
  direct: "Directo",
  google: "Org\u00e1nico: Google",
  bing: "Org\u00e1nico: Bing",
  yahoo: "Org\u00e1nico: Yahoo",
  duckduckgo: "Org\u00e1nico: DuckDuckGo",
  ecosia: "Org\u00e1nico: Ecosia",
  facebook: "Social: Facebook",
  instagram: "Social: Instagram",
  tiktok: "Social: TikTok",
  x_twitter: "Social: X (Twitter)",
  linkedin: "Social: LinkedIn",
  youtube: "Social: YouTube",
  pinterest: "Social: Pinterest",
  whatsapp: "Social: WhatsApp",
  telegram: "Social: Telegram",
  chatgpt: "IA: ChatGPT",
  gemini: "IA: Gemini",
  perplexity: "IA: Perplexity",
  copilot: "IA: Copilot",
  referral: "Referencia",
};

export const SOURCE_COLORS = {
  direct: "#8A8F87",
  google: "#6B826E",
  bing: "#7C9885",
  facebook: "#5A7A9E",
  instagram: "#B0654F",
  tiktok: "#4A4A4A",
  x_twitter: "#3D3D3D",
  linkedin: "#4E7396",
  youtube: "#A85A4A",
  chatgpt: "#8B7BA8",
  gemini: "#8B7BA8",
  perplexity: "#8B7BA8",
  referral: "#C2A878",
};

export function originLabel(acq) {
  if (!acq || !acq.source) return "Desconocido";
  if (acq.source === "referral" && acq.referrer_host) return `Fuente: ${acq.referrer_host}`;
  return SOURCE_LABELS[acq.source] || `Campa\u00f1a: ${acq.source}`;
}

export function sourceLabel(source) {
  return SOURCE_LABELS[source] || `Campa\u00f1a: ${source}`;
}
