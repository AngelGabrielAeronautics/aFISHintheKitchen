"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useHousehold } from "@/context/HouseholdContext";
import {
  getAllCollections,
  getAllRecipes,
  updateCollection,
  deleteCollection,
  createNotification,
  updateAssignmentStatus,
} from "@/lib/firebase-recipes";
import type { RecipeCollection, Recipe, EventMenuComment, EditLogEntry } from "@/lib/types";
import { FAMILY_MEMBERS } from "@/lib/types";
import RecipeCard from "@/components/RecipeCard";
import Avatar from "@/components/Avatar";
import EditHistory from "@/components/EditHistory";

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { householdId } = useHousehold();

  const [collection, setCollection] = useState<RecipeCollection | null>(null);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editRecipeIds, setEditRecipeIds] = useState<string[]>([]);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Assignments
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [assignmentStatus, setAssignmentStatus] = useState<Record<string, Record<string, "pending" | "accepted" | "declined">>>({});

  // Comments
  const [comments, setComments] = useState<EventMenuComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  // Edit history
  const [editHistory, setEditHistory] = useState<EditLogEntry[]>([]);

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const collectionId = params.id as string;

  useEffect(() => {
    async function load() {
      const [cols, recs] = await Promise.all([
        getAllCollections(householdId),
        getAllRecipes(householdId),
      ]);
      const found = cols.find((c) => c.id === collectionId);
      if (!found) {
        setNotFound(true);
      } else {
        setCollection(found);
        // Migrate old string assignments to string[] format
        const raw = found.assignments ?? {};
        const migrated: Record<string, string[]> = {};
        for (const [key, val] of Object.entries(raw)) {
          migrated[key] = Array.isArray(val) ? val : [val];
        }
        setAssignments(migrated);
        setComments(found.comments ?? []);
        setEditHistory(found.editHistory ?? []);
        setAssignmentStatus(found.assignmentStatus ?? {});
      }
      setAllRecipes(recs);
      setLoading(false);
    }
    load();
  }, [collectionId, householdId]);

  const recipeMap = useMemo(() => {
    const map = new Map<string, Recipe>();
    allRecipes.forEach((r) => map.set(r.id, r));
    return map;
  }, [allRecipes]);

  const collectionRecipes = useMemo(() => {
    if (!collection) return [];
    return collection.recipeIds
      .map((id) => recipeMap.get(id))
      .filter(Boolean) as Recipe[];
  }, [collection, recipeMap]);

  const filteredRecipes = useMemo(() => {
    const sorted = [...allRecipes].sort((a, b) => a.title.localeCompare(b.title));
    if (!recipeSearch.trim()) return sorted;
    const lower = recipeSearch.toLowerCase();
    return sorted.filter(
      (r) =>
        r.title.toLowerCase().includes(lower) ||
        r.tags.some((t) => t.toLowerCase().includes(lower))
    );
  }, [allRecipes, recipeSearch]);

  const startEdit = useCallback(() => {
    if (!collection) return;
    setEditName(collection.name);
    setEditDesc(collection.description);
    setEditRecipeIds([...collection.recipeIds]);
    setRecipeSearch("");
    setEditing(true);
  }, [collection]);

  function toggleEditRecipe(id: string) {
    setEditRecipeIds((prev) =>
      prev.includes(id) ? prev.filter((rid) => rid !== id) : [...prev, id]
    );
  }

  function logEdit(summary: string) {
    if (!collection) return;
    const editor = user?.displayName || user?.email || "Unknown";
    const entry: EditLogEntry = { editor, date: new Date().toISOString(), summary };
    const updated = [...editHistory, entry];
    setEditHistory(updated);
    updateCollection(collection.id, { editHistory: updated }).catch(() => {});
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!collection || !editName.trim()) return;
    setSaving(true);
    try {
      await updateCollection(collection.id, {
        name: editName.trim(),
        description: editDesc.trim(),
        recipeIds: editRecipeIds,
      });
      const changes: string[] = [];
      if (editName.trim() !== collection.name) changes.push("Updated name");
      if (editDesc.trim() !== collection.description) changes.push("Updated description");
      const addedIds = editRecipeIds.filter((id) => !collection.recipeIds.includes(id));
      const removedIds = collection.recipeIds.filter((id) => !editRecipeIds.includes(id));
      if (addedIds.length > 0) {
        const names = addedIds.map((id) => recipeMap.get(id)?.title ?? "Unknown").join(", ");
        changes.push(`Added ${names}`);
      }
      if (removedIds.length > 0) {
        const names = removedIds.map((id) => recipeMap.get(id)?.title ?? "Unknown").join(", ");
        changes.push(`Removed ${names}`);
      }
      if (changes.length > 0) logEdit(changes.join(", "));

      setCollection({
        ...collection,
        name: editName.trim(),
        description: editDesc.trim(),
        recipeIds: editRecipeIds,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleAssignSlot(recipeId: string, slotIndex: number, member: string) {
    const current = [...(assignments[recipeId] ?? ["", "", ""])];
    while (current.length < 3) current.push("");
    const previous = current[slotIndex];
    current[slotIndex] = member;
    const filtered = current.filter(Boolean);
    const next = { ...assignments };
    if (filtered.length === 0) {
      delete next[recipeId];
    } else {
      next[recipeId] = filtered;
    }
    setAssignments(next);

    // Update assignment status — auto-accept if assigning yourself
    const currentUserName = user?.displayName || user?.email || "";
    const nextStatus = { ...assignmentStatus };
    if (member) {
      if (!nextStatus[recipeId]) nextStatus[recipeId] = {};
      nextStatus[recipeId][member] = member === currentUserName ? "accepted" : "pending";
    }
    if (previous && previous !== member) {
      if (nextStatus[recipeId]) delete nextStatus[recipeId][previous];
    }
    setAssignmentStatus(nextStatus);

    if (collection) {
      setCollection({ ...collection, assignments: next, assignmentStatus: nextStatus });
      updateCollection(collection.id, { assignments: next, assignmentStatus: nextStatus }).catch(() => {});

      // Notify and log
      if (member && member !== previous) {
        const recipe = recipeMap.get(recipeId);
        const assignedBy = user?.displayName || user?.email || "Someone";
        // Only notify others, not yourself
        if (member !== currentUserName) {
          createNotification({
            type: "event-assignment",
            message: `${assignedBy} assigned you to make "${recipe?.title ?? "a recipe"}" for ${collection.name}. Do you accept?`,
            link: `/collections/${collection.id}`,
            authorName: assignedBy,
            collectionId: collection.id,
            recipeId,
            assignedMember: member,
          }).catch(() => {});
        }
        logEdit(`Assigned ${member} to ${recipe?.title ?? "a recipe"}`);
      } else if (!member && previous) {
        const recipe = recipeMap.get(recipeId);
        logEdit(`Unassigned ${previous} from ${recipe?.title ?? "a recipe"}`);
      }
    }
  }

  async function handleRespondAssignment(recipeId: string, member: string, status: "accepted" | "declined") {
    if (!collection) return;
    const nextStatus = { ...assignmentStatus };
    if (!nextStatus[recipeId]) nextStatus[recipeId] = {};
    nextStatus[recipeId][member] = status;
    setAssignmentStatus(nextStatus);
    setCollection({ ...collection, assignmentStatus: nextStatus });
    await updateAssignmentStatus(collection.id, recipeId, member, status).catch(() => {});
    logEdit(`${member} ${status} assignment for ${recipeMap.get(recipeId)?.title ?? "a recipe"}`);

    if (status === "declined") {
      // Remove the declined member from assignments
      const nextAssign = { ...assignments };
      if (nextAssign[recipeId]) {
        nextAssign[recipeId] = nextAssign[recipeId].filter((m) => m !== member);
        if (nextAssign[recipeId].length === 0) delete nextAssign[recipeId];
      }
      setAssignments(nextAssign);
      setCollection((prev) => prev ? { ...prev, assignments: nextAssign } : prev);
      updateCollection(collection.id, { assignments: nextAssign }).catch(() => {});
    }
  }

  async function handleAddComment() {
    if (!newComment.trim() || !user || !collection) return;
    setAddingComment(true);
    const comment: EventMenuComment = {
      id: Date.now().toString(),
      author: user.displayName || user.email || "Unknown",
      text: newComment.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...comments, comment];
    setComments(updated);
    setNewComment("");
    updateCollection(collection.id, { comments: updated }).catch(() => {});
    setAddingComment(false);
  }

  async function handleDeleteComment(commentId: string) {
    if (!collection) return;
    const updated = comments.filter((c) => c.id !== commentId);
    setComments(updated);
    updateCollection(collection.id, { comments: updated }).catch(() => {});
  }

  async function handleDelete() {
    if (!collection) return;
    setDeleting(true);
    try {
      await deleteCollection(collection.id);
      router.push("/collections");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-terracotta/30 border-t-terracotta rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-center">
        <h1 className="font-serif text-2xl font-bold text-charcoal mb-2">
          Event menu not found
        </h1>
        <p className="font-sans text-sm text-slate mb-6">
          This event menu may have been deleted.
        </p>
        <Link
          href="/collections"
          className="text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors"
        >
          Back to Event Menus
        </Link>
      </main>
    );
  }

  if (!collection) return null;

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Back link */}
      <Link
        href="/collections"
        className="inline-flex items-center gap-1.5 font-sans text-sm text-slate hover:text-terracotta transition-colors mb-6"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-4 w-4"
        >
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z"
            clipRule="evenodd"
          />
        </svg>
        All Event Menus
      </Link>

      {/* Editing mode */}
      {editing ? (
        <form
          onSubmit={handleSave}
          className="mb-10 rounded-xl bg-white p-6 shadow-sm ring-1 ring-charcoal/5"
        >
          <h2 className="font-serif text-xl font-bold text-charcoal mb-4">
            Edit Event Menu
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div>
              <label className="block font-sans text-sm font-medium text-charcoal mb-1">
                Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="w-full rounded-lg border border-cream-dark/60 bg-cream/40 px-3 py-2 text-sm text-charcoal placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
            </div>
            <div>
              <label className="block font-sans text-sm font-medium text-charcoal mb-1">
                Description
              </label>
              <input
                type="text"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full rounded-lg border border-cream-dark/60 bg-cream/40 px-3 py-2 text-sm text-charcoal placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30"
              />
            </div>
          </div>

          {/* Recipe picker */}
          <div className="mb-4">
            <label className="block font-sans text-sm font-medium text-charcoal mb-1">
              Recipes ({editRecipeIds.length} selected)
            </label>
            <input
              type="text"
              value={recipeSearch}
              onChange={(e) => setRecipeSearch(e.target.value)}
              placeholder="Search recipes..."
              className="w-full rounded-lg border border-cream-dark/60 bg-cream/40 px-3 py-2 text-sm text-charcoal placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-terracotta/30 mb-2"
            />
            <div className="max-h-52 overflow-y-auto rounded-lg border border-cream-dark/40 bg-cream/20">
              {filteredRecipes.length === 0 && (
                <p className="px-3 py-4 text-center text-sm text-slate">
                  No recipes found.
                </p>
              )}
              {filteredRecipes.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-cream-dark/20 transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={editRecipeIds.includes(r.id)}
                    onChange={() => toggleEditRecipe(r.id)}
                    className="h-4 w-4 rounded border-cream-dark text-terracotta focus:ring-terracotta/30 cursor-pointer"
                  />
                  <span className="font-sans text-sm text-charcoal flex-1 truncate">
                    {r.title}
                  </span>
                  <span className="font-sans text-xs text-slate">
                    {r.contributedBy}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving || !editName.trim()}
              className="px-5 py-2.5 rounded-lg bg-terracotta text-white text-sm font-medium hover:bg-terracotta-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-5 py-2.5 rounded-lg bg-cream-dark/40 text-charcoal text-sm font-medium hover:bg-cream-dark/60 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* Collection header */}
          <div className="mb-8">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-charcoal">
              {collection.name}
            </h1>
            {collection.description && (
              <p className="mt-2 font-sans text-sm text-slate">
                {collection.description}
              </p>
            )}
            <div className="mt-3 flex items-center gap-3 font-sans text-xs text-slate">
              <span>
                {collection.recipeIds.length}{" "}
                {collection.recipeIds.length === 1 ? "recipe" : "recipes"}
              </span>
              <span className="text-cream-dark">|</span>
              <span>by {collection.createdBy}</span>
            </div>

            {user && (
              <div className="mt-4 flex gap-3">
                <button
                  onClick={startEdit}
                  className="px-4 py-2 rounded-lg bg-cream-dark/40 text-charcoal text-sm font-medium hover:bg-cream-dark/60 transition-colors cursor-pointer"
                >
                  Edit Menu
                </button>
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate">Are you sure?</span>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {deleting ? "Deleting..." : "Yes, delete"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="px-4 py-2 rounded-lg bg-cream-dark/40 text-charcoal text-sm font-medium hover:bg-cream-dark/60 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="px-4 py-2 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors cursor-pointer"
                  >
                    Delete Menu
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Recipe grid */}
      {!editing && (
        <>
          {collectionRecipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="font-sans text-sm text-slate">
                This event menu has no recipes yet.
              </p>
              {user && (
                <button
                  onClick={startEdit}
                  className="mt-4 px-5 py-2.5 rounded-lg bg-terracotta text-white text-sm font-medium hover:bg-terracotta-dark transition-colors cursor-pointer"
                >
                  Add Recipes
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {collectionRecipes.map((recipe) => (
                <div key={recipe.id}>
                  <RecipeCard recipe={recipe} />
                  {/* Assignment — 3 slots */}
                  <div className="mt-2 flex flex-col gap-1.5">
                    {[0, 1, 2].map((slot) => {
                      const current = assignments[recipe.id] ?? [];
                      const value = current[slot] ?? "";
                      const otherSlots = current.filter((_, i) => i !== slot);
                      const status = value ? (assignmentStatus[recipe.id]?.[value] ?? "pending") : null;
                      const currentUserName = user?.displayName || user?.email || "";
                      const isCurrentUser = value === currentUserName;
                      return (
                        <div key={slot} className="flex items-center gap-2 rounded-lg bg-warm-white px-3 py-1.5 ring-1 ring-cream-dark/30">
                          {value ? (
                            <Avatar name={value} size="sm" ring />
                          ) : (
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-slate/20 shrink-0">
                              <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
                            </svg>
                          )}
                          <select
                            value={value}
                            onChange={(e) => handleAssignSlot(recipe.id, slot, e.target.value)}
                            className="flex-1 bg-transparent font-sans text-xs text-charcoal outline-none cursor-pointer"
                          >
                            <option value="">Assign to...</option>
                            {FAMILY_MEMBERS.filter((name) => name === value || !otherSlots.includes(name)).map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                          {/* Status badge */}
                          {status && (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 font-sans text-[10px] font-medium ${
                              status === "accepted" ? "bg-sage/15 text-sage-dark" :
                              status === "declined" ? "bg-red-500/10 text-red-500" :
                              "bg-gold-light/30 text-gold"
                            }`}>
                              {status === "accepted" ? "Accepted" : status === "declined" ? "Declined" : "Pending"}
                            </span>
                          )}
                          {/* Accept/Decline for current user */}
                          {isCurrentUser && status === "pending" && (
                            <div className="flex gap-1 shrink-0">
                              <button type="button" onClick={() => handleRespondAssignment(recipe.id, value, "accepted")} className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-sage/15 text-sage-dark hover:bg-sage/25 transition-colors cursor-pointer">Accept</button>
                              <button type="button" onClick={() => handleRespondAssignment(recipe.id, value, "declined")} className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors cursor-pointer">Decline</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Comments */}
      {!editing && collection && (
        <div className="mt-10 rounded-2xl bg-warm-white p-6 ring-1 ring-cream-dark/30">
          <h3 className="font-serif text-lg font-bold text-charcoal">
            Comments
          </h3>

          {comments.length > 0 ? (
            <div className="mt-4 space-y-4">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3">
                  <Avatar name={c.author} size="sm" ring />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-sans text-xs font-semibold text-charcoal">{c.author}</span>
                      <span className="font-sans text-[10px] text-slate/50">
                        {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {user && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c.id)}
                          aria-label="Delete comment"
                          className="ml-auto font-sans text-[10px] text-slate/30 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 font-sans text-sm text-slate whitespace-pre-line">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 font-sans text-xs text-slate/50">No comments yet.</p>
          )}

          {user && (
            <div className="mt-4 flex gap-2 pt-4 border-t border-cream-dark/20">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                placeholder="Add a comment..."
                className="flex-1 rounded-lg border border-gold-light bg-cream px-3 py-2 font-sans text-sm text-charcoal placeholder:text-slate/40 outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20"
              />
              <button
                type="button"
                onClick={handleAddComment}
                disabled={addingComment || !newComment.trim()}
                className="rounded-lg bg-terracotta px-4 py-2 font-sans text-sm font-medium text-white hover:bg-terracotta-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                Post
              </button>
            </div>
          )}
        </div>
      )}

      {/* Edit History */}
      {!editing && collection && (
        <EditHistory
          entries={editHistory}
          contributedBy={collection.createdBy}
        />
      )}
    </main>
  );
}
