"use client";

import { useState } from "react";

interface DeleteModalProps {
  title: string;
  heading?: string;
  message?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export default function DeleteModal({ title, heading, message, onConfirm, onCancel }: DeleteModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canDelete = confirmText === "DELETE";

  async function handleDelete() {
    if (!canDelete || deleting) return;
    setDeleting(true);
    await onConfirm();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-charcoal/10">
        {/* Warning icon */}
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-red-500">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
        </div>

        <h3 className="text-center font-serif text-xl font-bold text-charcoal">
          {heading || "Delete"}
        </h3>

        <p className="mt-2 text-center font-sans text-sm text-slate">
          {message || (
            <>You are about to permanently delete <span className="font-semibold text-charcoal">&ldquo;{title}&rdquo;</span>. This action cannot be undone.</>
          )}
        </p>

        <div className="mt-6">
          <label className="block font-sans text-xs font-medium text-charcoal mb-1.5">
            Type <span className="font-bold text-red-500">DELETE</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="w-full rounded-lg border border-gold-light bg-warm-white px-4 py-3 font-sans text-sm text-charcoal placeholder:text-slate/30 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 transition-colors"
            autoFocus
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-cream-dark px-4 py-3 font-sans text-sm font-medium text-slate transition-colors hover:bg-cream-dark/20 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!canDelete || deleting}
            className="flex-1 rounded-lg bg-red-500 px-4 py-3 font-sans text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {deleting ? "Deleting..." : "Delete Forever"}
          </button>
        </div>
      </div>
    </div>
  );
}
