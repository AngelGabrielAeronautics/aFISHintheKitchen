"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase";

// Superadmin authoring for the global Learn library (docs/LEARN.md). Content
// written here is live in the apps the moment it's published — no app release.

interface LearnItem {
  id: string;
  type: "tip" | "video" | "series" | "weekly";
  status: "draft" | "published";
  title: string;
  body: string;
  youtubeId: string | null;
  seriesId: string | null;
  seriesOrder: number | null;
  sortOrder: number;
  pinnedDate: string | null;
  /** The curated card "Save to my cookbook" copies. Presence is what the
   *  "recipe card" badge reports — a weekly isn't finished without one. */
  recipe?: { title?: string } | null;
  publishedAt: string | null;
  notifiedAt: string | null;
  updatedAt: string;
}

interface Draft {
  type: LearnItem["type"];
  title: string;
  body: string;
  youtubeId: string;
  seriesId: string;
  seriesOrder: string;
  sortOrder: string;
  pinnedDate: string;
}
const BLANK: Draft = { type: "tip", title: "", body: "", youtubeId: "", seriesId: "", seriesOrder: "", sortOrder: "0", pinnedDate: "" };

export default function LearnManager() {
  const [items, setItems] = useState<LearnItem[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [notifyConfirm, setNotifyConfirm] = useState<LearnItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<LearnItem | null>(null);

  const authHeaders = useCallback(async () => {
    const token = await getFirebaseAuth().currentUser?.getIdToken();
    return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/learn", { headers: await authHeaders() });
    if (res.ok) {
      setItems((await res.json()).items);
      setError("");
    } else {
      setError("Failed to load the Learn library.");
    }
  }, [authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(payload: Record<string, unknown>, busyKey: string) {
    setBusy(busyKey);
    try {
      const res = await fetch("/api/admin/learn", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(`That didn't save (${body.error ?? res.status}).`);
        return false;
      }
      setError("");
      await load();
      return true;
    } finally {
      setBusy(null);
    }
  }

  function startEdit(item?: LearnItem) {
    if (!item) {
      setDraft(BLANK);
      setEditing("new");
      return;
    }
    setDraft({
      type: item.type,
      title: item.title,
      body: item.body,
      youtubeId: item.youtubeId ?? "",
      seriesId: item.seriesId ?? "",
      seriesOrder: item.seriesOrder != null ? String(item.seriesOrder) : "",
      sortOrder: String(item.sortOrder ?? 0),
      pinnedDate: item.pinnedDate ?? "",
    });
    setEditing(item.id);
  }

  async function save() {
    const item = {
      type: draft.type,
      title: draft.title,
      body: draft.body,
      youtubeId: draft.youtubeId || null,
      seriesId: draft.seriesId || null,
      seriesOrder: draft.seriesOrder === "" ? null : Number(draft.seriesOrder),
      sortOrder: Number(draft.sortOrder) || 0,
      pinnedDate: draft.pinnedDate.trim() || null,
    };
    const ok = await post(
      editing === "new" ? { action: "create", item } : { action: "update", id: editing, item },
      "save"
    );
    if (ok) setEditing(null);
  }

  const seriesOptions = (items ?? []).filter((i) => i.type === "series");
  const input =
    "w-full rounded-lg border border-charcoal/15 bg-white px-3 py-2 font-sans text-sm text-charcoal focus:outline-none focus:ring-1 focus:ring-terracotta";
  const btn =
    "rounded-lg px-3 py-1.5 font-sans text-xs font-medium transition-colors disabled:opacity-40";

  // Grouped exactly as the app's Learn page is, so what you see here is what
  // a user sees there — one flat list of everything made the four sections
  // impossible to tell apart, and a missing recipe card impossible to spot.
  const all = items ?? [];
  const weeklies = all.filter((i) => i.type === "weekly");
  const tips = all.filter((i) => i.type === "tip");
  const series = all.filter((i) => i.type === "series");
  const standalone = all.filter((i) => i.type === "video" && !i.seriesId);
  const lessonsOf = (seriesId: string) =>
    all
      .filter((i) => i.type === "video" && i.seriesId === seriesId)
      .sort((a, b) => (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0));

  const rowProps = {
    btn,
    busy,
    onEdit: startEdit,
    onTogglePublish: (item: LearnItem) =>
      post({ action: item.status === "published" ? "unpublish" : "publish", id: item.id }, `pub:${item.id}`),
    onNotify: setNotifyConfirm,
    onDelete: setDeleteConfirm,
  };

  return (
    <section className="mb-8 rounded-xl border border-charcoal/10 bg-white p-5">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-serif text-lg font-semibold text-charcoal">Learn</h2>
        <button className={`${btn} bg-terracotta text-white hover:bg-terracotta/90`} onClick={() => startEdit()}>
          New item
        </button>
      </div>
      <p className="mb-4 font-sans text-xs text-slate">
        The global library every user sees. Publishing is live in the apps immediately — drafts are
        invisible to everyone but us. Notify sends one push to every device, so use it about once a
        week, for the best item.
      </p>

      {error && <p className="mb-3 font-sans text-xs text-red-600">{error}</p>}
      {!items && !error && <p className="font-sans text-xs text-slate/70">Loading…</p>}

      {editing && (
        <div className="mb-4 rounded-lg border border-terracotta/30 bg-terracotta/5 p-4">
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <label className="block font-sans text-xs text-slate">
              Type
              <select
                className={`${input} mt-1`}
                value={draft.type}
                onChange={(e) => setDraft({ ...draft, type: e.target.value as LearnItem["type"] })}
              >
                <option value="tip">Tip (from our kitchen)</option>
                <option value="video">Video (YouTube)</option>
                <option value="series">Masterclass series</option>
                <option value="weekly">Weekly recipe (Learn this week pool)</option>
              </select>
            </label>
            <label className="block font-sans text-xs text-slate">
              Sort order (lower shows first)
              <input
                className={`${input} mt-1`}
                value={draft.sortOrder}
                onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
                inputMode="numeric"
              />
            </label>
          </div>
          <label className="mb-3 block font-sans text-xs text-slate">
            Title
            <input
              className={`${input} mt-1`}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder={draft.type === "series" ? "Bread, week by week" : "Sharpen your knives properly"}
            />
          </label>
          <label className="mb-3 block font-sans text-xs text-slate">
            {draft.type === "tip" ? "The tip" : draft.type === "series" ? "What the series covers" : "Blurb (why this video)"}
            <textarea
              className={`${input} mt-1 min-h-24`}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </label>
          {(draft.type === "video" || draft.type === "weekly") && (
            <div className="mb-3 grid gap-3 sm:grid-cols-3">
              <label className="block font-sans text-xs text-slate sm:col-span-1">
                YouTube link or ID
                <input
                  className={`${input} mt-1`}
                  value={draft.youtubeId}
                  onChange={(e) => setDraft({ ...draft, youtubeId: e.target.value })}
                  placeholder="https://youtu.be/…"
                />
              </label>
              {draft.type === "weekly" && (
                <label className="block font-sans text-xs text-slate">
                  Pin to the week of (MM-DD, optional)
                  <input
                    className={`${input} mt-1`}
                    value={draft.pinnedDate}
                    onChange={(e) => setDraft({ ...draft, pinnedDate: e.target.value })}
                    placeholder="12-25 for Christmas"
                  />
                  <span className="mt-1 block text-[11px] text-slate/60">
                    A pinned recipe shows only in the week containing that date each year, and sits
                    out the normal rotation.
                  </span>
                </label>
              )}
              {draft.type === "video" && (
              <>
              <label className="block font-sans text-xs text-slate">
                Part of series
                <select
                  className={`${input} mt-1`}
                  value={draft.seriesId}
                  onChange={(e) => setDraft({ ...draft, seriesId: e.target.value })}
                >
                  <option value="">— none —</option>
                  {seriesOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block font-sans text-xs text-slate">
                Lesson number in the series
                <input
                  className={`${input} mt-1`}
                  value={draft.seriesOrder}
                  onChange={(e) => setDraft({ ...draft, seriesOrder: e.target.value })}
                  inputMode="numeric"
                  placeholder="1"
                />
              </label>
              </>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button
              className={`${btn} bg-terracotta text-white hover:bg-terracotta/90`}
              onClick={save}
              disabled={busy === "save" || !draft.title.trim()}
            >
              {busy === "save" ? "Saving…" : "Save"}
            </button>
            <button className={`${btn} bg-charcoal/5 text-charcoal hover:bg-charcoal/10`} onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {items && items.length === 0 && !editing && (
        <p className="font-sans text-sm text-slate/70">Nothing here yet — add the first tip.</p>
      )}

      {items && items.length > 0 && (
        <div className="space-y-6">
          <Section
            title="Learn this recipe this week"
            hint="The weekly pool. Unpinned ones rotate a week each, in this order; a pinned one owns its date's week every year."
            count={weeklies.length}
          >
            {weeklies.map((item) => (
              <Row key={item.id} item={item} {...rowProps} />
            ))}
          </Section>

          <Section
            title="Tips from our kitchen"
            hint="Our own kitchen wisdom. The app shows three, then “Show all”."
            count={tips.length}
            collapseAfter={5}
          >
            {tips.map((item) => (
              <Row key={item.id} item={item} {...rowProps} />
            ))}
          </Section>

          <Section
            title="Masterclasses"
            hint="Series with their classes beneath. Deleting a series frees its videos rather than deleting them."
            count={series.length}
          >
            {series.map((s) => (
              <div key={s.id}>
                <Row item={s} {...rowProps} />
                <div className="ml-4 border-l-2 border-gold-light/60 pl-3">
                  {lessonsOf(s.id).map((v) => (
                    <Row key={v.id} item={v} {...rowProps} />
                  ))}
                  {lessonsOf(s.id).length === 0 && (
                    <p className="py-2 font-sans text-xs text-slate/60">
                      No classes yet — add a video and set its series to “{s.title}”.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </Section>

          <Section
            title="Watch & learn"
            hint="Standalone videos — everything not part of a series."
            count={standalone.length}
          >
            {standalone.map((item) => (
              <Row key={item.id} item={item} {...rowProps} />
            ))}
          </Section>
        </div>
      )}

      {notifyConfirm && (
        <ConfirmBox
          title={`Push "${notifyConfirm.title}" to every device?`}
          detail="Every user with the app gets a notification right now. There is no undo. Once a week is plenty."
          confirmLabel="Send the push"
          busy={busy === `notify:${notifyConfirm.id}`}
          onConfirm={async () => {
            await post({ action: "notify", id: notifyConfirm.id }, `notify:${notifyConfirm.id}`);
            setNotifyConfirm(null);
          }}
          onCancel={() => setNotifyConfirm(null)}
        />
      )}
      {deleteConfirm && (
        <ConfirmBox
          title={`Delete "${deleteConfirm.title}"?`}
          detail={
            deleteConfirm.type === "series"
              ? "The series goes; its videos stay but leave the series. If it's published, it disappears from every app immediately."
              : "If it's published, it disappears from every app immediately. This cannot be undone."
          }
          confirmLabel="Delete"
          busy={busy === `del:${deleteConfirm.id}`}
          onConfirm={async () => {
            await post({ action: "delete", id: deleteConfirm.id }, `del:${deleteConfirm.id}`);
            setDeleteConfirm(null);
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </section>
  );
}

/** One section of the library, mirroring a section of the app's Learn page. */
function Section({
  title,
  hint,
  count,
  collapseAfter,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  collapseAfter?: number;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = React.Children.toArray(children);
  // Long sections (the tips) collapse the way the app's do, so every section
  // header stays visible without a scroll marathon.
  const collapsed = collapseAfter !== undefined && !expanded && rows.length > collapseAfter;
  const shown = collapsed ? rows.slice(0, collapseAfter) : rows;

  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2 border-b border-gold-light/60 pb-1">
        <h3 className="font-serif text-base font-semibold text-charcoal">{title}</h3>
        <span className="font-sans text-xs text-slate/70">{count}</span>
      </div>
      <p className="mb-2 font-sans text-[11px] leading-relaxed text-slate/70">{hint}</p>
      {count === 0 ? (
        <p className="py-2 font-sans text-xs text-slate/60">Nothing here yet.</p>
      ) : (
        <div className="divide-y divide-gold-light/40">{shown}</div>
      )}
      {collapseAfter !== undefined && rows.length > collapseAfter && (
        <button
          className="mt-1 font-sans text-xs font-medium text-terracotta hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {collapsed ? `Show all ${rows.length}` : "Show fewer"}
        </button>
      )}
    </div>
  );
}

/** One item row: title, the badges that matter, and its actions. */
function Row({
  item,
  btn,
  busy,
  onEdit,
  onTogglePublish,
  onNotify,
  onDelete,
}: {
  item: LearnItem;
  btn: string;
  busy: string | null;
  onEdit: (item: LearnItem) => void;
  onTogglePublish: (item: LearnItem) => void;
  onNotify: (item: LearnItem) => void;
  onDelete: (item: LearnItem) => void;
}) {
  const badge = "shrink-0 rounded-full px-2 py-0.5 font-sans text-[10px] uppercase tracking-wide";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.seriesOrder != null && item.seriesId && (
            <span className="font-sans text-xs text-slate/60">{item.seriesOrder}.</span>
          )}
          <span className="truncate font-sans text-sm font-medium text-charcoal">{item.title}</span>
          {item.status !== "published" && (
            <span className={`${badge} bg-gold-light/50 text-charcoal/70`}>draft</span>
          )}
          {item.pinnedDate && (
            <span className={`${badge} bg-terracotta/10 text-terracotta`}>pinned {item.pinnedDate}</span>
          )}
          {/* ⚠ The nag is for WEEKLIES ONLY. A weekly is "learn this recipe
              this week" — without a card there's nothing to learn, so a
              missing one is a real to-do. Plenty of videos are technique
              (knife skills, what not to buy) where a recipe card would be
              nonsense, and a checklist that cries wolf on those is a
              checklist you stop reading. Videos just show the ✓ when they
              have one. */}
          {item.type === "weekly" && !item.recipe && (
            <span className={`${badge} bg-red-50 text-red-700`}>no recipe card</span>
          )}
          {item.recipe && <span className={`${badge} bg-terracotta/10 text-terracotta`}>recipe ✓</span>}
        </div>
        {item.notifiedAt && (
          <div className="font-sans text-[11px] text-slate/60">
            push sent {new Date(item.notifiedAt).toLocaleDateString()}
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button className={`${btn} bg-charcoal/5 text-charcoal hover:bg-charcoal/10`} onClick={() => onEdit(item)}>
          Edit
        </button>
        <button
          className={`${btn} bg-charcoal/5 text-charcoal hover:bg-charcoal/10`}
          disabled={busy === `pub:${item.id}`}
          onClick={() => onTogglePublish(item)}
        >
          {item.status === "published" ? "Unpublish" : "Publish"}
        </button>
        {item.status === "published" && item.type !== "series" && (
          <button
            className={`${btn} bg-gold-light/40 text-charcoal hover:bg-gold-light/60`}
            disabled={busy === `notify:${item.id}`}
            onClick={() => onNotify(item)}
          >
            {item.notifiedAt ? "Notify again" : "Notify"}
          </button>
        )}
        <button
          className={`${btn} bg-red-50 text-red-700 hover:bg-red-100`}
          disabled={busy === `del:${item.id}`}
          onClick={() => onDelete(item)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function ConfirmBox({
  title,
  detail,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  title: string;
  detail: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-4 rounded-lg border border-terracotta-light/40 bg-terracotta-light/10 p-4">
      <p className="mb-1 font-sans text-sm font-semibold text-charcoal">{title}</p>
      <p className="mb-3 font-sans text-xs text-slate">{detail}</p>
      <div className="flex gap-2">
        <button
          className="rounded-lg bg-charcoal px-3 py-1.5 font-sans text-xs font-medium text-white hover:bg-charcoal/85 disabled:opacity-40"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Working…" : confirmLabel}
        </button>
        <button
          className="rounded-lg bg-charcoal/5 px-3 py-1.5 font-sans text-xs font-medium text-charcoal hover:bg-charcoal/10"
          onClick={onCancel}
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
