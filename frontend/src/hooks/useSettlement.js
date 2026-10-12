import { useState } from 'react';
import { billSettlementsService, paymentsService } from '../services';
import { config } from '../config';
import { supabase } from '../lib/supabase';
import { enqueueContribution } from '../offline/writes';

/**
 * useSettlement — wraps settlement / payment submission for BuktiTransfer.
 *
 * The BuktiTransfer screen handles two product domains:
 *   - arisan  → paymentsService.create({ round_id, amount, proof_url?, notes? })
 *   - patungan → billSettlementsService.create({ bill_id, amount, proof_url?, notes? })
 *
 * Wave-2: proof_url is now accepted as an optional parameter.
 * Upload the file first via useUpload, then pass the resulting read_url here.
 */
export function useSettlement() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  /**
   * submitArisan — records an arisan payment, optionally with a proof image URL.
   *
   * @param {Object} params
   * @param {string}  params.roundId   – the arisan round being paid
   * @param {number}  params.amount    – payment amount in Rupiah
   * @param {string}  [params.proofUrl] – public URL of the uploaded proof image (wave-2)
   * @param {string}  [params.notes]
   * @returns {Promise<Object|null>}
   */
  async function submitArisan({ roundId, amount, proofUrl = null, notes = '' }) {
    setSubmitting(true);
    setError(null);
    try {
      // Offline-first path: always queue through the outbox (even while
      // online) so the UI gets one consistent pending→synced→failed state
      // for every contribution, and a flaky connection never blocks the
      // user from recording "I paid" locally first.
      if (config.offlineEnabled) {
        const { data } = await supabase.auth.getSession();
        const payment = await enqueueContribution({
          userId: data?.session?.user?.id,
          roundId,
          amount,
          proofUrl,
          notes,
        });
        setSubmitted(true);
        return payment;
      }

      const payment = await paymentsService.create({
        round_id: roundId,
        amount: Math.round(amount),
        proof_url: proofUrl,
        notes,
      });
      setSubmitted(true);
      return payment;
    } catch (err) {
      console.error('[useSettlement] submitArisan failed:', err.message);
      setError(err.message);
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * submitPatungan — records a bill settlement, optionally with a proof image URL.
   *
   * @param {Object} params
   * @param {string}  params.billId      – the bill being settled
   * @param {string}  params.fromUserId  – payer user id
   * @param {string}  params.toUserId    – payee user id
   * @param {number}  params.amount      – amount being settled
   * @param {string}  [params.proofUrl]  – public URL of the uploaded proof image (wave-2)
   * @param {string}  [params.notes]
   * @returns {Promise<Object|null>}
   */
  async function submitPatungan({ billId, fromUserId, toUserId, amount, proofUrl = null, notes = '' }) {
    setSubmitting(true);
    setError(null);
    try {
      const settlement = await billSettlementsService.create({
        bill_id: billId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount: Math.round(amount),
        proof_url: proofUrl,
        notes,
      });
      setSubmitted(true);
      return settlement;
    } catch (err) {
      console.error('[useSettlement] submitPatungan failed:', err.message);
      setError(err.message);
      return null;
    } finally {
      setSubmitting(false);
    }
  }

  return { submitting, submitted, error, submitArisan, submitPatungan };
}
