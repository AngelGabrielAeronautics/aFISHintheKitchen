"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getAllTips, addTip, deleteTip } from "@/lib/firebase-recipes";
import { TIP_CATEGORIES, FAMILY_MEMBERS } from "@/lib/types";
import type { KitchenTip, TipCategory } from "@/lib/types";
import Avatar from "@/components/Avatar";

const inputClasses =
  "w-full rounded-lg border border-gold-light bg-warm-white px-3 py-2 font-sans text-sm text-charcoal outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20";

export default function TipsPage() {
  const { user } = useAuth();
  const [tips, setTips] = useState<KitchenTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeCategory, setActiveCategory] = useState<TipCategory | "all">("all");

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<TipCategory>("general");
  const [author, setAuthor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    getAllTips()
      .then(setTips)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filteredTips =
    activeCategory === "all"
      ? tips
      : tips.filter((t) => t.category === activeCategory);

  const categoryLabel = (cat: TipCategory) =>
    TIP_CATEGORIES.find((c) => c.value === cat);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !author) {
      setFormError("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const newTip = await addTip({
        title: title.trim(),
        content: content.trim(),
        category,
        author,
      });
      setTips((prev) => [newTip, ...prev]);
      setTitle("");
      setContent("");
      setCategory("general");
      setShowForm(false);
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this tip?")) return;
    setDeletingId(id);
    try {
      await deleteTip(id);
      setTips((prev) => prev.filter((t) => t.id !== id));
    } catch {
      // silently fail
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-cream">
      {/* Header */}
      <div className="mx-auto max-w-4xl px-4 pt-10 pb-6 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight text-charcoal sm:text-4xl">
              Tips & Tricks
            </h1>
            <p className="mt-2 font-sans text-sm text-slate">
              Kitchen wisdom from the family — shortcuts, techniques, and lessons learned the hard way.
            </p>
          </div>
          {user && (
            <button
              type="button"
              onClick={() => setShowForm(!showForm)}
              className="inline-flex items-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 font-sans text-sm font-medium text-white transition-colors hover:bg-terracotta-dark cursor-pointer shrink-0"
            >
              {showForm ? (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Share a Tip
                </>
              )}
            </button>
          )}
        </div>

        {/* Add tip form */}
        {showForm && user && (
          <form
            onSubmit={handleSubmit}
            className="mt-6 rounded-2xl bg-warm-white p-6 ring-1 ring-cream-dark/30 space-y-4"
          >
            <div>
              <label htmlFor="tip-title" className="block text-sm font-medium text-charcoal mb-1.5">
                Title <span className="text-terracotta">*</span>
              </label>
              <input
                id="tip-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., How to dice an onion without crying"
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="tip-content" className="block text-sm font-medium text-charcoal mb-1.5">
                Your tip <span className="text-terracotta">*</span>
              </label>
              <textarea
                id="tip-content"
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Share what you've learned..."
                className={`${inputClasses} resize-none`}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="tip-category" className="block text-sm font-medium text-charcoal mb-1.5">
                  Category
                </label>
                <select
                  id="tip-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TipCategory)}
                  className={inputClasses}
                >
                  {TIP_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.icon} {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="tip-author" className="block text-sm font-medium text-charcoal mb-1.5">
                  Who are you? <span className="text-terracotta">*</span>
                </label>
                <select
                  id="tip-author"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className={inputClasses}
                >
                  <option value="">Select your name</option>
                  {FAMILY_MEMBERS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formError && (
              <p className="font-sans text-sm text-red-500">{formError}</p>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-terracotta px-6 py-2.5 font-sans text-sm font-medium text-white transition-colors hover:bg-terracotta-dark disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {submitting ? "Sharing..." : "Share Tip"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Category filter tabs */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-colors cursor-pointer ${
              activeCategory === "all"
                ? "bg-terracotta text-white"
                : "bg-warm-white text-slate ring-1 ring-cream-dark/40 hover:ring-terracotta/40 hover:text-terracotta"
            }`}
          >
            All
          </button>
          {TIP_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setActiveCategory(cat.value)}
              className={`rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-colors cursor-pointer ${
                activeCategory === cat.value
                  ? "bg-terracotta text-white"
                  : "bg-warm-white text-slate ring-1 ring-cream-dark/40 hover:ring-terracotta/40 hover:text-terracotta"
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tips list */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="font-sans text-sm text-slate">Something went wrong loading tips.</p>
            <button
              type="button"
              onClick={() => {
                setError(false);
                setLoading(true);
                getAllTips()
                  .then(setTips)
                  .catch(() => setError(true))
                  .finally(() => setLoading(false));
              }}
              className="font-sans text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : filteredTips.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cream-dark/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10 text-slate/40">
                <path d="M12 .75a8.25 8.25 0 0 0-4.135 15.39c.686.398 1.115 1.008 1.134 1.623a.75.75 0 0 0 .577.706c.352.083.71.148 1.074.195.323.041.6-.218.6-.544v-4.661a6.714 6.714 0 0 1-.937-.171.75.75 0 1 1 .374-1.453 5.261 5.261 0 0 0 2.626 0 .75.75 0 1 1 .374 1.452 6.712 6.712 0 0 1-.937.172v4.66c0 .327.277.586.6.545.364-.047.722-.112 1.074-.195a.75.75 0 0 0 .577-.706c.02-.615.448-1.225 1.134-1.623A8.25 8.25 0 0 0 12 .75Z" />
                <path fillRule="evenodd" d="M9.013 19.9a.75.75 0 0 1 .877-.597 11.319 11.319 0 0 0 4.22 0 .75.75 0 1 1 .28 1.473 12.819 12.819 0 0 1-4.78 0 .75.75 0 0 1-.597-.876ZM9.754 22.344a.75.75 0 0 1 .824-.668 13.682 13.682 0 0 0 2.844 0 .75.75 0 1 1 .156 1.492 15.156 15.156 0 0 1-3.156 0 .75.75 0 0 1-.668-.824Z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="font-serif text-xl font-semibold text-charcoal">
              {activeCategory === "all" ? "No tips yet" : "No tips in this category"}
            </h3>
            <p className="max-w-sm font-sans text-sm text-slate">
              {activeCategory === "all"
                ? "Be the first to share a kitchen tip with the family."
                : "Try a different category or share a tip of your own."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filteredTips.map((tip) => {
              const cat = categoryLabel(tip.category);
              return (
                <div
                  key={tip.id}
                  className="group rounded-2xl bg-warm-white p-5 ring-1 ring-cream-dark/30 transition-shadow hover:shadow-md"
                >
                  {/* Category badge + delete */}
                  <div className="flex items-start justify-between gap-2">
                    {cat && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/8 px-2.5 py-0.5 font-sans text-[10px] font-medium text-terracotta">
                        {cat.icon} {cat.label}
                      </span>
                    )}
                    {user && (
                      <button
                        type="button"
                        onClick={() => handleDelete(tip.id)}
                        disabled={deletingId === tip.id}
                        aria-label="Delete tip"
                        className="opacity-0 group-hover:opacity-100 shrink-0 h-6 w-6 flex items-center justify-center rounded text-slate/30 hover:text-red-500 transition-all cursor-pointer disabled:opacity-40"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="mt-2 font-serif text-lg font-semibold text-charcoal leading-snug">
                    {tip.title}
                  </h3>

                  {/* Content */}
                  <p className="mt-2 font-sans text-sm leading-relaxed text-slate whitespace-pre-line">
                    {tip.content}
                  </p>

                  {/* Author + date */}
                  <div className="mt-4 flex items-center gap-2 pt-3 border-t border-cream-dark/20">
                    <Avatar name={tip.author} size="sm" ring />
                    <span className="font-sans text-xs font-medium text-charcoal">
                      {tip.author}
                    </span>
                    <span className="font-sans text-[10px] text-slate/50">
                      {new Date(tip.createdAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
