import React, { useRef, useState } from "react";
import { Upload, Loader2, Link2, X } from "lucide-react";
import { uploadFile, resolveAsset, api } from "../../lib/api";
import { toast } from "sonner";

// Reusable upload control. kind: 'image' | 'pdf'. Calls onUploaded({url, filename}) per file.
// Set multiple={true} to allow selecting and uploading many files at once.
// Incluye SIEMPRE la opción "por enlace": el botón 🔗 abre un diálogo para pegar
// la URL del archivo alojado en la nube/CDN del cliente (misma callback onUploaded).
export default function UploadButton({ kind = "image", label, onUploaded, testid, multiple = false, allowLink = true }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const accept = kind === "pdf" ? "application/pdf" : "image/*";

  const handle = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBusy(true);
    setProgress({ done: 0, total: files.length });
    let ok = 0;
    const failed = [];
    for (const file of files) {
      try {
        const res = await uploadFile(file, kind);
        ok += 1;
        onUploaded(res);
      } catch (err) {
        failed.push(file.name);
        toast.error(`Error al subir ${file.name}`, { description: err.message });
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    if (ok > 0) {
      toast.success(ok === 1 ? "Archivo subido" : `${ok} archivos subidos`, {
        description: failed.length ? `${failed.length} con error` : undefined,
      });
    }
    setBusy(false);
    setProgress({ done: 0, total: 0 });
    if (ref.current) ref.current.value = "";
  };

  const submitLink = async () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\/\S+/.test(url)) {
      toast.error("URL no válida", { description: "Debe empezar por http:// o https://" });
      return;
    }
    setLinkBusy(true);
    try {
      // Registra el enlace en la biblioteca de medios y devuelve {url, filename}
      const { data } = await api.post("/admin/files/external", { url });
      onUploaded?.(data);
      toast.success("Enlace aplicado", { description: data.filename });
      setLinkOpen(false);
      setLinkUrl("");
    } catch (e) {
      toast.error("Error al usar el enlace", { description: e?.response?.data?.detail || e.message });
    } finally {
      setLinkBusy(false);
    }
  };

  const busyLabel = progress.total > 1 ? `Subiendo ${progress.done + 1 > progress.total ? progress.total : progress.done + 1}/${progress.total}\u2026` : "Subiendo\u2026";

  return (
    <>
      <span className="inline-flex items-stretch">
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          data-testid={testid}
          className={`inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] px-3 py-2 border border-bone-200 bg-white text-ink hover:border-sage-500 transition-colors disabled:opacity-60 ${allowLink ? "rounded-l-sm" : "rounded-sm"}`}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {busy ? busyLabel : (label || "Subir")}
        </button>
        {allowLink && (
          <button
            type="button"
            onClick={() => setLinkOpen(true)}
            disabled={busy}
            data-testid={testid ? `${testid}-link` : undefined}
            title="Usar un enlace de tu nube/CDN (URL directa)"
            aria-label="Usar enlace en lugar de subir archivo"
            className="inline-flex items-center px-2.5 py-2 rounded-r-sm border border-l-0 border-bone-200 bg-sage-50 text-sage-700 hover:bg-sage-100 hover:border-sage-500 transition-colors disabled:opacity-60"
          >
            <Link2 size={13} />
          </button>
        )}
      </span>
      <input ref={ref} type="file" accept={accept} multiple={multiple} onChange={handle} className="hidden" />

      {linkOpen && (
        <div
          className="fixed inset-0 z-[300] bg-ink/40 flex items-center justify-center p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setLinkOpen(false); }}
          data-testid={testid ? `${testid}-link-dialog` : "upload-link-dialog"}
        >
          <div className="bg-white border border-bone-200 rounded-md max-w-md w-full p-5" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-heading text-lg font-light">Usar enlace</h3>
              <button type="button" onClick={() => setLinkOpen(false)} aria-label="Cerrar" className="text-ink-muted hover:text-ink">
                <X size={16} />
              </button>
            </div>
            <p className="text-[11px] text-ink-soft leading-relaxed mb-3">
              Pega la URL directa de la {kind === "pdf" ? "ficha (PDF)" : "imagen o vídeo"} alojada en tu
              nube/CDN. Se usará ese enlace directamente (carga más rápida) y quedará también en la
              biblioteca de Archivos.
            </p>
            <input
              className="input-eco w-full"
              placeholder={kind === "pdf" ? "https://…/ficha.pdf" : "https://…/imagen.webp"}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitLink(); } }}
              autoFocus
              data-testid={testid ? `${testid}-link-input` : "upload-link-input"}
            />
            <div className="flex justify-end gap-2.5 mt-4">
              <button type="button" onClick={() => setLinkOpen(false)} className="btn-outline text-xs">Cancelar</button>
              <button
                type="button"
                onClick={submitLink}
                disabled={linkBusy}
                className="btn-primary text-xs inline-flex items-center gap-2 disabled:opacity-60"
                data-testid={testid ? `${testid}-link-submit` : "upload-link-submit"}
              >
                <Link2 size={13} /> {linkBusy ? "Aplicando…" : "Usar enlace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export { resolveAsset };
