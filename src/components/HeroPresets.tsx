"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase";

// The hero photos a new owner picks from. The list is DATA now — add one here
// and it appears in every app on the next launch, no release needed. See
// /api/admin/hero-presets.

interface Preset {
  id: string;
  label: string;
  url: string;
  sortOrder: number;
  usedByNames: string[];
}

interface HeroData {
  classic: { label: string; displayUrl: string; usedByNames: string[] };
  presets: Preset[];
  custom: { name: string; url: string }[];
  totalHouseholds: number;
}

export default function HeroPresets() {
  const [data, setData] = useState<HeroData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Preset | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const token = useCallback(async () => getFirebaseAuth().currentUser?.getIdToken(), []);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/hero-presets", {
      headers: { Authorization: `Bearer ${await token()}` },
    });
    if (res.ok) {
      setData(await res.json());
      setError("");
    } else {
      setError("Failed to load the hero photos.");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function upload() {
    if (!file || !newLabel.trim()) return;
    setBusy("upload");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("label", newLabel.trim());
      const res = await fetch("/api/admin/hero-presets", {
        method: "POST",
        headers: { Authorization: `Bearer ${await token()}` },
        body: form,
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setError(`Upload failed (${b.error ?? res.status}).`);
        return;
      }
      setNewLabel("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function rename(p: Preset, label: string) {
    if (label === p.label || !label.trim()) return;
    setBusy(`edit:${p.id}`);
    try {
      await fetch("/api/admin/hero-presets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ id: p.id, label }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function move(p: Preset, direction: -1 | 1) {
    if (!data) return;
    const list = data.presets;
    const i = list.findIndex((x) => x.id === p.id);
    const j = i + direction;
    if (j < 0 || j >= list.length) return;
    setBusy(`move:${p.id}`);
    try {
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` };
      // Swap the two sort values — the simplest reorder that can't drift.
      await Promise.all([
        fetch("/api/admin/hero-presets", {
          method: "PATCH", headers,
          body: JSON.stringify({ id: p.id, sortOrder: list[j].sortOrder }),
        }),
        fetch("/api/admin/hero-presets", {
          method: "PATCH", headers,
          body: JSON.stringify({ id: list[j].id, sortOrder: p.sortOrder }),
        }),
      ]);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function remove(p: Preset) {
    setBusy(`del:${p.id}`);
    try {
      await fetch(`/api/admin/hero-presets?id=${encodeURIComponent(p.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${await token()}` },
      });
      setConfirmDelete(null);
      await load();
    } finally {
      setBusy(null);
    }
  }

  const btn = "rounded-lg px-2.5 py-1 font-sans text-[11px] font-medium transition-colors disabled:opacity-40";
  const tile = "relative aspect-[16/10] overflow-hidden rounded-lg border border-charcoal/10 bg-cream-dark";

  return (
    <section className="mb-8 rounded-xl border border-charcoal/10 bg-white p-5">
      <h2 className="mb-1 font-serif text-lg font-semibold text-charcoal">Cookbook hero photos</h2>
      <p className="mb-4 font-sans text-xs text-slate">
        What a new owner chooses from for the big photo on their Recipes screen. Add one here and it
        appears in every app — no release needed. Removing one takes it out of the picker but leaves
        the photo alone, so families already using it keep theirs.
      </p>

      {error && <p className="mb-3 font-sans text-xs text-warning">{error}</p>}
      {!data && !error && <p className="font-sans text-xs text-slate/70">Loading…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {/* Classic is bundled in the apps — it can't be removed or reordered,
                and it's the fallback if this list ever fails to load. */}
            <div>
              <div className={tile}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.classic.displayUrl} alt="Classic" className="h-full w-full object-cover" />
              </div>
              <div className="mt-1.5 font-sans text-sm font-medium text-charcoal">Classic</div>
              <div className="font-sans text-[11px] text-slate/70">
                built into the apps · {data.classic.usedByNames.length} cookbook
                {data.classic.usedByNames.length === 1 ? "" : "s"}
              </div>
              <div className="font-sans text-[11px] leading-snug text-slate/50">
                {data.classic.usedByNames.join(", ")}
              </div>
            </div>

            {data.presets.map((p, i) => (
              <div key={p.id}>
                <div className={tile}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.label} className="h-full w-full object-cover" />
                </div>
                <input
                  className="mt-1.5 w-full rounded border border-transparent bg-transparent font-sans text-sm font-medium text-charcoal hover:border-charcoal/15 focus:border-terracotta focus:outline-none"
                  defaultValue={p.label}
                  onBlur={(e) => rename(p, e.target.value)}
                  aria-label={`Rename ${p.label}`}
                />
                <div className="font-sans text-[11px] text-slate/70">
                  {p.usedByNames.length === 0
                    ? "nobody yet"
                    : `${p.usedByNames.length} cookbook${p.usedByNames.length === 1 ? "" : "s"}`}
                </div>
                {p.usedByNames.length > 0 && (
                  <div className="font-sans text-[11px] leading-snug text-slate/50">
                    {p.usedByNames.join(", ")}
                  </div>
                )}
                <div className="mt-1 flex gap-1">
                  <button
                    className={`${btn} bg-charcoal/5 text-charcoal hover:bg-charcoal/10`}
                    disabled={i === 0 || busy === `move:${p.id}`}
                    onClick={() => move(p, -1)}
                    aria-label="Move earlier"
                  >
                    ←
                  </button>
                  <button
                    className={`${btn} bg-charcoal/5 text-charcoal hover:bg-charcoal/10`}
                    disabled={i === data.presets.length - 1 || busy === `move:${p.id}`}
                    onClick={() => move(p, 1)}
                    aria-label="Move later"
                  >
                    →
                  </button>
                  <button
                    className={`${btn} bg-danger/10 text-danger hover:bg-danger/20`}
                    disabled={busy === `del:${p.id}`}
                    onClick={() => setConfirmDelete(p)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {confirmDelete && (
            <div className="mt-4 rounded-lg border border-terracotta-light/40 bg-terracotta-light/10 p-4">
              <p className="mb-1 font-sans text-sm font-semibold text-charcoal">
                Take “{confirmDelete.label}” out of the picker?
              </p>
              <p className="mb-3 font-sans text-xs text-slate">
                New owners stop seeing it.{" "}
                {confirmDelete.usedByNames.length > 0
                  ? `The ${confirmDelete.usedByNames.length} cookbook${confirmDelete.usedByNames.length === 1 ? "" : "s"} already using it (${confirmDelete.usedByNames.join(", ")}) keep it — the photo itself isn't deleted.`
                  : "Nobody is using it, and the photo itself isn't deleted."}
              </p>
              <div className="flex gap-2">
                <button
                  className="rounded-lg bg-charcoal px-3 py-1.5 font-sans text-xs font-medium text-warm-white hover:bg-charcoal/85 disabled:opacity-40"
                  disabled={busy === `del:${confirmDelete.id}`}
                  onClick={() => remove(confirmDelete)}
                >
                  {busy === `del:${confirmDelete.id}` ? "Removing…" : "Remove it"}
                </button>
                <button
                  className="rounded-lg bg-charcoal/5 px-3 py-1.5 font-sans text-xs font-medium text-charcoal hover:bg-charcoal/10"
                  onClick={() => setConfirmDelete(null)}
                >
                  Keep it
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 rounded-lg border border-terracotta/30 bg-terracotta/5 p-4">
            <h3 className="mb-2 font-sans text-xs font-semibold text-charcoal">Add a hero photo</h3>
            <div className="flex flex-wrap items-end gap-3">
              <label className="block font-sans text-xs text-slate">
                Name
                <input
                  className="mt-1 block w-48 rounded-lg border border-charcoal/15 bg-white px-3 py-2 font-sans text-sm text-charcoal focus:outline-none focus:ring-1 focus:ring-terracotta"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Braai"
                />
              </label>
              <label className="block font-sans text-xs text-slate">
                Photo
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="mt-1 block font-sans text-xs text-slate file:mr-2 file:rounded-lg file:border-0 file:bg-charcoal/5 file:px-3 file:py-2 file:font-sans file:text-xs file:text-charcoal"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <button
                className="rounded-lg bg-terracotta px-3 py-2 font-sans text-xs font-medium text-warm-white hover:bg-terracotta/90 disabled:opacity-40"
                disabled={!file || !newLabel.trim() || busy === "upload"}
                onClick={upload}
              >
                {busy === "upload" ? "Uploading…" : "Add it"}
              </button>
            </div>
            <p className="mt-2 font-sans text-[11px] text-slate/70">
              Wide and landscape (16:9 works well), under 8MB. The cookbook name and logo sit over
              the middle, so pick something calm and darker through the centre.
            </p>
          </div>

          <div className="mt-5 border-t border-hairline/50 pt-3">
            <h3 className="font-sans text-xs font-semibold text-charcoal">
              Their own photos ({data.custom.length})
            </h3>
            {data.custom.length === 0 ? (
              <p className="mt-1 font-sans text-[11px] text-slate/70">
                Nobody has uploaded their own hero yet — every cookbook is on one of ours.
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {data.custom.map((c) => (
                  <div key={c.url}>
                    <div className={tile}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.url} alt={c.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="mt-1 truncate font-sans text-[11px] text-slate/70">{c.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
