import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../../../styles/app-v2.css";
import { useToast } from "../../../context/ToastContext";
import { usersService } from "../../../services";
import { Check, ChevronDown } from "../../../components/application/v2/icons";
import ScreenHeader from "../../../components/application/v2/ScreenHeader";

const BANKS = [
  "BCA", "BNI", "BRI", "Mandiri", "CIMB Niaga", "Danamon",
  "Permata", "BTN", "Maybank", "OCBC NISP", "Bank Jago",
  "Jenius (BTPN)", "GoPay", "OVO", "DANA", "ShopeePay",
];

export default function RekeningPayout() {
  const navigate = useNavigate();
  const toast = useToast();

  const [bank, setBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);

  // Tracks whether the user already has a saved account (enables delete button)
  const [hasExisting, setHasExisting] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(true);

  // ── Load existing bank account on mount ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadAccount() {
      setLoadingAccount(true);
      try {
        // GET /users/me/bank-account → account object or null
        const account = await usersService.getBankAccount();
        if (cancelled) return;
        if (account) {
          setHasExisting(true);
          setBank(account.bank ?? "");
          setAccountNumber(account.account_number ?? "");
          setHolderName(account.holder_name ?? "");
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[RekeningPayout] failed to load bank account:', err.message);
        // Non-fatal — form stays empty, user can fill in from scratch.
      } finally {
        if (!cancelled) setLoadingAccount(false);
      }
    }

    loadAccount();
    return () => { cancelled = true; };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!bank) { toast("Pilih bank atau dompet digital terlebih dahulu", "error"); return; }
    if (!accountNumber.trim()) { toast("Nomor rekening tidak boleh kosong", "error"); return; }
    if (!holderName.trim()) { toast("Nama pemilik rekening tidak boleh kosong", "error"); return; }

    setSaving(true);
    try {
      // PUT /users/me/bank-account { bank, account_number, holder_name }
      await usersService.saveBankAccount({
        bank,
        account_number: accountNumber.trim(),
        holder_name: holderName.trim(),
      });
      setHasExisting(true);
      toast("Rekening berhasil disimpan ✓");
      navigate("/app/profil");
    } catch (err) {
      console.error('[RekeningPayout] saveBankAccount failed:', err.message);
      toast("Gagal menyimpan rekening: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!hasExisting) return;
    if (!window.confirm("Hapus rekening yang tersimpan?")) return;

    setDeleting(true);
    try {
      // DELETE /users/me/bank-account
      await usersService.deleteBankAccount();
      setHasExisting(false);
      setBank("");
      setAccountNumber("");
      setHolderName("");
      toast("Rekening berhasil dihapus");
    } catch (err) {
      console.error('[RekeningPayout] deleteBankAccount failed:', err.message);
      toast("Gagal menghapus rekening: " + err.message, "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="v2-screen">
      <div className="v2-inner" style={{ overflowY: "auto" }}>

        {/* ── Sticky header ── */}
        <ScreenHeader title="Rekening & Pencairan" onBack={() => navigate("/app/profil")}>
          {/* Loading skeleton in header */}
          {loadingAccount ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-primary" aria-hidden="true" />
          ) : (
            <button
              type="submit"
              form="rekening-form"
              disabled={saving || deleting}
              className="flex h-9 items-center gap-1.5 rounded-[11px] bg-brand-primary px-4 text-[13px] font-bold text-white transition-colors hover:bg-brand-primary-hover disabled:opacity-50"
            >
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Check size={14} strokeWidth={2.5} />
              )}
              Simpan
            </button>
          )}
        </ScreenHeader>

        {/* ── Content column ── */}
        <div className="mx-auto w-full max-w-[480px] px-5 py-6 lg:max-w-[600px] lg:px-6">

          {/* Info banner */}
          <div className="mb-5 rounded-[14px] bg-brand-primary-soft px-4 py-3.5">
            <p className="text-[12px] font-semibold leading-relaxed text-brand-primary-hover">
              {hasExisting
                ? "Rekening tersimpan — kamu bisa memperbarui atau menghapusnya di bawah."
                : "Rekening ini jadi tujuan transfer anggota saat kamu menerima giliran arisan."}
            </p>
          </div>

          {/* Form card */}
          <form id="rekening-form" onSubmit={handleSave}>
            <div className="overflow-hidden rounded-card bg-surface shadow-card">

              {/* Bank picker */}
              <div className="px-4 py-4">
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                  Bank / Dompet Digital
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowBankPicker((v) => !v)}
                    aria-haspopup="listbox"
                    aria-expanded={showBankPicker}
                    className="v2-input flex items-center justify-between text-left"
                    style={{ display: "flex" }}
                  >
                    <span className={bank ? "text-ink-1 font-medium" : "text-ink-3 font-normal"}>
                      {bank || "Pilih bank atau dompet"}
                    </span>
                    <ChevronDown
                      size={15}
                      strokeWidth={2.5}
                      className={`shrink-0 text-ink-3 transition-transform duration-200 ${showBankPicker ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showBankPicker && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setShowBankPicker(false)}
                      />
                      <div
                        role="listbox"
                        aria-label="Pilih bank"
                        className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-56 overflow-y-auto rounded-[14px] bg-surface shadow-[0_8px_32px_rgba(0,0,0,0.14)] border border-line-soft"
                      >
                        {BANKS.map((b) => (
                          <button
                            key={b}
                            type="button"
                            role="option"
                            aria-selected={bank === b}
                            onClick={() => { setBank(b); setShowBankPicker(false); }}
                            className={`flex w-full items-center px-4 py-3 text-left text-[14px] font-medium transition-colors hover:bg-gray-soft ${bank === b ? "font-bold text-brand-primary-hover" : "text-ink-1"}`}
                          >
                            {b}
                            {bank === b && <Check size={14} strokeWidth={2.5} className="ml-auto text-brand-primary" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="h-px bg-line-soft" />

              {/* Account number */}
              <div className="px-4 py-4">
                <label htmlFor="account-number" className="mb-2 block text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                  Nomor Rekening / Akun
                </label>
                <input
                  id="account-number"
                  type="text"
                  inputMode="numeric"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="0123456789"
                  maxLength={20}
                  autoComplete="off"
                  className="v2-input"
                />
              </div>

              <div className="h-px bg-line-soft" />

              {/* Holder name */}
              <div className="px-4 py-4">
                <label htmlFor="holder-name" className="mb-2 block text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                  Nama Pemilik Rekening
                </label>
                <input
                  id="holder-name"
                  type="text"
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  placeholder="Sesuai buku tabungan / aplikasi"
                  maxLength={60}
                  autoComplete="name"
                  className="v2-input"
                />
              </div>

            </div>
          </form>

          {/* Delete button — only shown when a saved account exists */}
          {hasExisting && (
            <button
              type="button"
              disabled={deleting || saving}
              onClick={handleDelete}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-[14px] border border-[var(--color-danger,#ef4444)] px-4 py-3 text-[13px] font-bold text-[var(--color-danger,#ef4444)] transition-colors hover:bg-[var(--color-danger-soft,#fee2e2)] disabled:opacity-50"
            >
              {deleting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
              ) : null}
              Hapus Rekening Tersimpan
            </button>
          )}

          <p className="mt-5 text-center text-[11px] font-medium leading-relaxed text-ink-3">
            Data rekening disimpan secara terenkripsi dan hanya ditampilkan ke anggota grupmu sebagai tujuan transfer. Hyro tidak menyimpan atau menyalurkan dana.
          </p>

        </div>
      </div>
    </div>
  );
}
