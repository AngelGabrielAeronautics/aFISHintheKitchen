/**
 * Did the scheduled jobs actually run?
 *
 * ⚠ WHY THIS EXISTS. The nightly lapse-sweep is not a nice-to-have: it is what
 * enforces billing for EVERY user, expires gifts, sends the trial and gift
 * reminders, and re-homes gifted recipe images. If it silently stops, nobody
 * lapses, no gift ever ends, no reminder goes out — and there is no other
 * signal that anything is wrong. On 2026-08-13 it carried a bug for hours
 * without a whisper.
 *
 * Deliberately admin-only: when the money moves is operational detail.
 */

import { getAdminDb } from "./firebase-admin";

export interface Heartbeat {
  /** ISO time the job last FINISHED. */
  at: string;
  /** Whatever the job returned — its own summary of what it did. */
  summary: Record<string, unknown>;
  /** Set when the run threw; the previous success stays readable. */
  error?: string;
}

const COLL = "jobHeartbeats";

/**
 * Record a completed run. Never throws — a failure to write the heartbeat
 * must not fail the job it is reporting on.
 */
export async function recordHeartbeat(
  job: string,
  summary: Record<string, unknown>,
  error?: string,
): Promise<void> {
  try {
    await getAdminDb()
      .collection(COLL)
      .doc(job)
      .set({ at: new Date().toISOString(), summary, ...(error ? { error } : {}) });
  } catch (e) {
    console.warn("[heartbeat] could not record", job, e);
  }
}

export async function readHeartbeats(): Promise<Record<string, Heartbeat>> {
  const snap = await getAdminDb().collection(COLL).get();
  const out: Record<string, Heartbeat> = {};
  snap.docs.forEach((d) => (out[d.id] = d.data() as Heartbeat));
  return out;
}
