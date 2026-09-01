import React, { useEffect, useState } from "react";
import { TicketPercent, Plus, Trash2, Pencil, X, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "sonner";

const empty = () => ({
  code: "",
  description: "",
  conditions: "",
  discount_type: "fixed",
  discount_value: 5,
  min_subtotal: 0,
  first_order_only: false,
  usage_limit: "",
  starts_at: "",
  expires_at: "",
  product_skus: "",
  active: true,
});

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null = closed, {} = create, {id} = edit
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .get("/admin/coupons")
      .then(({ data }) => setCoupons(data.coupons || []))
      .catch(() => toast.error("Error al cargar cupones"))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openCreate = () => setForm(empty());
  const openEdit = (c) =>
    setForm({
      ...c,
      usage_limit: c.usage_limit ?? "",
      starts_at: c.starts_at ? String(c.starts_at).slice(0, 10) : "",
      expires_at: c.expires_at ? String(c.expires_at).slice(0, 10) : "",
      product_skus: Array.isArray(c.product_skus) ? c.product_skus.join(", ") : "",
    });

  const save = async () => {
    if (!form.code || form.code.trim().length < 3) {
      toast.error("El código debe tener al menos 3 caracteres");
      return;
    }
    if (!form.discount_value || Number(form.discount_value) <= 0) {
      toast.error("El descuento debe ser mayor que 0");
      return;
    }
    setSaving(true);
    const payload = {
      code: form.code,
      description: form.description || "",
      conditions: form.conditions || "",
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      min_subtotal: Number(form.min_subtotal || 0),
      first_order_only: !!form.first_order_only,
      usage_limit: form.usage_limit === "" ? null : Number(form.usage_limit),
      starts_at: form.starts_at || null,
      expires_at: form.expires_at || null,
      product_skus: (form.product_skus || "").split(",").map((s) => s.trim()).filter(Boolean),
      active: !!form.active,
    };
    try {
      if (form.id) {
        await api.put(`/admin/coupons/${form.id}`, payload);
        toast.success("Cupón actualizado");
      } else {
        await api.post("/admin/coupons", payload);
        toast.success("Cupón creado");
      }
      setForm(null);
      load();
    } catch (err) {
      toast.error("Error al guardar", { description: err?.response?.data?.detail || err.message });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c) => {
    try {
      await api.put(`/admin/coupons/${c.id}`, {
        code: c.code,
        description: c.description || "",
        conditions: c.conditions || "",
        discount_type: c.discount_type,
        discount_value: c.discount_value,
        min_subtotal: c.min_subtotal || 0,
        first_order_only: !!c.first_order_only,
        usage_limit: c.usage_limit ?? null,
        starts_at: c.starts_at || null,
        expires_at: c.expires_at || null,
        product_skus: Array.isArray(c.product_skus) ? c.product_skus : [],
        active: !c.active,
      });
      load();
    } catch {
      toast.error("Error al cambiar estado");
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`¿Eliminar el cupón ${c.code}?`)) return;
    try {
      await api.delete(`/admin/coupons/${c.id}`);
      setCoupons((prev) => prev.filter((x) => x.id !== c.id));
      toast.success("Cupón eliminado");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const fmtDiscount = (c) =>
    c.discount_type === "percent" ? `${c.discount_value}%` : `${Number(c.discount_value).toFixed(2)}€`;

  return (
    <div data-testid="admin-coupons-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="overline">Marketing</div>
          <h1 className="font-heading text-3xl font-light">Cupones de descuento</h1>
          <p className="text-ink-soft text-sm mt-2 max-w-2xl">
            Crea y gestiona códigos de descuento. Se validan automáticamente en el carrito y el checkout.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2" data-testid="coupon-create-btn">
          <Plus size={15} /> Nuevo cupón
        </button>
      </div>

      {form && (
        <div className="bg-white border border-sage-200 rounded-md p-6 mb-8" data-testid="coupon-form">
          <div className="flex items-center justify-between mb-5">
            <div className="font-heading text-lg">{form.id ? `Editar ${form.code}` : "Nuevo cupón"}</div>
            <button onClick={() => setForm(null)} className="text-ink-muted hover:text-ink" data-testid="coupon-form-close"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <label className="block text-xs text-ink-soft">Código *
              <input className="input-eco mt-1 uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="ECOBONUS" data-testid="coupon-code-input" /></label>
            <label className="block text-xs text-ink-soft">Tipo de descuento
              <select className="input-eco mt-1" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} data-testid="coupon-type-select">
                <option value="fixed">Importe fijo (€)</option>
                <option value="percent">Porcentaje (%)</option>
              </select></label>
            <label className="block text-xs text-ink-soft">{form.discount_type === "percent" ? "Descuento (%)" : "Descuento (€)"} *
              <input type="number" min="0" step="0.5" className="input-eco mt-1" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} data-testid="coupon-value-input" /></label>
            <label className="block text-xs text-ink-soft">Compra mínima (€)
              <input type="number" min="0" step="1" className="input-eco mt-1" value={form.min_subtotal} onChange={(e) => setForm({ ...form, min_subtotal: e.target.value })} data-testid="coupon-min-input" /></label>
            <label className="block text-xs text-ink-soft">Límite de usos (vacío = ilimitado)
              <input type="number" min="1" className="input-eco mt-1" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} data-testid="coupon-limit-input" /></label>
            <label className="block text-xs text-ink-soft">Fecha de inicio (vacío = activo ya)
              <input type="date" className="input-eco mt-1" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} data-testid="coupon-start-input" /></label>
            <label className="block text-xs text-ink-soft">Caducidad (vacío = sin caducidad)
              <input type="date" className="input-eco mt-1" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} data-testid="coupon-expiry-input" /></label>
            <label className="block text-xs text-ink-soft sm:col-span-2 lg:col-span-3">SKUs de productos (separados por coma · vacío = todos los productos)
              <input className="input-eco mt-1 font-mono uppercase" value={form.product_skus} onChange={(e) => setForm({ ...form, product_skus: e.target.value })} placeholder="ACA70, ACE70, ALMP100" data-testid="coupon-products-input" /></label>
            <label className="block text-xs text-ink-soft sm:col-span-2 lg:col-span-3">Condiciones (texto visible)
              <textarea className="input-eco mt-1" rows={2} value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} placeholder="Válido solo para pedidos superiores a 60€. No acumulable con otras promociones." data-testid="coupon-conditions-input" /></label>
            <label className="block text-xs text-ink-soft sm:col-span-2 lg:col-span-3">Descripción interna
              <input className="input-eco mt-1" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="5€ de descuento en tu primer pedido (mínimo 60€)" data-testid="coupon-desc-input" /></label>
          </div>
          <div className="flex flex-wrap items-center gap-6 mt-4">
            <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input type="checkbox" checked={!!form.first_order_only} onChange={(e) => setForm({ ...form, first_order_only: e.target.checked })} className="accent-sage-600" data-testid="coupon-firstorder-check" />
              Solo primer pedido
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="accent-sage-600" data-testid="coupon-active-check" />
              Activo
            </label>
            <button onClick={save} disabled={saving} className="btn-primary ml-auto inline-flex items-center gap-2 disabled:opacity-60" data-testid="coupon-save-btn">
              {saving ? <Loader2 size={15} className="animate-spin" /> : null}
              {form.id ? "Guardar cambios" : "Crear cupón"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white border border-bone-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="coupons-table">
            <thead>
              <tr className="bg-bone-100 text-left">
                <th className="px-5 py-3.5 overline font-medium">Código</th>
                <th className="px-5 py-3.5 overline font-medium">Descuento</th>
                <th className="px-5 py-3.5 overline font-medium">Compra mín.</th>
                <th className="px-5 py-3.5 overline font-medium">Reglas</th>
                <th className="px-5 py-3.5 overline font-medium">Usos</th>
                <th className="px-5 py-3.5 overline font-medium">Estado</th>
                <th className="px-5 py-3.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bone-200">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-ink-soft">Cargando…</td></tr>
              ) : coupons.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-14 text-center text-ink-soft" data-testid="coupons-empty">
                  <TicketPercent size={28} className="mx-auto mb-3 text-bone-300" />
                  No hay cupones. Crea el primero con el botón de arriba.
                </td></tr>
              ) : (
                coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-bone-50 transition" data-testid={`coupon-row-${c.code}`}>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-ink tracking-wide">{c.code}</div>
                      {c.description ? <div className="text-[11px] text-ink-muted mt-0.5 max-w-[260px] truncate">{c.description}</div> : null}
                    </td>
                    <td className="px-5 py-3.5 text-sage-700 font-medium">-{fmtDiscount(c)}</td>
                    <td className="px-5 py-3.5 text-ink-soft">{c.min_subtotal ? `${Number(c.min_subtotal).toFixed(0)}€` : "—"}</td>
                    <td className="px-5 py-3.5 text-ink-soft text-xs">
                      {[c.first_order_only ? "1er pedido" : null, c.starts_at ? `Desde ${String(c.starts_at).slice(0, 10)}` : null, c.expires_at ? `Caduca ${String(c.expires_at).slice(0, 10)}` : null, c.usage_limit ? `Máx ${c.usage_limit} usos` : null, (Array.isArray(c.product_skus) && c.product_skus.length) ? `${c.product_skus.length} producto(s)` : null].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-ink-soft">{c.used_count || 0}{c.usage_limit ? ` / ${c.usage_limit}` : ""}</td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => toggleActive(c)} data-testid={`coupon-toggle-${c.code}`}
                        className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide px-2.5 py-1 rounded-full transition ${c.active ? "bg-sage-100 text-sage-700 hover:bg-sage-200" : "bg-bone-100 text-ink-muted hover:bg-bone-200"}`}>
                        {c.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {c.active ? "Activo" : "Inactivo"}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(c)} className="p-1.5 text-ink-muted hover:text-sage-700 transition" aria-label="Editar" data-testid={`coupon-edit-${c.code}`}><Pencil size={14} /></button>
                      <button onClick={() => remove(c)} className="p-1.5 text-ink-muted hover:text-red-500 transition" aria-label="Eliminar" data-testid={`coupon-delete-${c.code}`}><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
