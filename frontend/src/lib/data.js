// ─────────────────────────────────────────────────────────────
// Supabase-backed data layer for the Hyro MVP.
//
// The browser talks to Supabase directly (no NestJS backend). The
// current user is a real authenticated Supabase user (email/phone +
// password — anonymous sessions were removed in C4); every row is
// scoped to them by RLS. Members & participants are stored as plain
// names (see supabase/migration-mvp.sql).
// ─────────────────────────────────────────────────────────────
import { supabase } from "./supabase";

// ── helpers ───────────────────────────────────────────────────
export const toISODate = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

function addPeriod(startDate, frequency, n) {
  const d = new Date(startDate);
  if (frequency === "weekly") d.setDate(d.getDate() + 7 * n);
  else d.setMonth(d.getMonth() + n);
  return d;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

function throwIf(error, ctx) {
  if (error) throw new Error(`${ctx}: ${error.message}`);
}

// Tracks whether the user has created any arisan/patungan yet — drives the
// deferred-registration nudge (banner + one-time prompt after first creation).
const HAS_CREATED_KEY = "ad_has_created";
export function hasCreatedSomething() {
  try { return localStorage.getItem(HAS_CREATED_KEY) === "1"; } catch { return false; }
}
function markHasCreated() {
  try { localStorage.setItem(HAS_CREATED_KEY, "1"); } catch { /* ignore */ }
}

// ── profile (users table) ─────────────────────────────────────
export async function ensureProfile(userId, name) {
  const { data } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
  if (data) {
    // Reconcile a placeholder guest row with the real name once we know it.
    // At sign-up the client can race ahead of the handle_new_user DB trigger
    // and insert name="Tamu"; the trigger's real-name insert is then dropped
    // by ON CONFLICT DO NOTHING. When a real name is now available, heal it.
    if (name && name !== "Tamu" && (!data.name || data.name === "Tamu")) {
      const { data: updated } = await supabase
        .from("users")
        .update({ name })
        .eq("id", userId)
        .select("*")
        .maybeSingle();
      return updated ?? { ...data, name };
    }
    return data;
  }
  // Upsert (ignore duplicates) so concurrent bootstraps don't race on the PK.
  const { error } = await supabase
    .from("users")
    .upsert({ id: userId, name: name || "Tamu" }, { onConflict: "id", ignoreDuplicates: true });
  if (error && error.code !== "23505") throwIf(error, "ensureProfile");
  const { data: row } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
  return row;
}

export async function updateProfile(userId, updates) {
  const { error } = await supabase.from("users").update(updates).eq("id", userId);
  throwIf(error, "updateProfile");
}

// ─────────────────────────────────────────────────────────────
// ARISAN
// ─────────────────────────────────────────────────────────────

// List groups visible to the user, enriched with derived fields the UI needs.
export async function listGroups() {
  const uid = await currentUserId();
  const { data: groups, error } = await supabase
    .from("groups")
    .select("*")
    .order("created_at", { ascending: false });
  throwIf(error, "listGroups");
  if (!groups?.length) return [];

  const ids = groups.map((g) => g.id);
  const [{ data: members }, { data: rounds }] = await Promise.all([
    supabase.from("group_members").select("*").in("group_id", ids),
    supabase.from("rounds").select("*").in("group_id", ids),
  ]);

  return groups.map((g) => enrichGroup(g, members ?? [], rounds ?? [], uid));
}

function enrichGroup(g, allMembers, allRounds, uid) {
  const members = allMembers.filter((m) => m.group_id === g.id);
  const rounds = allRounds
    .filter((r) => r.group_id === g.id)
    .sort((a, b) => a.round_number - b.round_number);
  const current = rounds.find((r) => r.status === "active") || rounds.find((r) => r.status === "upcoming");
  const completed = rounds.filter((r) => r.status === "completed").length;
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    amount: g.amount_per_round,
    frequency: g.frequency === "weekly" ? "Mingguan" : "Bulanan",
    frequencyRaw: g.frequency,
    method: g.giliran_method === "random" ? "Undian Acak" : "Manual",
    methodRaw: g.giliran_method,
    members: members.length,
    memberList: members.sort((a, b) => (a.giliran_order ?? 99) - (b.giliran_order ?? 99)),
    totalRounds: g.total_rounds,
    currentRound: current ? current.round_number : completed,
    nextDate: current ? new Date(current.scheduled_date) : null,
    nextRecipient: current?.recipient_name ?? null,
    status: g.status, // raw lifecycle: 'active' | 'completed' | 'pending'
    badgeStatus: g.status === "completed" ? "selesai" : "menunggu", // for <StatusBadge>
    isAdmin: g.admin_id === uid,
    startDate: g.start_date,
  };
}

export async function getGroup(id) {
  const uid = await currentUserId();
  const [{ data: g, error }, { data: members }, { data: rounds }, { data: payments }] =
    await Promise.all([
      supabase.from("groups").select("*").eq("id", id).single(),
      supabase.from("group_members").select("*").eq("group_id", id),
      supabase.from("rounds").select("*").eq("group_id", id),
      supabase.from("payments").select("*").eq("group_id", id),
    ]);
  throwIf(error, "getGroup");
  const base = enrichGroup(g, members ?? [], rounds ?? [], uid);
  return {
    ...base,
    rounds: (rounds ?? []).sort((a, b) => a.round_number - b.round_number),
    payments: payments ?? [],
    raw: g,
  };
}

/**
 * Create an arisan group with named members and an auto-generated
 * giliran (turn) schedule.
 * @param {{name, description, amount, frequency, method, startDate, members: string[]}} input
 *   members: array of member display names (the creator is auto-added first as admin)
 */
export async function createGroup(input) {
  const uid = await currentUserId();
  if (!uid) throw new Error("Sesi belum siap, coba lagi.");
  const profile = await ensureProfile(uid);

  // The creator is always member #1 and admin.
  const memberNames = [profile?.name || "Saya", ...input.members.filter((n) => n.trim())];
  const totalRounds = memberNames.length;

  const { data: group, error: gErr } = await supabase
    .from("groups")
    .insert({
      name: input.name,
      description: input.description || null,
      amount_per_round: Math.round(input.amount),
      frequency: input.frequency, // 'weekly' | 'monthly'
      giliran_method: input.method, // 'random' | 'manual'
      start_date: toISODate(input.startDate),
      total_rounds: totalRounds,
      admin_id: uid,
      status: "active",
    })
    .select()
    .single();
  throwIf(gErr, "createGroup");

  // Members — creator linked to the real user, others name-only.
  const memberRows = memberNames.map((name, i) => ({
    group_id: group.id,
    user_id: i === 0 ? uid : null,
    member_name: name,
    giliran_order: i + 1,
    group_role: i === 0 ? "admin" : "member",
  }));
  const { error: mErr } = await supabase.from("group_members").insert(memberRows);
  throwIf(mErr, "createGroup.members");

  // Giliran order: sequential for manual, shuffled for random.
  const order = input.method === "random" ? shuffle(memberNames) : memberNames;
  const roundRows = order.map((name, i) => ({
    group_id: group.id,
    round_number: i + 1,
    recipient_name: name,
    recipient_id: name === memberNames[0] ? uid : null,
    scheduled_date: toISODate(addPeriod(input.startDate, input.frequency, i)),
    status: i === 0 ? "active" : "upcoming",
  }));
  const { error: rErr } = await supabase.from("rounds").insert(roundRows);
  throwIf(rErr, "createGroup.rounds");

  markHasCreated();
  return group.id;
}

export async function deleteGroup(id) {
  const { error } = await supabase.from("groups").delete().eq("id", id);
  throwIf(error, "deleteGroup");
}

// Record / update an iuran payment for a member in a round.
export async function setPayment({ groupId, roundId, payerName, amount, status }) {
  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("round_id", roundId)
    .eq("payer_name", payerName)
    .maybeSingle();
  const row = {
    group_id: groupId,
    round_id: roundId,
    payer_name: payerName,
    amount: Math.round(amount),
    status, // 'pending' | 'confirmed' | 'rejected'
    paid_at: status === "confirmed" ? new Date().toISOString() : null,
    confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
  };
  if (existing) {
    const { error } = await supabase.from("payments").update(row).eq("id", existing.id);
    throwIf(error, "setPayment.update");
  } else {
    const { error } = await supabase.from("payments").insert(row);
    throwIf(error, "setPayment.insert");
  }
}

// Advance the active round to completed and open the next one.
export async function completeRound(groupId, roundId) {
  const { data: rounds } = await supabase
    .from("rounds")
    .select("*")
    .eq("group_id", groupId)
    .order("round_number");
  const idx = rounds.findIndex((r) => r.id === roundId);
  await supabase
    .from("rounds")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", roundId);
  const next = rounds[idx + 1];
  if (next) {
    await supabase.from("rounds").update({ status: "active" }).eq("id", next.id);
  } else {
    await supabase.from("groups").update({ status: "completed" }).eq("id", groupId);
  }
}

// ─────────────────────────────────────────────────────────────
// PATUNGAN (bill splitting)
// ─────────────────────────────────────────────────────────────

const CAT_MAP = {
  makanan: "food",
  transport: "transport",
  penginapan: "accommodation",
  utilitas: "utilities",
  hiburan: "entertainment",
  belanja: "shopping",
  lainnya: "other",
};
const CAT_REVERSE = Object.fromEntries(Object.entries(CAT_MAP).map(([k, v]) => [v, k]));

export async function listBills() {
  const uid = await currentUserId();
  const { data: bills, error } = await supabase
    .from("bills")
    .select("*")
    .order("created_at", { ascending: false });
  throwIf(error, "listBills");
  if (!bills?.length) return { asPayer: [], asDebtor: [] };

  const ids = bills.map((b) => b.id);
  const [{ data: parts }, { data: splits }] = await Promise.all([
    supabase.from("bill_participants").select("*").in("bill_id", ids),
    supabase.from("bill_splits").select("*").in("bill_id", ids),
  ]);

  const enriched = bills.map((b) => enrichBill(b, parts ?? [], splits ?? []));
  return {
    asPayer: enriched.filter((b) => b.isPayer),
    asDebtor: enriched.filter((b) => !b.isPayer),
  };
}

function enrichBill(b, allParts, allSplits, uid) {
  const parts = allParts.filter((p) => p.bill_id === b.id);
  const splits = allSplits.filter((s) => s.bill_id === b.id);
  const paidSplits = splits.filter((s) => s.is_settled || s.is_payer);
  const paid = paidSplits.reduce((sum, s) => sum + Number(s.amount_owed), 0);
  return {
    id: b.id,
    title: b.title,
    category: CAT_REVERSE[b.category] || "lainnya",
    total: Number(b.total_amount),
    method:
      b.split_method === "equal"
        ? "Sama Rata"
        : b.split_method === "exact"
          ? "Nominal Pas"
          : b.split_method,
    methodRaw: b.split_method,
    paidById: b.paid_by,
    participants: parts.map((p) => p.participant_name || "?"),
    splits,
    paid,
    progress: b.total_amount ? Math.round((paid / Number(b.total_amount)) * 100) : 0,
    status: b.status, // 'open' | 'settled'
    isPayer: true, // every visible bill in this MVP is one the user fronted
    createdAt: b.created_at,
  };
}

export async function getBill(id) {
  const [{ data: b, error }, { data: parts }, { data: splits }] = await Promise.all([
    supabase.from("bills").select("*").eq("id", id).single(),
    supabase.from("bill_participants").select("*").eq("bill_id", id),
    supabase.from("bill_splits").select("*").eq("bill_id", id),
  ]);
  throwIf(error, "getBill");
  const base = enrichBill(b, parts ?? [], splits ?? []);
  return { ...base, raw: b };
}

/**
 * Split a total among N participants. The payer counts as a participant.
 * @returns array of { name, amount } summing exactly to total
 */
export function computeEqualSplit(total, names) {
  const n = names.length;
  if (n === 0) return [];
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return names.map((name, i) => ({ name, amount: base + (i < remainder ? 1 : 0) }));
}

/**
 * Create a patungan bill the current user fronted, split among named participants.
 * @param {{title, description, category, total, method, participants: {name, amount?}[]}} input
 *   participants includes everyone sharing the cost (the payer too).
 */
export async function createBill(input) {
  const uid = await currentUserId();
  if (!uid) throw new Error("Sesi belum siap, coba lagi.");
  const profile = await ensureProfile(uid);
  const payerName = profile?.name || "Saya";

  const names = input.participants.map((p) => p.name.trim()).filter(Boolean);
  const splitAmounts =
    input.method === "exact"
      ? input.participants.map((p) => ({ name: p.name.trim(), amount: Math.round(p.amount || 0) }))
      : computeEqualSplit(Math.round(input.total), names);

  const { data: bill, error: bErr } = await supabase
    .from("bills")
    .insert({
      title: input.title,
      description: input.description || null,
      category: CAT_MAP[input.category] || "other",
      total_amount: Math.round(input.total),
      paid_by: uid,
      split_method: input.method, // 'equal' | 'exact'
      status: "open",
    })
    .select()
    .single();
  throwIf(bErr, "createBill");

  const partRows = names.map((name) => ({
    bill_id: bill.id,
    user_id: name === payerName ? uid : null,
    participant_name: name,
  }));
  const { error: pErr } = await supabase.from("bill_participants").insert(partRows);
  throwIf(pErr, "createBill.participants");

  const splitRows = splitAmounts.map((s) => ({
    bill_id: bill.id,
    user_id: s.name === payerName ? uid : null,
    participant_name: s.name,
    amount_owed: s.amount,
    is_payer: s.name === payerName,
    is_settled: s.name === payerName, // the payer already "paid" their share
  }));
  const { error: sErr } = await supabase.from("bill_splits").insert(splitRows);
  throwIf(sErr, "createBill.splits");

  markHasCreated();
  return bill.id;
}

export async function toggleSplitSettled(splitId, settled) {
  const { error } = await supabase
    .from("bill_splits")
    .update({ is_settled: settled, settled_at: settled ? new Date().toISOString() : null })
    .eq("id", splitId);
  throwIf(error, "toggleSplitSettled");
}

// Recompute a bill's status from its splits (settled when all paid).
export async function refreshBillStatus(billId) {
  const { data: splits } = await supabase
    .from("bill_splits")
    .select("is_settled")
    .eq("bill_id", billId);
  const allSettled = splits?.length && splits.every((s) => s.is_settled);
  await supabase
    .from("bills")
    .update({ status: allSettled ? "settled" : "open", settled_at: allSettled ? new Date().toISOString() : null })
    .eq("id", billId);
}

export async function deleteBill(id) {
  const { error } = await supabase.from("bills").delete().eq("id", id);
  throwIf(error, "deleteBill");
}

// ─────────────────────────────────────────────────────────────
// BAYAR (payments) view
// ─────────────────────────────────────────────────────────────
export async function getBayarData() {
  const uid = await currentUserId();
  const groups = await listGroups();
  const active = groups.filter((g) => g.status !== "completed" && g.nextDate);
  if (!active.length) return { myBills: [], adminPayments: [] };

  const ids = active.map((g) => g.id);
  const [{ data: rounds }, { data: payments }] = await Promise.all([
    supabase.from("rounds").select("*").in("group_id", ids).eq("status", "active"),
    supabase.from("payments").select("*").in("group_id", ids),
  ]);
  const roundByGroup = Object.fromEntries((rounds ?? []).map((r) => [r.group_id, r]));
  const payList = payments ?? [];

  const statusOf = (roundId, name) => {
    const p = payList.find((x) => x.round_id === roundId && x.payer_name === name);
    if (!p) return "menunggu";
    if (p.status === "confirmed") return "lunas";
    if (p.status === "rejected") return "terlambat";
    return "menunggu";
  };

  const myBills = [];
  const adminPayments = [];
  for (const g of active) {
    const round = roundByGroup[g.id];
    if (!round) continue;
    const myMember = g.memberList.find((m) => m.user_id === uid);
    const myName = myMember?.member_name || "Saya";

    // My own iuran for this round (skip if already confirmed)
    const myStatus = statusOf(round.id, myName);
    if (myStatus !== "lunas") {
      myBills.push({
        groupId: g.id, roundId: round.id, group: g.name, round: round.round_number,
        amount: g.amount, due: new Date(round.scheduled_date), status: myStatus, payerName: myName,
      });
    }

    // Admin view: every member's iuran for the active round
    if (g.isAdmin) {
      for (const m of g.memberList) {
        const name = m.member_name || "Anggota";
        adminPayments.push({
          id: `${round.id}:${name}`, groupId: g.id, roundId: round.id, group: g.name,
          member: name, round: round.round_number, amount: g.amount, status: statusOf(round.id, name),
        });
      }
    }
  }
  return { myBills, adminPayments };
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD aggregate
// ─────────────────────────────────────────────────────────────
export async function getDashboard() {
  const [groups, bills] = await Promise.all([listGroups(), listBills()]);
  const myBills = groups
    .filter((g) => g.nextDate)
    .map((g) => ({
      groupId: g.id,
      group: g.name,
      round: g.currentRound,
      amount: g.amount,
      due: g.nextDate,
      status: "menunggu",
    }))
    .sort((a, b) => a.due - b.due);

  const openBills = bills.asPayer.filter((b) => b.status === "open");
  const owedToMe = openBills.reduce(
    (sum, b) => sum + b.splits.filter((s) => !s.is_settled && !s.is_payer).reduce((x, s) => x + Number(s.amount_owed), 0),
    0,
  );

  return {
    groups,
    myBills,
    openBillCount: openBills.length,
    owedToMe,
    nextArisanAmount: myBills[0]?.amount ?? 0,
    nextArisanDate: myBills[0]?.due ?? null,
  };
}
