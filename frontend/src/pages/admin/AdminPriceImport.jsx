import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { UploadCloud, DatabaseZap, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

export default function AdminPriceImport() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [sync, setSync] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const loadLogs = async () => {
    try {
      const { data } = await api.get("/admin/prices/logs", { params: { limit: 50 } });
      setLogs(data);
    } catch {}
  };
  const loadSync = async () => {
    try {
      const { data } = await api.get("/admin/catalog/sync-status");
      setSync(data);
      if (data?.status?.running) {
        setSyncing(true);
        setTimeout(loadSync, 3000);
      } else {
        setSyncing(false);
      }
    } catch {}
  };
  useEffect(() => { loadLogs(); loadSync(); }, []);

  const runSync = async () => {
    if (!window.confirm("¿Sincronizar el catálogo con los Excel del repositorio? Se archivarán los productos que no estén en los Excel.")) return;
    setSyncing(true);
    try {
      await api.post("/admin/catalog/sync");
      toast.success("Sincronización iniciada");
      setTimeout(loadSync, 2000);
    } catch (err) {
      setSyncing(false);
      toast.error("Error al sincronizar", { description: err?.response?.data?.detail || err.message });
    }
  };

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/prices/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      toast.success(`${data.updated} productos actualizados`);
      loadLogs();
    } catch (err) {
      toast.error("Error al importar", { description: err?.response?.data?.detail || err.message });
    } finally { setLoading(false); }
  };

  return (
    <div data-testid="admin-prices-page">
      <div className="overline mb-2">Automatización</div>
      <h1 className="font-heading text-3xl font-light mb-3">Catálogo y precios · Excel</h1>

      <div className="bg-white border border-bone-200 p-7 mb-10 rounded-sm" data-testid="catalog-sync-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 font-heading text-lg mb-2">
              <DatabaseZap size={18} className="text-sage-600" /> Sincronizar catálogo (Excel del repositorio)
            </div>
            <p className="text-sm text-ink-soft font-light leading-relaxed">
              Reconstruye el catálogo (productos, precios, IVA, formatos) desde los Excel maestros que viajan
              con el código. <strong>Al arrancar en un entorno nuevo esto se ejecuta solo</strong>; este botón
              permite forzarlo manualmente. Las traducciones y el SEO que falten se regeneran automáticamente después.
            </p>
            {sync?.marker && (
              <div className="flex flex-wrap items-center gap-4 mt-4 text-xs">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${sync.marker.in_sync ? "bg-sage-100 text-sage-700" : "bg-terracotta/15 text-terracotta"}`} data-testid="catalog-sync-state">
                  {sync.marker.in_sync ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                  {sync.marker.in_sync ? "Catálogo en sincronía con los Excel" : "Catálogo desincronizado"}
                </span>
                <span className="text-ink-soft">Productos en BD: <strong className="text-ink">{sync.products_in_db}</strong></span>
                {sync.marker.imported_at && (
                  <span className="text-ink-soft">Última importación: {new Date(sync.marker.imported_at).toLocaleString("es-ES")}</span>
                )}
              </div>
            )}
            {sync?.status?.error && (
              <div className="mt-3 text-xs text-red-600">Último error: {sync.status.error}</div>
            )}
          </div>
          <button
            onClick={runSync}
            disabled={syncing}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-60"
            data-testid="catalog-sync-btn"
          >
            {syncing ? (<><Loader2 size={15} className="animate-spin" /> Sincronizando…</>) : (<><DatabaseZap size={15} /> Sincronizar ahora</>)}
          </button>
        </div>
      </div>

      <h2 className="font-heading text-xl font-light mb-3">Actualización puntual de precios</h2>
      <p className="text-sm text-ink-soft max-w-xl mb-8 font-light">
        Sube un archivo <strong>.xlsx</strong> con columnas <code className="bg-bone-200 px-1">sku</code>,
        <code className="bg-bone-200 px-1 ml-1">pvp</code> y/o <code className="bg-bone-200 px-1">b2b</code>.
        Se hace match por SKU (producto base o variación) y se actualizan los precios.
      </p>

      <form onSubmit={upload} className="bg-white border border-bone-200 p-8 flex flex-wrap gap-4 items-center" data-testid="prices-form">
        <label className="flex-1 border-2 border-dashed border-bone-200 hover:border-sage-500 p-6 flex items-center gap-3 cursor-pointer transition rounded-sm">
          <UploadCloud size={18} className="text-sage-600" />
          <div className="flex-1">
            <div className="text-sm text-ink">{file ? file.name : "Selecciona un archivo Excel (.xlsx)"}</div>
            <div className="text-xs text-ink-soft mt-1">Columnas requeridas: sku, pvp, b2b</div>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            data-testid="prices-file-input"
          />
        </label>
        <button type="submit" disabled={!file || loading} className="btn-primary" data-testid="prices-submit">
          {loading ? "Procesando..." : "Importar"}
        </button>
      </form>

      {result && (
        <div className="mt-6 bg-white border border-bone-200 p-6" data-testid="prices-result">
          <h3 className="font-heading text-lg mb-3">Resumen</h3>
          <ul className="text-sm space-y-1.5">
            <li>Filas procesadas: <strong>{result.total_rows}</strong></li>
            <li className="text-sage-700">Actualizados: <strong>{result.updated}</strong></li>
            <li className="text-terracotta">SKUs no encontrados: <strong>{result.not_found}</strong></li>
            {result.errors.length > 0 && (
              <li>
                Errores:
                <ul className="list-disc pl-6 mt-1 text-red-600">
                  {result.errors.slice(0, 10).map((er, i) => <li key={i}>{er}</li>)}
                </ul>
              </li>
            )}
            {result.not_found_skus.length > 0 && (
              <li>
                No encontrados:
                <div className="font-mono text-xs mt-1 max-h-32 overflow-y-auto bg-bone-100 p-2 rounded-sm">
                  {result.not_found_skus.join(", ")}
                </div>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-12 bg-white border border-bone-200">
        <div className="p-6 border-b border-bone-200">
          <h3 className="font-heading text-lg">Historial de cambios</h3>
        </div>
        <div className="max-h-96 overflow-y-auto eco-scroll">
          {logs.length === 0 ? (
            <div className="p-6 text-sm text-ink-soft text-center">Sin cambios recientes.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.14em] text-ink-soft text-left border-b border-bone-200 bg-bone-100/60">
                  <th className="p-3">Fecha</th>
                  <th>SKU</th>
                  <th>PVP (antes → después)</th>
                  <th>B2B (antes → después)</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l, idx) => (
                  <tr key={`${l.sku}-${l.created_at}-${idx}`} className="border-b border-bone-100" data-testid={`price-log-${l.sku}-${idx}`}>
                    <td className="p-3 text-xs">{new Date(l.created_at).toLocaleString("es-ES")}</td>
                    <td className="font-mono text-xs">{l.sku}</td>
                    <td>{l.old_retail ?? "—"} → <strong>{l.new_retail ?? "—"}</strong></td>
                    <td>{l.old_professional ?? "—"} → <strong>{l.new_professional ?? "—"}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
