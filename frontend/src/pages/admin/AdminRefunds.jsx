import React, { useEffect, useState } from "react";
import { api, formatEUR } from "../../lib/api";
import { toast } from "sonner";
import { Plus, Trash2, RotateCcw, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function AdminRefunds() {
  const [reasons, setReasons] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [newReason, setNewReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        api.get("/admin/refund-reasons"),
        api.get("/admin/refunds"),
      ]);
      setReasons(r1.data.reasons || []);
      setRefunds(r2.data.refunds || []);
    } catch {
      toast.error("Error al cargar");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const addReason = async () => {
    if (!newReason.trim()) return;
    setSaving(true);
    try {
      await api.post("/admin/refund-reasons", { label: newReason.trim(), active: true });
      setNewReason("");
      toast.success("Motivo añadido");
      load();
    } catch (e) { toast.error("Error", { description: e?.response?.data?.detail }); }
    finally { setSaving(false); }
  };

  const toggleReason = async (r) => {
    try {
      await api.put(`/admin/refund-reasons/${r.id}`, { label: r.label, active: !r.active });
      load();
    } catch { toast.error("Error"); }
  };

  const removeReason = async (r) => {
    if (!window.confirm(`¿Eliminar el motivo "${r.label}"?`)) return;
    try {
      await api.delete(`/admin/refund-reasons/${r.id}`);
      setReasons((prev) => prev.filter((x) => x.id !== r.id));
      toast.success("Motivo eliminado");
    } catch { toast.error("Error"); }
  };

  return (
    <div data-testid="admin-refunds-page">
      <div className="overline mb-2">Postventa</div>
      <h1 className="font-heading text-3xl font-light mb-1">Reembolsos</h1>
      <p className="text-sm text-ink-soft mb-8">Gestiona los motivos de reembolso y consulta el historial. Los reembolsos se generan desde el detalle de cada pedido.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reasons */}
        <div className="bg-white border border-bone-200 rounded-md p-6">
          <h2 className="font-heading text-xl font-normal mb-4">Motivos de reembolso</h2>
          <div className="flex gap-2 mb-4">
            <input className="input-eco flex-1" value={newReason} onChange={(e) => setNewReason(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addReason()} placeholder="Nuevo motivo (ej. Falta de stock)" data-testid="refund-reason-input" />
            <button onClick={addReason} disabled={saving} className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-60" data-testid="refund-reason-add">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Añadir
            </button>
          </div>
          <ul className="divide-y divide-bone-100" data-testid="refund-reasons-list">
            {reasons.map((r) => (
              <li key={r.id} className="py-2.5 flex items-center justify-between gap-3" data-testid={`refund-reason-${r.id}`}>
                <span className={`text-sm ${r.active ? "text-ink" : "text-ink-muted line-through"}`}>{r.label}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleReason(r)} className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-wide px-2 py-1 rounded-full ${r.active ? "bg-sage-100 text-sage-700" : "bg-bone-100 text-ink-muted"}`}>
                    {r.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {r.active ? "Activo" : "Inactivo"}
                  </button>
                  <button onClick={() => removeReason(r)} className="p-1.5 text-ink-muted hover:text-terracotta" aria-label="Eliminar"><Trash2 size={14} /></button>
                </div>
              </li>
            ))}
            {reasons.length === 0 && <li className="py-4 text-sm text-ink-soft">Sin motivos.</li>}
          </ul>
        </div>

        {/* History */}
        <div className="bg-white border border-bone-200 rounded-md p-6">
          <h2 className="font-heading text-xl font-normal mb-4">Historial de reembolsos</h2>
          {loading ? (
            <div className="text-sm text-ink-soft py-6 text-center">Cargando…</div>
          ) : refunds.length === 0 ? (
            <div className="text-sm text-ink-soft py-6 text-center flex flex-col items-center gap-2" data-testid="refunds-empty">
              <RotateCcw size={24} className="text-bone-300" /> Todavía no hay reembolsos.
            </div>
          ) : (
            <ul className="divide-y divide-bone-100" data-testid="refunds-history">
              {refunds.map((r) => (
                <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-ink font-medium">{r.order_number} · {formatEUR(r.amount)}</div>
                    <div className="text-xs text-ink-soft">{r.reason} · {r.email}</div>
                    <div className="text-[11px] text-ink-muted mt-0.5">
                      {r.manual ? "Reembolso manual" : `Vía ${r.provider}`} · {new Date(r.created_at).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wide px-2 py-1 rounded-full ${r.provider_ok ? "bg-sage-100 text-sage-700" : "bg-bone-100 text-ink-muted"}`}>
                    {r.provider_ok ? "Procesado" : "Manual/Pendiente"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
