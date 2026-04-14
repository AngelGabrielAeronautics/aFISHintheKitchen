"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { addRecipeNote, removeRecipeNote } from "@/lib/firebase-recipes";
import type { RecipeNote } from "@/lib/types";
import Avatar from "@/components/Avatar";
import DeleteModal from "@/components/DeleteModal";

interface RecipeNotesProps {
  recipeId: string;
  initialNotes: RecipeNote[];
  contributedBy: string;
}

export default function RecipeNotes({ recipeId, initialNotes, contributedBy }: RecipeNotesProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<RecipeNote[]>(initialNotes);
  const [newNote, setNewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [deleteNote, setDeleteNote] = useState<RecipeNote | null>(null);

  const authorName = user?.displayName || user?.email || "Unknown";

  async function handleSubmit() {
    if (!newNote.trim() || submitting) return;
    setSubmitting(true);

    const note: RecipeNote = {
      id: Date.now().toString(),
      author: authorName,
      text: newNote.trim(),
      createdAt: new Date().toISOString(),
    };

    try {
      await addRecipeNote(recipeId, note);
      setNotes((prev) => [...prev, note]);
      setNewNote("");
      setShowForm(false);
    } catch {
      // silently fail
    }
    setSubmitting(false);
  }

  return (
    <div data-component="recipe-notes" className="mt-8 rounded-2xl bg-warm-white p-6 ring-1 ring-cream-dark/30">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif text-lg font-bold text-charcoal">
            Family Notes
          </h3>
          <p className="mt-0.5 font-sans text-xs text-slate">
            Tips, tweaks, and stories from the family
          </p>
        </div>
        {user && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-full bg-terracotta/10 px-4 py-2 font-sans text-xs font-medium text-terracotta transition-colors hover:bg-terracotta/20 cursor-pointer"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Add a note
          </button>
        )}
      </div>

      {/* Notes list */}
      {notes.length > 0 ? (
        <>
          <div className="mt-5 space-y-4">
            {(showAll ? notes : notes.slice(-3)).map((note) => (
              <div key={note.id} className="flex gap-3">
                <Avatar name={note.author} size="md" ring />
                <div className="flex-1 rounded-xl bg-white p-4 ring-1 ring-cream-dark/20">
                  <div className="flex items-center justify-between">
                    <p className="font-sans text-sm font-semibold text-charcoal">
                      {note.author}
                      {note.author !== contributedBy && (
                        <span className="ml-2 font-normal text-xs text-slate/60">
                          on {contributedBy}&rsquo;s recipe
                        </span>
                      )}
                    </p>
                    <p className="font-sans text-[10px] text-slate/40">
                      {new Date(note.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <p className="mt-1.5 font-sans text-sm leading-relaxed text-slate">
                    {note.text}
                  </p>
                  {user && (
                    <button
                      onClick={() => setDeleteNote(note)}
                      className="mt-2 font-sans text-[10px] text-slate/40 hover:text-red-500 transition-colors cursor-pointer"
                    >
                      Delete note
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {notes.length > 3 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-3 font-sans text-xs font-medium text-terracotta hover:text-terracotta-dark transition-colors cursor-pointer"
            >
              View all {notes.length} notes
            </button>
          )}
          {showAll && notes.length > 3 && (
            <button
              onClick={() => setShowAll(false)}
              className="mt-3 font-sans text-xs font-medium text-terracotta hover:text-terracotta-dark transition-colors cursor-pointer"
            >
              Show less
            </button>
          )}
        </>
      ) : !showForm ? (
        <p className="mt-4 font-sans text-xs italic text-slate/50">
          No notes yet. Be the first to add one.
        </p>
      ) : null}

      {/* Add note form */}
      {showForm && user && (
        <div className="mt-5 rounded-xl bg-white p-4 ring-1 ring-cream-dark/20">
          <p className="mb-3 font-sans text-xs text-slate">
            Posting as <span className="font-semibold text-charcoal">{authorName}</span>
          </p>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a tip, tweak, memory, or suggestion..."
            rows={3}
            className="w-full rounded-lg border border-gold-light bg-warm-white px-3 py-2 font-sans text-sm text-charcoal placeholder:text-slate/40 outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20 resize-none"
            autoFocus
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={!newNote.trim() || submitting}
              className="rounded-full bg-terracotta px-5 py-2 font-sans text-xs font-medium text-white transition-colors hover:bg-terracotta-dark disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Posting..." : "Post Note"}
            </button>
            <button
              onClick={() => { setShowForm(false); setNewNote(""); }}
              className="rounded-full px-4 py-2 font-sans text-xs font-medium text-slate hover:text-charcoal transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!user && (
        <p className="mt-4 font-sans text-xs text-slate/60">
          <a href="/auth" className="text-terracotta hover:text-terracotta-dark">Sign in</a> to add a note
        </p>
      )}

      {/* Delete note modal */}
      {deleteNote && (
        <DeleteModal
          title={`note by ${deleteNote.author}`}
          onConfirm={async () => {
            await removeRecipeNote(recipeId, deleteNote);
            setNotes((prev) => prev.filter((n) => n.id !== deleteNote.id));
            setDeleteNote(null);
          }}
          onCancel={() => setDeleteNote(null)}
        />
      )}
    </div>
  );
}
