import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, Users, ShoppingCart, ShoppingBasket, FileSpreadsheet, LogOut, Leaf, ImageIcon, Mail, MessageCircle, FolderOpen, TicketPercent, RotateCcw, GalleryHorizontal, Sparkles, ScrollText, Clapperboard, Newspaper } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function AdminLayout() {
  const { user, logout, loading } = useAuth();
  const nav = useNavigate();

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-ink-soft">Cargando…</div>;
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-center px-6">
        <div>
          <h1 className="font-heading text-3xl font-light">Acceso restringido</h1>
          <p className="text-ink-soft mt-3">Esta sección es solo para administradores.</p>
          <button onClick={() => nav("/login")} className="btn-primary mt-6" data-testid="admin-login-redirect">Acceder</button>
        </div>
      </div>
    );
  }

  const linkCls = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 text-sm rounded-sm transition ${
      isActive ? "bg-sage-100 text-sage-700 font-medium" : "text-ink-soft hover:text-sage-700 hover:bg-bone-200/70"
    }`;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#F2F4F2]" data-testid="admin-layout">
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] min-h-[calc(100vh-80px)]">
        <aside className="bg-white border-r border-bone-200 p-6 lg:sticky lg:top-0 lg:h-screen lg:flex lg:flex-col lg:overflow-hidden" data-testid="admin-sidebar">
          <div className="flex items-center gap-2 mb-8 pt-4 shrink-0">
            <img src="/logo-ecoandes.png" alt="EcoAndes" className="h-11 w-auto object-contain" />
            <span className="font-heading text-xs tracking-[0.22em] font-medium text-ink-soft uppercase">· Admin</span>
          </div>
          <nav className="flex flex-col gap-1 lg:flex-1 lg:min-h-0 lg:overflow-y-auto eco-scroll pr-1" data-testid="admin-sidebar-nav">
            <NavLink to="/admin" end className={linkCls} data-testid="admin-nav-dash"><LayoutDashboard size={16} /> Dashboard</NavLink>
            <NavLink to="/admin/pedidos" className={linkCls} data-testid="admin-nav-orders"><ShoppingCart size={16} /> Pedidos</NavLink>
            <NavLink to="/admin/clientes" className={linkCls} data-testid="admin-nav-customers"><Users size={16} /> Clientes</NavLink>
            <NavLink to="/admin/compradores" className={linkCls} data-testid="admin-nav-buyers"><Mail size={16} /> Compradores</NavLink>
            <NavLink to="/admin/whatsapp" className={linkCls} data-testid="admin-nav-whatsapp"><MessageCircle size={16} /> WhatsApp</NavLink>
            <NavLink to="/admin/carritos" className={linkCls} data-testid="admin-nav-carts"><ShoppingBasket size={16} /> Carritos abandonados</NavLink>
            <NavLink to="/admin/productos" className={linkCls} data-testid="admin-nav-products"><Package size={16} /> Productos</NavLink>
            <NavLink to="/admin/portada" className={linkCls} data-testid="admin-nav-hero"><ImageIcon size={16} /> Portada</NavLink>
            <NavLink to="/admin/carrusel" className={linkCls} data-testid="admin-nav-carousel"><GalleryHorizontal size={16} /> Carrusel categorías</NavLink>
            <NavLink to="/admin/recetas" className={linkCls} data-testid="admin-nav-recipes"><Clapperboard size={16} /> Recetas (vídeos)</NavLink>
            <NavLink to="/admin/blog" className={linkCls} data-testid="admin-nav-blog"><Newspaper size={16} /> Blog</NavLink>
            <NavLink to="/admin/imagenes" className={linkCls} data-testid="admin-nav-site-images"><ImageIcon size={16} /> Imágenes del sitio</NavLink>
            <NavLink to="/admin/seo" className={linkCls} data-testid="admin-nav-seo"><Sparkles size={16} /> SEO (IA)</NavLink>
            <NavLink to="/admin/legal" className={linkCls} data-testid="admin-nav-legal"><ScrollText size={16} /> Páginas legales</NavLink>
            <NavLink to="/admin/archivos" className={linkCls} data-testid="admin-nav-files"><FolderOpen size={16} /> Archivos</NavLink>
            <NavLink to="/admin/cupones" className={linkCls} data-testid="admin-nav-coupons"><TicketPercent size={16} /> Cupones</NavLink>
            <NavLink to="/admin/reembolsos" className={linkCls} data-testid="admin-nav-refunds"><RotateCcw size={16} /> Reembolsos</NavLink>
            <NavLink to="/admin/precios" className={linkCls} data-testid="admin-nav-prices"><FileSpreadsheet size={16} /> Importar precios</NavLink>
          </nav>
          <div className="mt-6 pt-4 border-t border-bone-100 shrink-0">
            <button onClick={() => { logout(); nav("/"); }} className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-soft hover:text-sage-700" data-testid="admin-logout">
              <LogOut size={14} /> Salir
            </button>
          </div>
        </aside>
        <main className="p-6 md:p-10" data-testid="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
