"use client";

import { useEffect, useState } from "react";
import { getAllMembers, updateMember } from "@/lib/firebase-recipes";
import type { Member } from "@/lib/types";
import Avatar from "@/components/Avatar";
import { useAuth } from "@/context/AuthContext";
import { useHousehold } from "@/context/HouseholdContext";

const inputClass =
  "w-full rounded-lg border border-gold-light bg-warm-white px-3 py-2 font-sans text-sm text-charcoal outline-none focus:border-terracotta/50 focus:ring-2 focus:ring-terracotta/20";

interface EditFormState {
  title: string;
  bio: string;
  goodAt: string;
  loves: string;
  hates: string;
  favouriteFromBook: string;
  favouriteNotInBook: string;
}

function memberToForm(member: Member): EditFormState {
  return {
    title: member.title,
    bio: member.bio,
    goodAt: member.goodAt.join(", "),
    loves: member.loves.join(", "),
    hates: member.hates.join(", "),
    favouriteFromBook: member.favouriteFromBook,
    favouriteNotInBook: member.favouriteNotInBook,
  };
}

function splitComma(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function MembersPage() {
  const { user } = useAuth();
  const { householdId } = useHousehold();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditFormState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllMembers(householdId ?? undefined)
      .then(setMembers)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  function startEdit(member: Member) {
    setEditingId(member.id);
    setForm(memberToForm(member));
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(null);
  }

  async function handleSave(memberId: string) {
    if (!form) return;
    setSaving(true);
    try {
      const data = {
        title: form.title,
        bio: form.bio,
        goodAt: splitComma(form.goodAt),
        loves: splitComma(form.loves),
        hates: splitComma(form.hates),
        favouriteFromBook: form.favouriteFromBook,
        favouriteNotInBook: form.favouriteNotInBook,
      };
      await updateMember(memberId, data);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, ...data } : m))
      );
      setEditingId(null);
      setForm(null);
    } catch {
      // leave edit open so the user can retry
    } finally {
      setSaving(false);
    }
  }

  function updateField(field: keyof EditFormState, value: string) {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev));
  }

  return (
    <main className="min-h-screen bg-cream">
      <section className="border-b border-cream-dark/30 bg-warm-white px-4 pb-10 pt-16 text-center sm:px-6 lg:px-8">
        <h1 className="font-serif text-4xl font-bold tracking-tight text-charcoal sm:text-5xl">
          The Family
        </h1>
        <p className="mx-auto mt-3 max-w-lg font-sans text-lg text-slate">
          The cooks, the critics, and the ones who always come back for seconds
        </p>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <p className="font-sans text-sm text-slate">Something went wrong loading family members.</p>
            <button type="button" onClick={() => { setError(false); setLoading(true); getAllMembers(householdId ?? undefined).then(setMembers).catch(() => setError(true)).finally(() => setLoading(false)); }} className="font-sans text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors cursor-pointer">Try again</button>
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-cream-dark/20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10 text-slate/40">
                <path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.5 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 18a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z" />
              </svg>
            </div>
            <h3 className="font-serif text-xl font-semibold text-charcoal">No family members yet</h3>
            <p className="max-w-sm font-sans text-sm text-slate">Family member profiles will appear here once they&apos;ve been added.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {members.map((member) => {
              const isEditing = editingId === member.id;

              return (
                <article
                  key={member.id}
                  className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-charcoal/5"
                >
                  {/* Header */}
                  <div className="flex items-center gap-5 border-b border-cream-dark/30 bg-warm-white px-6 py-6 sm:px-8">
                    <Avatar name={member.name} size="xl" ring />
                    <div className="flex-1">
                      <h2 className="font-serif text-xl font-bold text-charcoal sm:text-2xl">
                        {member.name}
                      </h2>
                      <p className="font-sans text-sm italic text-terracotta">
                        {member.title}
                      </p>
                    </div>
                    {user && !isEditing && (
                      <button
                        onClick={() => startEdit(member)}
                        className="shrink-0 rounded-lg border border-gold-light bg-warm-white px-3 py-1.5 font-sans text-xs font-medium text-charcoal transition-colors hover:border-terracotta/40 hover:text-terracotta"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  <div className="px-6 py-6 sm:px-8">
                    {isEditing && form ? (
                      /* ---------- EDIT MODE ---------- */
                      <div className="space-y-5">
                        {/* Title */}
                        <div>
                          <label className="mb-1.5 block font-sans text-xs font-semibold text-charcoal">
                            Title
                          </label>
                          <input
                            type="text"
                            value={form.title}
                            onChange={(e) => updateField("title", e.target.value)}
                            className={inputClass}
                            placeholder="e.g. The Braai Master"
                          />
                        </div>

                        {/* Bio */}
                        <div>
                          <label className="mb-1.5 block font-sans text-xs font-semibold text-charcoal">
                            Bio
                          </label>
                          <textarea
                            value={form.bio}
                            onChange={(e) => updateField("bio", e.target.value)}
                            rows={3}
                            className={inputClass + " resize-y"}
                          />
                        </div>

                        {/* Good at cooking */}
                        <div>
                          <label className="mb-1.5 block font-sans text-xs font-semibold text-charcoal">
                            Good at cooking
                          </label>
                          <input
                            type="text"
                            value={form.goodAt}
                            onChange={(e) => updateField("goodAt", e.target.value)}
                            className={inputClass}
                            placeholder="Comma-separated, e.g. Pasta, Stews, Curries"
                          />
                        </div>

                        {/* Loves */}
                        <div>
                          <label className="mb-1.5 block font-sans text-xs font-semibold text-charcoal">
                            Loves
                          </label>
                          <input
                            type="text"
                            value={form.loves}
                            onChange={(e) => updateField("loves", e.target.value)}
                            className={inputClass}
                            placeholder="Comma-separated, e.g. Garlic, Chilli, Lemon"
                          />
                        </div>

                        {/* Hates */}
                        <div>
                          <label className="mb-1.5 block font-sans text-xs font-semibold text-charcoal">
                            Hates
                          </label>
                          <input
                            type="text"
                            value={form.hates}
                            onChange={(e) => updateField("hates", e.target.value)}
                            className={inputClass}
                            placeholder="Comma-separated, e.g. Olives, Anchovies"
                          />
                        </div>

                        {/* Favourite from book */}
                        <div>
                          <label className="mb-1.5 block font-sans text-xs font-semibold text-charcoal">
                            Favourite from book
                          </label>
                          <input
                            type="text"
                            value={form.favouriteFromBook}
                            onChange={(e) =>
                              updateField("favouriteFromBook", e.target.value)
                            }
                            className={inputClass}
                          />
                        </div>

                        {/* Favourite not in book */}
                        <div>
                          <label className="mb-1.5 block font-sans text-xs font-semibold text-charcoal">
                            Favourite not in book
                          </label>
                          <input
                            type="text"
                            value={form.favouriteNotInBook}
                            onChange={(e) =>
                              updateField("favouriteNotInBook", e.target.value)
                            }
                            className={inputClass}
                          />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-3 pt-1">
                          <button
                            onClick={() => handleSave(member.id)}
                            disabled={saving}
                            className="rounded-lg bg-terracotta px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-terracotta-dark disabled:opacity-50"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className="rounded-lg border border-gold-light px-4 py-2 font-sans text-sm font-medium text-slate transition-colors hover:border-charcoal/30 hover:text-charcoal disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ---------- READ-ONLY MODE ---------- */
                      <>
                        {/* Bio */}
                        <p className="font-sans text-sm leading-relaxed text-slate">
                          {member.bio}
                        </p>

                        {/* Grid of details */}
                        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                          {/* Good at cooking */}
                          <div>
                            <div className="mb-2.5 flex items-center gap-2">
                              <svg
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-4 w-4 text-terracotta"
                              >
                                <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.784l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .784.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.784l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.052.683a1 1 0 0 0 0 1.898l2.052.683a1 1 0 0 1 .633.633l.683 2.052a1 1 0 0 0 1.898 0l.683-2.052a1 1 0 0 1 .633-.633l2.052-.683a1 1 0 0 0 0-1.898l-2.052-.683a1 1 0 0 1-.633-.633L6.95 5.684ZM13.949 13.684a1 1 0 0 0-1.898 0l-.184.551a1 1 0 0 1-.633.633l-.551.183a1 1 0 0 0 0 1.898l.551.183a1 1 0 0 1 .633.633l.183.552a1 1 0 0 0 1.898 0l.184-.552a1 1 0 0 1 .632-.633l.551-.183a1 1 0 0 0 0-1.898l-.551-.183a1 1 0 0 1-.633-.633l-.183-.551Z" />
                              </svg>
                              <h3 className="font-sans text-sm font-semibold text-charcoal">
                                Good at cooking
                              </h3>
                            </div>
                            <ul className="space-y-1.5">
                              {member.goodAt.map((item) => (
                                <li
                                  key={item}
                                  className="flex items-start gap-2 font-sans text-xs text-slate"
                                >
                                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta/40" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Loves these flavours */}
                          <div>
                            <div className="mb-2.5 flex items-center gap-2">
                              <svg
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-4 w-4 text-sage"
                              >
                                <path d="m9.653 16.915-.005-.003-.019-.01a20.759 20.759 0 0 1-1.162-.682 22.045 22.045 0 0 1-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 0 1 8-2.828A4.5 4.5 0 0 1 18 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 0 1-3.744 2.582l-.019.01-.005.003h-.002a.723.723 0 0 1-.692 0h-.002Z" />
                              </svg>
                              <h3 className="font-sans text-sm font-semibold text-charcoal">
                                Loves these flavours
                              </h3>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {member.loves.map((item) => (
                                <span
                                  key={item}
                                  className="rounded-full bg-sage-light/30 px-2.5 py-1 font-sans text-xs text-sage-dark"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Can't stand */}
                          <div>
                            <div className="mb-2.5 flex items-center gap-2">
                              <svg
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-4 w-4 text-slate/50"
                              >
                                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                              </svg>
                              <h3 className="font-sans text-sm font-semibold text-charcoal">
                                Can&rsquo;t stand
                              </h3>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {member.hates.map((item) => (
                                <span
                                  key={item}
                                  className="rounded-full bg-terracotta-light/20 px-2.5 py-1 font-sans text-xs text-terracotta-dark"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Favourites */}
                          <div>
                            <div className="mb-2.5 flex items-center gap-2">
                              <svg
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                className="h-4 w-4 text-gold"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <h3 className="font-sans text-sm font-semibold text-charcoal">
                                Favourites
                              </h3>
                            </div>
                            <div className="space-y-2">
                              <div className="rounded-lg bg-gold-light/20 px-3 py-2">
                                <p className="font-sans text-[10px] font-medium uppercase tracking-wider text-slate/60">
                                  From the book
                                </p>
                                <p className="font-serif text-sm font-semibold text-charcoal">
                                  {member.favouriteFromBook}
                                </p>
                              </div>
                              <div className="rounded-lg bg-cream-dark/20 px-3 py-2">
                                <p className="font-sans text-[10px] font-medium uppercase tracking-wider text-slate/60">
                                  Wish was in the book
                                </p>
                                <p className="font-serif text-sm font-semibold text-charcoal">
                                  {member.favouriteNotInBook}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
