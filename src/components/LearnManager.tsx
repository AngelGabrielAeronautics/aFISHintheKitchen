"use client";

import { useCallback, useEffect, useState } from "react";
import { getFirebaseAuth } from "@/lib/firebase";

// Superadmin authoring for the global Learn library (docs/LEARN.md). Content
// written here is live in the apps the moment it's published — no app release.

interface LearnItem {
  id: string;
  type: "tip" | "video" | "series";
  status: "draft" | "published";
  title: string;
  body: string;
  youtubeId: string | null;
  seriesId: string | null;
  seriesOrder: number | null;
  sortOrder: number;
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
}
const BLANK: Draft = { type: "tip", title: "", body: "", youtubeId: "", seriesId: "", seriesOrder: "", sortOrder: "0" };

const TYPE_LABEL: Record<LearnItem["type"], string> = {
  tip: "Tip",
  video: "Video",
  series: "Masterclass series",
};

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
            {draft.type === "tip" ? "The tip" : draft.type === "video" ? "Blurb (why this video)" : "What the series covers"}
            <textarea
              className={`${input} mt-1 min-h-24`}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </label>
          {draft.type === "video" && (
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
        <ul className="divide-y divide-gold-light/50">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-sans text-sm font-medium text-charcoal">{item.title}</span>
                  <span className="shrink-0 rounded-full bg-charcoal/5 px-2 py-0.5 font-sans text-[10px] uppercase tracking-wide text-slate">
                    {TYPE_LABEL[item.type]}
                    {item.seriesId ? ` · lesson ${item.seriesOrder ?? "?"}` : ""}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-sans text-[10px] uppercase tracking-wide ${
                      item.status === "published" ? "bg-terracotta/10 text-terracotta" : "bg-gold-light/40 text-charcoal/60"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                {item.notifiedAt && (
                  <div className="font-sans text-[11px] text-slate/60">
                    push sent {new Date(item.notifiedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button className={`${btn} bg-charcoal/5 text-charcoal hover:bg-charcoal/10`} onClick={() => startEdit(item)}>
                  Edit
                </button>
                <button
                  className={`${btn} bg-charcoal/5 text-charcoal hover:bg-charcoal/10`}
                  disabled={busy === `pub:${item.id}`}
                  onClick={() => post({ action: item.status === "published" ? "unpublish" : "publish", id: item.id }, `pub:${item.id}`)}
                >
                  {item.status === "published" ? "Unpublish" : "Publish"}
                </button>
                {item.status === "published" && item.type !== "series" && (
                  <button
                    className={`${btn} bg-gold-light/40 text-charcoal hover:bg-gold-light/60`}
                    disabled={busy === `notify:${item.id}`}
                    onClick={() => setNotifyConfirm(item)}
                  >
                    {item.notifiedAt ? "Notify again" : "Notify"}
                  </button>
                )}
                <button
                  className={`${btn} bg-red-50 text-red-700 hover:bg-red-100`}
                  disabled={busy === `del:${item.id}`}
                  onClick={() => setDeleteConfirm(item)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
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
