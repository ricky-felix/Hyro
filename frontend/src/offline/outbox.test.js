/**
 * src/offline/outbox.js — unit tests
 *
 * Covers the outbox's retry/backoff classification and the drain loop:
 * success removes the item, terminal (4xx) errors mark it failed without
 * further retries, and retryable errors leave it pending but backed off.
 */
vi.mock('../services', () => ({
  paymentsService: { create: vi.fn() },
  groupsService: { update: vi.fn() },
}));

import { paymentsService, groupsService } from '../services';
import { db } from './db';
import {
  classifyError,
  backoffDelayMs,
  enqueue,
  listOutbox,
  pendingCount,
  failedCount,
  retryItem,
  drain,
  STATUS_PENDING,
  STATUS_FAILED,
} from './outbox';

beforeEach(async () => {
  vi.clearAllMocks();
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('classifyError', () => {
  it('treats a missing status (network failure) as retryable', () => {
    expect(classifyError(new Error('Failed to fetch'))).toBe('retryable');
  });

  it.each([500, 502, 503, 408, 429])('treats HTTP %i as retryable', (status) => {
    const err = new Error('x');
    err.status = status;
    expect(classifyError(err)).toBe('retryable');
  });

  it.each([400, 401, 403, 404, 422])('treats HTTP %i as terminal', (status) => {
    const err = new Error('x');
    err.status = status;
    expect(classifyError(err)).toBe('terminal');
  });
});

describe('backoffDelayMs', () => {
  it('increases with attempt count and caps at the last schedule entry', () => {
    expect(backoffDelayMs(1)).toBe(2000);
    expect(backoffDelayMs(2)).toBe(5000);
    expect(backoffDelayMs(3)).toBe(15000);
    expect(backoffDelayMs(4)).toBe(30000);
    expect(backoffDelayMs(5)).toBe(60000);
    expect(backoffDelayMs(99)).toBe(60000); // capped
  });

  it('clamps attemptCount <= 0 to the first delay', () => {
    expect(backoffDelayMs(0)).toBe(2000);
  });
});

describe('enqueue', () => {
  it('adds a pending outbox row and applies the optimistic write', async () => {
    const applyOptimistic = vi.fn(async () => {
      await db.payments.put({ id: 'local-1', status: 'pending' });
    });

    await enqueue({
      type: 'payment.create',
      clientId: 'local-1',
      payload: { id: 'local-1', round_id: 'r1', amount: 1000 },
      applyOptimistic,
    });

    expect(applyOptimistic).toHaveBeenCalledOnce();
    const items = await listOutbox();
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe(STATUS_PENDING);
    expect(items[0].attemptCount).toBe(0);
    expect(await db.payments.get('local-1')).toMatchObject({ status: 'pending' });
    expect(await pendingCount()).toBe(1);
    expect(await failedCount()).toBe(0);
  });

  it('rejects an unknown mutation type', async () => {
    await expect(
      enqueue({ type: 'nonsense', clientId: 'x', payload: {} })
    ).rejects.toThrow(/Unknown outbox mutation type/);
  });
});

describe('drain', () => {
  it('sends a pending payment.create item and removes it on success', async () => {
    const serverRow = { id: 'local-1', status: 'pending', round_id: 'r1' };
    paymentsService.create.mockResolvedValue(serverRow);

    await enqueue({
      type: 'payment.create',
      clientId: 'local-1',
      payload: { id: 'local-1', round_id: 'r1', amount: 1000 },
    });

    const onApplied = vi.fn();
    const results = await drain({ onApplied });

    expect(paymentsService.create).toHaveBeenCalledWith({ id: 'local-1', round_id: 'r1', amount: 1000 });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ type: 'payment.create', ok: true, serverRow });
    expect(onApplied).toHaveBeenCalledWith('payment.create', 'local-1', serverRow);
    expect(await listOutbox()).toHaveLength(0); // removed from the queue
  });

  it('marks a terminal (4xx) failure as failed, not pending-for-retry, and calls onFailed', async () => {
    const err = new Error('You have already submitted a payment for this round');
    err.status = 400;
    paymentsService.create.mockRejectedValue(err);

    await enqueue({
      type: 'payment.create',
      clientId: 'local-2',
      payload: { id: 'local-2', round_id: 'r1', amount: 1000 },
    });

    const onFailed = vi.fn();
    const results = await drain({ onFailed });
    expect(results[0]).toMatchObject({ ok: false, kind: 'terminal' });
    expect(onFailed).toHaveBeenCalledWith('payment.create', 'local-2', err);

    const items = await listOutbox();
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe(STATUS_FAILED);
    expect(items[0].attemptCount).toBe(1);
    expect(items[0].lastError).toBe(err.message);
    expect(await failedCount()).toBe(1);
    expect(await pendingCount()).toBe(0);
  });

  it('leaves a retryable failure pending, backed off, and skips it on an immediate second drain', async () => {
    const networkErr = new Error('Failed to fetch');
    paymentsService.create.mockRejectedValue(networkErr);

    await enqueue({
      type: 'payment.create',
      clientId: 'local-3',
      payload: { id: 'local-3', round_id: 'r1', amount: 1000 },
    });

    const onFailed = vi.fn();
    const first = await drain({ onFailed });
    expect(first[0]).toMatchObject({ ok: false, kind: 'retryable' });
    expect(onFailed).not.toHaveBeenCalled(); // retryable — not a terminal give-up yet

    let items = await listOutbox();
    expect(items[0].status).toBe(STATUS_PENDING); // retryable — stays queued
    expect(items[0].attemptCount).toBe(1);

    // Immediately draining again must NOT re-attempt — still inside the backoff window.
    const second = await drain();
    expect(second).toEqual([]);
    expect(paymentsService.create).toHaveBeenCalledOnce();

    items = await listOutbox();
    expect(items[0].attemptCount).toBe(1); // unchanged — wasn't retried
  });

  it('retries a backed-off item once its delay has elapsed', async () => {
    paymentsService.create.mockRejectedValueOnce(new Error('Failed to fetch'));
    paymentsService.create.mockResolvedValueOnce({ id: 'local-4', status: 'pending' });

    await enqueue({
      type: 'payment.create',
      clientId: 'local-4',
      payload: { id: 'local-4', round_id: 'r1', amount: 1000 },
    });

    await drain(); // 1st attempt fails, schedules a retry ~2s out

    // Simulate time passing by back-dating lastAttemptAt past the backoff window.
    const items = await listOutbox();
    await db.outbox.update(items[0].localId, {
      lastAttemptAt: new Date(Date.now() - 10_000).toISOString(),
    });

    const results = await drain();
    expect(results).toEqual([
      { localId: items[0].localId, type: 'payment.create', ok: true, serverRow: { id: 'local-4', status: 'pending' } },
    ]);
    expect(await listOutbox()).toHaveLength(0);
  });

  it('processes multiple queued items in FIFO order', async () => {
    const calls = [];
    paymentsService.create.mockImplementation(async (payload) => {
      calls.push(payload.id);
      return { id: payload.id };
    });

    await enqueue({ type: 'payment.create', clientId: 'a', payload: { id: 'a' } });
    await enqueue({ type: 'payment.create', clientId: 'b', payload: { id: 'b' } });
    await enqueue({ type: 'payment.create', clientId: 'c', payload: { id: 'c' } });

    await drain();
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('routes group.update items to groupsService.update', async () => {
    groupsService.update.mockResolvedValue({ id: 'g1', name: 'New Name', overridden_fields: [] });

    await enqueue({
      type: 'group.update',
      clientId: 'edit-1',
      payload: { group_id: 'g1', name: 'New Name', base_snapshot: { name: 'Old Name' } },
    });

    await drain();
    expect(groupsService.update).toHaveBeenCalledWith('g1', {
      group_id: 'g1',
      name: 'New Name',
      base_snapshot: { name: 'Old Name' },
    });
  });
});

describe('retryItem', () => {
  it('resets a failed item back to pending for an immediate manual retry', async () => {
    const err = new Error('nope');
    err.status = 400;
    paymentsService.create.mockRejectedValue(err);

    await enqueue({ type: 'payment.create', clientId: 'x', payload: { id: 'x' } });
    await drain();
    let items = await listOutbox();
    expect(items[0].status).toBe(STATUS_FAILED);

    await retryItem(items[0].localId);
    items = await listOutbox();
    expect(items[0].status).toBe(STATUS_PENDING);
    expect(items[0].lastAttemptAt).toBeNull();
  });
});
