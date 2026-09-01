import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export default function AdminCustomers() {
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState("");

  const load = async () => {
    const { data } = await api.get("/admin/users", { params: { role: roleFilter || undefined } });
    setUsers(data);
  };

  useEffect(() => { load(); }, [roleFilter]);

  const setRole = async (id, role) => {
    try {
      await api.patch(`/admin/users/${id}`, { role });
      toast.success("Cliente actualizado");
      load();
    } catch (e) { toast.error("Error", { description: e?.response?.data?.detail }); }
  };

  const toggleApproved = async (u) => {
    try {
      await api.patch(`/admin/users/${u.id}/approval`, { approved: !u.approved });
      toast.success(!u.approved ? "Cuenta aprobada (email enviado)" : "Cuenta desactivada");
      load();
    } catch (e) { toast.error("Error", { description: e?.response?.data?.detail }); }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`¿Eliminar definitivamente al cliente "${u.first_name} ${u.last_name}" (${u.email})?\n\nEsta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast.success("Cliente eliminado", { description: u.email });
    } catch (e) { toast.error("No se pudo eliminar", { description: e?.response?.data?.detail }); }
  };

  return (
    <div data-testid="admin-customers-page">
      <div className="overline mb-2">Gestión</div>
      <h1 className="font-heading text-3xl font-light mb-6">Clientes</h1>
      <select className="input-eco max-w-xs mb-5" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} data-testid="customers-role-filter">
        <option value="">Todos los roles</option>
        <option value="retail">Retail</option>
        <option value="professional">Profesional</option>
        <option value="admin">Administrador</option>
      </select>
      <div className="bg-white border border-bone-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.14em] text-ink-soft text-left border-b border-bone-200">
              <th className="p-4">Nombre</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Empresa</th>
              <th>CIF/NIF</th>
              <th>Rol</th>
              <th>Aprobado</th>
              <th className="p-4">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-bone-100" data-testid={`user-row-${u.email}`}>
                <td className="p-4">{u.first_name} {u.last_name}</td>
                <td>{u.email}</td>
                <td>{u.phone ? <a href={`tel:${u.phone}`} className="text-sage-700 hover:underline" data-testid={`user-phone-${u.email}`}>{u.phone}</a> : "—"}</td>
                <td>{u.company || "—"}</td>
                <td>{u.tax_id || "—"}</td>
                <td>
                  <select className="text-xs border border-bone-200 px-2 py-1 rounded-sm" value={u.role} onChange={(e) => setRole(u.id, e.target.value)} data-testid={`user-role-${u.email}`}>
                    <option value="retail">Retail</option>
                    <option value="professional">Profesional</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>{u.approved ? "Sí" : "No"}</td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleApproved(u)} className="text-xs text-sage-700 hover:underline" data-testid={`user-toggle-${u.email}`}>
                      {u.approved ? "Desactivar" : "Aprobar"}
                    </button>
                    {u.role !== "admin" && (
                      <button onClick={() => deleteUser(u)} aria-label={`Eliminar ${u.email}`} className="text-ink-muted hover:text-red-500 transition-colors p-1" data-testid={`user-delete-${u.email}`}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={8} className="p-10 text-center text-ink-soft" data-testid="users-empty">Sin clientes.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
