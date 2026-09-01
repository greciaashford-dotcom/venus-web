// Pricing + variation helpers

export function parseWeightGrams(name) {
  if (!name) return 0;
  const m = String(name).match(/([\d.,]+)\s*(kg|g|gr|ml|l|cl)/i);
  if (!m) return 0;
  let val = parseFloat(m[1].replace(",", "."));
  if (isNaN(val)) return 0;
  const unit = m[2].toLowerCase();
  if (unit === "kg") return val * 1000;
  if (unit === "l") return val * 1000;
  if (unit === "cl") return val * 10;
  return val; // g, gr, ml
}

export function sortVariations(variations = []) {
  return [...variations].sort(
    (a, b) => parseWeightGrams(a.name) - parseWeightGrams(b.name)
  );
}

export function variationPrice(v, isPro) {
  // Prefer backend-decorated display_price (role + VAT aware). Fallback to raw.
  if (v && typeof v.display_price === "number") return v.display_price;
  return isPro ? v.price_professional : v.price_retail;
}

export function getPriceRange(product, isPro = false) {
  if (!product) return { min: 0, max: 0 };
  const vars = product.variations || [];
  if (vars.length) {
    const prices = vars
      .map((v) => variationPrice(v, isPro))
      .filter((p) => typeof p === "number" && p > 0);
    if (prices.length) {
      return { min: Math.min(...prices), max: Math.max(...prices) };
    }
  }
  const single =
    typeof product.display_price === "number"
      ? product.display_price
      : isPro
      ? product.price_professional
      : product.price_retail;
  return { min: single || 0, max: single || 0 };
}
