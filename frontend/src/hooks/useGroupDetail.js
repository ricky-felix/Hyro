import { useState, useEffect } from 'react';
import { groupsService, groupMembersService, roundsService, paymentsService } from '../services';
import { GROUP, STATS, PROGRESS, RECIPIENT, GILIRAN } from '../components/application/v2/grup/data';
import { MEMBERS } from '../components/application/v2/members/data';
import { config } from '../config';
import { getCachedGroups, getCachedGroupDetail } from '../offline/cache';

/**
 * Maps a group member (backend) → the shape MemberStatusList / MembersOrbit expect.
 * Uses fallback color palette so avatars stay colourful without a profile picture.
 */
const FALLBACK_COLORS = [
  '#f59e0b', '#3b82f6', '#8b5cf6', '#f59e0b', '#ec4899',
  '#6366f1', '#ef4444', '#14b8a6', '#0891b2', '#d97706',
  '#7c3aed', '#dc2626',
];

function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name.slice(0, 2) || '??').toUpperCase();
}

function mapMember(m, idx, roundPayments = []) {
  const payment = roundPayments.find(
    p => p.member_id === m.id || p.user_id === m.user_id
  );
  const status = m.is_recipient
    ? 'giliran'
    : payment?.status === 'confirmed'
    ? 'paid'
    : 'unpaid';

  return {
    initials: initials(m.display_name ?? m.member_name ?? 'Anggota'),
    name: m.display_name ?? m.member_name ?? 'Anggota',
    status,
    statusText: status === 'giliran'
      ? 'Giliran bulan ini!'
      : status === 'paid'
      ? 'Sudah lunas'
      : 'Belum bayar',
    sub: status === 'paid'
      ? `Bayar via ${payment?.payment_method ?? 'Transfer'}`
      : status === 'giliran'
      ? `Penerima putaran ini`
      : 'Ingatkan?',
    color: FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
    // orbit animation parameters (static, visual only)
    giliran_order: m.giliran_order ?? idx + 1,
  };
}

/**
 * Builds the view-model this hook exposes from raw group/members/round/
 * payments data — shared by the live-API path and the offline-cache
 * fallback so both produce identical shapes.
 */
function deriveState(groupData, membersData, currentRound, roundPayments) {
  const mappedMembers = Array.isArray(membersData)
    ? membersData.map((m, i) => mapMember(m, i, Array.isArray(roundPayments) ? roundPayments : []))
    : MEMBERS;

  const totalMembers = mappedMembers.length;
  const paidMembers = mappedMembers.filter(m => m.status === 'paid' || m.status === 'giliran').length;
  const contributionAmount = groupData.contribution_amount ?? groupData.amount_per_round ?? 0;
  const totalPot = contributionAmount * totalMembers;
  const collected = contributionAmount * paidMembers;

  const recipientMember = mappedMembers.find(m => m.status === 'giliran');

  const dueDate = currentRound?.due_date ?? currentRound?.scheduled_date
    ? new Date(currentRound.due_date ?? currentRound.scheduled_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    : null;

  const roundNum = currentRound?.round_number ?? 1;

  const pct = totalMembers > 0 ? Math.round((paidMembers / totalMembers) * 100) : 0;
  const remaining = totalPot - collected;

  const sortedByOrder = [...mappedMembers].sort(
    (a, b) => (a.giliran_order ?? 99) - (b.giliran_order ?? 99)
  );

  return {
    group: {
      name: groupData.name,
      headerSub: `${totalMembers} anggota · Putaran ke-${roundNum} · Rp ${Number(contributionAmount).toLocaleString('id-ID')}/bln`,
      status: groupData.status === 'completed' ? 'Arisan Selesai' : 'Arisan Aktif',
      urgent: dueDate ? `Jatuh tempo ${dueDate}` : null,
      title: groupData.name,
      emoji: '🏡',
      collectedText: `Terkumpul Rp ${collected.toLocaleString('id-ID')} dari target Rp ${totalPot.toLocaleString('id-ID')}`,
      memberCount: totalMembers,
      payLabel: `Bayar Iuran Arisanku Rp ${Number(contributionAmount).toLocaleString('id-ID')}`,
      payAmount: `Rp ${Number(contributionAmount).toLocaleString('id-ID')}`,
    },
    stats: [
      { val: `${paidMembers}/${totalMembers}`, lbl: 'Sudah Bayar' },
      { val: `Rp ${Math.round(contributionAmount / 1000)}k`, lbl: 'Per Bulan' },
      { val: dueDate ?? '—', lbl: 'Jatuh Tempo' },
    ],
    progress: {
      label: 'Progres Iuran Bulan Ini',
      pct,
      left: `${paidMembers} dari ${totalMembers} anggota sudah bayar`,
      right: `Sisa Rp ${remaining.toLocaleString('id-ID')}`,
    },
    recipient: recipientMember ? {
      initials: recipientMember.initials,
      label: `Penerima Putaran ke-${roundNum}`,
      name: `${recipientMember.name} 🎉`,
      sub: `Menunggu semua bayar · ${totalMembers - paidMembers} belum lunas`,
    } : RECIPIENT,
    giliran: sortedByOrder.map((m, i) => ({
      n: i + 1,
      name: m.name,
      state: i + 1 < roundNum ? 'done' : i + 1 === roundNum ? 'current' : 'upcoming',
    })),
    members: mappedMembers,
  };
}

/** Reads group/members/rounds/payments from the local cache and derives the
 * same view-model as the live path. Returns null if nothing is cached yet. */
async function loadFromCache(groupId) {
  let targetId = groupId;
  if (!targetId) {
    const groups = await getCachedGroups();
    targetId = groups.length > 0 ? groups[0].id : null;
  }
  if (!targetId) return null;

  const { group, members, rounds, payments } = await getCachedGroupDetail(targetId);
  if (!group) return null;

  const currentRound = rounds.find(r => r.status === 'active') ?? rounds[rounds.length - 1] ?? null;
  const roundPayments = currentRound ? payments.filter(p => p.round_id === currentRound.id) : [];

  return deriveState(group, members, currentRound, roundPayments);
}

/**
 * useGroupDetail — fetches group metadata, members, current round, and payments.
 * Falls back to the offline cache, then static mock data, on error.
 *
 * @param {string|null} groupId – if null, uses the first group returned by the API.
 */
export function useGroupDetail(groupId = null) {
  const [group, setGroup] = useState(GROUP);
  const [stats, setStats] = useState(STATS);
  const [progress, setProgress] = useState(PROGRESS);
  const [recipient, setRecipient] = useState(RECIPIENT);
  const [giliran, setGiliran] = useState(GILIRAN);
  const [members, setMembers] = useState(MEMBERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    function applyState(derived) {
      if (cancelled) return;
      setGroup(derived.group);
      setStats(derived.stats);
      setProgress(derived.progress);
      setRecipient(derived.recipient);
      setGiliran(derived.giliran);
      setMembers(derived.members);
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        let targetId = groupId;

        if (!targetId) {
          // No group id in the route yet — pick the first group the user belongs to
          const groups = await groupsService.list();
          targetId = Array.isArray(groups) && groups.length > 0 ? groups[0].id : null;
        }

        if (!targetId) {
          // User has no groups yet — stay on static fallback
          if (!cancelled) setLoading(false);
          return;
        }

        const [groupData, membersData] = await Promise.all([
          groupsService.getById(targetId),
          groupMembersService.list(targetId),
        ]);

        if (cancelled) return;

        // Current round
        let currentRound = null;
        let roundPayments = [];
        try {
          currentRound = await roundsService.getCurrent(targetId);
          if (currentRound?.id) {
            roundPayments = await paymentsService.getForRound(currentRound.id);
          }
        } catch {
          // Round data is best-effort; fall through with nulls
        }

        applyState(deriveState(groupData, membersData, currentRound, roundPayments));
      } catch (err) {
        if (cancelled) return;
        console.error('[useGroupDetail] failed to load:', err.message);
        setError(err.message);

        if (config.offlineEnabled) {
          try {
            const derived = await loadFromCache(groupId);
            if (derived) {
              applyState(derived);
              return;
            }
          } catch (cacheErr) {
            console.error('[useGroupDetail] cache fallback failed:', cacheErr.message);
          }
        }
        // Otherwise keep the static fallback already set as initial state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [groupId]);

  return { group, stats, progress, recipient, giliran, members, loading, error };
}
