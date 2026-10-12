/**
 * useGroups.js (useHomeCards) — unit tests
 *
 * Tests the mapGroupToCard / mapBillToCard mapping logic indirectly through
 * the hook, and verifies loading/success/error/fallback behavior.
 */

// Mock the home/data module to control the demo-mode mockup
vi.mock('../components/application/v2/home/data', () => ({
  ALL_CARDS: [{ id: 'fallback', type: 'arisan' }],
}));

vi.mock('../services', () => ({
  groupsService: { list: vi.fn() },
  billsService: { list: vi.fn() },
}));

vi.mock('../config', () => ({ config: { offlineEnabled: true } }));
vi.mock('../offline/cache', () => ({
  getCachedGroups: vi.fn(),
}));
vi.mock('../lib/appMode', () => ({ isDemoMode: vi.fn(() => false) }));

import { renderHook, waitFor } from '@testing-library/react';
import { groupsService, billsService } from '../services';
import { getCachedGroups } from '../offline/cache';
import { isDemoMode } from '../lib/appMode';
import { useHomeCards } from './useGroups';

beforeEach(() => {
  vi.clearAllMocks();
  groupsService.list.mockResolvedValue([]);
  billsService.list.mockResolvedValue([]);
  getCachedGroups.mockResolvedValue([]);
  isDemoMode.mockReturnValue(false);
});

describe('useHomeCards', () => {
  it('demo mode returns the ALL_CARDS mockup without touching the API', () => {
    isDemoMode.mockReturnValue(true);
    const { result } = renderHook(() => useHomeCards());
    expect(result.current.loading).toBe(false);
    expect(result.current.cards).toEqual([{ id: 'fallback', type: 'arisan' }]);
    expect(groupsService.list).not.toHaveBeenCalled();
    expect(billsService.list).not.toHaveBeenCalled();
  });

  it('real mode starts in loading state with no cards', () => {
    const { result } = renderHook(() => useHomeCards());
    expect(result.current.loading).toBe(true);
    expect(result.current.cards).toEqual([]);
  });

  it('resolves to an empty deck when API returns empty arrays', async () => {
    const { result } = renderHook(() => useHomeCards());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // 0 groups + 0 bills → empty deck (HomeDeck shows EmptyCard), never mockups
    expect(result.current.cards).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('maps a group from the API to card shape', async () => {
    groupsService.list.mockResolvedValue([
      {
        id: 'g1',
        name: 'Arisan RT 05',
        contribution_amount: 500000,
        member_count: 10,
        max_members: 10,
        status: 'active',
        current_round: {
          round_number: 2,
          paid_count: 5,
          due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days away
          recipient_name: 'Budi',
        },
      },
    ]);

    const { result } = renderHook(() => useHomeCards());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.cards).toHaveLength(1);
    const card = result.current.cards[0];
    expect(card.type).toBe('arisan');
    expect(card.id).toBe('g1');
    expect(card.eyebrow).toContain('Arisan RT 05');
    expect(card.eyebrow).toContain('Budi');
    expect(card.amount).toContain('500.000');
    expect(card.progress).toBe(50); // 5/10
    expect(card.badgeLabel).toBe('Arisan');
    expect(card.ctaLabel).toBe('Bayar Sekarang');
  });

  it('marks overdue groups correctly', async () => {
    groupsService.list.mockResolvedValue([
      {
        id: 'g2',
        name: 'Overdue Group',
        status: 'active',
        contribution_amount: 200000,
        member_count: 5,
        current_round: {
          round_number: 1,
          paid_count: 2,
          due_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // yesterday
        },
      },
    ]);

    const { result } = renderHook(() => useHomeCards());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const card = result.current.cards[0];
    expect(card.status).toBe('overdue');
    expect(card.urgent).toBe('Telat');
  });

  it('marks soon-due groups correctly (within 3 days)', async () => {
    groupsService.list.mockResolvedValue([
      {
        id: 'g3',
        name: 'Soon Group',
        status: 'active',
        contribution_amount: 100000,
        member_count: 3,
        current_round: {
          round_number: 1,
          paid_count: 1,
          due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
        },
      },
    ]);

    const { result } = renderHook(() => useHomeCards());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const card = result.current.cards[0];
    expect(card.status).toBe('soon');
    expect(card.urgent).toBe('Segera');
  });

  it('maps a completed group to the proof CTA', async () => {
    groupsService.list.mockResolvedValue([
      {
        id: 'g4',
        name: 'Done Group',
        status: 'completed',
        contribution_amount: 300000,
        member_count: 6,
        current_round: null,
      },
    ]);

    const { result } = renderHook(() => useHomeCards());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const card = result.current.cards[0];
    expect(card.settled).toBe(true);
    expect(card.ctaLabel).toBe('Kirim Bukti Transfer');
    expect(card.badgeLabel).toBe('Selesai');
  });

  it('maps a bill from the API to patungan card shape', async () => {
    billsService.list.mockResolvedValue([
      {
        id: 'b1',
        title: 'Makan Siang Tim',
        total_amount: 200000,
        participant_count: 4,
        settled_count: 2,
        status: 'open',
        due_date: null,
      },
    ]);

    const { result } = renderHook(() => useHomeCards());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const card = result.current.cards[0];
    expect(card.type).toBe('patungan');
    expect(card.id).toBe('b1');
    expect(card.eyebrow).toContain('Patungan');
    expect(card.eyebrow).toContain('Makan Siang Tim');
    expect(card.progress).toBe(50); // 2/4
    expect(card.badgeLabel).toBe('Patungan');
  });

  it('puts active cards before settled ones', async () => {
    groupsService.list.mockResolvedValue([
      { id: 'active', name: 'Active', status: 'active', contribution_amount: 0, member_count: 2, current_round: null },
    ]);
    billsService.list.mockResolvedValue([
      { id: 'settled', title: 'Old Bill', total_amount: 0, participant_count: 2, settled_count: 2, status: 'settled', due_date: null },
    ]);

    const { result } = renderHook(() => useHomeCards());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // First card should be active group, second settled bill
    expect(result.current.cards[0].id).toBe('active');
    expect(result.current.cards[1].id).toBe('settled');
  });

  it('falls back to an empty deck on API error with nothing cached', async () => {
    groupsService.list.mockRejectedValue(new Error('Server error'));
    billsService.list.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useHomeCards());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Server error');
    expect(result.current.cards).toEqual([]);
  });

  it('falls back to the offline cache on API error when groups are cached', async () => {
    groupsService.list.mockRejectedValue(new Error('Server error'));
    billsService.list.mockRejectedValue(new Error('Server error'));
    getCachedGroups.mockResolvedValue([
      { id: 'g1', name: 'Arisan Cache', status: 'active', amount_per_round: 100000 },
    ]);

    const { result } = renderHook(() => useHomeCards());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.cards).toHaveLength(1);
    expect(result.current.cards[0].id).toBe('g1');
  });
});
