import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import StarRating from "./StarRating";

export default function ProductReviews({ productId }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState({ summary: { average: 0, count: 0, distribution: {} }, items: [], my_review: null });
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/products/${productId}/reviews`);
      setData(res);
      if (res.my_review) {
        setRating(res.my_review.rating);
        setComment(res.my_review.comment || "");
      }
    } catch (e) {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (productId) load();
  }, [productId, load]);

  const submit = async (e) => {
    e.preventDefault();
    if (rating < 1) {
      toast.error(t("reviews.selectRating"), { description: t("reviews.selectRatingDesc") });
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/products/${productId}/reviews`, { rating, comment });
      toast.success(data.my_review ? t("reviews.updated") : t("reviews.thanks"));
      await load();
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message;
      toast.error(t("reviews.saveError"), { description: String(msg) });
    } finally {
      setSubmitting(false);
    }
  };

  const { summary, items } = data;
  const dist = summary.distribution || {};

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-12 py-14 border-t border-bone-200" data-testid="product-reviews">
      <div className="overline mb-2">{t("reviews.overline")}</div>
      <h2 className="font-heading text-2xl md:text-3xl font-light text-ink mb-8">
        {t("reviews.heading")}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Resumen */}
        <div className="lg:col-span-1">
          <div className="flex items-end gap-3">
            <div className="font-heading text-5xl font-light text-ink" data-testid="reviews-average">
              {summary.count ? summary.average.toFixed(1) : "—"}
            </div>
            <div className="pb-1">
              <StarRating value={summary.average} readOnly size={18} />
              <div className="text-xs text-ink-soft mt-1" data-testid="reviews-count">
                {summary.count} {summary.count === 1 ? t("reviews.opinionsSingular") : t("reviews.opinionsPlural")}
              </div>
            </div>
          </div>
          <div className="mt-6 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const c = dist[star] || 0;
              const pct = summary.count ? (c / summary.count) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs text-ink-soft">
                  <span className="w-3">{star}</span>
                  <StarRating value={1} readOnly size={11} className="!gap-0" />
                  <div className="flex-1 h-1.5 bg-bone-200 rounded-full overflow-hidden">
                    <div className="h-full bg-terracotta" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-5 text-right">{c}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Formulario + lista */}
        <div className="lg:col-span-2">
          {user ? (
            <form onSubmit={submit} className="bg-white border border-bone-200 p-6 rounded-sm mb-8" data-testid="review-form">
              <div className="text-sm font-medium text-ink mb-3">
                {data.my_review ? t("reviews.edit") : t("reviews.leave")}
              </div>
              <StarRating value={rating} onChange={setRating} size={26} className="mb-4" />
              <textarea
                className="input-eco w-full"
                rows={3}
                placeholder={t("reviews.commentPlaceholder")}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                data-testid="review-comment"
              />
              <button type="submit" disabled={submitting} className="btn-primary mt-4" data-testid="review-submit">
                {submitting ? t("reviews.saving") : data.my_review ? t("reviews.update") : t("reviews.publish")}
              </button>
            </form>
          ) : (
            <div className="bg-bone-50 border border-bone-200 p-6 rounded-sm mb-8 text-sm text-ink-soft" data-testid="review-login-prompt">
              <Link to="/login" className="text-sage-600 hover:text-sage-700 font-medium">{t("reviews.loginLink")}</Link> {t("reviews.loginPrompt1")}{" "}
              <Link to="/registro" className="text-sage-600 hover:text-sage-700 font-medium">{t("reviews.registerLink")}</Link>.
            </div>
          )}

          {loading ? (
            <div className="text-ink-soft text-sm">{t("reviews.loading")}</div>
          ) : items.length === 0 ? (
            <div className="text-ink-soft text-sm" data-testid="reviews-empty">
              {t("reviews.empty")}
            </div>
          ) : (
            <ul className="space-y-6" data-testid="reviews-list">
              {items.map((r) => (
                <li key={r.id} className="border-b border-bone-200 pb-6 last:border-0">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-ink">{r.user_name}</div>
                    <div className="text-xs text-ink-muted">
                      {new Date(r.created_at).toLocaleDateString("es-ES", { year: "numeric", month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <StarRating value={r.rating} readOnly size={14} className="mt-1.5" />
                  {r.comment && <p className="text-sm text-ink-soft mt-2 leading-relaxed">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
