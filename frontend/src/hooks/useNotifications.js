import { useState, useEffect, useCallback } from 'react';
import { notificationsService } from '../services';
import { config } from '../config';
import { getCachedNotifications } from '../offline/cache';
import { supabase } from '../lib/supabase';
import { isDemoMode } from '../lib/appMode';

/**
 * useNotifications — loads notifications + unread count from the API.
 * Exposes markRead / markAllRead actions that optimistically update local state.
 *
 * The API returns an array of notification objects. Shape (per backend):
 *   { id, type, title, body, metadata, is_read, created_at }
 *
 * Returns the raw API list so the Notifikasi screen can render its own
 * bubble layout, plus helpers it needs.
 */
export function useNotifications() {
  // Demo mode: Notifikasi renders its static mockup, so there's nothing to load.
  const demo = isDemoMode();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (demo) return undefined;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [list, countRes] = await Promise.all([
          notificationsService.list(),
          notificationsService.getUnreadCount(),
        ]);

        if (cancelled) return;
        setNotifications(Array.isArray(list) ? list : []);
        setUnreadCount(typeof countRes?.count === 'number' ? countRes.count : 0);
      } catch (err) {
        if (cancelled) return;
        console.error('[useNotifications] failed to load:', err.message);
        setError(err.message);

        if (config.offlineEnabled) {
          try {
            const { data } = await supabase.auth.getSession();
            const userId = data?.session?.user?.id;
            if (userId) {
              const cached = await getCachedNotifications(userId);
              if (!cancelled) {
                setNotifications(cached);
                setUnreadCount(cached.filter(n => !n.is_read).length);
              }
            }
          } catch (cacheErr) {
            console.error('[useNotifications] cache fallback failed:', cacheErr.message);
          }
        }
        // Otherwise keep empty arrays — the screen shows its empty/error state.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [demo]);

  const markRead = useCallback(async (id) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await notificationsService.markRead(id);
    } catch (err) {
      console.error('[useNotifications] markRead failed:', err.message);
      // Rollback would require re-fetching; tolerate the stale state for MVP.
    }
  }, []);

  const markAllRead = useCallback(async () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await notificationsService.markAllRead();
    } catch (err) {
      console.error('[useNotifications] markAllRead failed:', err.message);
    }
  }, []);

  return { notifications, unreadCount, loading, error, markRead, markAllRead };
}
