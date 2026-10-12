import { useState, useEffect } from 'react';
import { groupsService, billsService } from '../services';
import { ARISAN_CARD, PATUNGAN_CARD, DOMPET_CARD } from '../components/application/v2/dompet/data';
import { isDemoMode } from '../lib/appMode';

// Real-mode starting point: the mockup cards' labels with every figure blanked,
// so a new or offline account never shows made-up totals.
function blankCard(card, desc) {
  return {
    ...card,
    desc,
    stats: card.stats.map(st => ({ ...st, val: '—', sub: '' })),
    due: { ...card.due, text: 'Belum ada jatuh tempo', amount: '—' },
  };
}
const EMPTY_ARISAN_CARD = blankCard(ARISAN_CARD, 'Belum ada grup arisan');
const EMPTY_PATUNGAN_CARD = blankCard(PATUNGAN_CARD, 'Belum ada tagihan patungan');
const EMPTY_DOMPET_CARD = blankCard(DOMPET_CARD, 'Belum ada iuran terkumpul');

/**
 * useDompet — fetches groups, bills and payment data to populate the Dompet screen.
 *
 * The Dompet screen (Wallet overview) has three accordion cards:
 *   1. Arisan card   — summarises all arisan groups
 *   2. Patungan card — summarises all bills
 *   3. Dompet Grup   — summarises collected pot totals
 *
 * Because the backend does not have a dedicated /plans or /subscriptions/me endpoint
 * (the task spec mentions these but they don't exist in the services layer), we derive
 * the summary from groupsService.list() and billsService.list().
 *
 * TODO(wave2-plans): once /plans and /subscriptions/me are added to the backend,
 * replace the derivation below with direct calls to those endpoints.
 *
 * Demo mode: the static ARISAN_CARD / PATUNGAN_CARD / DOMPET_CARD mockups.
 * Real mode: live data only — blank cards when empty or on error.
 */
export function useDompet() {
  const demo = isDemoMode();
  const [arisanCard, setArisanCard] = useState(demo ? ARISAN_CARD : EMPTY_ARISAN_CARD);
  const [patunganCard, setPatunganCard] = useState(demo ? PATUNGAN_CARD : EMPTY_PATUNGAN_CARD);
  const [dompetCard, setDompetCard] = useState(demo ? DOMPET_CARD : EMPTY_DOMPET_CARD);
  // Detailed rows for each accordion panel
  const [arisanRows, setArisanRows] = useState([]);
  const [patunganRows, setPatunganRows] = useState([]);
  const [dompetRows, setDompetRows] = useState([]);
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

        const groupList = Array.isArray(groups) ? groups : [];
        const billList = Array.isArray(bills) ? bills : [];

        // ── Arisan card summary ──────────────────────────────────────────────
        const activeGroups = groupList.filter(g => g.status !== 'completed');
        const nextGroup = activeGroups[0] ?? null;
        const totalMonthly = activeGroups.reduce(
          (sum, g) => sum + (Number(g.contribution_amount) || 0), 0
        );

        const nextDueDate = nextGroup?.current_round?.due_date
          ? new Date(nextGroup.current_round.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
          : null;

        if (activeGroups.length > 0) {
          setArisanCard({
            ...ARISAN_CARD,
            desc: `${activeGroups.length} grup aktif · Rp ${totalMonthly.toLocaleString('id-ID')}/bln total iuran arisan`,
            stats: [
              { label: 'Grup Aktif', val: String(activeGroups.length), sub: 'grup bergabung' },
              {
                label: 'Arisan Berikutnya',
                val: nextGroup?.contribution_amount
                  ? `Rp ${Number(nextGroup.contribution_amount).toLocaleString('id-ID')}`
                  : '—',
                sub: nextGroup?.name ?? '—',
              },
            ],
            due: nextDueDate ? {
              text: `Jatuh tempo ${nextDueDate} · ${nextGroup.name}`,
              amount: `Rp ${Number(nextGroup.contribution_amount).toLocaleString('id-ID')}`,
            } : EMPTY_ARISAN_CARD.due,
          });

          // Rows for each arisan group
          setArisanRows(activeGroups.map(g => {
            const paidCount = g.current_round?.paid_count ?? 0;
            const totalM = g.member_count ?? g.max_members ?? 1;
            const fillWidth = totalM > 0 ? `${Math.round((paidCount / totalM) * 100)}%` : '0%';
            const due = g.current_round?.due_date
              ? new Date(g.current_round.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
              : null;
            return {
              id: g.id,
              name: g.name,
              meta: `${totalM} anggota · ${paidCount}/${totalM} bayar${g.current_round?.recipient_name ? ` · Giliran: ${g.current_round.recipient_name}` : ''}`,
              fillWidth,
              amount: `Rp ${Math.round((g.contribution_amount ?? 0) / 1000)}k`,
              badge: due ? { text: due, className: 'em' } : null,
            };
          }));
        }

        // ── Patungan card summary ────────────────────────────────────────────
        const openBills = billList.filter(b => b.status !== 'settled');
        const totalOwed = openBills.reduce(
          (sum, b) => sum + (Number(b.total_amount) || 0), 0
        );
        const urgentBill = openBills.find(b => {
          if (!b.due_date) return false;
          return new Date(b.due_date) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        }) ?? null;

        if (billList.length > 0) {
          setPatunganCard({
            ...PATUNGAN_CARD,
            desc: `${openBills.length} tagihan terbuka · Rp ${totalOwed.toLocaleString('id-ID')} belum masuk`,
            stats: [
              { label: 'Tagihan Open', val: String(openBills.length), sub: `dari ${billList.length} total` },
              { label: 'Belum Masuk', val: `Rp ${totalOwed.toLocaleString('id-ID')}`, sub: 'dari orang lain' },
            ],
            due: urgentBill ? {
              dotClass: 'orange',
              text: `${urgentBill.title} — ${(urgentBill.participant_count ?? 0) - (urgentBill.settled_count ?? 0)} orang belum bayar`,
              amount: `Rp ${Number(urgentBill.total_amount).toLocaleString('id-ID')}`,
            } : EMPTY_PATUNGAN_CARD.due,
          });

          setPatunganRows(billList.map(b => {
            const total = b.participant_count ?? 1;
            const settled = b.settled_count ?? 0;
            const pct = total > 0 ? Math.round((settled / total) * 100) : 0;
            const isSettled = b.status === 'settled';
            return {
              id: b.id,
              name: b.title,
              meta: `${total} orang · ${total - settled} belum bayar${b.due_date ? ` · Deadline ${new Date(b.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}` : ''}`,
              fillWidth: `${pct}%`,
              amount: `Rp ${Math.round((b.total_amount ?? 0) / 1000)}k`,
              badge: isSettled
                ? { text: 'Selesai', className: 'settled' }
                : { text: `${pct}%`, className: 'lv' },
              settled: isSettled,
            };
          }));
        }

        // ── Dompet Grup card summary ─────────────────────────────────────────
        // Pot = sum of confirmed payments across all active groups this round
        const potGroups = activeGroups.filter(g => g.current_round);
        if (potGroups.length > 0) {
          const totalPotCollected = potGroups.reduce((sum, g) => {
            const paidCount = g.current_round?.paid_count ?? 0;
            return sum + paidCount * (Number(g.contribution_amount) || 0);
          }, 0);
          const totalPotTarget = potGroups.reduce((sum, g) => {
            const totalM = g.member_count ?? g.max_members ?? 1;
            return sum + totalM * (Number(g.contribution_amount) || 0);
          }, 0);

          const firstGroup = potGroups[0];
          const paidC = firstGroup.current_round?.paid_count ?? 0;
          const totalM = firstGroup.member_count ?? firstGroup.max_members ?? 1;
          const disbursementDate = firstGroup.current_round?.due_date
            ? new Date(firstGroup.current_round.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
            : null;
          const recipientName = firstGroup.current_round?.recipient_name ?? null;

          setDompetCard({
            ...DOMPET_CARD,
            desc: `${potGroups.length} dompet aktif · akan dicairkan bulan ini`,
            stats: [
              { label: 'Total Saldo', val: `Rp ${Math.round(totalPotCollected / 1000000 * 10) / 10}jt`, sub: 'terkumpul' },
              { label: 'Akan Cair', val: disbursementDate ?? '—', sub: recipientName ? `ke ${recipientName}` : '—' },
            ],
            due: {
              dotClass: 'teal',
              text: `${firstGroup.name} — ${paidC}/${totalM} sudah setor`,
              amount: `Rp ${totalPotCollected.toLocaleString('id-ID')} / ${totalPotTarget.toLocaleString('id-ID')}`,
            },
          });

          setDompetRows(potGroups.map(g => {
            const paidCount = g.current_round?.paid_count ?? 0;
            const totalMem = g.member_count ?? g.max_members ?? 1;
            const collected = paidCount * (Number(g.contribution_amount) || 0);
            const target = totalMem * (Number(g.contribution_amount) || 0);
            const fillPct = totalMem > 0 ? Math.round((paidCount / totalMem) * 100) : 0;
            const dueD = g.current_round?.due_date
              ? new Date(g.current_round.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
              : null;
            const recip = g.current_round?.recipient_name ?? null;
            return {
              id: g.id,
              name: `Dompet ${g.name}`,
              meta: `Terkumpul Rp ${collected.toLocaleString('id-ID')} dari Rp ${target.toLocaleString('id-ID')}${dueD ? ` · Cair ${dueD}` : ''}${recip ? ` ke ${recip}` : ''}`,
              fillWidth: `${fillPct}%`,
              amount: `Rp ${Math.round(collected / 1000000 * 10) / 10}jt`,
              badge: { text: `${fillPct}%`, className: 'teal' },
            };
          }));
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[useDompet] failed to load:', err.message);
        setError(err.message);
        // Blank cards remain from useState initialization
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [demo]);

  return {
    arisanCard, patunganCard, dompetCard,
    arisanRows, patunganRows, dompetRows,
    loading, error,
  };
}
