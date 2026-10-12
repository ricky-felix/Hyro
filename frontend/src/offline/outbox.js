/**
 * The write outbox: queued mutations made while offline (or just
 * optimistically, while online), drained in FIFO order against the real
 * backend. Two mutation types are supported in v1 — exactly the two
 * offline-writable actions the product allows:
 *
 *   - "payment.create" — record an arisan contribution. Carries the
 *     client-generated UUID that makes retries idempotent (see
 *     backend/app/payments/service.py).
 *   - "group.update"   — an admin's settings edit. Carries a `base_snapshot`
 *     of the fields being changed, for server-side per-field
 *     last-write-wins (see backend/app/groups/service.py).
 *
 * Everything else the task scoped as offline-readable-only has no outbox
 * path at all — there's simply nowhere in the UI that queues a turn-order
 * change or a payment confirmation offline.
 */
import { paymentsService, groupsService } from "../services";
import { db } from "./db";

export const STATUS_PENDING = "pending";
export const STATUS_FAILED = "failed";

// Exponential backoff, capped. Index 0 = delay before the 1st retry.
const BACKOFF_SCHEDULE_MS = [2000, 5000, 15000, 30000, 60000];

/** Delay before the next retry, given how many attempts have already been made. */
export function backoffDelayMs(attemptCount) {
  const idx = Math.min(Math.max(attemptCount - 1, 0), BACKOFF_SCHEDULE_MS.length - 1);
  return BACKOFF_SCHEDULE_MS[idx];
}

/**
 * Classifies an error thrown by the API client (see src/lib/api.js) so the
 * outbox knows whether to retry or give up.
 *   - no `.status` → a network failure (fetch itself threw) → retryable.
 *   - 5xx / 408 / 429 → transient server-side issue → retryable.
 *   - any other 4xx → the server rejected the write on its merits
 *     (validation, permission, business rule) → terminal, needs the user.
 */
export function classifyError(err) {
  const status = err?.status;
  if (status === undefined || status === null) return "retryable";
  if (status >= 500 || status === 408 || status === 429) return "retryable";
  return "terminal";
}

const SENDERS = {
  "payment.create": (payload) => paymentsService.create(payload),
  "group.update": (payload) => groupsService.update(payload.group_id, payload),
};

/** Queues a mutation. `applyOptimistic` (if given) runs in the same
 * transaction as the enqueue so the local cache reflects the pending write
 * immediately — the UI never has to wait for a sync to see its own change. */
export async function enqueue({ type, clientId, payload, applyOptimistic }) {
  if (!SENDERS[type]) throw new Error(`Unknown outbox mutation type: ${type}`);
  const createdAt = new Date().toISOString();

  await db.transaction("rw", db.tables, async () => {
    await db.outbox.add({
      type,
      clientId,
      payload,
      status: STATUS_PENDING,
      attemptCount: 0,
      lastError: null,
      lastAttemptAt: null,
      createdAt,
    });
    if (applyOptimistic) await applyOptimistic();
  });
}

export async function listOutbox() {
  return db.outbox.orderBy("localId").toArray();
}

export async function pendingCount() {
  return db.outbox.where("status").equals(STATUS_PENDING).count();
}

export async function failedCount() {
  return db.outbox.where("status").equals(STATUS_FAILED).count();
}

/** Resets a failed item back to pending for an immediate manual retry. */
export async function retryItem(localId) {
  await db.outbox.update(localId, {
    status: STATUS_PENDING,
    lastAttemptAt: null,
  });
}

export async function removeItem(localId) {
  await db.outbox.delete(localId);
}

/**
 * Drains every eligible queued item, in FIFO order, sequentially (so a
 * member's second contribution never races ahead of their first write to
 * the same round). An item is "eligible" if it's pending-and-due (never
 * attempted, or past its backoff delay) or explicitly reset to pending via
 * retryItem(). Failed (terminal) items are left alone — the user decides.
 *
 * `onApplied(type, clientId, serverRow)` is called after each successful
 * send so the caller (sync.js) can merge the server's authoritative row
 * into the local cache, replacing the optimistic placeholder.
 *
 * `onFailed(type, clientId, err)` is called only for TERMINAL failures (not
 * retryable ones, which stay "pending" and shouldn't flicker the UI) — the
 * caller uses it to mark the optimistic cache row as failed too, so a
 * rejected contribution doesn't sit forever looking like it's still
 * "pending" once its outbox entry is gone from the queue.
 */
export async function drain({ onApplied, onFailed } = {}) {
  const items = await listOutbox();
  const now = Date.now();
  const results = [];

  for (const item of items) {
    if (item.status !== STATUS_PENDING) continue;
    if (item.lastAttemptAt) {
      const dueAt = new Date(item.lastAttemptAt).getTime() + backoffDelayMs(item.attemptCount);
      if (now < dueAt) continue; // still backing off — try again on a later drain
    }

    const send = SENDERS[item.type];
    try {
      const serverRow = await send(item.payload);
      await db.outbox.delete(item.localId);
      if (onApplied) await onApplied(item.type, item.clientId, serverRow);
      results.push({ localId: item.localId, type: item.type, ok: true, serverRow });
    } catch (err) {
      const kind = classifyError(err);
      await db.outbox.update(item.localId, {
        attemptCount: item.attemptCount + 1,
        lastAttemptAt: new Date().toISOString(),
        lastError: err?.message || "Gagal tersambung ke server",
        status: kind === "terminal" ? STATUS_FAILED : STATUS_PENDING,
      });
      if (kind === "terminal" && onFailed) await onFailed(item.type, item.clientId, err);
      results.push({ localId: item.localId, type: item.type, ok: false, error: err, kind });
    }
  }

  return results;
}
