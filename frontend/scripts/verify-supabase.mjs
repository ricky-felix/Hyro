// Verify the MVP Supabase wiring end-to-end against the live project.
//
//   node scripts/verify-supabase.mjs
//
// Run this AFTER you have:
//   1. Enabled Anonymous auth (Supabase → Authentication → Sign In / Providers)
//   2. Run supabase/migration-mvp.sql in the SQL Editor
//
// It signs in anonymously, then exercises the same create flows the app
// uses (group + members + rounds, and bill + participants + splits),
// reading them back and cleaning up. Any RLS or schema mismatch surfaces here.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(here, "..", ".env"), "utf8")
    .split("\n")
    .map((l) => l.match(/^\s*([A-Za-z_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
);

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);
const ok = (m) => console.log("  ✓", m);
const fail = (m, e) => { console.log("  ✗", m, "→", e?.message || e); process.exitCode = 1; };

const { data: anon, error: anonErr } = await sb.auth.signInAnonymously();
if (anonErr) { fail("anonymous sign-in (enable it in the dashboard)", anonErr); process.exit(1); }
const uid = anon.user.id;
ok("anonymous sign-in");

await sb.from("users").upsert({ id: uid, name: "Verifier" });

let groupId, billId;
try {
  const { data: g, error } = await sb.from("groups").insert({
    name: "Verify Arisan", amount_per_round: 100000, frequency: "monthly",
    giliran_method: "manual", start_date: "2026-01-01", total_rounds: 3, admin_id: uid,
  }).select().single();
  if (error) throw error;
  groupId = g.id; ok("create group");

  const { error: mErr } = await sb.from("group_members").insert([
    { group_id: groupId, user_id: uid, member_name: "Verifier", giliran_order: 1, group_role: "admin" },
    { group_id: groupId, member_name: "Budi", giliran_order: 2 },
  ]);
  if (mErr) throw mErr; ok("add members (name-based)");

  const { error: rErr } = await sb.from("rounds").insert({
    group_id: groupId, round_number: 1, recipient_name: "Verifier", scheduled_date: "2026-01-01", status: "active",
  });
  if (rErr) throw rErr; ok("create round");

  const { data: readG } = await sb.from("groups").select("*, group_members(*), rounds(*)").eq("id", groupId).single();
  if (!readG?.group_members?.length) throw new Error("could not read members back (RLS recursion?)");
  ok(`read group back (${readG.group_members.length} members, ${readG.rounds.length} rounds)`);
} catch (e) { fail("arisan flow", e); }

try {
  const { data: b, error } = await sb.from("bills").insert({
    title: "Verify Patungan", total_amount: 90000, paid_by: uid, split_method: "equal", category: "food",
  }).select().single();
  if (error) throw error;
  billId = b.id; ok("create bill");

  const { error: pErr } = await sb.from("bill_participants").insert([
    { bill_id: billId, user_id: uid, participant_name: "Verifier" },
    { bill_id: billId, participant_name: "Budi" },
    { bill_id: billId, participant_name: "Citra" },
  ]);
  if (pErr) throw pErr; ok("add participants");

  const { error: sErr } = await sb.from("bill_splits").insert([
    { bill_id: billId, user_id: uid, participant_name: "Verifier", amount_owed: 30000, is_payer: true, is_settled: true },
    { bill_id: billId, participant_name: "Budi", amount_owed: 30000 },
    { bill_id: billId, participant_name: "Citra", amount_owed: 30000 },
  ]);
  if (sErr) throw sErr; ok("create splits");

  const { data: readB } = await sb.from("bills").select("*, bill_participants(*), bill_splits(*)").eq("id", billId).single();
  if (!readB?.bill_splits?.length) throw new Error("could not read splits back");
  ok(`read bill back (${readB.bill_participants.length} participants, ${readB.bill_splits.length} splits)`);
} catch (e) { fail("patungan flow", e); }

// cleanup
if (groupId) await sb.from("groups").delete().eq("id", groupId);
if (billId) await sb.from("bills").delete().eq("id", billId);
console.log(process.exitCode ? "\n✗ Verification FAILED — see above." : "\n✓ All checks passed. The app is wired correctly.");
