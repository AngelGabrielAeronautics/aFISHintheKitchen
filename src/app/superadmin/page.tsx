"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getFirebaseAuth } from "@/lib/firebase";

interface HouseholdRow {
  id: string;
  name: string;
  ownerId: string;
  memberCount: number;
  accessState: string;
  subscriptionStatus: string;
  plan: string | null;
  trialEndsAt: string | null;
  lapsedAt: string | null;
  createdAt: string | null;
  seatUpgradeRequestedAt: string | null;
}

interface Business {
  money: {
    active: number; trialing: number; lapsed: number; canceled: number;
    comped: number; gifted: number;
    byPlan: Record<string, number>; byProvider: Record<string, number>;
    trialsEndingSoon: number;
  };
  gifts: {
    bought: number; redeemed: number; unredeemed: number; revoked: number;
    withCookbook: number; staleUnclaimed: number;
  };
  giftPrice: string;
  reach: {
    appStore: number | null; appStoreAsOf: string | null;
    play: number | null; playAsOf: string | null;
    updatedAt: number; notes: string[];
  } | null;
  jobs: Record<string, { at: string; summary: Record<string, unknown>; error?: string }>;
}

interface Overview {
  metrics: {
    households: number;
    members: number;
    seatRequests: number;
    byAccessState: Record<string, number>;
    bySubscription: Record<string, number>;
  };
  households: HouseholdRow[];
}

const stateColors: Record<string, string> = {
  active: "text-sage-dark",
  read_only: "text-gold",
  suspended: "text-red-600",
};

export default function SuperAdminPage() {
  const { user, isSuperAdmin, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [biz, setBiz] = useState<Business | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = await getFirebaseAuth().currentUser?.getIdToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    // ⚠ Fetched SEPARATELY and tolerantly: the business panel pulls gifts,
    // subscriptions and the stored reach figures, and none of that should be
    // able to stop the cookbook table — the table is what the actions hang off.
    const [res, bizRes] = await Promise.all([
      fetch("/api/admin/overview", { headers }),
      fetch("/api/admin/business", { headers }),
    ]);
    if (res.ok) {
      setData(await res.json());
      setError("");
    } else {
      setError("Failed to load overview.");
    }
    setBiz(bizRes.ok ? await bizRes.json() : null);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || !isSuperAdmin) {
      router.push("/");
      return;
    }
    load();
  }, [loading, user, isSuperAdmin, router, load]);

  async function act(householdId: string, action: string, days?: number) {
    setBusy(`${householdId}:${action}`);
    try {
      const token = await getFirebaseAuth().currentUser?.getIdToken();
      await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ householdId, action, days }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (loading || !user || !isSuperAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-1 font-serif text-3xl font-bold text-charcoal">Super Admin</h1>
      <p className="mb-6 font-sans text-sm text-slate">Platform-wide oversight of every cookbook.</p>

      {error && <p className="mb-4 font-sans text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="font-sans text-sm text-slate">Loading…</p>}

      {data && (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Metric label="Cookbooks" value={data.metrics.households} />
            <Metric label="Members" value={data.metrics.members} />
            <Metric label="Active" value={data.metrics.byAccessState.active ?? 0} />
            <Metric label="Suspended" value={data.metrics.byAccessState.suspended ?? 0} />
            <Metric label="Seat requests" value={data.metrics.seatRequests ?? 0} />
          </div>

          {biz && <BusinessPanels biz={biz} />}

          {data.households.some((h) => h.seatUpgradeRequestedAt) && (
            <div className="mb-8 rounded-xl border border-terracotta-light/40 bg-terracotta-light/10 p-5">
              <h2 className="mb-1 font-serif text-lg font-semibold text-charcoal">
                More-seats requests
              </h2>
              <p className="mb-4 font-sans text-xs text-slate">
                Owners who hit the seat cap and asked to be notified. Captured demand for the paid
                extra-seats add-on — reach out, then mark handled.
              </p>
              <ul className="divide-y divide-gold-light/50">
                {data.households
                  .filter((h) => h.seatUpgradeRequestedAt)
                  .sort((a, b) => (a.seatUpgradeRequestedAt! < b.seatUpgradeRequestedAt! ? 1 : -1))
                  .map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate font-sans text-sm font-medium text-charcoal">
                          {h.name || h.id}
                        </div>
                        <div className="font-sans text-xs text-slate/70">
                          {h.memberCount} members · requested {formatDate(h.seatUpgradeRequestedAt)}
                        </div>
                      </div>
                      <ActionBtn
                        onClick={() => act(h.id, "clear_seat_request")}
                        busy={busy === `${h.id}:clear_seat_request`}
                      >
                        Mark handled
                      </ActionBtn>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-gold-light bg-white">
            <table className="w-full text-left font-sans text-sm">
              <thead className="border-b border-gold-light bg-cream/40 text-xs uppercase text-slate/60">
                <tr>
                  <th className="px-4 py-3">Cookbook</th>
                  <th className="px-4 py-3">Members</th>
                  <th className="px-4 py-3">Access</th>
                  <th className="px-4 py-3">Subscription</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.households.map((h) => (
                  <tr key={h.id} className="border-b border-gold-light/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-charcoal">{h.name || h.id}</td>
                    <td className="px-4 py-3 text-slate">{h.memberCount}</td>
                    <td className={`px-4 py-3 font-medium ${stateColors[h.accessState] ?? "text-slate"}`}>
                      {h.accessState}
                    </td>
                    <td className="px-4 py-3 text-slate">
                      {h.subscriptionStatus}
                      {h.plan ? ` · ${h.plan}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {h.accessState === "suspended" ? (
                          <ActionBtn onClick={() => act(h.id, "reactivate")} busy={busy === `${h.id}:reactivate`}>
                            Reactivate
                          </ActionBtn>
                        ) : (
                          <ActionBtn onClick={() => act(h.id, "suspend")} busy={busy === `${h.id}:suspend`} danger>
                            Suspend
                          </ActionBtn>
                        )}
                        <ActionBtn onClick={() => act(h.id, "comp")} busy={busy === `${h.id}:comp`}>
                          Comp
                        </ActionBtn>
                        <ActionBtn onClick={() => act(h.id, "extend_trial", 14)} busy={busy === `${h.id}:extend_trial`}>
                          +14d trial
                        </ActionBtn>
                        <ActionBtn onClick={() => act(h.id, "cancel")} busy={busy === `${h.id}:cancel`} danger>
                          Cancel
                        </ActionBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * How the business is doing, as opposed to what any one cookbook is doing.
 *
 * ⚠ EVERY FIGURE SAYS WHERE IT CAME FROM AND WHEN. A number on this page will
 * be used to make decisions, and the two install figures in particular are
 * different KINDS of number — Apple is near-daily, Play is a monthly file
 * rewritten daily — so they carry separate dates and are never added up.
 */
function BusinessPanels({ biz }: { biz: Business }) {
  const { money, gifts, reach, jobs } = biz;
  const sweep = jobs["lapse-sweep"];
  const sweepAge = sweep ? (Date.now() - Date.parse(sweep.at)) / 3_600_000 : null;
  // The sweep runs at 03:00 daily, so anything past ~26h means it missed one.
  const sweepLate = sweepAge === null || sweepAge > 26;

  return (
    <div className="mb-8 grid gap-4 lg:grid-cols-3">
      {/* ── Money ── */}
      <Panel title="Money">
        <Line label="Paying" value={money.active - money.gifted - money.comped} strong />
        <Line label="On a gifted year" value={money.gifted} />
        <Line label="Comped" value={money.comped} />
        <Line label="In trial" value={money.trialing} />
        {money.trialsEndingSoon > 0 && (
          <Line label="…ending within 7 days" value={money.trialsEndingSoon} warn />
        )}
        <Line label="Lapsed" value={money.lapsed} />
        <p className="mt-3 border-t border-charcoal/10 pt-2 font-sans text-xs text-slate">
          {Object.entries(money.byPlan).map(([p, n]) => `${n} ${p}`).join(" · ") || "no plans yet"}
        </p>
      </Panel>

      {/* ── Gifts ── */}
      <Panel title="Gifts">
        <Line label="Bought" value={gifts.bought} strong />
        <Line label="Redeemed" value={gifts.redeemed} />
        <Line label="Still unclaimed" value={gifts.unredeemed} warn={gifts.unredeemed > 0} />
        {gifts.staleUnclaimed > 0 && (
          <Line label="…unclaimed over 14 days" value={gifts.staleUnclaimed} warn />
        )}
        <Line label="Sent with a cookbook copy" value={gifts.withCookbook} />
        <p className="mt-3 border-t border-charcoal/10 pt-2 font-sans text-xs text-slate">
          {/* No gross: gifts sell in five currencies and the document does not
              record which was charged. Saying so beats inventing a total. */}
          £{biz.giftPrice} each · real revenue lives in App Store Connect and Play
        </p>
      </Panel>

      {/* ── Reach + jobs ── */}
      <Panel title="Reach">
        {reach ? (
          <>
            <Line
              label="iOS downloads"
              value={reach.appStore}
              note={reach.appStoreAsOf ? `to ${reach.appStoreAsOf}` : undefined}
              strong
            />
            <Line
              label="Android installs"
              value={reach.play}
              note={reach.playAsOf ? `to ${reach.playAsOf}` : undefined}
              strong
            />
            {reach.notes.length > 0 && (
              <ul className="mt-2 space-y-1">
                {reach.notes.map((n) => (
                  <li key={n} className="font-sans text-[11px] leading-snug text-slate">
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="font-sans text-xs text-slate">
            No figures yet — the nightly job writes these.
          </p>
        )}

        <div className="mt-3 border-t border-charcoal/10 pt-2">
          <p className="font-sans text-xs font-semibold text-charcoal">Nightly job</p>
          <p className={`font-sans text-xs ${sweepLate ? "text-red-600" : "text-slate"}`}>
            {sweep
              ? `last ran ${new Date(sweep.at).toLocaleString()}${sweepLate ? " — LATE" : ""}`
              : "has never recorded a run"}
          </p>
          {/* Spelled out because it is not obvious how much rides on it. */}
          <p className="mt-1 font-sans text-[11px] leading-snug text-slate">
            Enforces billing, expires gifts, sends reminders, copies gifted photos.
          </p>
        </div>
      </Panel>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-charcoal/10 bg-white p-4">
      <h2 className="mb-3 font-serif text-lg font-semibold text-charcoal">{title}</h2>
      {children}
    </section>
  );
}

/** A figure with its provenance. `null` renders as "—", never as 0. */
function Line({
  label,
  value,
  note,
  strong,
  warn,
}: {
  label: string;
  value: number | null;
  note?: string;
  strong?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className={`font-sans text-sm ${warn ? "text-red-600" : "text-slate"}`}>{label}</span>
      <span className="flex items-baseline gap-1.5">
        {note && <span className="font-sans text-[11px] text-slate/70">{note}</span>}
        <span
          className={`font-sans tabular-nums ${
            strong ? "text-base font-semibold text-charcoal" : "text-sm text-charcoal"
          } ${warn ? "text-red-600" : ""}`}
        >
          {value === null ? "—" : value}
        </span>
      </span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gold-light bg-white p-4">
      <div className="font-serif text-2xl text-charcoal">{value}</div>
      <div className="font-sans text-xs uppercase tracking-wide text-slate/60">{label}</div>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  busy,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer ${
        danger
          ? "bg-red-50 text-red-600 hover:bg-red-100"
          : "bg-cream-dark/30 text-charcoal hover:bg-cream-dark/50"
      }`}
    >
      {busy ? "…" : children}
    </button>
  );
}
