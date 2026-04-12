"use client";

import { useEffect, useState } from "react";
import { getAllMembers } from "@/lib/firebase-recipes";
import type { Member } from "@/lib/types";
import Avatar from "@/components/Avatar";

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAllMembers()
      .then(setMembers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
        ) : members.length === 0 ? (
          <p className="py-20 text-center font-sans text-slate">
            No family members added yet.
          </p>
        ) : (
          <div className="space-y-8">
            {members.map((member) => (
              <article
                key={member.id}
                className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-charcoal/5"
              >
                {/* Header */}
                <div className="flex items-center gap-4 border-b border-cream-dark/30 bg-warm-white px-6 py-5 sm:px-8">
                  <Avatar name={member.name} size="lg" />
                  <div>
                    <h2 className="font-serif text-xl font-bold text-charcoal sm:text-2xl">
                      {member.name}
                    </h2>
                    <p className="font-sans text-sm italic text-terracotta">
                      {member.title}
                    </p>
                  </div>
                </div>

                <div className="px-6 py-6 sm:px-8">
                  {/* Bio */}
                  <p className="font-sans text-sm leading-relaxed text-slate">
                    {member.bio}
                  </p>

                  {/* Grid of details */}
                  <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {/* Good at cooking */}
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-terracotta">
                          <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.784l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .784.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.784l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.052.683a1 1 0 0 0 0 1.898l2.052.683a1 1 0 0 1 .633.633l.683 2.052a1 1 0 0 0 1.898 0l.683-2.052a1 1 0 0 1 .633-.633l2.052-.683a1 1 0 0 0 0-1.898l-2.052-.683a1 1 0 0 1-.633-.633L6.95 5.684ZM13.949 13.684a1 1 0 0 0-1.898 0l-.184.551a1 1 0 0 1-.633.633l-.551.183a1 1 0 0 0 0 1.898l.551.183a1 1 0 0 1 .633.633l.183.552a1 1 0 0 0 1.898 0l.184-.552a1 1 0 0 1 .632-.633l.551-.183a1 1 0 0 0 0-1.898l-.551-.183a1 1 0 0 1-.633-.633l-.183-.551Z" />
                        </svg>
                        <h3 className="font-sans text-sm font-semibold text-charcoal">
                          Good at cooking
                        </h3>
                      </div>
                      <ul className="space-y-1.5">
                        {member.goodAt.map((item) => (
                          <li key={item} className="flex items-start gap-2 font-sans text-xs text-slate">
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta/40" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Loves these flavours */}
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-sage">
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
                      <div className="flex items-center gap-2 mb-2.5">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate/50">
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
                      <div className="flex items-center gap-2 mb-2.5">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gold">
                          <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clipRule="evenodd" />
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
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
