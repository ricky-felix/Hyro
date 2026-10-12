/**
 * useSettlement.js — unit tests
 *
 * Verifies state machine and payload shapes for both arisan and patungan paths.
 */

vi.mock('../services', () => ({
  paymentsService: { create: vi.fn() },
  billSettlementsService: { create: vi.fn() },
}));

// Offline layer off by default — these tests cover the pre-existing
// online-only path. See the dedicated describe block below for the
// offlineEnabled=true (outbox) path.
vi.mock('../config', () => ({ config: { offlineEnabled: false } }));
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));
vi.mock('../offline/writes', () => ({
  enqueueContribution: vi.fn(),
}));

import { renderHook, act } from '@testing-library/react';
import { paymentsService, billSettlementsService } from '../services';
import { config } from '../config';
import { supabase } from '../lib/supabase';
import { enqueueContribution } from '../offline/writes';
import { useSettlement } from './useSettlement';

beforeEach(() => {
  vi.clearAllMocks();
  config.offlineEnabled = false;
});

describe('useSettlement', () => {
  it('starts with submitting=false, submitted=false, error=null', () => {
    const { result } = renderHook(() => useSettlement());
    expect(result.current.submitting).toBe(false);
    expect(result.current.submitted).toBe(false);
    expect(result.current.error).toBeNull();
  });

  // ── submitArisan ────────────────────────────────────────────────────────────

  describe('submitArisan()', () => {
    it('calls paymentsService.create with the correct payload', async () => {
      paymentsService.create.mockResolvedValue({ id: 'p1' });
      const { result } = renderHook(() => useSettlement());

      await act(async () => {
        await result.current.submitArisan({
          roundId: 'r1',
          amount: 500000,
          proofUrl: 'https://cdn.example.com/proof.jpg',
          notes: 'Via GoPay',
        });
      });

      expect(paymentsService.create).toHaveBeenCalledWith({
        round_id: 'r1',
        amount: 500000,
        proof_url: 'https://cdn.example.com/proof.jpg',
        notes: 'Via GoPay',
      });
    });

    it('rounds the amount', async () => {
      paymentsService.create.mockResolvedValue({ id: 'p2' });
      const { result } = renderHook(() => useSettlement());

      await act(async () => {
        await result.current.submitArisan({ roundId: 'r1', amount: 500000.9 });
      });

      expect(paymentsService.create.mock.calls[0][0].amount).toBe(500001);
    });

    it('defaults proofUrl to null and notes to empty string', async () => {
      paymentsService.create.mockResolvedValue({ id: 'p3' });
      const { result } = renderHook(() => useSettlement());

      await act(async () => {
        await result.current.submitArisan({ roundId: 'r1', amount: 300000 });
      });

      const payload = paymentsService.create.mock.calls[0][0];
      expect(payload.proof_url).toBeNull();
      expect(payload.notes).toBe('');
    });

    it('sets submitting=true during the call and submitted=true on success', async () => {
      let resolve;
      paymentsService.create.mockReturnValue(new Promise(r => { resolve = r; }));
      const { result } = renderHook(() => useSettlement());

      act(() => { result.current.submitArisan({ roundId: 'r1', amount: 100000 }); });
      expect(result.current.submitting).toBe(true);

      await act(async () => { resolve({ id: 'p4' }); });
      expect(result.current.submitting).toBe(false);
      expect(result.current.submitted).toBe(true);
    });

    it('returns the payment on success', async () => {
      const mockPayment = { id: 'p5', status: 'pending' };
      paymentsService.create.mockResolvedValue(mockPayment);
      const { result } = renderHook(() => useSettlement());

      let returnValue;
      await act(async () => {
        returnValue = await result.current.submitArisan({ roundId: 'r1', amount: 100000 });
      });

      expect(returnValue).toEqual(mockPayment);
    });

    it('sets error and returns null on failure', async () => {
      paymentsService.create.mockRejectedValue(new Error('Payment failed'));
      const { result } = renderHook(() => useSettlement());

      let returnValue;
      await act(async () => {
        returnValue = await result.current.submitArisan({ roundId: 'r1', amount: 100000 });
      });

      expect(returnValue).toBeNull();
      expect(result.current.error).toBe('Payment failed');
      expect(result.current.submitted).toBe(false);
    });
  });

  // ── submitPatungan ──────────────────────────────────────────────────────────

  describe('submitPatungan()', () => {
    it('calls billSettlementsService.create with the correct payload', async () => {
      billSettlementsService.create.mockResolvedValue({ id: 's1' });
      const { result } = renderHook(() => useSettlement());

      await act(async () => {
        await result.current.submitPatungan({
          billId: 'b1',
          fromUserId: 'u1',
          toUserId: 'u2',
          amount: 50000,
          proofUrl: 'https://cdn.example.com/bukti.jpg',
          notes: 'Lunas',
        });
      });

      expect(billSettlementsService.create).toHaveBeenCalledWith({
        bill_id: 'b1',
        from_user_id: 'u1',
        to_user_id: 'u2',
        amount: 50000,
        proof_url: 'https://cdn.example.com/bukti.jpg',
        notes: 'Lunas',
      });
    });

    it('rounds the amount', async () => {
      billSettlementsService.create.mockResolvedValue({ id: 's2' });
      const { result } = renderHook(() => useSettlement());

      await act(async () => {
        await result.current.submitPatungan({
          billId: 'b1', fromUserId: 'u1', toUserId: 'u2', amount: 50000.4,
        });
      });

      expect(billSettlementsService.create.mock.calls[0][0].amount).toBe(50000);
    });

    it('defaults proofUrl to null and notes to empty string', async () => {
      billSettlementsService.create.mockResolvedValue({ id: 's3' });
      const { result } = renderHook(() => useSettlement());

      await act(async () => {
        await result.current.submitPatungan({
          billId: 'b1', fromUserId: 'u1', toUserId: 'u2', amount: 50000,
        });
      });

      const payload = billSettlementsService.create.mock.calls[0][0];
      expect(payload.proof_url).toBeNull();
      expect(payload.notes).toBe('');
    });

    it('sets submitted=true on success', async () => {
      billSettlementsService.create.mockResolvedValue({ id: 's4' });
      const { result } = renderHook(() => useSettlement());

      await act(async () => {
        await result.current.submitPatungan({
          billId: 'b1', fromUserId: 'u1', toUserId: 'u2', amount: 25000,
        });
      });

      expect(result.current.submitted).toBe(true);
    });

    it('sets error and returns null on failure', async () => {
      billSettlementsService.create.mockRejectedValue(new Error('Settlement failed'));
      const { result } = renderHook(() => useSettlement());

      let returnValue;
      await act(async () => {
        returnValue = await result.current.submitPatungan({
          billId: 'b1', fromUserId: 'u1', toUserId: 'u2', amount: 25000,
        });
      });

      expect(returnValue).toBeNull();
      expect(result.current.error).toBe('Settlement failed');
    });
  });

  // ── submitArisan() with the offline layer enabled ──────────────────────────
  describe('submitArisan() with offlineEnabled=true', () => {
    beforeEach(() => {
      config.offlineEnabled = true;
      supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    });

    it('routes through enqueueContribution instead of paymentsService.create', async () => {
      enqueueContribution.mockResolvedValue({ id: 'local-1', status: 'pending' });
      const { result } = renderHook(() => useSettlement());

      await act(async () => {
        await result.current.submitArisan({ roundId: 'r1', amount: 100000, notes: 'Via GoPay' });
      });

      expect(enqueueContribution).toHaveBeenCalledWith({
        userId: 'u1',
        roundId: 'r1',
        amount: 100000,
        proofUrl: null,
        notes: 'Via GoPay',
      });
      expect(paymentsService.create).not.toHaveBeenCalled();
    });

    it('returns the optimistic (pending) row and sets submitted=true', async () => {
      const optimistic = { id: 'local-2', status: 'pending', _local: true };
      enqueueContribution.mockResolvedValue(optimistic);
      const { result } = renderHook(() => useSettlement());

      let returnValue;
      await act(async () => {
        returnValue = await result.current.submitArisan({ roundId: 'r1', amount: 50000 });
      });

      expect(returnValue).toEqual(optimistic);
      expect(result.current.submitted).toBe(true);
    });

    it('sets error and returns null if enqueueing itself fails', async () => {
      enqueueContribution.mockRejectedValue(new Error('IndexedDB unavailable'));
      const { result } = renderHook(() => useSettlement());

      let returnValue;
      await act(async () => {
        returnValue = await result.current.submitArisan({ roundId: 'r1', amount: 50000 });
      });

      expect(returnValue).toBeNull();
      expect(result.current.error).toBe('IndexedDB unavailable');
    });
  });
});
