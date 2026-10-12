/**
 * The two offline-writable mutations, as plain functions — deliberately
 * NOT tied to React context, so any hook can call them directly without
 * needing a provider in the tree (useSettlement, the debug panel, and
 * Playwright's test bridge all go through here).
 */
import { db } from "./db";
import * as outbox from "./outbox";
import { syncNow } from "./sync";

/**
 * Records an arisan contribution. Always goes through the outbox — even
 * while online — so the UI has one pending→synced→failed state machine
 * regardless of connectivity. Never auto-confirmed locally: a payment only
 * leaves "pending" once the server says so.
 */
export async function enqueueContribution({
  userId,
  roundId,
  amount,
  proofUrl = null,
  notes = "",
}) {
  const clientId = crypto.randomUUID();
  const roundedAmount = Math.round(amount);
  // The round (and its group_id) was already pulled down by the sync
  // engine before the user could even see this round in the UI — no
  // network needed to resolve it here, online or offline.
  const round = await db.rounds.get(roundId);
  const groupId = round?.group_id ?? null;
  const optimisticRow = {
    id: clientId,
    group_id: groupId,
    round_id: roundId,
    payer_id: userId,
    amount: roundedAmount,
    status: "pending",
    proof_url: proofUrl,
    notes,
    rejection_reason: null,
    paid_at: new Date().toISOString(),
    confirmed_at: null,
    _local: true, // not yet acknowledged by the server
  };

  await outbox.enqueue({
    type: "payment.create",
    clientId,
    payload: {
      id: clientId,
      round_id: roundId,
      amount: roundedAmount,
      proof_url: proofUrl,
      notes,
    },
    applyOptimistic: () => db.payments.put(optimisticRow),
  });

  syncNow(); // fire-and-forget — the caller gets the optimistic row immediately
  return optimisticRow;
}

/**
 * Queues an admin settings edit. `baseSnapshot` is the client's last-known
 * value for each field in `changes`, captured when the edit started — the
 * server uses it to detect "someone else changed this exact field first"
 * (see backend/app/groups/service.py).
 */
export async function enqueueGroupSettingsUpdate({ groupId, changes, baseSnapshot }) {
  const clientId = crypto.randomUUID();

  await outbox.enqueue({
    type: "group.update",
    clientId,
    payload: { group_id: groupId, ...changes, base_snapshot: baseSnapshot },
    applyOptimistic: async () => {
      const current = await db.groups.get(groupId);
      if (current) await db.groups.put({ ...current, ...changes, _local: true });
    },
  });

  syncNow();
}
