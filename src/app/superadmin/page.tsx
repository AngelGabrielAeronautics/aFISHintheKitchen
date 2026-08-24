"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from "firebase/auth";
import {
  FUNDING_LABELS,
  FUNDING_MEANING,
  FUNDING_ORDER,
  type Funding,
} from "@/lib/funding";
import LearnManager from "@/components/LearnManager";

interface HouseholdRow {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail: string | null;
  memberCount: number;
  accessState: string;
  subscriptionStatus: string;
  /** The one label that tells a comped year from a gifted one from a real
   *  store subscription — all three carry status "active". */
  funding: Funding;
  provider: string | null;
  plan: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  lapsedAt: string | null;
  createdAt: string | null;
  seatUpgradeRequestedAt: string | null;
}

interface Business {
  money: {
    byFunding: Partial<Record<Funding, number>>;
    byPlan: Record<string, number>; byProvider: Record<string, number>;
    trialsEndingSoon: number;
  };
  gifts: {
    bought: number; redeemed: number; unredeemed: number; revoked: number;
    withCookbook: number; staleUnclaimed: number;
  };
  giftPrice: string;
  reach: {
    appStore: number | null; appStoreAsOf: string | null; appStoreSince: string | null;
    play: number | null; playAsOf: string | null;
    updatedAt: number; notes: string[];
  } | null;
  jobs: Record<string, { at: string; summary: Record<string, unknown>; error?: string }>;
  ai: {
    since: string; calls: number; inputTokens: number; outputTokens: number;
    estimatedUsd: number; byRoute: Record<string, { calls: number; usd: number }>;
    unpricedModels: string[]; topHouseholds: { householdId: string; calls: number }[];
  } | null;
}

interface Overview {
  metrics: {
    households: number;
    members: number;
    seatRequests: number;
    byAccessState: Record<string, number>;
    bySubscription: Record<string, number>;
    byFunding: Record<string, number>;
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
  const [data, setData] = useState<Overview | null>(null);
  const [biz, setBiz] = useState<Business | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  /**
   * The action waiting on confirmation.
   *
   * ⚠ EVERY button in the table writes to a REAL FAMILY'S COOKBOOK — suspend
   * locks them out, cancel starts the lapse ladder that eventually deletes
   * their recipes. They sit inches apart in a dense row, so a misclick was one
   * pixel away from cutting somebody off. Nothing fires now without a typed
   * confirmation.
   */
  const [confirm, setConfirm] = useState<{
    householdId: string;
    name: string;
    action: string;
    days?: number;
  } | null>(null);
  /**
   * Which Money line the table is showing, or null for all of them.
   *
   * ⚠ This is the answer to "it says Comped 2 and I cannot tell WHICH two".
   * The panel's counts and this filter run off the same `funding` label, so
   * the count on the line and the number of rows below it are the same fact.
   */
  const [fundingFilter, setFundingFilter] = useState<Funding | null>(null);

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
    if (loading || !user || !isSuperAdmin) return;
    load();
  }, [loading, user, isSuperAdmin, load]);

  // The rows the table draws. Filtered client-side on purpose: the whole list
  // is already loaded, and a filter that needs a round trip stops being a way
  // of reading the panel above it.
  const visibleHouseholds = data
    ? fundingFilter
      ? data.households.filter((h) => h.funding === fundingFilter)
      : data.households
    : [];

  /**
   * What each action does, in the words of its consequence. "Cancel" and
   * "Comp" say nothing to a tired person at 11pm; "starts the lapse ladder"
   * does.
   */
  const ACTION_COPY: Record<string, { title: string; detail: string; danger?: boolean }> = {
    suspend: {
      title: "Suspend this cookbook?",
      detail:
        "Everyone in it loses access immediately — they can sign in and see nothing. Reversible with Reactivate.",
      danger: true,
    },
    reactivate: {
      title: "Reactivate this cookbook?",
      detail: "Access is restored for everyone in it.",
    },
    comp: {
      title: "Give this cookbook free access?",
      detail:
        "It stops being billed and never lapses. Use for family and staff — not as a way to fix a payment problem.",
    },
    extend_trial: {
      title: "Add 14 days to this trial?",
      detail: "The trial end date moves back by two weeks. There is no undo button for this one.",
    },
    cancel: {
      title: "Cancel this subscription?",
      detail:
        "Starts the lapse ladder: full access for 7 days, then read-only, then suspended, and eventually the recipes are deleted.",
      danger: true,
    },
    clear_seat_request: {
      title: "Mark this seat request handled?",
      detail: "It disappears from the list. Nothing changes for the owner.",
    },
    delete_household: {
      title: "Delete this cookbook?",
      detail: "Everything in it goes — recipes, photos, members. This cannot be undone.",
      danger: true,
    },
  };

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

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
      </main>
    );
  }

  // ⚠ SIGN IN HERE, not at /auth. The launch gate (proxy.ts BLOCK_WEB_APP)
  // blocks the web app's own auth pages, so there is nowhere else to do it —
  // which is why the footer padlock used to bounce straight back to the home
  // page and look broken.
  if (!user) return <SignIn />;

  // Signed in as somebody else. Say so rather than redirect: a silent bounce
  // is indistinguishable from a broken link, which is exactly how this read.
  if (!isSuperAdmin) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-6 text-center">
        <p className="font-serif text-xl font-bold text-charcoal">Not an admin account</p>
        <p className="max-w-sm font-sans text-sm text-slate">
          You&rsquo;re signed in as {user.email}, which isn&rsquo;t on the admin list.
        </p>
        <button
          onClick={() => signOut(getFirebaseAuth())}
          className="mt-1 rounded-lg bg-terracotta px-4 py-2 font-sans text-sm font-semibold text-white"
        >
          Sign out
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      {confirm && (
        <ConfirmDialog
          name={confirm.name}
          copy={ACTION_COPY[confirm.action] ?? { title: "Are you sure?", detail: confirm.action }}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const c = confirm;
            setConfirm(null);
            void act(c.householdId, c.action, c.days);
          }}
        />
      )}
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

          {biz && (
            <BusinessPanels
              biz={biz}
              filter={fundingFilter}
              onFilter={(f) => setFundingFilter((current) => (current === f ? null : f))}
            />
          )}

          <LearnManager />

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
                        onClick={() => setConfirm({ householdId: h.id, name: h.name || h.id, action: "clear_seat_request" })}
                        busy={busy === `${h.id}:clear_seat_request`}
                      >
                        Mark handled
                      </ActionBtn>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {fundingFilter && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-sans text-sm text-slate">
                Showing the{" "}
                <span className="font-semibold text-charcoal">
                  {visibleHouseholds.length}
                </span>{" "}
                {visibleHouseholds.length === 1 ? "cookbook" : "cookbooks"} counted under{" "}
                <span className="font-semibold text-charcoal">
                  {FUNDING_LABELS[fundingFilter]}
                </span>
                .
              </span>
              <button
                type="button"
                onClick={() => setFundingFilter(null)}
                className="cursor-pointer rounded-md bg-cream-dark/30 px-2 py-1 font-sans text-xs font-medium text-charcoal transition-colors hover:bg-cream-dark/50"
              >
                Show all {data.households.length}
              </button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-gold-light bg-white">
            <table className="w-full text-left font-sans text-sm">
              <thead className="border-b border-gold-light bg-cream/40 text-xs uppercase text-slate/60">
                <tr>
                  <th className="px-4 py-3">Cookbook</th>
                  <th className="px-4 py-3">Members</th>
                  <th className="px-4 py-3">Access</th>
                  <th className="px-4 py-3">Paid for by</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleHouseholds.map((h) => (
                  <tr key={h.id} className="border-b border-gold-light/50 last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium text-charcoal">{h.name || h.id}</div>
                      {/* Who to actually email when something here needs a human.
                          Falls back to the uid rather than going blank — a row
                          with no way to identify its owner is the one you most
                          need to identify. */}
                      <div className="mt-0.5 truncate font-sans text-xs text-slate/70">
                        {h.ownerEmail ?? `no email on file · ${h.ownerId || "unknown owner"}`}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate">{h.memberCount}</td>
                    <td className={`px-4 py-3 font-medium ${stateColors[h.accessState] ?? "text-slate"}`}>
                      {h.accessState}
                    </td>
                    <td className="px-4 py-3">
                      <FundingCell row={h} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {h.accessState === "suspended" ? (
                          <ActionBtn onClick={() => setConfirm({ householdId: h.id, name: h.name || h.id, action: "reactivate" })} busy={busy === `${h.id}:reactivate`}>
                            Reactivate
                          </ActionBtn>
                        ) : (
                          <ActionBtn onClick={() => setConfirm({ householdId: h.id, name: h.name || h.id, action: "suspend" })} busy={busy === `${h.id}:suspend`} danger>
                            Suspend
                          </ActionBtn>
                        )}
                        <ActionBtn onClick={() => setConfirm({ householdId: h.id, name: h.name || h.id, action: "comp" })} busy={busy === `${h.id}:comp`}>
                          Comp
                        </ActionBtn>
                        <ActionBtn onClick={() => setConfirm({ householdId: h.id, name: h.name || h.id, action: "extend_trial", days: 14 })} busy={busy === `${h.id}:extend_trial`}>
                          +14d trial
                        </ActionBtn>
                        <ActionBtn onClick={() => setConfirm({ householdId: h.id, name: h.name || h.id, action: "cancel" })} busy={busy === `${h.id}:cancel`} danger>
                          Cancel
                        </ActionBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TableKey />
        </>
      )}
    </main>
  );
}

/** The colour each funding label wears, in the panel and in the table. Money
 *  in is charcoal, money owed nothing is neutral, trouble is red. */
const fundingColors: Record<Funding, string> = {
  paying: "text-sage-dark",
  gifted: "text-terracotta",
  comped: "text-gold",
  trialing: "text-slate",
  lapsed: "text-red-600",
  canceled: "text-slate",
  uncovered: "text-red-600",
  none: "text-slate/70",
};

/**
 * One cookbook's funding, said in words rather than in database state.
 *
 * ⚠ THE SECOND LINE IS THE POINT. "Comped" alone still leaves you asking why
 * this book is free; "granted free — never billed" answers it in the row,
 * without a trip to the key underneath the table.
 */
function FundingCell({ row }: { row: HouseholdRow }) {
  const detail = (() => {
    switch (row.funding) {
      case "paying":
        return [row.plan, storeName(row.provider)].filter(Boolean).join(" · ") || "plan not recorded";
      case "gifted":
        return row.currentPeriodEnd ? `runs to ${formatDate(row.currentPeriodEnd)}` : "does not renew";
      case "comped":
        return "granted free — never billed";
      case "trialing":
        return row.trialEndsAt ? `ends ${formatDate(row.trialEndsAt)}` : "no end date recorded";
      case "lapsed":
        return row.lapsedAt ? `since ${formatDate(row.lapsedAt)}` : "date not recorded";
      case "canceled":
        return row.currentPeriodEnd ? `paid to ${formatDate(row.currentPeriodEnd)}` : "inside the paid period";
      case "uncovered":
        return "their subscription pays for another cookbook";
      default:
        return "never had one";
    }
  })();

  return (
    <>
      <div className={`font-medium ${fundingColors[row.funding]}`}>
        {FUNDING_LABELS[row.funding]}
      </div>
      <div className="mt-0.5 font-sans text-xs text-slate/70">{detail}</div>
    </>
  );
}

/** The store a payment came through, in the words the stores use themselves. */
function storeName(provider: string | null): string {
  if (provider === "appstore") return "App Store";
  if (provider === "play") return "Google Play";
  if (provider === "stripe") return "Stripe";
  if (provider === "paddle") return "Paddle";
  return "";
}

/**
 * What the two status columns mean.
 *
 * ⚠ ACCESS AND SUBSCRIPTION BOTH SAY "active" AND THEY ARE NOT THE SAME THING.
 * That collision is the whole reason this exists — Dylan read the table and
 * could not tell what either column was telling him. Access is what the family
 * can DO; subscription is how it is being PAID FOR. A cookbook can be fully
 * active on a trial that has never taken a penny, and a cancelled subscription
 * still shows active access until the lapse ladder catches up.
 */
function TableKey() {
  const access: [string, string][] = [
    ["active", "Full use — they can add and edit."],
    ["read_only", "Can look, can't change anything. Where the lapse ladder puts a cookbook 7 days after it lapses."],
    ["suspended", "Locked out. Nothing is deleted."],
  ];
  // ⚠ Built from the SAME source the panel and the rows use. The old version
  // was a hand-written list of raw statuses that lumped paying, gifted and
  // comped together under "active" — the exact confusion the column now
  // resolves, restated underneath it.
  const sub: [string, string][] = FUNDING_ORDER.map((f) => [FUNDING_LABELS[f], FUNDING_MEANING[f]]);
  return (
    <div className="mt-6 grid gap-6 rounded-xl border border-charcoal/10 bg-white p-5 sm:grid-cols-2">
      <div>
        <h3 className="font-serif text-sm font-bold text-charcoal">Access — what they can do</h3>
        <dl className="mt-2 space-y-1.5">
          {access.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="w-24 flex-shrink-0 font-mono text-[11px] text-terracotta">{k}</dt>
              <dd className="font-sans text-xs leading-snug text-slate">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <h3 className="font-serif text-sm font-bold text-charcoal">
          Paid for by — where the money comes from
        </h3>
        <dl className="mt-2 space-y-1.5">
          {sub.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              {/* Wider and in sans, unlike the access codes beside it: these are
                  English labels now, not database values, and at w-24 in mono
                  "On a gifted year" wrapped to three lines. */}
              <dt className="w-32 flex-shrink-0 font-sans text-[11px] font-semibold text-terracotta">
                {k}
              </dt>
              <dd className="font-sans text-xs leading-snug text-slate">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="font-sans text-xs leading-relaxed text-slate sm:col-span-2">
        {/* ⚠ The leading space is inside the expression on purpose — JSX drops
            whitespace between an element and the text after it, which ran this
            together as "independently.Access". */}
        <span className="font-semibold text-charcoal">The two move independently.</span>{" "}
        Access
        only changes when the nightly sweep walks a lapsed cookbook down the ladder — full access
        for 7 days, then read-only, then suspended. So &ldquo;Cancelled&rdquo; next to
        &ldquo;active&rdquo; is normal and means they are still inside time they have paid for.
        Every cookbook carries exactly one of these labels, and the Money panel counts the same
        labels — click a line there to see the cookbooks behind the number.
      </p>
    </div>
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
function BusinessPanels({
  biz,
  filter,
  onFilter,
}: {
  biz: Business;
  filter: Funding | null;
  onFilter: (f: Funding) => void;
}) {
  const { money, gifts, reach, jobs, ai } = biz;
  const sweep = jobs["lapse-sweep"];
  const sweepAge = sweep ? (Date.now() - Date.parse(sweep.at)) / 3_600_000 : null;
  // The sweep runs at 03:00 daily, so anything past ~26h means it missed one.
  const sweepLate = sweepAge === null || sweepAge > 26;

  return (
    <div className="mb-8 grid gap-4 lg:grid-cols-3">
      {/* ── Money ──
          ⚠ EVERY LINE IS A BUTTON that filters the table below to exactly the
          cookbooks it counted. The panel used to state a number with no way to
          reach the rows behind it — "Comped 2" against a table where four rows
          said "active". Empty buckets are hidden rather than shown as 0: a
          line you cannot click should not look clickable. */}
      <Panel title="Money">
        {FUNDING_ORDER.filter((f) => (money.byFunding[f] ?? 0) > 0).map((f) => (
          <Fragment key={f}>
            <Line
              label={FUNDING_LABELS[f]}
              value={money.byFunding[f] ?? 0}
              strong={f === "paying"}
              warn={f === "lapsed" || f === "uncovered"}
              onClick={() => onFilter(f)}
              active={filter === f}
            />
            {/* Sits directly under "In trial" because it is a subset of it, and
                it is the line that actually needs doing something about. */}
            {f === "trialing" && money.trialsEndingSoon > 0 && (
              <Line label="…ending within 7 days" value={money.trialsEndingSoon} warn />
            )}
          </Fragment>
        ))}
        <p className="mt-3 border-t border-charcoal/10 pt-2 font-sans text-xs text-slate">
          {/* Plans of the PAYING cookbooks only — a comped year has no plan, and
              counting those as "unknown" made this line read "2 annual · 2
              unknown" about books nobody could identify. */}
          {Object.entries(money.byPlan).map(([p, n]) => `${n} ${p}`).join(" · ") ||
            "nobody on a paid plan yet"}
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
              note={
                reach.appStoreSince && reach.appStoreAsOf
                  ? `${reach.appStoreSince} → ${reach.appStoreAsOf}`
                  : reach.appStoreAsOf
                    ? `to ${reach.appStoreAsOf}`
                    : undefined
              }
              strong
            />
            {/* ⚠ Apple reports forward from the day the request was registered,
                not from launch. Without this the number reads as lifetime. */}
            {reach.appStoreSince && (
              <p className="mt-0.5 font-sans text-[11px] leading-snug text-slate">
                First-time downloads only — updates and redownloads excluded. Apple reports from{" "}
                {reach.appStoreSince}, not from launch.
              </p>
            )}
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

/** The back office's own front door. Email/password plus Google, because the
 *  admin account may be either and locking out the one person who needs this
 *  page is the worst possible failure mode. */
function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr("");
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message.replace(/^Firebase:\s*/, "") : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6">
      <div className="w-full max-w-sm rounded-2xl border border-charcoal/10 bg-white p-6">
        <h1 className="font-serif text-2xl font-bold text-charcoal">Back office</h1>
        <p className="mt-1 font-sans text-sm text-slate">Admin accounts only.</p>
        <form
          className="mt-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password));
          }}
        >
          <input
            type="email"
            autoComplete="username"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-charcoal/15 px-3 py-2 font-sans text-sm"
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-charcoal/15 px-3 py-2 font-sans text-sm"
          />
          <button
            type="submit"
            disabled={busy || !email || !password}
            className="w-full rounded-lg bg-terracotta py-2 font-sans text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <button
          onClick={() => run(() => signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider()))}
          disabled={busy}
          className="mt-3 w-full rounded-lg border border-charcoal/15 py-2 font-sans text-sm font-semibold text-charcoal disabled:opacity-50"
        >
          Continue with Google
        </button>
        {err && <p className="mt-3 font-sans text-xs text-red-600">{err}</p>}
      </div>
    </main>
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

/**
 * A figure with its provenance. `null` renders as "—", never as 0.
 *
 * With `onClick` it becomes a real <button> spanning the row, so the count and
 * the thing it counts are one target — the Reach figures stay plain divs,
 * because there is nothing to drill into behind an install count.
 */
function Line({
  label,
  value,
  note,
  strong,
  warn,
  onClick,
  active,
}: {
  label: string;
  value: number | null;
  note?: string;
  strong?: boolean;
  warn?: boolean;
  onClick?: () => void;
  active?: boolean;
}) {
  const body = (
    <>
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
    </>
  );

  if (!onClick) {
    return <div className="flex items-baseline justify-between gap-3 py-0.5">{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`Show the ${label.toLowerCase()} cookbooks in the table below`}
      className={`-mx-1.5 flex w-[calc(100%+0.75rem)] cursor-pointer items-baseline justify-between gap-3 rounded-md px-1.5 py-0.5 text-left transition-colors ${
        active ? "bg-cream-dark/50" : "hover:bg-cream-dark/30"
      }`}
    >
      {body}
    </button>
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

/**
 * Type-to-confirm. Dylan's call: nothing in this table should be one stray
 * click from happening.
 *
 * ⚠ THE TYPING IS THE POINT. An OK button is muscle memory — you dismiss it
 * without reading, which is exactly the failure this is meant to stop. Having
 * to type the word forces you to have actually looked at which cookbook is
 * named above it.
 */
function ConfirmDialog({
  name,
  copy,
  onCancel,
  onConfirm,
}: {
  name: string;
  copy: { title: string; detail: string; danger?: boolean };
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const ready = typed.trim().toLowerCase() === "yes";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 p-4"
      // Clicking the backdrop cancels; it is the safe outcome, so it is the
      // one a stray click should reach.
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-charcoal/10 bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-xl font-bold text-charcoal">{copy.title}</h2>
        {/* The cookbook's NAME, prominently — the whole risk is doing the right
            thing to the wrong family. */}
        <p className="mt-1 font-sans text-sm font-semibold text-terracotta">{name}</p>
        <p className="mt-3 font-sans text-sm leading-relaxed text-slate">{copy.detail}</p>

        <label className="mt-5 block font-sans text-xs font-semibold text-charcoal">
          Type <span className="font-mono text-terracotta">yes</span> to confirm
        </label>
        <input
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ready) onConfirm();
            if (e.key === "Escape") onCancel();
          }}
          className="mt-1.5 w-full rounded-lg border border-charcoal/15 px-3 py-2 font-sans text-sm"
          placeholder="yes"
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-charcoal/15 px-4 py-2 font-sans text-sm font-semibold text-charcoal"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!ready}
            className={`rounded-lg px-4 py-2 font-sans text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 ${
              copy.danger ? "bg-red-600" : "bg-terracotta"
            }`}
          >
            {copy.danger ? "Yes, do it" : "Confirm"}
          </button>
        </div>
      </div>
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
