"use client";

import { useCallback, useEffect, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase";

// What a new owner picks from for their cookbook's home hero, plus who is
// actually using each one. See /api/admin/heroes for where the list lives and
// why the images can be swapped without an app release.

interface Preset {
  key: string;
  label: string;
  url: string | null;
  displayUrl: string;
  status: number | string;
  usedBy: number;
  usedByNames: string[];
}

interface HeroData {
  presets: Preset[];
  custom: { name: string; url: string }[];
  totalHouseholds: number;
}

export default function HeroPresets() {
  const [data, setData] = useState<HeroData | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const token = await getFirebaseAuth().currentUser?.getIdToken();
    const res = await fetch("/api/admin/heroes", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      setData(await res.json());
      setError("");
    } else {
      setError("Failed to load the hero photos.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="mb-8 rounded-xl border border-charcoal/10 bg-white p-5">
      <h2 className="mb-1 font-serif text-lg font-semibold text-charcoal">Cookbook hero photos</h2>
      <p className="mb-4 font-sans text-xs text-slate">
        What a new owner chooses from for the big photo on their Recipes screen, and who picked
        what. The <strong>photos</strong> live in Storage — replacing a file changes it for
        everyone with no app release. The <strong>list</strong> is in the apps, so adding or
        removing an option needs one.
      </p>

      {error && <p className="mb-3 font-sans text-xs text-red-600">{error}</p>}
      {!data && !error && <p className="font-sans text-xs text-slate/70">Loading…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {data.presets.map((p) => (
              <div key={p.key}>
                <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-charcoal/10 bg-cream-dark">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.displayUrl} alt={p.label} className="h-full w-full object-cover" />
                  {p.status !== 200 && p.url && (
                    <span className="absolute inset-x-0 bottom-0 bg-red-600/90 px-1 py-0.5 text-center font-sans text-[10px] font-semibold text-white">
                      {String(p.status)} — broken
                    </span>
                  )}
                </div>
                <div className="mt-1.5 font-sans text-sm font-medium text-charcoal">{p.label}</div>
                <div className="font-sans text-[11px] text-slate/70">
                  {p.usedBy === 0
                    ? "nobody yet"
                    : `${p.usedBy} cookbook${p.usedBy === 1 ? "" : "s"}`}
                  {p.key === "standard" && " (the default)"}
                </div>
                {p.usedByNames.length > 0 && (
                  <div className="font-sans text-[11px] leading-snug text-slate/50">
                    {p.usedByNames.join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-gold-light/50 pt-3">
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
                    <div className="aspect-[16/10] overflow-hidden rounded-lg border border-charcoal/10 bg-cream-dark">
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
