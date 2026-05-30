"use client";

import { useState } from "react";
import { collection, getDocs, writeBatch, doc, addDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

const COLLECTIONS_TO_MIGRATE = [
  "recipes",
  "members",
  "collections",
  "tips",
  "notifications",
  "invitedUsers",
];

export default function MigratePage() {
  const { user, isAdmin } = useAuth();
  const [status, setStatus] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [householdId, setHouseholdId] = useState("");

  function log(msg: string) {
    setStatus((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }

  async function runMigration() {
    if (running) return;
    setRunning(true);
    setStatus([]);
    const db = getDb();

    try {
      // Step 1: Create the Coppard household
      log("Creating household...");
      const householdData = {
        name: "A Fish in the Kitchen",
        slug: "coppard-kitchen",
        ownerId: user!.uid,
        memberIds: [user!.uid],
        customisation: {
          brandName: "A Fish in the Kitchen",
          tagline: "The food your family is built on",
        },
        plan: "premium" as const,
        accessState: "active" as const,
        createdAt: new Date().toISOString(),
      };

      const householdRef = await addDoc(collection(db, "households"), householdData);
      const newHouseholdId = householdRef.id;
      setHouseholdId(newHouseholdId);
      log(`Household created with ID: ${newHouseholdId}`);

      // Step 2: Add current user as owner member
      log("Adding owner membership...");
      await addDoc(collection(db, "householdMembers"), {
        userId: user!.uid,
        householdId: newHouseholdId,
        displayName: user!.displayName || user!.email || "Owner",
        role: "owner",
        joinedAt: new Date().toISOString(),
      });
      log("Owner membership created.");

      // Step 3: Migrate all collections
      for (const colName of COLLECTIONS_TO_MIGRATE) {
        log(`Migrating ${colName}...`);
        const snapshot = await getDocs(collection(db, colName));
        const docsToUpdate = snapshot.docs.filter((d) => !d.data().householdId);

        if (docsToUpdate.length === 0) {
          log(`  ${colName}: all docs already have householdId, skipping.`);
          continue;
        }

        // Firestore batches limited to 500 writes
        for (let i = 0; i < docsToUpdate.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = docsToUpdate.slice(i, i + 500);
          for (const d of chunk) {
            batch.update(doc(db, colName, d.id), { householdId: newHouseholdId });
          }
          await batch.commit();
          log(`  ${colName}: updated ${Math.min(i + 500, docsToUpdate.length)}/${docsToUpdate.length} docs`);
        }
      }

      // Step 4: Migrate mealPlans (these may have different ID patterns)
      log("Migrating mealPlans...");
      const mealSnapshot = await getDocs(collection(db, "mealPlans"));
      const mealDocs = mealSnapshot.docs.filter((d) => !d.data().householdId);
      if (mealDocs.length > 0) {
        for (let i = 0; i < mealDocs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = mealDocs.slice(i, i + 500);
          for (const d of chunk) {
            batch.update(doc(db, "mealPlans", d.id), { householdId: newHouseholdId });
          }
          await batch.commit();
        }
        log(`  mealPlans: updated ${mealDocs.length} docs`);
      } else {
        log("  mealPlans: all docs already migrated.");
      }

      log("");
      log("Migration complete!");
      log(`Household ID: ${newHouseholdId}`);
      log("Save this ID — you may need it for debugging.");

    } catch (err) {
      log(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  }

  if (!user || !isAdmin) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center">
        <p className="font-sans text-sm text-slate">Admin access required.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream py-8 sm:py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-3xl font-bold text-charcoal mb-2">
          Multi-Tenant Migration
        </h1>
        <p className="font-sans text-sm text-slate mb-8">
          This will create the Coppard household and add <code>householdId</code> to all existing documents.
          Run this once only.
        </p>

        {householdId && (
          <div className="mb-6 rounded-xl bg-sage/10 p-4 ring-1 ring-sage/30">
            <p className="font-sans text-sm text-sage-dark">
              Household created: <code className="font-mono text-xs bg-sage/20 px-1.5 py-0.5 rounded">{householdId}</code>
            </p>
          </div>
        )}

        <button
          onClick={runMigration}
          disabled={running || !!householdId}
          className="rounded-lg bg-terracotta px-6 py-3 font-sans text-sm font-medium text-white hover:bg-terracotta-dark disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          {running ? "Running..." : householdId ? "Migration Complete" : "Run Migration"}
        </button>

        {status.length > 0 && (
          <div className="mt-6 rounded-xl bg-charcoal p-4 max-h-96 overflow-y-auto">
            {status.map((line, i) => (
              <p key={i} className={`font-mono text-xs leading-relaxed ${line.startsWith("ERROR") ? "text-red-400" : line === "" ? "" : "text-cream/80"}`}>
                {line || "\u00A0"}
              </p>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
