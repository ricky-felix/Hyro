/**
 * src/offline/sync.js — unit tests
 *
 * Covers the incremental pull (cursor advance, group pruning) and the
 * syncNow() orchestration (offline short-circuit, push-before-pull order).
 */
vi.mock('../lib/api', () => ({
  api: { get: vi.fn() },
}));
vi.mock('../services', () => ({
  paymentsService: { create: vi.fn() },
  groupsService: { update: vi.fn() },
}));

import { api } from '../lib/api';
import { paymentsService } from '../services';
import { db } from './db';
import { enqueue } from './outbox';
import { pull, getCursor, getLastSyncAt, syncNow } from './sync';

function setOnline(value) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

beforeEach(async () => {
  vi.clearAllMocks();
  await Promise.all(db.tables.map((t) => t.clear()));
  setOnline(true);
});

function samplePullResponse(overrides = {}) {
  return {
    server_time: '2026-01-01T00:00:00.000Z',
    group_ids: ['g1'],
    groups: [{ id: 'g1', name: 'Arisan RT 05', updated_at: '2026-01-01T00:00:00.000Z' }],
    group_members: [{ id: 'm1', group_id: 'g1', user_id: 'u1' }],
    rounds: [{ id: 'r1', group_id: 'g1', status: 'active' }],
    payments: [{ id: 'p1', group_id: 'g1', round_id: 'r1', payer_id: 'u1', status: 'confirmed' }],
    notifications: [{ id: 'n1', user_id: 'u1', is_read: false }],
    ...overrides,
  };
}

describe('pull', () => {
  it('fetches without a since param on the first call and applies every table', async () => {
    api.get.mockResolvedValue(samplePullResponse());

    const res = await pull();

    expect(api.get).toHaveBeenCalledWith('/sync/pull');
    expect(res.server_time).toBe('2026-01-01T00:00:00.000Z');
    expect(await db.groups.get('g1')).toMatchObject({ name: 'Arisan RT 05' });
    expect(await db.group_members.get('m1')).toBeTruthy();
    expect(await db.rounds.get('r1')).toBeTruthy();
    expect(await db.payments.get('p1')).toBeTruthy();
    expect(await db.notifications.get('n1')).toBeTruthy();
  });

  it('advances the cursor to the returned server_time and reuses it on the next pull', async () => {
    api.get.mockResolvedValue(samplePullResponse());
    await pull();
    expect(await getCursor()).toBe('2026-01-01T00:00:00.000Z');

    api.get.mockResolvedValue(samplePullResponse({ server_time: '2026-01-02T00:00:00.000Z' }));
    await pull();

    expect(api.get).toHaveBeenLastCalledWith(
      `/sync/pull?since=${encodeURIComponent('2026-01-01T00:00:00.000Z')}`
    );
    expect(await getCursor()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('records lastSyncAt', async () => {
    expect(await getLastSyncAt()).toBeNull();
    api.get.mockResolvedValue(samplePullResponse());
    await pull();
    expect(await getLastSyncAt()).toBeTruthy();
  });

  it('prunes a locally-cached group that is no longer in group_ids', async () => {
    await db.groups.put({ id: 'stale-group', name: 'No Longer Mine' });

    api.get.mockResolvedValue(samplePullResponse({ group_ids: ['g1'], groups: [] }));
    await pull();

    expect(await db.groups.get('stale-group')).toBeUndefined();
  });
});

describe('syncNow', () => {
  it('skips entirely when the browser reports offline', async () => {
    setOnline(false);
    const result = await syncNow();

    expect(result).toEqual({ skipped: true });
    expect(api.get).not.toHaveBeenCalled();
  });

  it('drains the outbox before pulling, and the pull reflects the sent item', async () => {
    paymentsService.create.mockResolvedValue({
      id: 'local-1',
      group_id: 'g1',
      round_id: 'r1',
      status: 'pending',
    });
    await enqueue({
      type: 'payment.create',
      clientId: 'local-1',
      payload: { id: 'local-1', round_id: 'r1', amount: 50000 },
    });

    api.get.mockResolvedValue(samplePullResponse());

    const result = await syncNow();

    expect(result.skipped).toBe(false);
    expect(result.outboxResults).toEqual([
      expect.objectContaining({ type: 'payment.create', ok: true }),
    ]);
    // Push-before-pull: the outbox drains before the pull request fires.
    expect(paymentsService.create.mock.invocationCallOrder[0]).toBeLessThan(
      api.get.mock.invocationCallOrder[0]
    );
    // The outbox item's server row got merged into the cache by applySentItem.
    expect(await db.payments.get('local-1')).toMatchObject({ status: 'pending' });
  });

  it('marks a terminally-rejected contribution failed in the cache, not stuck pending', async () => {
    // Build the optimistic state directly (the same shape writes.js produces)
    // rather than going through enqueueContribution(), which fires its own
    // syncNow() — this test wants full control over when syncNow runs.
    await db.payments.put({ id: 'local-2', round_id: 'r1', status: 'pending', _local: true });
    await enqueue({
      type: 'payment.create',
      clientId: 'local-2',
      payload: { id: 'local-2', round_id: 'r1', amount: 50000 },
    });

    const err = new Error('You have already submitted a payment for this round');
    err.status = 400;
    paymentsService.create.mockRejectedValue(err);
    api.get.mockResolvedValue(samplePullResponse());

    await syncNow();

    const cached = await db.payments.get('local-2');
    expect(cached.status).toBe('failed');
  });
});
