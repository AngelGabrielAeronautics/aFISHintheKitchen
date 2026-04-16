"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { getAllTips, getAllRecipes, addTip, deleteTip, updateTip, uploadTipFile } from "@/lib/firebase-recipes";
import type { KitchenTip, Recipe } from "@/lib/types";
import Avatar from "@/components/Avatar";
import DeleteModal from "@/components/DeleteModal";

const inputClasses =
  "w-full rounded-lg border border-gold-light bg-warm-white px-3 py-2 font-sans text-sm text-charcoal outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20";

export default function TipsPage() {
  const { user } = useAuth();
  const [tips, setTips] = useState<KitchenTip[]>([]);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>("");
  const [linkedRecipes, setLinkedRecipes] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KitchenTip | null>(null);

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [editNewPhotos, setEditNewPhotos] = useState<File[]>([]);
  const [editNewPreviews, setEditNewPreviews] = useState<string[]>([]);
  const [editVideo, setEditVideo] = useState<string>("");
  const [editNewVideo, setEditNewVideo] = useState<File | null>(null);
  const [editNewVideoPreview, setEditNewVideoPreview] = useState("");
  const [editLinkedRecipes, setEditLinkedRecipes] = useState<{ id: string; title: string; slug: string }[]>([]);
  const [editRecipeSearch, setEditRecipeSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getAllTips(), getAllRecipes()])
      .then(([t, r]) => { setTips(t); setAllRecipes(r); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const recipeSearchResults = useMemo(() => {
    if (!recipeSearch.trim()) return [];
    const q = recipeSearch.toLowerCase();
    return allRecipes
      .filter((r) => r.title.toLowerCase().includes(q) && !linkedRecipes.some((lr) => lr.id === r.id))
      .slice(0, 5);
  }, [allRecipes, recipeSearch, linkedRecipes]);

  const editRecipeSearchResults = useMemo(() => {
    if (!editRecipeSearch.trim()) return [];
    const q = editRecipeSearch.toLowerCase();
    return allRecipes
      .filter((r) => r.title.toLowerCase().includes(q) && !editLinkedRecipes.some((lr) => lr.id === r.id))
      .slice(0, 5);
  }, [allRecipes, editRecipeSearch, editLinkedRecipes]);

  const filteredTips = useMemo(() => {
    if (!searchQuery.trim()) return tips;
    const q = searchQuery.toLowerCase();
    return tips.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q) ||
        t.author.toLowerCase().includes(q)
    );
  }, [tips, searchQuery]);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (photoFiles.length >= 3) return;
    setPhotoFiles((prev) => [...prev, file]);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreviews((prev) => [...prev, ev.target?.result as string]);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function removePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("video/")) return;
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
    e.target.value = "";
  }

  function removeVideo() {
    setVideoFile(null);
    setVideoPreview("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const author = user?.displayName || user?.email || "";
    if (!title.trim() || !content.trim() || !author) {
      setFormError("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const tipId = Date.now().toString();

      const imageUrls: string[] = [];
      for (const file of photoFiles) {
        const url = await uploadTipFile(file, tipId);
        imageUrls.push(url);
      }

      let videoUrl: string | undefined;
      if (videoFile) {
        videoUrl = await uploadTipFile(videoFile, `${tipId}/video`);
      }

      const newTip = await addTip({
        title: title.trim(),
        content: content.trim(),
        category: "general",
        author,
        ...(imageUrls.length > 0 ? { images: imageUrls } : {}),
        ...(videoUrl ? { video: videoUrl } : {}),
        ...(linkedRecipes.length > 0 ? { linkedRecipes } : {}),
      });
      setTips((prev) => [newTip, ...prev]);
      setTitle("");
      setContent("");
      setPhotoFiles([]);
      setPhotoPreviews([]);
      setVideoFile(null);
      setVideoPreview("");
      setLinkedRecipes([]);
      setRecipeSearch("");
      setShowForm(false);
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeletingId(id);
    try {
      await deleteTip(id);
      setTips((prev) => prev.filter((t) => t.id !== id));
    } catch {
      // silently fail
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  }

  function startEditing(tip: KitchenTip) {
    setEditingId(tip.id);
    setEditTitle(tip.title);
    setEditContent(tip.content);
    setEditPhotos(tip.images ?? []);
    setEditNewPhotos([]);
    setEditNewPreviews([]);
    setEditVideo(tip.video ?? "");
    setEditNewVideo(null);
    setEditNewVideoPreview("");
    setEditLinkedRecipes(tip.linkedRecipes ?? []);
    setEditRecipeSearch("");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditNewPhotos([]);
    setEditNewPreviews([]);
    setEditNewVideo(null);
    setEditNewVideoPreview("");
    setEditLinkedRecipes([]);
    setEditRecipeSearch("");
  }

  function handleEditPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (editPhotos.length + editNewPhotos.length >= 3) return;
    setEditNewPhotos((prev) => [...prev, file]);
    const reader = new FileReader();
    reader.onload = (ev) => setEditNewPreviews((prev) => [...prev, ev.target?.result as string]);
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handleEditVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("video/")) return;
    setEditNewVideo(file);
    setEditNewVideoPreview(URL.createObjectURL(file));
    setEditVideo("");
    e.target.value = "";
  }

  async function handleSaveEdit() {
    if (!editingId || !editTitle.trim() || !editContent.trim()) return;
    setSaving(true);
    try {
      const newImageUrls: string[] = [];
      for (const file of editNewPhotos) {
        const url = await uploadTipFile(file, editingId);
        newImageUrls.push(url);
      }
      const allImages = [...editPhotos, ...newImageUrls];

      let finalVideo = editVideo || undefined;
      if (editNewVideo) {
        finalVideo = await uploadTipFile(editNewVideo, `${editingId}/video`);
      }

      const updates: Record<string, unknown> = {
        title: editTitle.trim(),
        content: editContent.trim(),
        linkedRecipes: editLinkedRecipes.length > 0 ? editLinkedRecipes : [],
        linkedRecipeIds: editLinkedRecipes.map((r) => r.id),
      };
      if (allImages.length > 0) {
        updates.images = allImages;
      }
      if (finalVideo) {
        updates.video = finalVideo;
      }

      await updateTip(editingId, updates);
      setTips((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? { ...t, title: editTitle.trim(), content: editContent.trim(), images: allImages.length > 0 ? allImages : undefined, video: finalVideo, linkedRecipes: editLinkedRecipes.length > 0 ? editLinkedRecipes : undefined }
            : t
        )
      );
      cancelEditing();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
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

            {/* Photos */}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">
                Photos <span className="text-slate/50 font-normal">(up to 3)</span>
              </label>
              {photoPreviews.length > 0 && (
                <div className="flex gap-3 mb-3">
                  {photoPreviews.map((preview, index) => (
                    <div key={index} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt={`Photo ${index + 1}`} className="h-20 w-28 rounded-lg object-cover ring-1 ring-cream-dark/30" />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        aria-label="Remove photo"
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-charcoal/70 hover:bg-charcoal rounded-full flex items-center justify-center text-white cursor-pointer"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {photoFiles.length < 3 && (
                <label className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate/60 hover:text-slate hover:bg-cream-dark/20 transition-colors cursor-pointer">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909-4.97-4.969a.75.75 0 0 0-1.06 0L2.5 11.06ZM12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clipRule="evenodd" />
                  </svg>
                  {photoFiles.length === 0 ? "Add photos" : `Add another (${3 - photoFiles.length} remaining)`}
                  <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                </label>
              )}
            </div>

            {/* Video */}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">
                Video <span className="text-slate/50 font-normal">(optional, 1 max)</span>
              </label>
              {videoPreview ? (
                <div className="relative inline-block">
                  <video src={videoPreview} className="h-24 w-40 rounded-lg object-cover ring-1 ring-cream-dark/30" />
                  <button
                    type="button"
                    onClick={removeVideo}
                    aria-label="Remove video"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-charcoal/70 hover:bg-charcoal rounded-full flex items-center justify-center text-white cursor-pointer"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate/60 hover:text-slate hover:bg-cream-dark/20 transition-colors cursor-pointer">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM19 4.75a.75.75 0 0 0-1.28-.53l-3 3a.75.75 0 0 0-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 0 0 1.28-.53V4.75Z" />
                  </svg>
                  Add video
                  <input type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
                </label>
              )}
            </div>

            {/* Pin to recipes */}
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1.5">
                Pin this tip to recipes <span className="text-slate/50 font-normal">(optional)</span>
              </label>
              <div className="rounded-lg border border-gold-light bg-cream max-h-48 overflow-y-auto">
                {[...allRecipes].sort((a, b) => a.title.localeCompare(b.title)).map((r) => {
                  const isPinned = linkedRecipes.some((lr) => lr.id === r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        if (isPinned) {
                          setLinkedRecipes((prev) => prev.filter((lr) => lr.id !== r.id));
                        } else {
                          setLinkedRecipes((prev) => [...prev, { id: r.id, title: r.title, slug: r.slug }]);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left font-sans text-sm transition-colors cursor-pointer border-b border-gold-light/30 last:border-b-0 ${isPinned ? "bg-terracotta/8 text-terracotta" : "text-charcoal hover:bg-cream-dark/20"}`}
                    >
                      <span className="truncate">{r.title}</span>
                      <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 shrink-0 ml-2 transition-colors ${isPinned ? "text-terracotta" : "text-slate/20"}`}>
                        <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.547a2.25 2.25 0 0 1-.66 1.591L5.03 10.45a.75.75 0 0 0 .53 1.3h3.69v4.5a.75.75 0 0 0 1.5 0v-4.5h3.69a.75.75 0 0 0 .53-1.3l-1.56-1.562a2.25 2.25 0 0 1-.66-1.59V3.75a.75.75 0 0 0-1.5 0v3.547a3.75 3.75 0 0 0 1.1 2.652l.44.44H8.16l.44-.44a3.75 3.75 0 0 0 1.1-2.652V3.75Z" />
                      </svg>
                    </button>
                  );
                })}
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

      {/* Search */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate/40">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tips..."
            className="w-full rounded-xl border border-gold-light bg-warm-white py-2.5 pl-10 pr-4 font-sans text-sm text-charcoal placeholder:text-slate/40 outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20"
          />
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
              {searchQuery.trim() ? "No tips found" : "No tips yet"}
            </h3>
            <p className="max-w-sm font-sans text-sm text-slate">
              {searchQuery.trim()
                ? "Try different keywords or share a tip of your own."
                : "Be the first to share a kitchen tip with the family."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {filteredTips.map((tip) => (
                <div
                  key={tip.id}
                  className="group rounded-2xl bg-warm-white p-5 ring-1 ring-cream-dark/30 transition-shadow hover:shadow-md"
                >
                  {editingId === tip.id ? (
                    /* ---- Edit mode ---- */
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className={inputClasses}
                      />
                      <textarea
                        rows={4}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className={`${inputClasses} resize-none`}
                      />

                      {/* Existing + new photos */}
                      <div className="flex flex-wrap gap-2">
                        {editPhotos.map((url, i) => (
                          <div key={`existing-${i}`} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="h-16 w-24 rounded-lg object-cover ring-1 ring-cream-dark/30" />
                            <button type="button" onClick={() => setEditPhotos((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove photo" className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-charcoal/70 hover:bg-charcoal rounded-full flex items-center justify-center text-white cursor-pointer">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))}
                        {editNewPreviews.map((url, i) => (
                          <div key={`new-${i}`} className="relative">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="h-16 w-24 rounded-lg object-cover ring-1 ring-cream-dark/30" />
                            <button type="button" onClick={() => { setEditNewPhotos((p) => p.filter((_, idx) => idx !== i)); setEditNewPreviews((p) => p.filter((_, idx) => idx !== i)); }} aria-label="Remove photo" className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-charcoal/70 hover:bg-charcoal rounded-full flex items-center justify-center text-white cursor-pointer">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                      {editPhotos.length + editNewPhotos.length < 3 && (
                        <label className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate/50 hover:text-slate cursor-pointer">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909-4.97-4.969a.75.75 0 0 0-1.06 0L2.5 11.06ZM12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clipRule="evenodd" /></svg>
                          Add photo
                          <input type="file" accept="image/*" onChange={handleEditPhotoSelect} className="hidden" />
                        </label>
                      )}

                      {/* Video */}
                      {(editVideo || editNewVideoPreview) ? (
                        <div className="relative inline-block">
                          <video src={editNewVideoPreview || editVideo} className="h-20 w-32 rounded-lg object-cover ring-1 ring-cream-dark/30" />
                          <button type="button" onClick={() => { setEditVideo(""); setEditNewVideo(null); setEditNewVideoPreview(""); }} aria-label="Remove video" className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-charcoal/70 hover:bg-charcoal rounded-full flex items-center justify-center text-white cursor-pointer">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ) : (
                        <label className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate/50 hover:text-slate cursor-pointer">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM19 4.75a.75.75 0 0 0-1.28-.53l-3 3a.75.75 0 0 0-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 0 0 1.28-.53V4.75Z" /></svg>
                          Add video
                          <input type="file" accept="video/*" onChange={handleEditVideoSelect} className="hidden" />
                        </label>
                      )}

                      {/* Pin to recipes */}
                      <div>
                        <p className="font-sans text-[10px] font-medium text-slate/50 mb-1">Pin to recipes</p>
                        <div className="rounded-lg border border-gold-light bg-cream max-h-36 overflow-y-auto">
                          {[...allRecipes].sort((a, b) => a.title.localeCompare(b.title)).map((r) => {
                            const isPinned = editLinkedRecipes.some((lr) => lr.id === r.id);
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => {
                                  if (isPinned) {
                                    setEditLinkedRecipes((prev) => prev.filter((lr) => lr.id !== r.id));
                                  } else {
                                    setEditLinkedRecipes((prev) => [...prev, { id: r.id, title: r.title, slug: r.slug }]);
                                  }
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left font-sans text-xs transition-colors cursor-pointer border-b border-gold-light/30 last:border-b-0 ${isPinned ? "bg-terracotta/8 text-terracotta" : "text-charcoal hover:bg-cream-dark/20"}`}
                              >
                                <span className="truncate">{r.title}</span>
                                <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3.5 w-3.5 shrink-0 ml-2 transition-colors ${isPinned ? "text-terracotta" : "text-slate/20"}`}>
                                  <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.547a2.25 2.25 0 0 1-.66 1.591L5.03 10.45a.75.75 0 0 0 .53 1.3h3.69v4.5a.75.75 0 0 0 1.5 0v-4.5h3.69a.75.75 0 0 0 .53-1.3l-1.56-1.562a2.25 2.25 0 0 1-.66-1.59V3.75a.75.75 0 0 0-1.5 0v3.547a3.75 3.75 0 0 0 1.1 2.652l.44.44H8.16l.44-.44a3.75 3.75 0 0 0 1.1-2.652V3.75Z" />
                                </svg>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button type="button" onClick={handleSaveEdit} disabled={saving} className="rounded-lg bg-terracotta px-4 py-2 font-sans text-xs font-medium text-white hover:bg-terracotta-dark disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button type="button" onClick={cancelEditing} className="rounded-lg px-4 py-2 font-sans text-xs font-medium text-slate hover:text-charcoal cursor-pointer">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ---- View mode ---- */
                    <>
                      {/* Title + actions */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-serif text-lg font-semibold text-charcoal leading-snug">
                          {tip.title}
                        </h3>
                        {user && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditing(tip)}
                              aria-label="Edit tip"
                              className="h-6 w-6 flex items-center justify-center rounded text-slate/30 hover:text-terracotta cursor-pointer"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(tip)}
                              disabled={deletingId === tip.id}
                              aria-label="Delete tip"
                              className="h-6 w-6 flex items-center justify-center rounded text-slate/30 hover:text-red-500 cursor-pointer disabled:opacity-40"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <p className="mt-2 font-sans text-sm leading-relaxed text-slate whitespace-pre-line">
                        {tip.content}
                      </p>

                      {/* Images */}
                      {tip.images && tip.images.length > 0 && (
                        <div className="mt-3 flex gap-2">
                          {tip.images.map((url, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={url} alt={`${tip.title} photo ${i + 1}`} className="h-20 w-28 rounded-lg object-cover ring-1 ring-cream-dark/30" />
                          ))}
                        </div>
                      )}

                      {/* Video */}
                      {tip.video && (
                        <div className="mt-3">
                          <video src={tip.video} controls className="w-full max-w-xs rounded-lg ring-1 ring-cream-dark/30" />
                        </div>
                      )}

                      {/* Linked recipes */}
                      {tip.linkedRecipes && tip.linkedRecipes.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {tip.linkedRecipes.map((r) => (
                            <Link
                              key={r.id}
                              href={`/recipes/${r.slug}`}
                              className="inline-flex items-center gap-1 rounded-full bg-sage/10 px-2.5 py-0.5 font-sans text-[10px] font-medium text-sage-dark hover:bg-sage/20 transition-colors"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                                <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Z" clipRule="evenodd" />
                              </svg>
                              {r.title}
                            </Link>
                          ))}
                        </div>
                      )}

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
                    </>
                  )}
                </div>
            ))}
          </div>
        )}
      </div>

      {deleteTarget && (
        <DeleteModal
          title={deleteTarget.title}
          heading="Delete Tip"
          message={`Are you sure you want to delete "${deleteTarget.title}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </main>
  );
}
