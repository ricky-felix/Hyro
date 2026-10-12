import { useState, useEffect } from 'react';
import { groupsService, billsService } from '../services';
import { ALL_CARDS } from '../components/application/v2/home/data';
import { config } from '../config';
import { getCachedGroups } from '../offline/cache';
import { isDemoMode } from '../lib/appMode';

/**
 * Maps a backend group object to the card shape expected by HomeDeck / StoryCard.
 * Falls back to static defaults for any missing fields.
 */
function mapGroupToCard(group) {
  const isOverdue = group.current_round?.due_date
    ? new Date(group.current_round.due_date) < new Date()
    : false;

  const isSoon = !isOverdue && group.current_round?.due_date
    ? (new Date(group.current_round.due_date) - new Date()) < 3 * 24 * 60 * 60 * 1000
    : false;

  const status = isOverdue ? 'overdue' : isSoon ? 'soon' : 'upcoming';

  const paidCount = group.current_round?.paid_count ?? 0;
  const totalMembers = group.member_count ?? group.max_members ?? 1;
  const progress = totalMembers > 0 ? Math.round((paidCount / totalMembers) * 100) : 0;

  const dueDate = group.current_round?.due_date
    ? new Date(group.current_round.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    : null;

  const recipientName = group.current_round?.recipient_name ?? null;
  const roundNum = group.current_round?.round_number ?? 1;

  return {
    id: group.id,
    type: 'arisan',
    status,
    settled: group.status === 'completed',
    eyebrow: `Arisan · ${group.name}${recipientName ? ` · Giliran ${recipientName}` : ''}`,
    amount: group.contribution_amount
      ? `Rp ${Number(group.contribution_amount).toLocaleString('id-ID')}`
      : 'Rp 0',
    due: dueDate ? `Jatuh tempo ${dueDate}` : 'Belum ada jatuh tempo',
    progress,
    progressLabel: [
      `${paidCount}/${totalMembers} setor`,
      `Putaran ${roundNum}/${group.max_members ?? totalMembers}`,
    ],
    urgent: isOverdue ? `Telat` : isSoon ? `Segera` : null,
    badgeLabel: group.status === 'completed' ? 'Selesai' : 'Arisan',
    ctaLabel: group.status === 'completed' ? 'Kirim Bukti Transfer' : 'Bayar Sekarang',
    ctaType: group.status === 'completed' ? 'proof' : 'pay',
    ctaVariant: group.status === 'completed' ? 'em' : undefined,
    ctaHint: group.status === 'completed' ? 'ke Dompet Grup' : undefined,
    destName: `Dompet Grup ${group.name}`,
    destType: 'arisan',
    // keep group id for navigation
    groupId: group.id,
  };
}

/**
 * Maps a backend bill to the card shape expected by HomeDeck / StoryCard.
 */
function mapBillToCard(bill) {
  const totalParticipants = bill.participant_count ?? 1;
  const paidParticipants = bill.settled_count ?? 0;
  const progress = totalParticipants > 0
    ? Math.round((paidParticipants / totalParticipants) * 100)
    : 0;

  const unpaidCount = totalParticipants - paidParticipants;

  const isOverdue = bill.due_date ? new Date(bill.due_date) < new Date() : false;
  const isSoon = !isOverdue && bill.due_date
    ? (new Date(bill.due_date) - new Date()) < 3 * 24 * 60 * 60 * 1000
    : false;

  const status = isOverdue ? 'overdue' : isSoon ? 'soon' : 'upcoming';

  return {
    id: bill.id,
    type: 'patungan',
    status,
    settled: bill.status === 'settled',
    eyebrow: `Patungan · ${bill.title}${unpaidCount > 0 ? ` · ${unpaidCount} belum bayar` : ''}`,
    amount: bill.total_amount
      ? `Rp ${Number(bill.total_amount).toLocaleString('id-ID')}`
      : 'Rp 0',
    due: unpaidCount > 0
      ? `belum masuk dari ${unpaidCount} orang`
      : 'Semua sudah bayar',
    progress,
    progressLabel: [
      `${paidParticipants}/${totalParticipants} sudah bayar`,
      `${progress}% lunas`,
    ],
    urgent: isOverdue ? `Telat` : isSoon ? `Deadline segera` : null,
    badgeLabel: bill.status === 'settled' ? 'Selesai' : 'Patungan',
    ctaLabel: bill.status === 'settled'
      ? 'Kirim Bukti Transfer'
      : unpaidCount > 0
      ? `Ingatkan ${unpaidCount} Teman`
      : 'Tagih Sekarang',
    ctaType: bill.status === 'settled'
      ? 'proof'
      : unpaidCount > 0
      ? 'remind'
      : 'collect',
    ctaVariant: bill.status === 'settled' ? 'lv' : undefined,
    ctaHint: bill.status === 'settled' ? 'bagikan ke grup' : undefined,
    reminderCount: unpaidCount,
    destName: null,
    destType: 'patungan',
    billId: bill.id,
  };
}

/**
 * useHomeCards — loads groups + bills and maps them to HomeDeck card shape.
 *
 * Demo mode: the static ALL_CARDS mockup, no network.
 * Real mode: live data only. On failure, falls back to the offline cache,
 * then to an empty deck (HomeDeck shows its EmptyCard) — never mockups.
 */
export function useHomeCards() {
  const demo = isDemoMode();
  const [cards, setCards] = useState(demo ? ALL_CARDS : []);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (demo) return undefined;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [groups, bills] = await Promise.all([
          groupsService.list(),
          billsService.list(),
        ]);

        if (cancelled) return;

        const groupCards = (Array.isArray(groups) ? groups : []).map(mapGroupToCard);
        const billCards = (Array.isArray(bills) ? bills : []).map(mapBillToCard);

        // Merge: active/urgent items first, then settled
        const active = [...groupCards, ...billCards].filter(c => !c.settled);
        const settled = [...groupCards, ...billCards].filter(c => c.settled);
        const merged = [...active, ...settled];

        setCards(merged);
      } catch (err) {
        if (cancelled) return;
        console.error('[useHomeCards] failed to load:', err.message);
        setError(err.message);

        // Offline (or the request otherwise failed) — fall back to the local
        // cache before giving up to an empty deck.
        if (config.offlineEnabled) {
          try {
            const cachedGroups = await getCachedGroups();
            const groupCards = cachedGroups.map(mapGroupToCard);
            if (!cancelled && groupCards.length > 0) {
              setCards(groupCards);
              return;
            }
          } catch (cacheErr) {
            console.error('[useHomeCards] cache fallback failed:', cacheErr.message);
          }
        }

        if (!cancelled) setCards([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [demo]);

  return { cards, loading, error };
}
