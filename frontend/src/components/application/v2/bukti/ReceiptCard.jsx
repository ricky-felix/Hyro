// ── ReceiptCard ──────────────────────────────────────────────────────────────
// The entire receipt paper card: gradient banner, perforated divider,
// detail rows, reference sub-card, and branded footer.
//
// Custom CSS returned to caller (applied via flat class names):
//   .bukti-perforate-line  – repeating dashed gradient (cannot be expressed in Tailwind)
//   .bukti-hole-l / .bukti-hole-r – half-bleed circles via negative margin
//   .bukti-footer-logo-gradient – diagonal gradient on the mini logo
//
// Props:
//   headerGradient {string} – CSS gradient string for the banner background.
//   amount         {string} – Formatted amount string, e.g. "Rp 200.000".
//   amountSub      {string} – Subtitle shown under the amount in the hero area.
//   rowKe          {string} – "Ke" row value; may contain "\n" for line breaks.
//   rowUntuk       {string} – "Untuk" row value; may contain "\n" for line breaks.
//   rowLabel       {string} – Label for the amount row ("Jumlah" or "Bagianmu").
//   rowJenis       {string} – Jenis value in the reference sub-card.
//   refNo          {string} – Reference/transaction number in the sub-card.
//   onCopyRef      {function} – Click handler to copy refNo to the clipboard.
//   accentColor    {string} – CSS color for accented values (amount, method, ref).
//   rowMethod      {Object|null} – Optional. When present, renders a "Ke Rekening"
//                    row showing the method selected in PaymentMethodSelector.
//                    Shape: { label: string, masked: string, holder?: string }
//                    where `masked` is the API value "••••7890".
//                    Example: { label: "BCA Utama", masked: "••••7890", holder: "Ari Nugraha" }

import { Check, Copy } from "../icons";
import DetailRow from "./DetailRow";

// Splits a string on "\n" and injects <br /> between lines.
function MultiLine({ text }) {
  const lines = text.split("\n");
  return lines.map((line, i) => (
    <span key={i}>
      {line}
      {i < lines.length - 1 && <br />}
    </span>
  ));
}

export default function ReceiptCard({
  headerGradient,
  amount,
  amountSub,
  rowKe,
  rowUntuk,
  rowLabel,
  rowJenis,
  refNo,
  onCopyRef,
  accentColor,
  rowMethod = null,
}) {
  return (
    /* bukti-paper: mx-4 mt-4 rounded-[20px] surface bg, complex shadow, overflow-hidden */
    <div className="mx-4 mt-4 overflow-hidden rounded-[20px] bg-surface shadow-[0_4px_24px_rgba(17,24,39,.10),0_1px_4px_rgba(17,24,39,.06),0_0_0_1px_rgba(0,0,0,.04)]">

      {/* 2a. Gradient banner — bukti-banner: p-5 pb-[22px] relative overflow-hidden */}
      <div
        className="relative overflow-hidden px-5 pt-5 pb-5.5"
        style={{ background: headerGradient }}
      >
        {/* Decorative blobs — absolute circles, pointer-events-none */}
        {/* bukti-blob-1: top:-30 right:-30 w-30 h-30 */}
        <div className="pointer-events-none absolute -top-7.5 -right-7.5 h-30 w-30 rounded-full bg-white/8" />
        {/* bukti-blob-2: bottom:-20 left:-20 w-22.5 h-22.5 bg-white/6 */}
        <div className="pointer-events-none absolute -bottom-5 -left-5 h-22.5 w-22.5 rounded-full bg-white/6" />

        {/* Brand row — bukti-brand-row: flex items-center gap-[9px] mb-[18px] relative z-1 */}
        <div className="relative z-1 mb-4.5 flex items-center gap-2.25">
          {/* bukti-logo: w-8 h-8 white tile so the multicolor mark stays legible on the gradient banner */}
          <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[9px] border-[1.5px] border-white/35 bg-white p-1">
            <img
              src="/Arisan-Digital-Logo-icon.png"
              alt="Hyro"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            {/* bukti-wordmark: text-[14px] font-extrabold text-white tracking-[-0.01em] */}
            <div className="text-[14px] font-extrabold tracking-[-0.01em] text-white">Hyro</div>
            {/* bukti-wordmark-sub: text-[9px] font-semibold text-white/65 tracking-[0.04em] uppercase */}
            <div className="text-[9px] font-semibold uppercase tracking-[0.04em] text-white/65">WebApp Arisan & Tagihan Modern, Transparan & Aman</div>
          </div>
          {/* bukti-type-chip: ml-auto rounded-full px-[10px] py-1 bg-white/20 border border-white/30 text-[9px] font-extrabold text-white tracking-[0.1em] uppercase backdrop-blur */}
          <div className="ml-auto rounded-full border border-white/30 bg-white/20 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-widest text-white backdrop-blur-xs">
            Bukti Transfer
          </div>
        </div>

        {/* 2b. Success hero — bukti-success-hero: flex flex-col items-center text-center relative z-1 */}
        <div className="relative z-1 flex flex-col items-center text-center">
          {/* bukti-check-ring: w-14 h-14 rounded-full bg-white/20 border-[2.5px] border-white/70 grid place-items-center mb-[10px] shadow-[0_0_0_8px_rgba(255,255,255,.08)] */}
          <div className="mb-2.5 grid h-14 w-14 place-items-center rounded-full border-[2.5px] border-white/70 bg-white/20 shadow-[0_0_0_8px_rgba(255,255,255,.08)]">
            <Check size={26} stroke="white" strokeWidth={3} />
          </div>
          {/* bukti-success-label: text-[13px] font-extrabold text-white/90 tracking-[0.02em] uppercase mb-1 */}
          <div className="mb-1 text-[13px] font-extrabold uppercase tracking-[0.02em] text-white/90">
            Pembayaran Berhasil
          </div>
          {/* bukti-success-amount: text-[32px] font-extrabold text-white tracking-[-0.04em] leading-none shadow text-shadow */}
          <div className="text-[32px] font-extrabold leading-none tracking-[-0.04em] text-white [text-shadow:0_2px_8px_rgba(0,0,0,.15)]">
            {amount}
          </div>
          {/* bukti-success-sub: text-[11px] text-white/70 font-semibold tracking-[0.01em] mt-1 */}
          <div className="mt-1 text-[11px] font-semibold tracking-[0.01em] text-white/70">
            {amountSub}
          </div>
        </div>
      </div>

      {/* 2c. Perforated ticket divider
          The holes bleed -9px outside the card left/right edges.
          The dashed line uses a repeating-linear-gradient.
          Both require custom CSS — flat classes applied here. */}
      <div className="relative flex items-center">
        <div className="bukti-hole-l" />
        <div className="bukti-perforate-line" />
        <div className="bukti-hole-r" />
      </div>

      {/* 2d. Detail rows — bukti-body: px-5 pt-4 */}
      <div className="px-5 pt-4">

        <DetailRow label="Dari">
          Ricky Felix
        </DetailRow>

        <DetailRow label="Ke">
          <MultiLine text={rowKe} />
        </DetailRow>

        <DetailRow label="Untuk">
          <MultiLine text={rowUntuk} />
        </DetailRow>

        {/* Large amount row — valueClass adds text-[18px] font-extrabold tracking-[-0.02em] */}
        <DetailRow
          label={rowLabel}
          valueClass="!text-[18px] !font-extrabold !tracking-[-0.02em]"
          valueStyle={{ color: accentColor }}
        >
          {amount}
        </DetailRow>

        {/*
          "Ke Rekening" row — shown when the payer selected a specific
          payment method via PaymentMethodSelector (Phase 3).
          Mirrors the design prototype Frame 4:
            label row  : method.label (e.g. "BCA Utama") in accent color
            number row : • • • • 7890 (split from masked "••••7890")
            holder row : a.n. Ari Nugraha (when holder_name present)
        */}
        {rowMethod && (
          <DetailRow label="Ke Rekening">
            <span style={{ color: accentColor }} className="block font-bold">
              {rowMethod.label}
            </span>
            {rowMethod.masked && (() => {
              const last4 = rowMethod.masked.slice(-4);
              return (
                <span
                  className="block text-[13px] font-semibold text-ink-1 mt-0.5"
                  style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '.02em' }}
                  aria-label={`Nomor berakhiran ${last4}`}
                >
                  <span className="text-ink-3" aria-hidden="true">•&nbsp;•&nbsp;•&nbsp;•&nbsp;</span>
                  <strong>{last4}</strong>
                </span>
              );
            })()}
            {rowMethod.holder && (
              <span className="block text-[11px] font-medium text-ink-3 mt-0.5">
                a.n. {rowMethod.holder}
              </span>
            )}
          </DetailRow>
        )}

        <DetailRow label="Tanggal">
          5 Jun 2026, 09:41 WIB
        </DetailRow>

        <DetailRow label="Metode" valueStyle={{ color: accentColor }}>
          GoPay
        </DetailRow>

        <DetailRow label="Status" last>
          {/* bukti-status-badge: inline-flex items-center gap-1 px-[10px] py-[3px] rounded-full bg-success-light text-success text-[10px] font-extrabold tracking-[0.06em] uppercase */}
          <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2.5 py-0.75 text-[10px] font-extrabold uppercase tracking-[0.06em] text-success">
            <Check size={9} stroke="currentColor" strokeWidth={3} />
            Berhasil
          </span>
        </DetailRow>

      </div>

      {/* 2e. Reference sub-card — bukti-meta-block: mx-5 mt-[10px] bg-line-soft rounded-[12px] p-3 px-[14px] grid grid-cols-2 gap-[8px_12px] */}
      <div className="mx-5 mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-line-soft px-3.5 py-3">
        <div>
          {/* bukti-meta-label: text-[9px] font-bold text-ink-3 uppercase tracking-[0.06em] mb-0.5 */}
          <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-ink-3">No. Referensi</div>
          {/* bukti-meta-val: text-[12px] font-bold text-ink-1 tracking-[-0.01em] —
              click to copy the reference number to the clipboard */}
          <button
            type="button"
            onClick={onCopyRef}
            aria-label="Salin no. referensi"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold tracking-[-0.01em] transition-opacity active:opacity-60"
            style={{ color: accentColor }}
          >
            {refNo}
            <Copy size={12} stroke="currentColor" strokeWidth={2} />
          </button>
        </div>
        <div>
          <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-ink-3">Jenis</div>
          <div className="text-[12px] font-bold tracking-[-0.01em] text-ink-1">{rowJenis}</div>
        </div>
      </div>

      {/* Branded footer — bukti-footer: px-5 pt-[14px] pb-[18px] flex items-center justify-center gap-1.5 */}
      <div className="flex items-center justify-center gap-1.5 px-5 pt-3.5 pb-4.5">
        {/* bukti-footer-logo: w-4 h-4 brand mark */}
        <img
          src="/Arisan-Digital-Logo-icon.png"
          alt="Hyro"
          className="h-4 w-4 object-contain"
        />
        {/* bukti-footer-text: text-[10px] text-ink-3 font-semibold tracking-[0.01em] */}
        <span className="text-[10px] font-semibold tracking-[0.01em] text-ink-3">
          Dibuat dengan Hyro
        </span>
      </div>

    </div>
  );
}
