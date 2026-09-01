import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { X, Plus, Minus, Trash2, Truck, PartyPopper, CheckCircle2 } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { formatEUR, resolveAsset } from "../lib/api";
import { useNavigate } from "react-router-dom";
import CartRecommendations from "./CartRecommendations";

export default function CartDrawer() {
  const { t } = useTranslation();
  const { drawerOpen, closeDrawer, items, subtotal, subtotalExVat, subtotalWithVat, updateQuantity, removeItem, lastAdded } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  // Umbral de envío gratis por rol: particulares 50€ (IVA incl.) · profesionales verificados 150€ (base imponible)
  const isVerifiedPro = !!user && user.role === "professional" && user.approved !== false;
  const freeThreshold = isVerifiedPro ? 150 : 50;
  const progressBasis = isVerifiedPro ? subtotalExVat : subtotalWithVat;
  const remaining = useMemo(() => Math.max(0, freeThreshold - progressBasis), [freeThreshold, progressBasis]);
  const progressPct = Math.min(100, (progressBasis / freeThreshold) * 100);

  return (
    <AnimatePresence>
      {drawerOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-ink/20 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeDrawer}
            data-testid="cart-drawer-overlay"
          />
          <motion.aside
            key="drawer"
            data-testid="cart-drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="fixed top-0 right-0 bottom-0 w-full sm:max-w-md z-50 bg-bone-100 shadow-[-10px_0_40px_rgba(0,0,0,0.07)] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-bone-200">
              <h3 className="font-heading text-xl font-light tracking-wide">{t("cart.title")}</h3>
              <button onClick={closeDrawer} data-testid="cart-drawer-close" className="text-ink hover:text-sage-600">
                <X size={22} />
              </button>
            </div>

            {/* Confirmación estilo Amazon del último producto añadido */}
            {lastAdded && items.length > 0 && (
              <div className="px-6 py-3.5 bg-sage-50 border-b border-sage-200 flex items-center gap-3" data-testid="cart-added-confirmation">
                <CheckCircle2 size={20} className="text-sage-600 shrink-0" />
                <div className="w-10 h-10 bg-white border border-bone-200 rounded-md overflow-hidden shrink-0">
                  {lastAdded.image_url ? (
                    <img src={resolveAsset(lastAdded.image_url)} alt={lastAdded.name} className="w-full h-full object-contain p-0.5" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-sage-700 leading-tight">{t("cart.addedToCart")}</div>
                  <div className="text-xs text-ink-soft truncate">
                    {lastAdded.name}
                    {lastAdded.variation_name ? ` · ${lastAdded.variation_name}` : ""}
                  </div>
                </div>
              </div>
            )}

            <div className="px-6 py-4 bg-white border-b border-bone-200">
              {progressBasis >= freeThreshold ? (
                <div
                  className="flex items-center gap-3 rounded-md bg-sage-50 border border-sage-200 px-4 py-3"
                  data-testid="free-shipping-achieved"
                >
                  <PartyPopper size={18} className="text-sage-600 shrink-0" />
                  <div className="text-sm text-sage-700 font-medium leading-tight">
                    {t("cart.freeShippingAchieved")}
                  </div>
                </div>
              ) : (
                <div
                  className="rounded-md bg-bone-50 border border-bone-300 px-4 py-3"
                  data-testid="free-shipping-progress"
                >
                  <div className="flex items-start gap-3 mb-2.5">
                    <Truck size={18} className="text-sage-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-ink leading-snug" data-testid="free-shipping-remaining">
                      {t("cart.freeShippingRemaining", { amount: formatEUR(remaining) })}
                    </div>
                  </div>
                  <div className="h-1.5 bg-bone-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-sage-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPct}%` }}
                      transition={{ duration: 0.6 }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 eco-scroll">
              {items.length === 0 ? (
                <div className="text-center text-ink-soft py-16" data-testid="cart-empty">
                  <div className="overline mb-3">{t("cart.empty")}</div>
                  <p className="text-sm">{t("cart.emptyDesc")}</p>
                  <button
                    className="btn-outline mt-8"
                    onClick={() => { closeDrawer(); navigate("/tienda"); }}
                    data-testid="cart-empty-shop-btn"
                  >
                    {t("cart.goShop")}
                  </button>
                </div>
              ) : (
                <ul className="flex flex-col gap-6">
                  {items.map((it, i) => (
                    <li
                      key={`${it.product_id}-${it.variation_name || "d"}-${i}`}
                      className="flex gap-4"
                      data-testid={`cart-item-${it.sku}`}
                    >
                      <div className="w-20 h-20 bg-white border border-bone-200 overflow-hidden shrink-0">
                        {it.image_url ? (
                          <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" />
                        ) : null}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-ink leading-tight">{it.name}</div>
                        {it.variation_name && (
                          <div className="text-xs text-ink-soft mt-1">{it.variation_name}</div>
                        )}
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center border border-bone-200 rounded-sm">
                            <button
                              onClick={() => updateQuantity(it.product_id, it.variation_name, it.quantity - 1)}
                              className="p-2 text-ink-soft hover:text-sage-600"
                              data-testid={`cart-dec-${it.sku}`}
                              aria-label={t("cart.decrease")}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="px-3 text-sm" data-testid={`cart-qty-${it.sku}`}>{it.quantity}</span>
                            <button
                              onClick={() => updateQuantity(it.product_id, it.variation_name, it.quantity + 1)}
                              className="p-2 text-ink-soft hover:text-sage-600"
                              data-testid={`cart-inc-${it.sku}`}
                              aria-label={t("cart.increase")}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <div className="text-sm text-ink">{formatEUR(it.unit_price * it.quantity)}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeItem(it.product_id, it.variation_name)}
                        className="text-ink-muted hover:text-red-500 self-start p-1"
                        data-testid={`cart-remove-${it.sku}`}
                        aria-label={t("cart.remove")}
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Secciones dinámicas: relacionados, recomendados, explorar, ofertas */}
              {items.length > 0 && (
                <CartRecommendations seedProductId={(lastAdded || items[items.length - 1])?.product_id} />
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-bone-200 px-6 py-5 bg-white">
                <div className="flex items-center justify-between text-sm text-ink-soft mb-2">
                  <span>{t("cart.subtotal")}</span>
                  <span className="text-ink font-medium" data-testid="cart-subtotal">{formatEUR(subtotal)}</span>
                </div>
                <div className="text-xs text-ink-muted mb-4">
                  {user?.role === "professional" ? t("cart.proPrices") : t("cart.taxesNote")}
                </div>
                <button
                  onClick={closeDrawer}
                  data-testid="cart-continue-shopping-btn"
                  className="btn-outline w-full mb-3"
                >
                  {t("cart.continueShopping")}
                </button>
                <button
                  onClick={() => { closeDrawer(); navigate("/checkout"); }}
                  data-testid="cart-checkout-btn"
                  className="btn-primary w-full"
                >
                  {t("cart.checkout")}
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
