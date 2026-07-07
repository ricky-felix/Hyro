import { useState, useEffect } from 'react';
import { paymentMethodsService } from '../../../../services/paymentMethods.service';
import { BankIcon, QRCodeIcon, Wallet } from '../icons';
import { TYPE_LABELS, TYPE_CATEGORY } from './data';
import '../../.././../styles/app-v2.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns initials (up to 2 chars, uppercase) from a display name.
 * e.g. "Ari Nugraha" → "AN", "Budi" → "B"
 */
function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

/**
 * Formats a Rupiah amount integer for display.
 * e.g. 200000 → "Rp 200.000", "200000" (string) → "Rp 200.000"
 * Passes through if already a formatted string (contains "Rp").
 */
function formatRupiah(amount) {
  if (typeof amount === 'string' && amount.includes('Rp')) return amount;
  const n = Number(amount);
  if (isNaN(n)) return String(amount);
  return 'Rp ' + n.toLocaleString('id-ID');
}

/**
 * Returns the human-readable type group label for a method type.
 * e.g. "gopay" → "E-Wallet", "bank_bca" → "Bank", "qris" → "QRIS"
 */
function typeGroupLabel(type) {
  if (!type) return '';
  const cat = TYPE_CATEGORY[type];
  if (cat === 'ewallet') return 'E-Wallet';
  if (type === 'qris') return 'QRIS';
  // bank types use the TYPE_LABELS map for the provider name; the category is "bank"
  if (cat === 'bank' || type === 'bank') return 'Bank';
  // fallback: capitalize
  return type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Returns the CSS modifier class for the method icon tile.
 * Ewallet types use the default lavender swatch; bank = blue; qris = pink.
 */
function iconModClass(type) {
  if (!type) return '';
  if (type === 'qris') return 'qris';
  const cat = TYPE_CATEGORY[type];
  if (cat === 'bank' || type === 'bank') return 'bank';
  return ''; // ewallet — default lavender
}

/**
 * Returns the correct icon component for a given method type.
 * Ewallet → Wallet, bank → BankIcon, qris → QRCodeIcon.
 */
function MethodTypeIcon({ type, size = 18 }) {
  if (type === 'qris') return <QRCodeIcon size={size} strokeWidth={2} />;
  const cat = TYPE_CATEGORY[type];
  if (cat === 'bank' || type === 'bank') return <BankIcon size={size} strokeWidth={2} />;
  // default: e-wallet
  return <Wallet size={size} strokeWidth={2} />;
}

/**
 * Splits a masked number string (e.g. "••••7890") into the dot prefix and
 * last-4. The API always returns the dots portion as bullet chars, but we
 * normalise here so any prefix works.
 *
 * Returns { dots: string, last4: string }.
 */
function splitMasked(value = '') {
  if (!value) return { dots: '', last4: '' };
  // The last 4 chars are always the visible digits
  const last4 = value.slice(-4);
  // Everything before is the mask prefix (could be "••••" or "•••• ")
  const dots = value.slice(0, -4);
  return { dots, last4 };
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * MaskedNumber — renders the two-part masked number display (dots + last-4).
 * Wraps with an aria-label so screen readers say "Nomor berakhiran 7890"
 * instead of reading raw bullet characters.
 *
 * Props:
 *   value  {string} – masked string from API, e.g. "••••7890"
 */
function MaskedNumber({ value }) {
  const { dots, last4 } = splitMasked(value);
  if (!last4) return null;

  return (
    <div
      className="pms-masked-number"
      aria-label={`Nomor berakhiran ${last4}`}
    >
      {dots && (
        <span className="pms-mask-dots" aria-hidden="true">
          {/* Render spaced bullets for cross-platform visual consistency */}
          •&nbsp;•&nbsp;•&nbsp;•
        </span>
      )}
      <span className="pms-mask-last4">{last4}</span>
    </div>
  );
}

/**
 * QrisThumbnail — thumbnail block shown inside a QRIS method card when
 * qris_image_path is present. Falls back to a QR icon placeholder.
 */
function QrisThumbnail({ imagePath }) {
  return (
    <div className="pms-qris-thumb-row">
      <div className="pms-qris-thumb">
        {imagePath ? (
          <img src={imagePath} alt="Gambar QRIS" />
        ) : (
          <QRCodeIcon size={22} strokeWidth={1.8} />
        )}
      </div>
      <div className="pms-qris-thumb-info">
        <div className="pms-qris-thumb-label">Scan QR untuk transfer</div>
        <div className="pms-qris-thumb-hint">Gambar asli — bukan dari Hyro</div>
      </div>
    </div>
  );
}

/**
 * MethodCard (selector variant) — a single selectable method card in the sheet.
 *
 * Props:
 *   method      {Object}   – payment method object (masked, from peer API)
 *   isSelected  {boolean}
 *   onSelect    {Function} – called when the card is clicked
 */
function PeerMethodCard({ method, isSelected, onSelect }) {
  const {
    type,
    label,
    is_primary,
    account_number,  // bank — already masked by backend: "••••7890"
    phone,           // ewallet — already masked: "••••6789"
    holder_name,
    qris_image_path,
  } = method;

  const maskedValue = account_number || phone || null;
  const typeLabel   = typeGroupLabel(type);
  const displayName = TYPE_LABELS[type] ?? label;
  // For the label row show the user's custom label; for type show typeLabel
  const isQris = type === 'qris';

  return (
    <div
      className={`pms-card${isSelected ? ' selected' : ''}`}
      onClick={onSelect}
      role="radio"
      aria-checked={isSelected}
      aria-label={`${label}${is_primary ? ', metode utama' : ''}`}
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
    >
      {/* Selection radio */}
      <div className="pms-radio" aria-hidden="true" />

      {/* Type icon tile */}
      <div className={`pms-icon ${iconModClass(type)}`} aria-hidden="true">
        <MethodTypeIcon type={type} size={18} />
      </div>

      {/* Info body */}
      <div className="pms-body">
        {/* Label row: type-chip + label text + primary badge */}
        <div className="pms-label-row">
          <span className="pms-type-chip">{typeLabel}</span>
          <span>{label}</span>
          {is_primary && (
            <span className="pms-primary-badge">
              {/* Star glyph */}
              <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Utama
            </span>
          )}
        </div>

        {/* Masked number OR QRIS thumbnail */}
        {isQris ? (
          /* QRIS: show thumbnail row if image path is available; always show the block */
          <QrisThumbnail imagePath={qris_image_path} />
        ) : (
          maskedValue && <MaskedNumber value={maskedValue} />
        )}

        {/* Holder name — shown in full for bank-transfer confirmation */}
        {holder_name && !isQris && (
          <div className="pms-holder">{holder_name}</div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * PaymentMethodSelector — bottom sheet (mobile) / centered modal (desktop) that
 * lets the payer pick which of the PAYEE's saved payment methods to transfer into.
 *
 * Renders 3 states:
 *   1. Loading  — skeleton pulse
 *   2. Populated — radio-card list, privacy note, Lanjutkan / Batal actions
 *   3. Empty    — payee has no methods; single "Tutup" button
 *
 * Props:
 *   payeeUserId   {string}    – userId of the person being paid; used to fetch their masked methods.
 *   payeeName     {string}    – display name of the payee (shown in avatar + identity row).
 *   contextLabel  {string}    – context line under the payee name, e.g. "Makan Bali 2026 · Penerima".
 *   amount        {number|string} – amount the payer owes; formatted as Rupiah in the chip.
 *   onContinue    {Function}  – called with the selectedMethod object when "Lanjutkan" is pressed.
 *                               The caller is responsible for navigating to BuktiTransfer.
 *   onCancel      {Function}  – called when "Batal" or "Tutup" is pressed.
 */
export default function PaymentMethodSelector({
  payeeUserId,
  payeeName,
  contextLabel,
  amount,
  onContinue,
  onCancel,
}) {
  const [methods,  setMethods]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState(null);  // method object or null

  // ── Fetch payee's methods on mount ────────────────────────────────────────
  useEffect(() => {
    if (!payeeUserId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    paymentMethodsService.listForUser(payeeUserId)
      .then(list => {
        if (cancelled) return;
        const arr = Array.isArray(list) ? list : [];
        setMethods(arr);
        // Auto-select the primary method (or the first one if no primary set).
        const primary = arr.find(m => m.is_primary) ?? arr[0] ?? null;
        setSelected(primary);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[PaymentMethodSelector] listForUser failed:', err?.message ?? err);
        setMethods([]);
        setSelected(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [payeeUserId]);

  // ── Backdrop click closes the sheet ──────────────────────────────────────
  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onCancel();
  }

  const payeeInitials = initials(payeeName);
  const formattedAmount = formatRupiah(amount);
  const isEmpty = !loading && methods.length === 0;

  return (
    <div
      className="v2-sheet-backdrop v2-payment-selector"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pms-title"
    >
      <div className="pms-sheet">
        {/* Grab handle (mobile drag hint) */}
        <div className="pms-grabber" aria-hidden="true" />

        {/* Sheet header */}
        <div className="pms-header">
          <div id="pms-title" className="pms-title">
            Pilih Metode Pembayaran
          </div>
          <p className="pms-sub">
            {isEmpty
              ? 'Rekening penerima.'
              : 'Rekening penerima. Pilih satu lalu transfer secara langsung.'}
          </p>
        </div>

        {/* Payee identity row */}
        <div className="pms-payee-row">
          <div
            className="pms-payee-avatar"
            aria-hidden="true"
          >
            {payeeInitials}
          </div>
          <div className="pms-payee-info">
            <div className="pms-payee-name">{payeeName}</div>
            {contextLabel && (
              <div className="pms-payee-sub">{contextLabel}</div>
            )}
          </div>
          <div className="pms-amount-chip" aria-label={`Jumlah: ${formattedAmount}`}>
            {formattedAmount}
          </div>
        </div>

        {/* ── Body — loading / empty / methods ────────────────────────── */}
        {loading ? (
          /* Skeleton */
          <div
            className="pms-scroll"
            aria-label="Memuat metode pembayaran…"
            aria-busy="true"
          >
            <div className="pms-skeleton">
              <div className="pms-skeleton-card" />
              <div className="pms-skeleton-card" />
            </div>
          </div>
        ) : isEmpty ? (
          /* Empty state — payee has no saved methods */
          <div className="pms-scroll">
            <div className="pms-empty" role="status">
              <div className="pms-empty-icon" aria-hidden="true">
                {/* Credit-card icon */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
              </div>
              <div className="pms-empty-title">Belum ada metode pembayaran</div>
              <p className="pms-empty-desc">
                {payeeName} belum menambahkan metode pembayaran. Hubungi langsung untuk mendapatkan detail rekening.
              </p>
            </div>
          </div>
        ) : (
          /* Populated — radio card list + privacy note */
          <div
            className="pms-scroll"
            role="radiogroup"
            aria-label="Pilih metode pembayaran penerima"
          >
            <div className="pms-methods-list">
              {methods.map(method => (
                <PeerMethodCard
                  key={method.id}
                  method={method}
                  isSelected={selected?.id === method.id}
                  onSelect={() => setSelected(method)}
                />
              ))}
            </div>

            {/* Privacy compliance note (spec §9 — mandatory copy) */}
            <div className="pms-privacy-note" role="note">
              <svg
                className="pms-privacy-icon"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <p className="pms-privacy-text">
                Nomor rekening ditampilkan sebagian (4 digit terakhir) demi privasi. Detail lengkap hanya terlihat oleh pemilik.
              </p>
            </div>
          </div>
        )}

        {/* ── Action bar ──────────────────────────────────────────────── */}
        <div className="pms-actions">
          {isEmpty ? (
            /* Empty state: single close button */
            <button
              type="button"
              className="pms-btn-close"
              onClick={onCancel}
            >
              Tutup
            </button>
          ) : (
            <>
              <button
                type="button"
                className="pms-btn-primary"
                disabled={loading || !selected}
                onClick={() => selected && onContinue(selected)}
              >
                Lanjutkan ke Upload Bukti
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <button
                type="button"
                className="pms-btn-secondary"
                onClick={onCancel}
              >
                Batal
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
