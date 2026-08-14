"use client";

// The full FAQ, searchable — and the page BOTH APPS link to from More → Help.
//
// ⚠ WHY THIS EXISTS. The FAQ only ever appeared on the logged-OUT landing
// page, so the people most likely to have a question — the ones already using
// the app — could never reach it. A real customer (2026-08-14) was invited
// into a second cookbook, could not work out why she was stuck, and had
// nowhere in the product to look. Answers have to be reachable from inside.
//
// ⚠ Lives at /faq, which proxy.ts must allow while the web app is gated —
// otherwise the in-app link lands on the marketing site instead.

import { useMemo, useState } from "react";
import Link from "next/link";
import { FAQS } from "@/lib/faqs";

export default function FaqPage() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () =>
      !q
        ? FAQS
        : // Search the ANSWERS too, not just the questions. Somebody stuck on
          // switching cookbooks types "switch" — which appears in an answer
          // long before it appears in a question.
          FAQS.filter(
            (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q),
          ),
    [q],
  );

  return (
    <main className="min-h-screen bg-cream px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <p className="font-sans text-sm font-semibold uppercase tracking-widest text-terracotta">
          Help
        </p>
        <h1 className="mt-2 font-serif text-4xl font-bold text-charcoal">Questions, answered</h1>
        <p className="mt-3 font-sans text-base text-slate">
          Everything we get asked. Search it, or browse the lot.
        </p>

        <div className="relative mt-7">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search — try “switch”, “invite”, “gift”"
            aria-label="Search the FAQ"
            className="w-full rounded-full border border-charcoal/15 bg-white py-3 pl-11 pr-4 font-sans text-base text-charcoal placeholder:text-slate/60 focus:border-terracotta focus:outline-none"
          />
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate"
            aria-hidden="true"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="m14 14 4 4" strokeLinecap="round" />
          </svg>
        </div>

        {shown.length === 0 ? (
          // Never a bare "no results" — say what to do next.
          <div className="mt-10 rounded-xl border border-charcoal/10 bg-white p-6 text-center">
            <p className="font-serif text-lg font-semibold text-charcoal">
              Nothing matches “{query}”
            </p>
            <p className="mt-2 font-sans text-sm text-slate">
              Try a different word, or email{" "}
              <a
                href="mailto:hello@afishinthekitchen.com"
                className="font-semibold text-terracotta underline"
              >
                hello@afishinthekitchen.com
              </a>{" "}
              and a human will answer.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-2">
            {shown.map((f) => {
              const isOpen = open === f.q || (!!q && shown.length <= 3);
              return (
                <div
                  key={f.q}
                  className="overflow-hidden rounded-xl border border-charcoal/10 bg-white"
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : f.q)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="font-sans text-sm font-semibold text-charcoal">{f.q}</span>
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`h-4 w-4 flex-shrink-0 text-slate transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    >
                      <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {isOpen && (
                    <p className="px-5 pb-4 font-sans text-sm leading-relaxed text-slate">{f.a}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-center font-sans text-sm text-slate">
          Still stuck?{" "}
          <a
            href="mailto:hello@afishinthekitchen.com"
            className="font-semibold text-terracotta underline"
          >
            Email us
          </a>{" "}
          — we read every one.
        </p>
        <p className="mt-6 text-center">
          <Link href="/" className="font-sans text-sm text-slate underline">
            Back to A Fish in the Kitchen
          </Link>
        </p>
      </div>
    </main>
  );
}
