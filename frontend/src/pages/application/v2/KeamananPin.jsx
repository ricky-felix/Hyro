import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../../../styles/app-v2.css";
import { useToast } from "../../../context/ToastContext";
import { usersService } from "../../../services";
import { Lock } from "../../../components/application/v2/icons";
import ScreenHeader from "../../../components/application/v2/ScreenHeader";

// 6-digit PIN dot display component
function PinDots({ length = 6, filled = 0 }) {
  return (
    <div className="flex items-center justify-center gap-3" aria-hidden="true">
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={`h-3.5 w-3.5 rounded-full transition-all duration-150 ${
            i < filled
              ? "scale-110 bg-brand-primary shadow-[0_0_0_3px_var(--color-brand-primary-soft)]"
              : "bg-line"
          }`}
        />
      ))}
    </div>
  );
}

// Numeric keypad
function Keypad({ onDigit, onDelete }) {
  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];
  return (
    <div className="grid grid-cols-3 gap-3">
      {keys.map((k, i) => {
        if (k === "") return <div key={i} />;
        const isDelete = k === "⌫";
        return (
          <button
            key={i}
            type="button"
            aria-label={isDelete ? "Hapus" : k}
            onClick={() => isDelete ? onDelete() : onDigit(k)}
            className={`flex h-14 items-center justify-center rounded-[14px] text-[20px] font-bold transition-colors active:scale-95 ${
              isDelete
                ? "bg-gray-soft text-ink-2 hover:bg-line"
                : "bg-surface text-ink-1 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:bg-gray-soft"
            }`}
          >
            {k}
          </button>
        );
      })}
    </div>
  );
}

export default function KeamananPin() {
  const navigate = useNavigate();
  const toast = useToast();

  // Step machine: "set" → "confirm"
  const [step, setStep] = useState("set");      // "set" | "confirm"
  const [pin, setPin] = useState("");            // PIN being typed
  const [firstPin, setFirstPin] = useState("");  // stored after step 1
  const [shakeKey, setShakeKey] = useState(0);
  const PIN_LEN = 6;

  // Security state loaded from GET /users/me/security
  const [hasPin, setHasPin] = useState(false);
  const [appLock, setAppLock] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);

  // Announce step changes for screen readers
  const srRef = useRef(null);

  // ── Load security settings on mount ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadSecurity() {
      setLoadingSettings(true);
      try {
        const settings = await usersService.getSecurity();
        if (cancelled) return;
        setHasPin(!!settings.has_pin);
        setAppLock(!!settings.app_lock_enabled);
      } catch (err) {
        if (cancelled) return;
        console.error('[KeamananPin] failed to load security settings:', err.message);
        // Fall back to defaults — non-fatal; page still usable.
      } finally {
        if (!cancelled) setLoadingSettings(false);
      }
    }

    loadSecurity();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (srRef.current) {
      srRef.current.textContent =
        step === "set"
          ? "Masukkan PIN baru, 6 digit"
          : "Konfirmasi PIN kamu";
    }
  }, [step]);

  const handleDigit = (d) => {
    if (pin.length >= PIN_LEN) return;
    const next = pin + d;
    setPin(next);

    if (next.length === PIN_LEN) {
      // Small timeout so the last dot fills before reacting
      setTimeout(() => advance(next), 180);
    }
  };

  const handleDelete = () => setPin((p) => p.slice(0, -1));

  const advance = async (completed) => {
    if (step === "set") {
      setFirstPin(completed);
      setPin("");
      setStep("confirm");
    } else {
      // Confirm step — check the two PINs match before saving
      if (completed !== firstPin) {
        setShakeKey((k) => k + 1);
        setPin("");
        toast("PIN tidak cocok, coba lagi", "error");
        return;
      }

      setSaving(true);
      try {
        // PATCH /users/me/pin { pin: completed }
        await usersService.setPin(completed);
        setHasPin(true);
        toast("PIN berhasil disimpan ✓");
        navigate("/app/profil");
      } catch (err) {
        console.error('[KeamananPin] setPin failed:', err.message);
        setShakeKey((k) => k + 1);
        setPin("");
        setFirstPin("");
        setStep("set");
        toast("Gagal menyimpan PIN: " + err.message, "error");
      } finally {
        setSaving(false);
      }
    }
  };

  const toggleAppLock = async () => {
    const next = !appLock;
    setAppLock(next); // optimistic update
    setTogglingLock(true);
    try {
      // PATCH /users/me/security { app_lock_enabled: next }
      await usersService.updateSecurity({ app_lock_enabled: next });
      toast(next ? "Kunci Otomatis diaktifkan" : "Kunci Otomatis dinonaktifkan");
    } catch (err) {
      console.error('[KeamananPin] updateSecurity failed:', err.message);
      setAppLock(!next); // roll back
      toast("Gagal mengubah pengaturan kunci: " + err.message, "error");
    } finally {
      setTogglingLock(false);
    }
  };

  return (
    <div className="v2-screen">
      <div className="v2-inner" style={{ overflowY: "auto" }}>

        {/* ── Sticky header ── */}
        <ScreenHeader title="Keamanan & PIN" onBack={() => navigate("/app/profil")}>
          {/* Loading indicator while fetching security settings */}
          {loadingSettings && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand-primary" aria-hidden="true" />
          )}
        </ScreenHeader>

        {/* SR live region */}
        <span ref={srRef} className="sr-only" aria-live="polite" aria-atomic="true" />

        {/* ── Content column ── */}
        <div className="mx-auto flex w-full max-w-[480px] flex-col items-center px-5 py-8 lg:max-w-[520px] lg:px-6">

          {/* Icon + heading */}
          <div className="mb-7 flex flex-col items-center gap-3">
            <div className="grid h-16 w-16 place-items-center rounded-[20px] bg-brand-primary-soft text-brand-primary-hover">
              <Lock size={30} strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="text-[18px] font-extrabold tracking-[-0.02em] text-ink-1">
                {step === "set"
                  ? (hasPin ? "Ubah PIN" : "Buat PIN baru")
                  : "Konfirmasi PIN"}
              </p>
              <p className="mt-1 text-[13px] font-medium text-ink-3">
                {step === "set"
                  ? "Masukkan 6 digit PIN untuk mengamankan akunmu"
                  : "Masukkan ulang PIN yang sama untuk konfirmasi"}
              </p>
            </div>
          </div>

          {/* PIN dots — animated shake on mismatch via key change */}
          <div
            key={shakeKey}
            className="mb-10"
            style={
              shakeKey > 0
                ? { animation: "v2PinShake .4s ease" }
                : undefined
            }
          >
            <PinDots length={PIN_LEN} filled={pin.length} />
          </div>

          {/* Keypad — disabled while saving */}
          <div className="w-full max-w-[280px]" style={{ opacity: saving ? 0.5 : 1, pointerEvents: saving ? "none" : undefined }}>
            <Keypad onDigit={handleDigit} onDelete={handleDelete} />
          </div>

          {/* Saving spinner */}
          {saving && (
            <p className="mt-4 flex items-center gap-2 text-[13px] font-semibold text-brand-primary">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-primary/30 border-t-brand-primary" />
              Menyimpan PIN…
            </p>
          )}

          {/* Reset link */}
          {step === "confirm" && !saving && (
            <button
              type="button"
              onClick={() => { setStep("set"); setPin(""); setFirstPin(""); }}
              className="mt-6 text-[12px] font-semibold text-ink-3 underline underline-offset-2 hover:text-ink-2"
            >
              Mulai ulang
            </button>
          )}

          {/* App lock toggle */}
          <div className="mt-10 w-full overflow-hidden rounded-card bg-surface shadow-card">
            <div className="flex min-h-14 items-center gap-3.5 px-4 py-3">
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-ink-1">Kunci Otomatis</p>
                <p className="mt-0.5 text-[11px] font-medium text-ink-3">
                  Minta PIN setiap buka WebApp
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={appLock}
                aria-label="Kunci Otomatis"
                disabled={loadingSettings || togglingLock}
                onClick={toggleAppLock}
                className="v2-toggle disabled:opacity-50"
              >
                <div className={`v2-toggle-track ${appLock ? "on" : ""}`} />
                <div className={`v2-toggle-thumb ${appLock ? "on" : ""}`} />
              </button>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] font-medium leading-relaxed text-ink-3">
            PIN disimpan secara aman di server. Tim Hyro tidak pernah meminta PIN-mu.
          </p>
        </div>

      </div>

      {/* PIN shake keyframe — scoped inline so it doesn't pollute app-v2.css */}
      <style>{`@keyframes v2PinShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}`}</style>
    </div>
  );
}
