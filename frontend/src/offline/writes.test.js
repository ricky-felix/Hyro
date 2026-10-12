/**
 * src/offline/writes.js — unit tests
 *
 * These are the two offline-writable mutations the product allows.
 * Focuses on: the optimistic row appearing in the cache immediately (before
 * any network round-trip), the payload shape sent to the server, and that
 * group_id for a contribution is resolved from the already-synced round —
 * no network needed to know which group a round belongs to.
 */
// syncNow() is fire-and-forget from writes.js — mocked out so these tests
// only assert what enqueue* did, without racing the sync engine's own
// drain-and-delete against the test's assertions.
vi.mock('./sync', () => ({ syncNow: vi.fn() }));

import { db } from './db';
import { listOutbox } from './outbox';
import { enqueueContribution, enqueueGroupSettingsUpdate } from './writes';

beforeEach(async () => {
  vi.clearAllMocks();
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('enqueueContribution', () => {
  it('resolves group_id from the cached round and writes an optimistic pending row', async () => {
    await db.rounds.put({ id: 'r1', group_id: 'g1', status: 'active' });

    const row = await enqueueContribution({
      userId: 'u1',
      roundId: 'r1',
      amount: 50000.4,
      notes: 'Via GoPay',
    });

    expect(row.group_id).toBe('g1');
    expect(row.payer_id).toBe('u1');
    expect(row.amount).toBe(50000); // rounded
    expect(row.status).toBe('pending');
    expect(row._local).toBe(true);

    const cached = await db.payments.get(row.id);
    expect(cached).toMatchObject({ status: 'pending', round_id: 'r1', group_id: 'g1' });
  });

  it('queues a payment.create outbox item carrying the same client id as the row', async () => {
    await db.rounds.put({ id: 'r1', group_id: 'g1' });
    const row = await enqueueContribution({ userId: 'u1', roundId: 'r1', amount: 10000 });

    const items = await listOutbox();
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('payment.create');
    expect(items[0].clientId).toBe(row.id);
    expect(items[0].payload).toEqual({
      id: row.id,
      round_id: 'r1',
      amount: 10000,
      proof_url: null,
      notes: '',
    });
  });

  it('leaves group_id null when the round has not been synced yet', async () => {
    const row = await enqueueContribution({ userId: 'u1', roundId: 'unknown-round', amount: 5000 });
    expect(row.group_id).toBeNull();
  });
});

describe('enqueueGroupSettingsUpdate', () => {
  it('applies the change optimistically to the cached group and queues base_snapshot', async () => {
    await db.groups.put({ id: 'g1', name: 'Old Name', description: 'Old Desc' });

    await enqueueGroupSettingsUpdate({
      groupId: 'g1',
      changes: { name: 'New Name' },
      baseSnapshot: { name: 'Old Name' },
    });

    const cached = await db.groups.get('g1');
    expect(cached.name).toBe('New Name');
    expect(cached.description).toBe('Old Desc'); // untouched field preserved
    expect(cached._local).toBe(true);

    const items = await listOutbox();
    expect(items[0].type).toBe('group.update');
    expect(items[0].payload).toEqual({
      group_id: 'g1',
      name: 'New Name',
      base_snapshot: { name: 'Old Name' },
    });
  });

  it('is a no-op on the cache if the group was never synced locally', async () => {
    await enqueueGroupSettingsUpdate({
      groupId: 'never-cached',
      changes: { name: 'New Name' },
      baseSnapshot: { name: 'Old Name' },
    });

    expect(await db.groups.get('never-cached')).toBeUndefined();
    const items = await listOutbox();
    expect(items).toHaveLength(1); // still queued — will apply once it next syncs
  });
});
