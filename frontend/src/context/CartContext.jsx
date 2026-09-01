import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "eco_cart_v1";

// Peso por unidad: usa weight_kg si existe; si no, lo deriva del formato ("150 g", "1 kg", "500 ml")
const parseWeightFromName = (name) => {
  if (!name) return 0;
  const m = String(name).toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(kg|kilos?|g|gr|gramos|ml|l|litros?)\b/);
  if (!m) return 0;
  const val = parseFloat(m[1].replace(",", "."));
  if (Number.isNaN(val)) return 0;
  return m[2].startsWith("k") || m[2].startsWith("l") ? val : val / 1000;
};

const resolveItemWeight = (it) => {
  const w = Number(it?.weight_kg);
  if (Number.isFinite(w) && w > 0) return w;
  return parseWeightFromName(it?.variation_name || it?.name);
};

export function CartProvider({ children }) {
  // Lazy-initialize from localStorage synchronously to avoid a load/save effect race
  // that could clear the cart on refresh (esp. under React StrictMode double-invoke).
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      // Migración: carritos guardados antes del cálculo de peso llevan weight_kg 0
      return parsed.map((it) => ({ ...it, weight_kg: resolveItemWeight(it) }));
    } catch {
      return [];
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const lineKey = (productId, variationName) => `${productId}::${variationName || "default"}`;

  const addItem = useCallback((product, variation, quantity = 1, isPro = false) => {
    const variationName = variation ? variation.name : null;
    const src = variation || product;
    // Prefer backend display_price (role + VAT aware). Fallback to raw ex-VAT price.
    const unit_price =
      typeof src.display_price === "number"
        ? src.display_price
        : (isPro ? src.price_professional : src.price_retail);
    const unit_price_ex_vat =
      typeof src.display_price_ex_vat === "number"
        ? src.display_price_ex_vat
        : (isPro ? src.price_professional : src.price_retail);
    const vat_rate = typeof product.vat_rate === "number" ? product.vat_rate : 10;
    const weight_kg =
      typeof src.weight_kg === "number" && src.weight_kg > 0
        ? src.weight_kg
        : parseWeightFromName(variationName || product.name);
    const sku = variation ? variation.sku : product.sku;
    setItems((prev) => {
      const key = lineKey(product.id, variationName);
      const existing = prev.find((x) => lineKey(x.product_id, x.variation_name) === key);
      if (existing) {
        return prev.map((x) =>
          lineKey(x.product_id, x.variation_name) === key
            ? { ...x, quantity: x.quantity + quantity, weight_kg }
            : x
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          sku,
          name: product.name,
          variation_name: variationName,
          unit_price,
          unit_price_ex_vat,
          vat_rate,
          weight_kg,
          quantity,
          image_url: product.image_url || "",
          category: product.category || "",
        },
      ];
    });
    // Confirmación estilo Amazon dentro del panel (sin toast que tape los botones)
    setLastAdded({
      product_id: product.id,
      name: product.name,
      variation_name: variationName,
      image_url: product.image_url || "",
      unit_price,
      quantity,
      category: product.category || "",
      at: Date.now(),
    });
    setDrawerOpen(true);
  }, []);

  const updateQuantity = (productId, variationName, quantity) => {
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter(
          (x) => !(x.product_id === productId && (x.variation_name || null) === (variationName || null))
        );
      }
      return prev.map((x) =>
        x.product_id === productId && (x.variation_name || null) === (variationName || null)
          ? { ...x, quantity }
          : x
      );
    });
  };

  const removeItem = (productId, variationName) => {
    setItems((prev) =>
      prev.filter(
        (x) => !(x.product_id === productId && (x.variation_name || null) === (variationName || null))
      )
    );
  };

  const clearCart = () => setItems([]);

  const subtotal = items.reduce((acc, it) => acc + it.unit_price * it.quantity, 0);
  const subtotalExVat = items.reduce(
    (acc, it) => acc + (it.unit_price_ex_vat ?? it.unit_price) * it.quantity, 0
  );
  // VAT computed from each line's vat_rate (works for both B2C and B2B carts)
  const vatAmount = Math.round(
    items.reduce(
      (acc, it) => acc + (it.unit_price_ex_vat ?? it.unit_price) * it.quantity * ((it.vat_rate ?? 0) / 100),
      0
    ) * 100
  ) / 100;
  const subtotalWithVat = Math.round((subtotalExVat + vatAmount) * 100) / 100;
  const totalWeightKg = items.reduce((acc, it) => acc + resolveItemWeight(it) * it.quantity, 0);
  const hasBulk = items.some((it) => resolveItemWeight(it) > 1);
  // Peso de ítems a granel (>1 kg por unidad): con base B2B >=150€ solo estos pagan portes
  const bulkWeightKg = items.reduce(
    (acc, it) => acc + (resolveItemWeight(it) > 1 ? resolveItemWeight(it) * it.quantity : 0),
    0
  );
  const count = items.reduce((acc, it) => acc + it.quantity, 0);

  const value = {
    items,
    subtotal,
    subtotalExVat,
    subtotalWithVat,
    vatAmount,
    totalWeightKg,
    hasBulk,
    bulkWeightKg,
    count,
    lastAdded,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    drawerOpen,
    setDrawerOpen,
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de CartProvider");
  return ctx;
}
