/**
 * Read-side helpers over the local Dexie cache — used by hooks as a
 * fallback when a network call fails and the offline layer is enabled.
 * Mirrors the shape of the equivalent backend endpoints as closely as
 * possible so the same mapping/view logic can run on either source.
 */
import { db } from "./db";

export async function getCachedGroups() {
  return db.groups.toArray();
}

export async function getCachedGroupDetail(groupId) {
  const [group, members, rounds, payments] = await Promise.all([
    db.groups.get(groupId),
    db.group_members.where("group_id").equals(groupId).toArray(),
    db.rounds.where("group_id").equals(groupId).toArray(),
    db.payments.where("group_id").equals(groupId).toArray(),
  ]);
  return { group, members, rounds, payments };
}

export async function getCachedNotifications(userId) {
  const rows = await db.notifications.where("user_id").equals(userId).toArray();
  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}
