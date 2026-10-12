import { useState, useEffect } from 'react';
import { contactsService, groupMembersService } from '../services';
import { MEMBERS, DANCE_PARAMS } from '../components/application/v2/members/data';
import { isDemoMode } from '../lib/appMode';

/**
 * useMembers — loads contacts / group members for MembersOrbit.
 *
 * Priority:
 *   1. If groupId is provided → fetch groupMembersService.list(groupId)
 *   2. Otherwise → fetch contactsService.list() (all contacts)
 *
 * Demo mode: the static MEMBERS mockup, no network.
 * Real mode: live data only — an empty list on error or when there's nobody.
 *
 * @param {string|null} groupId – optional; when provided fetches members of that group.
 */

const FALLBACK_COLORS = [
  '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899',
  '#6366f1', '#ef4444', '#14b8a6', '#0891b2',
  '#d97706', '#7c3aed', '#dc2626', '#10b981',
];

function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name.slice(0, 2) || '??').toUpperCase();
}

export function useMembers(groupId = null) {
  const demo = isDemoMode();
  const [members, setMembers] = useState(demo ? MEMBERS : []);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (demo) return undefined;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        let raw = [];
        if (groupId) {
          raw = await groupMembersService.list(groupId);
        } else {
          // Fall back to contacts — this gives "people I interact with"
          raw = await contactsService.list({ sort: 'recent', limit: 12 });
        }

        if (cancelled) return;
        if (!Array.isArray(raw) || raw.length === 0) {
          setMembers([]);
          return;
        }

        const mapped = raw.map((m, idx) => {
          const name = m.display_name ?? m.member_name ?? m.contact_user?.display_name ?? 'Anggota';
          return {
            initials: initials(name),
            name,
            status: m.payment_status === 'confirmed' ? 'paid' : m.is_recipient ? 'giliran' : 'unpaid',
            statusText: m.is_recipient
              ? 'Giliran bulan ini!'
              : m.payment_status === 'confirmed'
              ? 'Sudah lunas'
              : 'Belum bayar',
            sub: m.is_recipient
              ? 'Penerima putaran ini'
              : m.payment_status === 'confirmed'
              ? 'Sudah bayar'
              : 'Ingatkan?',
            color: FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
          };
        });

        setMembers(mapped);
      } catch (err) {
        if (cancelled) return;
        console.error('[useMembers] failed to load:', err.message);
        setError(err.message);
        setMembers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [groupId, demo]);

  // Always expose the DANCE_PARAMS so MembersOrbit can slice as needed
  return { members, danceParams: DANCE_PARAMS, loading, error };
}
