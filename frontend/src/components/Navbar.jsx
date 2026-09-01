import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShoppingBag, User, Menu, X, LogOut, LayoutDashboard, Heart, Scale, Home, Store, BookOpen, Briefcase, Mail, ChevronRight } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import SearchBar from "./SearchBar";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Navbar() {
  const { t } = useTranslation();
  const { count, openDrawer } = useCart();
  const { user, logout } = useAuth();
  const { wishlistCount, compareCount } = useWishlist();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();

  const linkCls = ({ isActive }) =>
    `text-xs uppercase tracking-[0.22em] font-medium transition-colors whitespace-nowrap ${
      isActive ? "text-sage-600" : "text-ink hover:text-sage-600"
    }`;

  return (
    <header
      data-testid="eco-navbar"
      className="sticky top-0 z-40 bg-bone-100/95 backdrop-blur-md border-b border-bone-200"
    >
      {/* Top row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-3 sm:py-4 flex items-center justify-between gap-3 sm:gap-6">
        <button
          className="lg:hidden text-ink shrink-0"
          onClick={() => setMobileOpen(true)}
          data-testid="nav-mobile-toggle"
          aria-label={t("nav.openMenu")}
        >
          <Menu size={22} />
        </button>

        <Link to="/" data-testid="nav-brand" className="flex items-center shrink-0">
          <img src="/logo-ecoandes.png" alt="EcoAndes · Organic Ingredients" className="h-14 sm:h-16 md:h-[72px] w-auto object-contain" />
        </Link>

        {/* Desktop search bar - persistent */}
        <div className="hidden lg:block flex-1 max-w-xl mx-4">
          <SearchBar />
        </div>

        <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 shrink-0">
          {user?.role === "admin" && (
            <button
              onClick={() => nav("/admin")}
              data-testid="nav-admin-btn"
              className="hidden md:inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-sage-600 hover:text-sage-700"
            >
              <LayoutDashboard size={16} /> {t("nav.admin")}
            </button>
          )}
          {user ? (
            <div className="relative group hidden md:block">
              <Link
                to="/cuenta"
                className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink hover:text-sage-600"
                data-testid="nav-user-btn"
              >
                <User size={16} /> {user.first_name}
              </Link>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-bone-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 rounded-xl overflow-hidden">
                <Link to="/cuenta" className="block px-4 py-3 text-sm text-ink hover:bg-sage-50 transition-colors" data-testid="nav-account-link">
                  {t("nav.account")}
                </Link>
                {user.role === "admin" && (
                  <Link to="/admin" className="block px-4 py-3 text-sm text-ink hover:bg-sage-50 transition-colors" data-testid="nav-admin-link">
                    {t("nav.adminDashboard")}
                  </Link>
                )}
                <button
                  onClick={() => { logout(); nav("/"); }}
                  className="w-full text-left px-4 py-3 text-sm text-ink hover:bg-sage-50 transition-colors flex items-center gap-2"
                  data-testid="nav-logout-btn"
                >
                  <LogOut size={14} /> {t("nav.logout")}
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              data-testid="nav-login-link"
              className="hidden md:flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink hover:text-sage-600"
            >
              <User size={16} /> {t("nav.login")}
            </Link>
          )}
          <LanguageSwitcher />
          <Link
            to="/comparar"
            data-testid="nav-compare-btn"
            className="relative hidden sm:flex items-center text-ink hover:text-sage-600 transition-colors"
            aria-label={t("nav.compare")}
          >
            <Scale size={20} />
            {compareCount > 0 && (
              <span data-testid="compare-count" className="absolute -top-2 -right-2 bg-sage-500 text-white text-[10px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center font-medium">{compareCount}</span>
            )}
          </Link>
          <Link
            to="/lista-deseos"
            data-testid="nav-wishlist-btn"
            className="relative hidden md:flex items-center text-ink hover:text-sage-600 transition-colors"
            aria-label={t("nav.wishlist")}
          >
            <Heart size={20} />
            {wishlistCount > 0 && (
              <span data-testid="wishlist-count" className="absolute -top-2 -right-2 bg-terracotta text-white text-[10px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center font-medium">{wishlistCount}</span>
            )}
          </Link>
          {/* Móvil: cuenta y carrito viven ahora en la barra inferior fija. */}
          <button
            onClick={openDrawer}
            data-testid="nav-cart-btn"
            className="relative hidden lg:flex items-center gap-2 text-ink hover:text-sage-600 transition-colors"
            aria-label={t("nav.openCart")}
          >
            <ShoppingBag size={20} />
            {count > 0 && (
              <span
                data-testid="cart-count"
                className="absolute -top-2 -right-2 bg-sage-500 text-white text-[10px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center font-medium"
              >
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile search bar — siempre visible (sin zoom al escribir: fuente 16px) */}
      <div className="lg:hidden border-t border-bone-200/70 px-4 sm:px-6 py-2.5 bg-bone-100" data-testid="nav-mobile-search">
        <SearchBar compact />
      </div>

      {/* Bottom row: navigation links (desktop) */}
      <div className="hidden lg:block border-t border-bone-200/70 bg-bone-100">
        <nav className="max-w-7xl mx-auto px-6 lg:px-12 py-3 flex items-center justify-center gap-10">
          <NavLink to="/" className={linkCls} data-testid="nav-link-home" end>{t("nav.home")}</NavLink>
          <NavLink to="/tienda" className={linkCls} data-testid="nav-link-shop">{t("nav.shop")}</NavLink>
          <NavLink to="/blog" className={linkCls} data-testid="nav-link-blog">{t("nav.blog")}</NavLink>
          <NavLink to="/profesional" className={linkCls} data-testid="nav-link-pro">{t("nav.pro")}</NavLink>
          <NavLink to="/contacto" className={linkCls} data-testid="nav-link-contact">{t("nav.contact")}</NavLink>
        </nav>
      </div>

      {/* Mobile drawer menu — panel lateral (portal: el header con backdrop-blur crea containing block) */}
      {mobileOpen && createPortal(
        <div className="fixed inset-0 z-[120]" data-testid="mobile-menu">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-sm bg-bone-50 shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-bone-200 bg-white">
              <img src="/logo-ecoandes.png" alt="EcoAndes" className="h-10 w-auto object-contain" />
              <button onClick={() => setMobileOpen(false)} data-testid="mobile-close" aria-label={t("nav.close")} className="h-9 w-9 rounded-full bg-bone-100 flex items-center justify-center text-ink hover:bg-bone-200 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Sesión */}
            <div className="px-5 pt-4">
              {user ? (
                <Link
                  to="/cuenta"
                  onClick={() => setMobileOpen(false)}
                  data-testid="mobile-user-card"
                  className="flex items-center gap-3 bg-sage-50 border border-sage-200 rounded-xl p-3.5"
                >
                  <span className="h-10 w-10 rounded-full bg-sage-500 text-white flex items-center justify-center font-medium text-sm shrink-0">
                    {(user.first_name || "?").charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-ink truncate">Hola, {user.first_name}</span>
                    <span className="block text-[10px] uppercase tracking-[0.16em] text-sage-700">
                      {user.role === "professional" ? "Profesional B2B" : user.role === "admin" ? "Administrador" : t("nav.account")}
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-sage-600 shrink-0" />
                </Link>
              ) : (
                <div className="flex gap-2.5" data-testid="mobile-auth-actions">
                  <Link to="/login" onClick={() => setMobileOpen(false)} className="btn-primary flex-1 text-center py-3 text-[11px]">
                    {t("nav.login")}
                  </Link>
                  <Link to="/registro" onClick={() => setMobileOpen(false)} className="btn-outline flex-1 text-center py-3 text-[11px]">
                    {t("nav.register", "Crear cuenta")}
                  </Link>
                </div>
              )}
            </div>

            {/* Navegación */}
            <nav className="px-5 py-4 space-y-5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-ink-muted mb-1.5 px-1">{t("nav.shop")}</div>
                <div className="bg-white border border-bone-200 rounded-xl overflow-hidden divide-y divide-bone-100">
                  {[
                    ["/", t("nav.home"), Home],
                    ["/tienda", t("nav.shop"), Store],
                    ["/blog", t("nav.blog"), BookOpen],
                    ["/profesional", t("nav.pro"), Briefcase],
                    ["/contacto", t("nav.contact"), Mail],
                  ].map(([to, label, Icon]) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMobileOpen(false)}
                      data-testid={`mobile-link-${to.replace(/\//g, "") || "home"}`}
                      className="flex items-center gap-3 px-4 py-3.5 text-sm text-ink hover:bg-sage-50 active:bg-sage-50 transition-colors"
                    >
                      <Icon size={17} className="text-sage-600 shrink-0" />
                      <span className="flex-1">{label}</span>
                      <ChevronRight size={15} className="text-bone-300" />
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-ink-muted mb-1.5 px-1">{t("nav.account")}</div>
                <div className="bg-white border border-bone-200 rounded-xl overflow-hidden divide-y divide-bone-100">
                  {[
                    ["/lista-deseos", t("nav.wishlist"), Heart, wishlistCount],
                    ["/comparar", t("nav.compare"), Scale, compareCount],
                    [user ? "/cuenta" : "/login", user ? t("nav.account") : t("nav.login"), User, 0],
                  ].map(([to, label, Icon, badge]) => (
                    <Link
                      key={to + label}
                      to={to}
                      onClick={() => setMobileOpen(false)}
                      data-testid={`mobile-link-${String(to).replace(/\//g, "") || "home"}`}
                      className="flex items-center gap-3 px-4 py-3.5 text-sm text-ink hover:bg-sage-50 active:bg-sage-50 transition-colors"
                    >
                      <Icon size={17} className="text-sage-600 shrink-0" />
                      <span className="flex-1">{label}</span>
                      {badge > 0 && (
                        <span className="bg-terracotta text-white text-[10px] h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center font-medium">{badge}</span>
                      )}
                      <ChevronRight size={15} className="text-bone-300" />
                    </Link>
                  ))}
                  {user?.role === "admin" && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileOpen(false)}
                      data-testid="mobile-link-admin"
                      className="flex items-center gap-3 px-4 py-3.5 text-sm text-sage-700 bg-sage-50/60 hover:bg-sage-50 transition-colors"
                    >
                      <LayoutDashboard size={17} className="shrink-0" />
                      <span className="flex-1">{t("nav.adminDashboard")}</span>
                      <ChevronRight size={15} className="text-sage-300" />
                    </Link>
                  )}
                </div>
              </div>
            </nav>

            {/* Pie del menú */}
            <div className="mt-auto px-5 pb-6 pt-2 space-y-3">
              {user && (
                <button
                  onClick={() => { logout(); setMobileOpen(false); nav("/"); }}
                  data-testid="mobile-logout"
                  className="w-full inline-flex items-center justify-center gap-2 border border-terracotta text-terracotta px-4 py-3 rounded-full text-[11px] uppercase tracking-[0.18em] font-medium hover:bg-terracotta hover:text-white transition-colors duration-200"
                >
                  <LogOut size={14} /> {t("nav.logout")}
                </button>
              )}
              <div className="text-center text-[10px] uppercase tracking-[0.24em] text-ink-muted">
                EcoAndes · Natural BIO
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Barra inferior fija (solo móvil/tablet): Menú · Inicio · Acceder · Favoritos · Carrito.
          Mismo fondo que la barra de promociones superior (sage-800). */}
      {createPortal(
        <nav
          data-testid="mobile-bottom-nav"
          aria-label="Navegación inferior"
          className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-sage-800 border-t border-sage-700/50 pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid grid-cols-5 h-[60px]">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              data-testid="bottomnav-menu"
              aria-label={t("nav.openMenu")}
              className="flex items-center justify-center text-bone-100/75 hover:text-white active:text-white transition-colors"
            >
              <Menu size={22} />
            </button>
            <Link
              to="/"
              data-testid="bottomnav-home"
              aria-label={t("nav.home")}
              className={`flex items-center justify-center transition-colors ${loc.pathname === "/" ? "text-white" : "text-bone-100/75 hover:text-white active:text-white"}`}
            >
              <Home size={22} />
            </Link>
            <Link
              to={user ? "/cuenta" : "/login"}
              data-testid="bottomnav-account"
              aria-label={user ? t("nav.account") : t("nav.login")}
              className="flex items-start justify-center"
            >
              <span
                className={`relative -mt-4 flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-4 ring-sage-800 transition-transform active:scale-95 ${
                  user ? "bg-sage-500 text-white" : "bg-sage-600 text-bone-100"
                }`}
              >
                <User size={22} />
                {user && (
                  <span
                    data-testid="bottomnav-account-dot"
                    className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-white border-2 border-sage-500"
                  />
                )}
              </span>
            </Link>
            <Link
              to="/lista-deseos"
              data-testid="bottomnav-wishlist"
              aria-label={t("nav.wishlist")}
              className={`relative flex items-center justify-center transition-colors ${loc.pathname === "/lista-deseos" ? "text-white" : "text-bone-100/75 hover:text-white active:text-white"}`}
            >
              <span className="relative">
                <Heart size={22} />
                {wishlistCount > 0 && (
                  <span
                    data-testid="bottomnav-wishlist-count"
                    className="absolute -top-2 -right-2.5 bg-terracotta text-white text-[10px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center font-medium"
                  >
                    {wishlistCount}
                  </span>
                )}
              </span>
            </Link>
            <button
              type="button"
              onClick={openDrawer}
              data-testid="bottomnav-cart"
              aria-label={t("nav.openCart")}
              className="relative flex items-center justify-center text-bone-100/75 hover:text-white active:text-white transition-colors"
            >
              <span className="relative">
                <ShoppingBag size={22} />
                {count > 0 && (
                  <span
                    data-testid="bottomnav-cart-count"
                    className="absolute -top-2 -right-2.5 bg-terracotta text-white text-[10px] h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center font-medium"
                  >
                    {count}
                  </span>
                )}
              </span>
            </button>
          </div>
        </nav>,
        document.body
      )}
    </header>
  );
}
