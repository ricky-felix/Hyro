import { useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../../../styles/app-v2.css";
import { useToast } from "../../../context/ToastContext";
import { useSettlement } from "../../../hooks/useSettlement";
import { useUpload } from "../../../hooks/useUpload";
import { Share } from "../../../components/application/v2/icons";
import ScreenHeader from "../../../components/application/v2/ScreenHeader";
import { getBuktiVariant } from "../../../components/application/v2/bukti/variants";
import ReceiptCard from "../../../components/application/v2/bukti/ReceiptCard";
import ReceiptActions from "../../../components/application/v2/bukti/ReceiptActions";

export default function BuktiTransfer() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const toast = useToast();

  // Variant: ?type=arisan → emerald/arisan, default → lavender/patungan
  const isArisan = params.get("type") === "arisan";

  // Optional context IDs passed via query string from the previous screen:
  //   ?roundId=<id>  (arisan)   or  ?billId=<id>&fromUserId=<id>&toUserId=<id>&amount=<n>  (patungan)
  // When absent the submit call is a no-op (no backend call), consistent with
  // the current UX where the receipt is shown as a static confirmation.
  const roundId    = params.get("roundId")    ?? null;
  const billId     = params.get("billId")     ?? null;
  const fromUserId = params.get("fromUserId") ?? null;
  const toUserId   = params.get("toUserId")   ?? null;
  const amountParam = params.get("amount")    ?? null;

  // ── Selected payment method — passed from PaymentMethodSelector (Phase 3) ──
  // When present, the "Ke Rekening" row renders in the receipt card.
  // methodMasked is the backend-masked value: "••••7890"
  const methodLabel  = params.get("methodLabel")  ?? null;
  const methodMasked = params.get("methodMasked") ?? null;
  const methodHolder = params.get("methodHolder") ?? null;
  // Build the rowMethod object only when the selector was used.
  const rowMethod = methodLabel
    ? { label: methodLabel, masked: methodMasked ?? '', holder: methodHolder }
    : null;

  // Reference number — randomly generated per receipt. Lazy-initialized so it
  // stays stable across re-renders. Prefix encodes the product domain:
  // ADA = Hyro Arisan, ADP = Hyro Patungan.
  const [refNo] = useState(
    () => `TRX-${isArisan ? "ADA" : "ADP"}-${crypto.randomUUID().split("-")[0].toUpperCase()}`,
  );

  // ── Upload state ─────────────────────────────────────────────────────────────
  const { upload, uploading: uploadingProof } = useUpload();
  const [proofPreview, setProofPreview] = useState(null);  // blob URL for local preview
  const [proofUrl, setProofUrl] = useState(null);          // read_url after upload
  const fileInputRef = useRef(null);

  // Settlement hook — wires the submit to the backend.
  const { submitting, submitArisan, submitPatungan } = useSettlement();

  // Copy the reference number to the clipboard with a confirmation toast.
  const copyRef = async () => {
    try {
      await navigator.clipboard.writeText(refNo);
      toast("No. referensi disalin");
    } catch {
      toast("Gagal menyalin no. referensi");
    }
  };

  // ── Proof image picker ───────────────────────────────────────────────────────
  const handleProofPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofPreview(URL.createObjectURL(file));
    setProofUrl(null); // reset until upload completes

    try {
      // Upload to 'payment-proofs' bucket; returns { file_key, read_url }
      const result = await upload(file, { bucket: "payment-proofs" });
      if (!result) {
        toast("Gagal mengunggah bukti — coba lagi", "error");
        return;
      }
      setProofUrl(result.read_url);
      toast("Bukti transfer siap dilampirkan ✓");
    } catch (err) {
      console.error('[BuktiTransfer] proof upload failed:', err.message);
      toast("Gagal mengunggah bukti: " + err.message, "error");
    }
  };

  // ── "Bagikan Bukti" — submits the payment/settlement with the proof URL ──────
  async function handleShare() {
    if (isArisan && roundId && amountParam) {
      await submitArisan({
        roundId,
        amount: Number(amountParam),
        proofUrl: proofUrl ?? null,
      });
    } else if (!isArisan && billId && fromUserId && toUserId && amountParam) {
      await submitPatungan({
        billId,
        fromUserId,
        toUserId,
        amount: Number(amountParam),
        proofUrl: proofUrl ?? null,
      });
    }
    // Always show the share toast regardless of backend result (MVP UX continuity).
    toast("Bukti dikirim ke grup");
  }

  const {
    headerGradient,
    primaryBtnBg,
    primaryBtnShadow,
    secondaryBtnBg,
    secondaryBtnBorder,
    secondaryBtnColor,
    accentColor,
    amount,
    amountSub,
    rowKe,
    rowUntuk,
    rowLabel,
    rowJenis,
  } = getBuktiVariant(isArisan);

  const isBusy = submitting || uploadingProof;

  return (
    <div className="v2-screen">
      {/*
        v2-inner is intentionally NOT used here — this screen owns its own
        full-bleed scroll area with a centered 480px column.
      */}
      <div
        className={[
          "flex w-full min-h-svh flex-col items-center overflow-x-hidden overflow-y-auto",
          "bg-app-bg pb-30",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "lg:pb-12",
        ].join(" ")}
      >

        <ScreenHeader title="Bukti Transfer" onBack={() => navigate(-1)}>
          <button
            type="button"
            className="grid h-8.5 w-8.5 shrink-0 cursor-pointer place-items-center rounded-[10px] bg-gray-soft text-ink-1 transition-colors hover:bg-line"
            onClick={() => toast("Bukti transfer dibagikan")}
            aria-label="Bagikan bukti transfer"
          >
            <Share size={16} stroke="currentColor" strokeWidth={2} />
          </button>
        </ScreenHeader>

        {/* Receipt column */}
        <div className="flex w-full max-w-120 flex-col lg:mx-auto">

          <ReceiptCard
            headerGradient={headerGradient}
            amount={amount}
            amountSub={amountSub}
            rowKe={rowKe}
            rowUntuk={rowUntuk}
            rowLabel={rowLabel}
            rowJenis={rowJenis}
            refNo={refNo}
            onCopyRef={copyRef}
            accentColor={accentColor}
            rowMethod={rowMethod}
          />

          {/* ── Proof image attachment area ─────────────────────────────────── */}
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Pilih foto bukti transfer"
            onChange={handleProofPick}
          />

          <div className="mx-4 mt-3">
            {proofPreview ? (
              /* Preview of the attached proof image */
              <div className="relative overflow-hidden rounded-[14px] bg-surface shadow-[0_1px_4px_rgba(0,0,0,0.08)]">
                <img
                  src={proofPreview}
                  alt="Bukti transfer"
                  className="w-full max-h-48 object-cover"
                />
                {/* Upload in-progress overlay */}
                {uploadingProof && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
                    <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
                    <span className="text-[12px] font-bold text-white">Mengunggah…</span>
                  </div>
                )}
                {/* Checkmark when upload is done */}
                {!uploadingProof && proofUrl && (
                  <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                    <span className="h-3 w-3 rounded-full bg-emerald-400" />
                    Siap dikirim
                  </div>
                )}
                {/* Re-pick button */}
                {!uploadingProof && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-2.5 right-2.5 rounded-[10px] bg-black/50 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm transition-opacity hover:bg-black/70"
                  >
                    Ganti foto
                  </button>
                )}
              </div>
            ) : (
              /* Attach proof CTA */
              <button
                type="button"
                disabled={uploadingProof}
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-dashed border-line px-4 py-3.5 text-[13px] font-semibold text-ink-3 transition-colors hover:border-brand-primary hover:text-brand-primary disabled:opacity-50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Lampirkan foto bukti transfer (opsional)
              </button>
            )}
          </div>

          <ReceiptActions
            primaryBtnBg={primaryBtnBg}
            primaryBtnShadow={primaryBtnShadow}
            secondaryBtnBg={secondaryBtnBg}
            secondaryBtnBorder={secondaryBtnBorder}
            secondaryBtnColor={secondaryBtnColor}
            onShare={isBusy ? undefined : handleShare}
            onSave={() => toast("Tersimpan ke galeri")}
          />

          {/* Bottom spacer */}
          <div className="h-8" />

        </div>
      </div>
    </div>
  );
}
