/**
 * The sync engine: a cursor-based incremental pull (GET /sync/pull?since=)
 * and an outbox drain (src/offline/outbox.js), composed into one
 * syncNow() that the UI calls on reconnect, on app foreground, on a manual
 * "Sync sekarang" tap, and on a periodic fallback timer.
 *
 * Push-before-pull: draining the outbox first means a contribution this
 * device just recorded shows up as "confirmed by the server" (or at least
 * "received") in the very same sync pass that refreshes everyone else's
 * view of the round.
 */
import { api } from "../lib/api";
import { db } from "./db";
import { drain } from "./outbox";

const CURSOR_KEY = "syncCursor";
const LAST_SYNC_KEY = "lastSyncAt";

export async function getCursor() {
  const row = await db.meta.get(CURSOR_KEY);
  return row?.value ?? null;
}

async function setCursor(value) {
  await db.meta.put({ key: CURSOR_KEY, value });
}

export async function getLastSyncAt() {
  const row = await db.meta.get(LAST_SYNC_KEY);
  return row?.value ?? null;
}

async function setLastSyncAt(value) {
  await db.meta.put({ key: LAST_SYNC_KEY, value });
}

/** Merges one /sync/pull response into the local cache tables. */
async function applyPull(res) {
  await db.transaction(
    "rw",
    [db.groups, db.group_members, db.rounds, db.payments, db.notifications],
    async () => {
      // Prune any locally-cached group the user no longer belongs to
      // (removed from the group, or the group was deleted).
      const liveIds = new Set(res.group_ids || []);
      const localGroups = await db.groups.toArray();
      await Promise.all(
        localGroups.filter((g) => !liveIds.has(g.id)).map((g) => db.groups.delete(g.id))
      );

      await Promise.all([
        db.groups.bulkPut(res.groups || []),
        db.group_members.bulkPut(res.group_members || []),
        db.rounds.bulkPut(res.rounds || []),
        db.payments.bulkPut(res.payments || []),
        db.notifications.bulkPut(res.notifications || []),
      ]);
    }
  );
}

/** One incremental pull. Safe to call repeatedly — it's just "what changed since my cursor". */
export async function pull() {
  const since = await getCursor();
  const res = await api.get(`/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ""}`);
  await applyPull(res);
  await setCursor(res.server_time);
  await setLastSyncAt(new Date().toISOString());
  return res;
}

/** Applies a successfully-sent outbox item's server row into the cache,
 * replacing the optimistic placeholder written at enqueue time. */
async function applySentItem(type, clientId, serverRow) {
  if (type === "payment.create") {
    await db.payments.put(serverRow);
  } else if (type === "group.update") {
    const { overridden_fields, ...row } = serverRow;
    await db.groups.put(row);
  }
}

/** A contribution the server permanently rejected (e.g. "you already paid
 * this round") — mark the optimistic row failed rather than leave it
 * looking like a still-pending payment forever. The outbox entry itself
 * (with the error + retry button) is what the debug panel/UI surfaces. */
async function markSentItemFailed(type, clientId, err) {
  if (type === "payment.create") {
    const row = await db.payments.get(clientId);
    if (row?._local) {
      await db.payments.put({ ...row, status: "failed", _localError: err?.message || null });
    }
  }
}

let inFlight = null;

/**
 * Drains the outbox, then pulls. Returns a summary the UI/debug panel can
 * show: how many outbox items synced vs failed, and the fresh pull result.
 * No-ops (returns `{skipped: true}`) when the browser reports offline —
 * callers don't need to check navigator.onLine themselves.
 *
 * Re-entrant-safe: syncNow() gets called from several independent places
 * (reconnect, app foreground, the periodic fallback timer, a manual tap,
 * and fire-and-forget right after enqueueing a write) and nothing
 * coordinates between them. Without this guard, two overlapping calls
 * could both read the same outbox item as "pending" and send it twice.
 * Concurrent callers share the one in-flight run instead.
 */
export async function syncNow() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { skipped: true };
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const outboxResults = await drain({ onApplied: applySentItem, onFailed: markSentItemFailed });
    const pullResult = await pull();

    return {
      skipped: false,
      outboxResults,
      pullResult,
    };
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}
