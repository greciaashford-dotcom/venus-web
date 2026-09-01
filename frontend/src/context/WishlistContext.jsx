import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";

const WishlistContext = createContext(null);
const WK = "eco_wishlist_v1";
const CK = "eco_compare_v1";
const MAX_COMPARE = 4;

function readLS(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [wishlist, setWishlist] = useState([]);
  const [compare, setCompare] = useState([]);
  const syncedFor = useRef(null);

  useEffect(() => {
    setWishlist(readLS(WK));
    setCompare(readLS(CK));
  }, []);

  useEffect(() => {
    localStorage.setItem(WK, JSON.stringify(wishlist));
  }, [wishlist]);
  useEffect(() => {
    localStorage.setItem(CK, JSON.stringify(compare));
  }, [compare]);

  // On login: merge local lists with server, then adopt the merged list.
  useEffect(() => {
    if (!user) {
      syncedFor.current = null;
      return;
    }
    if (syncedFor.current === user.id) return;
    syncedFor.current = user.id;
    (async () => {
      try {
        const local = readLS(WK);
        const { data: serverWish } = await api.get("/me/wishlist");
        const merged = Array.from(new Set([...(serverWish.product_ids || []), ...local]));
        const { data: saved } = await api.put("/me/wishlist", { product_ids: merged });
        setWishlist(saved.product_ids || merged);
      } catch (e) {
        /* keep local */
      }
      try {
        const localC = readLS(CK);
        const { data: serverCmp } = await api.get("/me/compare");
        const mergedC = Array.from(new Set([...(serverCmp.product_ids || []), ...localC])).slice(0, MAX_COMPARE);
        const { data: savedC } = await api.put("/me/compare", { product_ids: mergedC });
        setCompare(savedC.product_ids || mergedC);
      } catch (e) {
        /* keep local */
      }
    })();
  }, [user]);

  const isWished = useCallback((id) => wishlist.includes(id), [wishlist]);
  const isCompared = useCallback((id) => compare.includes(id), [compare]);

  const toggleWishlist = useCallback(
    (product) => {
      const id = product.id || product;
      const has = wishlist.includes(id);
      const next = has ? wishlist.filter((x) => x !== id) : [...wishlist, id];
      setWishlist(next);
      toast.success(has ? t("product.removedFromWishlist") : t("product.addedToWishlist"));
      if (user) {
        if (has) api.delete(`/me/wishlist/${id}`).catch(() => {});
        else api.post(`/me/wishlist/${id}`).catch(() => {});
      }
    },
    [wishlist, user, t]
  );

  const toggleCompare = useCallback(
    (product) => {
      const id = product.id || product;
      const has = compare.includes(id);
      if (!has && compare.length >= MAX_COMPARE) {
        toast.error(t("product.compareMax"));
        return;
      }
      const next = has ? compare.filter((x) => x !== id) : [...compare, id];
      setCompare(next);
      toast.success(has ? t("product.removedFromCompare") : t("product.addedToCompare"));
      if (user) {
        if (has) api.delete(`/me/compare/${id}`).catch(() => {});
        else api.post(`/me/compare/${id}`).catch(() => {});
      }
    },
    [compare, user, t]
  );

  const clearCompare = useCallback(() => {
    setCompare([]);
    if (user) api.put("/me/compare", { product_ids: [] }).catch(() => {});
  }, [user]);

  const value = {
    wishlist,
    compare,
    isWished,
    isCompared,
    toggleWishlist,
    toggleCompare,
    clearCompare,
    wishlistCount: wishlist.length,
    compareCount: compare.length,
    MAX_COMPARE,
  };
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
