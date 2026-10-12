/**
 * useNotifications — unit tests
 *
 * Mocks notificationsService to control API responses.
 * Tests loading/success/error states and action methods.
 */

vi.mock('../services', () => ({
  notificationsService: {
    list: vi.fn(),
    getUnreadCount: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

vi.mock('../config', () => ({ config: { offlineEnabled: true } }));
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));
vi.mock('../offline/cache', () => ({
  getCachedNotifications: vi.fn(),
}));

import { renderHook, waitFor, act } from '@testing-library/react';
import { notificationsService } from '../services';
import { supabase } from '../lib/supabase';
import { getCachedNotifications } from '../offline/cache';
import { useNotifications } from './useNotifications';

const MOCK_NOTIFICATIONS = [
  { id: 'n1', title: 'Bayar Iuran', body: 'Jatuh tempo besok', is_read: false, created_at: '2026-06-07T00:00:00Z' },
  { id: 'n2', title: 'Iuran Dikonfirmasi', body: 'Pembayaran kamu diterima', is_read: true, created_at: '2026-06-06T00:00:00Z' },
];

beforeEach(() => {
  vi.clearAllMocks();
  notificationsService.list.mockResolvedValue(MOCK_NOTIFICATIONS);
  notificationsService.getUnreadCount.mockResolvedValue({ count: 1 });
  notificationsService.markRead.mockResolvedValue({ is_read: true });
  notificationsService.markAllRead.mockResolvedValue({ updated: 1 });
  supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  getCachedNotifications.mockResolvedValue([]);
});

describe('useNotifications', () => {
  it('starts in loading state', () => {
    const { result } = renderHook(() => useNotifications());
    expect(result.current.loading).toBe(true);
  });

  it('loads notifications and unread count on mount', async () => {
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.notifications).toEqual(MOCK_NOTIFICATIONS);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('handles non-array list response gracefully', async () => {
    notificationsService.list.mockResolvedValue(null);

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.notifications).toEqual([]);
  });

  it('handles missing count in getUnreadCount response', async () => {
    notificationsService.getUnreadCount.mockResolvedValue({ total: 5 }); // no .count key

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.unreadCount).toBe(0);
  });

  it('sets error state and keeps empty arrays on API failure', async () => {
    notificationsService.list.mockRejectedValue(new Error('Jaringan error'));
    notificationsService.getUnreadCount.mockRejectedValue(new Error('Jaringan error'));

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Jaringan error');
    expect(result.current.notifications).toEqual([]);
  });

  it('falls back to the offline cache on API failure when a session exists', async () => {
    notificationsService.list.mockRejectedValue(new Error('Jaringan error'));
    notificationsService.getUnreadCount.mockRejectedValue(new Error('Jaringan error'));
    supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    getCachedNotifications.mockResolvedValue([
      { id: 'n1', is_read: false },
      { id: 'n2', is_read: true },
    ]);

    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getCachedNotifications).toHaveBeenCalledWith('u1');
    expect(result.current.notifications).toHaveLength(2);
    expect(result.current.unreadCount).toBe(1);
  });

  describe('markRead()', () => {
    it('optimistically marks the notification as read', async () => {
      const { result } = renderHook(() => useNotifications());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.markRead('n1');
      });

      const updated = result.current.notifications.find(n => n.id === 'n1');
      expect(updated.is_read).toBe(true);
    });

    it('decrements unread count by 1', async () => {
      const { result } = renderHook(() => useNotifications());
      await waitFor(() => expect(result.current.loading).toBe(false));

      const before = result.current.unreadCount;

      await act(async () => {
        await result.current.markRead('n1');
      });

      expect(result.current.unreadCount).toBe(Math.max(0, before - 1));
    });

    it('calls notificationsService.markRead with the id', async () => {
      const { result } = renderHook(() => useNotifications());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.markRead('n1');
      });

      expect(notificationsService.markRead).toHaveBeenCalledWith('n1');
    });
  });

  describe('markAllRead()', () => {
    it('marks all notifications as read optimistically', async () => {
      const { result } = renderHook(() => useNotifications());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.markAllRead();
      });

      const allRead = result.current.notifications.every(n => n.is_read);
      expect(allRead).toBe(true);
    });

    it('resets unread count to 0', async () => {
      const { result } = renderHook(() => useNotifications());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.markAllRead();
      });

      expect(result.current.unreadCount).toBe(0);
    });

    it('calls notificationsService.markAllRead()', async () => {
      const { result } = renderHook(() => useNotifications());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.markAllRead();
      });

      expect(notificationsService.markAllRead).toHaveBeenCalledOnce();
    });
  });
});
