import Dexie from "dexie";

/**
 * Local offline cache + write outbox. One database per browser profile —
 * cleared entirely on logout (see clearAllData), so it never outlives the
 * session it belongs to.
 *
 * Versioned schema: bump the version number and declare the new `.stores()`
 * shape to change it. Dexie runs any `.upgrade()` step for that version
 * exactly once, the first time a returning user's browser opens the DB
 * after the app ships the new version — this is the migration path.
 */
export const db = new Dexie("hyro-offline");

// v1 — initial offline cache (groups/members/rounds/payments/notifications)
// + outbox for queued writes.
db.version(1).stores({
  groups: "id, updated_at",
  group_members: "id, group_id, user_id",
  rounds: "id, group_id",
  payments: "id, group_id, round_id, payer_id",
  notifications: "id, user_id",
  meta: "key",
  outbox: "++localId, status, createdAt",
});

// v2 — adds updated_at indexes to rounds/payments (so future delta-only
// queries don't need a full table scan) and backfills `attemptCount` on any
// outbox row queued before retry counting existed, so old queued writes
// don't crash the backoff calculation on the first sync after an update.
db.version(2)
  .stores({
    groups: "id, updated_at",
    group_members: "id, group_id, user_id",
    rounds: "id, group_id, updated_at",
    payments: "id, group_id, round_id, payer_id, updated_at",
    notifications: "id, user_id",
    meta: "key",
    outbox: "++localId, status, createdAt",
  })
  .upgrade(async (tx) => {
    await tx
      .table("outbox")
      .toCollection()
      .modify((item) => {
        if (item.attemptCount === undefined) item.attemptCount = 0;
      });
  });

/** Wipes every local table — called on logout. */
export async function clearAllData() {
  await db.transaction("rw", db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
  });
}
