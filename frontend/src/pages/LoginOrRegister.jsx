/**
 * LoginOrRegister.jsx — Full-page auth screen for /masuk (Workstream C4).
 *
 * This replaces the old modal-only component. It now renders as a standalone
 * full-viewport page (not a modal) and is mounted at the public route /masuk.
 *
 * Features:
 *  - Toggle between "Masuk" (login) and "Daftar" (register) tabs.
 *  - Single "Email atau Nomor HP" identifier field for both flows.
 *  - parseIdentifier() validates and normalises the input client-side.
 *  - Post-auth redirect: reads `returnTo` from query param (?returnTo=/app/xyz)
 *    or from React Router location.state.returnTo, defaulting to /app.
 *  - Inline field errors + server error banner.
 *  - Loading state + disabled submit while in-flight.
 *  - Password strength meter on the register form.
 *  - CSS: Tailwind utilities only (no Framer Motion — this is a v2 screen).
 *
 * NOTE: The old modal-style export (with onClose/onSuccess props) is no longer
 * the primary use-case. AccountPromptContext renders this page inline but since
 * every user is now authenticated the prompt is gated off (see AccountPromptContext).
 */

import { useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { parseIdentifier } from "../utils/identifier";
import { getAppMode, setAppMode, MODE_DEMO, MODE_REAL } from "../lib/appMode";
import { InputField } from "../components/auth/InputField";

// ─── TEMPORARY PASSWORD GATE ──────────────────────────────────────────────────
// Gates the whole /masuk page behind a shared passphrase during pre-launch.
// This is client-side only — NOT real security, just a soft barrier.
// To remove: delete this block + the <PasswordGate> wrapper at the bottom.
//
// Two passwords, two modes (see lib/appMode.js):
//   - demo password → skip login, straight into /app on mockup data
//   - real password → unlock the normal login form, live data only
// Production builds default the real password to "real_data_hyro"; in dev it
// has no default, so only the demo path exists unless GATE_PASSWORD_REAL
// is set.
const GATE_PASSWORD_DEMO =
  import.meta.env.VITE_GATE_PASSWORD_DEMO ||
  import.meta.env.VITE_GATE_PASSWORD ||
  "arisan-patungan-2026";
const GATE_PASSWORD_REAL =
  import.meta.env.GATE_PASSWORD_REAL ||
  (import.meta.env.PROD ? "real_data_hyro" : "");

function PasswordGate({ children }) {
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(() => getAppMode() === MODE_REAL);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  if (unlocked) return children;

  function handleSubmit(e) {
    e.preventDefault();
    if (input === GATE_PASSWORD_DEMO) {
      setAppMode(MODE_DEMO);
      navigate("/app");
    } else if (GATE_PASSWORD_REAL && input === GATE_PASSWORD_REAL) {
      setAppMode(MODE_REAL);
      setUnlocked(true);
    } else {
      setError("Kata sandi salah.");
    }
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-gray-50 px-4 py-8">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-bold text-gray-900">Halaman terkunci</h1>
          <p className="text-sm text-gray-500">
            Masukkan kata sandi untuk mengakses halaman ini.
          </p>
        </div>
        <InputField
          type="password"
          placeholder="Kata sandi akses"
          id="gate-password"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (error) setError("");
          }}
          autoFocus
        />
        {error && <ErrorAlert message={error} />}
        <button
          type="submit"
          className="flex min-h-11 w-full items-center justify-center rounded-lg bg-[#10b981] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0d9e6e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981] focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          Buka
        </button>
      </form>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="inline-block size-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function ErrorAlert({ message }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
      <svg className="mt-px size-4 shrink-0 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <p className="text-xs leading-relaxed text-red-700">{message}</p>
    </div>
  );
}

/**
 * ConfirmationNotice — shown after a successful sign-up when Supabase has
 * "Confirm email" enabled (signUp returns a user but no session). It replaces
 * the register form entirely so the "check your email" step is unmissable,
 * instead of a small inline banner buried under a still-filled form.
 */
function ConfirmationNotice({ email, onBackToLogin, onUseAnotherEmail }) {
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/60">
        <svg className="size-8 text-[#10b981]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
        </svg>
      </div>

      <div className="flex flex-col gap-1.5">
        <h1 className="text-lg font-bold text-gray-900">Cek email kamu</h1>
        <p className="text-sm leading-relaxed text-gray-500">
          Kami mengirim tautan verifikasi ke{" "}
          <span className="font-semibold text-gray-700">{email}</span>. Buka email
          itu dan klik tautannya untuk mengaktifkan akun, lalu masuk.
        </p>
      </div>

      <div className="flex w-full flex-col gap-2.5">
        <button
          type="button"
          onClick={onBackToLogin}
          className="flex min-h-11 w-full items-center justify-center rounded-lg bg-[#10b981] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0d9e6e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981] focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          Lanjut ke Masuk
        </button>
        <button
          type="button"
          onClick={onUseAnotherEmail}
          className="text-sm font-medium text-gray-500 transition hover:text-gray-700 focus-visible:underline focus-visible:outline-none"
        >
          Daftar dengan email lain
        </button>
      </div>

      <p className="text-xs leading-relaxed text-gray-400">
        Tidak menerima email dalam beberapa menit? Periksa folder spam atau promosi.
      </p>
    </div>
  );
}

/** Returns { level: 0|1|2|3 } — 0 empty, 1 lemah, 2 sedang, 3 kuat */
function getPasswordStrength(pw) {
  if (!pw) return { level: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: "Lemah", color: "bg-red-400" };
  if (score <= 3) return { level: 2, label: "Sedang", color: "bg-amber-400" };
  return { level: 3, label: "Kuat", color: "bg-[#10b981]" };
}

function PasswordStrengthBar({ password }) {
  const { level, label, color } = getPasswordStrength(password);
  if (!password) return null;
  return (
    <div className="mt-1.5 flex flex-col gap-1" aria-live="polite" aria-label={`Kekuatan kata sandi: ${label}`}>
      <div className="flex gap-1">
        {[1, 2, 3].map((step) => (
          <div key={step} className={["h-1 flex-1 rounded-full transition-all duration-300", level >= step ? color : "bg-gray-200"].join(" ")} />
        ))}
      </div>
      <p className={["text-xs font-medium", level === 1 && "text-red-500", level === 2 && "text-amber-500", level === 3 && "text-[#10b981]"].filter(Boolean).join(" ")}>
        {label}
      </p>
    </div>
  );
}

// ── Typed field hint ──────────────────────────────────────────────────────────
// Both the login Email field and the register Email/Nomor HP fields validate
// against a single expected type rather than accepting either.
function TypedHint({ value, expect }) {
  if (!value) return null;
  const parsed = parseIdentifier(value);
  if (parsed?.type === expect) {
    return (
      <p className="mt-1 text-xs text-emerald-600">
        {expect === "email" ? "Email terdeteksi." : `Nomor HP: ${parsed.phone}`}
      </p>
    );
  }
  return (
    <p className="mt-1 text-xs text-red-500">
      {expect === "email" ? "Format email tidak dikenali." : "Format nomor HP tidak dikenali."}
    </p>
  );
}

// ── Login form ────────────────────────────────────────────────────────────────
function LoginForm({ onSuccess }) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const identifierParsed = parseIdentifier(identifier);
  const canSubmit = identifierParsed?.type === "email" && password.length >= 1 && !pending;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setPending(true);
    try {
      await login({ identifier, password });
      onSuccess();
    } catch (err) {
      setError(err.message ?? "Gagal masuk. Periksa email dan kata sandi.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <div>
        <InputField
          label="Email"
          type="email"
          placeholder="nama@email.com"
          id="login-identifier"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="email"
          inputMode="email"
        />
        <TypedHint value={identifier} expect="email" />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="login-password" className="text-sm font-medium text-gray-700">
            Kata Sandi<span className="ml-0.5 text-red-400" aria-hidden="true">*</span>
          </label>
        </div>
        <InputField
          type="password"
          placeholder="••••••••"
          id="login-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      {error && <ErrorAlert message={error} />}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-1 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#10b981] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0d9e6e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981] focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <><Spinner /><span>Memproses...</span></> : "Masuk"}
      </button>
    </form>
  );
}

// ── Register form ─────────────────────────────────────────────────────────────
function RegisterForm({ onSuccess, onConfirmationPending }) {
  const { register } = useAuth();

  const [form, setForm] = useState({ email: "", phone: "", name: "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [pending, setPending] = useState(false);

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = "Nama wajib diisi";

    const parsedEmail = parseIdentifier(form.email);
    if (!form.email.trim()) {
      errs.email = "Email wajib diisi";
    } else if (parsedEmail?.type !== "email") {
      errs.email = "Masukkan alamat email yang valid.";
    }

    const parsedPhone = parseIdentifier(form.phone);
    if (!form.phone.trim()) {
      errs.phone = "Nomor HP wajib diisi";
    } else if (parsedPhone?.type !== "phone") {
      errs.phone = "Masukkan nomor HP yang valid.";
    }

    if (form.password.length < 8) errs.password = "Minimal 8 karakter";
    if (form.password !== form.confirm) errs.confirm = "Kata sandi tidak cocok";
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError("");
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      await register({ email: form.email, phone: form.phone, password: form.password, name: form.name.trim() });
      onSuccess();
    } catch (err) {
      const msg = err.message ?? "Gagal mendaftar. Coba lagi.";
      // Detect the "please confirm" case (signUp succeeded but no session yet):
      // hand the email up so the page can swap to a full confirmation screen.
      if (msg.toLowerCase().includes("konfirmasi") || msg.toLowerCase().includes("verifikasi")) {
        onConfirmationPending(parseIdentifier(form.email)?.email ?? form.email.trim());
      } else {
        setServerError(msg);
      }
    } finally {
      setPending(false);
    }
  }

  const canSubmit =
    parseIdentifier(form.email)?.type === "email" &&
    parseIdentifier(form.phone)?.type === "phone" &&
    form.name.trim() &&
    form.password.length >= 8 &&
    form.password === form.confirm &&
    !pending;

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <InputField
        label="Nama Lengkap"
        placeholder="Budi Santoso"
        id="reg-name"
        required
        value={form.name}
        onChange={set("name")}
        error={errors.name}
        autoComplete="name"
      />

      <div>
        <InputField
          label="Email"
          type="email"
          placeholder="nama@email.com"
          id="reg-email"
          required
          value={form.email}
          onChange={set("email")}
          error={errors.email}
          autoComplete="email"
          inputMode="email"
        />
        {!errors.email && <TypedHint value={form.email} expect="email" />}
      </div>

      <div>
        <InputField
          label="Nomor HP"
          type="tel"
          placeholder="0812..."
          id="reg-phone"
          required
          value={form.phone}
          onChange={set("phone")}
          error={errors.phone}
          autoComplete="tel"
          inputMode="tel"
        />
        {!errors.phone && <TypedHint value={form.phone} expect="phone" />}
      </div>

      <div className="flex flex-col gap-0">
        <InputField
          label="Kata Sandi"
          type="password"
          placeholder="Min. 8 karakter"
          id="reg-password"
          required
          value={form.password}
          onChange={set("password")}
          error={errors.password}
          autoComplete="new-password"
        />
        <PasswordStrengthBar password={form.password} />
      </div>

      <InputField
        label="Konfirmasi Kata Sandi"
        type="password"
        placeholder="Ulangi kata sandi"
        id="reg-confirm"
        required
        value={form.confirm}
        onChange={set("confirm")}
        error={errors.confirm}
        autoComplete="new-password"
      />

      <p className="text-xs leading-relaxed text-gray-500">
        Dengan mendaftar, kamu menyetujui{" "}
        <a href="#" className="font-medium text-[#10b981] transition hover:underline">Syarat &amp; Ketentuan</a>{" "}
        dan{" "}
        <a href="#" className="font-medium text-[#10b981] transition hover:underline">Kebijakan Privasi</a>{" "}
        kami.
      </p>

      {serverError && <ErrorAlert message={serverError} />}

      <button
        type="submit"
        disabled={!canSubmit}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#10b981] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0d9e6e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981] focus-visible:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? <><Spinner /><span>Mendaftarkan...</span></> : "Daftar Sekarang"}
      </button>
    </form>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
const TABS = [
  { key: "login", label: "Masuk" },
  { key: "register", label: "Daftar" },
];

/**
 * LoginOrRegister — standalone full-viewport auth page at /masuk.
 *
 * Props (all optional — retained for backwards-compat with AccountPromptContext
 * which no longer opens it, but keeps the import):
 *   defaultTab   {string}   "login" | "register"
 *   onClose      {Function} — ignored in page mode (no overlay)
 *   onSuccess    {Function} — if provided, called instead of navigate(returnTo)
 *   reason       {string}   — subtitle override (unused in page mode)
 */
function LoginOrRegisterPage({ defaultTab = "login", onSuccess }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(defaultTab);
  // When set, the user just registered but must confirm their email first —
  // we replace the tabs + form with a dedicated "check your email" screen.
  const [pendingEmail, setPendingEmail] = useState(null);

  // ── Determine where to send the user after auth ───────────────────────────
  // Priority: query param ?returnTo → location.state.returnTo → /app
  const returnTo =
    searchParams.get("returnTo") ||
    location.state?.returnTo ||
    "/app";

  function handleSuccess() {
    if (onSuccess) {
      onSuccess();
    } else {
      // Replace so the user can't hit back to the login page after authenticating.
      navigate(returnTo, { replace: true });
    }
  }

  function handleBackToLogin() {
    setPendingEmail(null);
    setTab("login");
  }

  function handleUseAnotherEmail() {
    setPendingEmail(null);
    setTab("register");
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-start bg-gray-50 px-4 py-8 sm:justify-center">
      <div className="w-full max-w-md">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-3 inline-flex items-center gap-1.5 rounded-lg py-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]/40 focus-visible:ring-offset-1"
        >
          <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Kembali ke beranda
        </button>

        <div className="flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between bg-[#10b981] px-6 py-4">
          <img
            src="/Arisan-Digital-Full-Logo-no-bg.webp"
            alt="Arisan Digital"
            style={{ height: "56px", width: "auto" }}
          />
          <button
            type="button"
            onClick={() => navigate("/")}
            aria-label="Tutup dan kembali ke beranda"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs — hidden while showing the post-register confirmation screen */}
        {!pendingEmail && (
        <div className="flex shrink-0 border-b border-gray-200 bg-gray-50">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                "relative flex-1 py-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#10b981]/40",
                tab === key ? "text-[#10b981]" : "text-gray-500 hover:text-gray-700",
              ].join(" ")}
              aria-selected={tab === key}
              role="tab"
            >
              {label}
              {tab === key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#10b981]" />
              )}
            </button>
          ))}
        </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {pendingEmail ? (
            <ConfirmationNotice
              email={pendingEmail}
              onBackToLogin={handleBackToLogin}
              onUseAnotherEmail={handleUseAnotherEmail}
            />
          ) : (
            <>
              <div className="mb-5">
                <h1 className="text-lg font-bold text-gray-900">
                  {tab === "login" ? "Selamat datang kembali!" : "Buat akun baru"}
                </h1>
                <p className="mt-0.5 text-sm text-gray-500">
                  {tab === "login"
                    ? "Masuk dengan email dan kata sandimu."
                    : "Daftar dengan email dan nomor HP, lalu buat kata sandi."}
                </p>
              </div>

              {tab === "login"
                ? <LoginForm onSuccess={handleSuccess} />
                : <RegisterForm onSuccess={handleSuccess} onConfirmationPending={setPendingEmail} />}

              <p className="mt-5 text-center text-sm text-gray-500">
                {tab === "login" ? (
                  <>
                    Belum punya akun?{" "}
                    <button
                      type="button"
                      onClick={() => setTab("register")}
                      className="font-semibold text-[#10b981] transition hover:text-[#0d9e6e] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]/40 focus-visible:ring-offset-1"
                    >
                      Daftar
                    </button>
                  </>
                ) : (
                  <>
                    Sudah punya akun?{" "}
                    <button
                      type="button"
                      onClick={() => setTab("login")}
                      className="font-semibold text-[#10b981] transition hover:text-[#0d9e6e] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]/40 focus-visible:ring-offset-1"
                    >
                      Masuk
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

// TEMPORARY: wrap the page in the password gate. To restore normal behaviour,
// export LoginOrRegisterPage directly and remove PasswordGate.
export function LoginOrRegister(props) {
  return (
    <PasswordGate>
      <LoginOrRegisterPage {...props} />
    </PasswordGate>
  );
}

export default LoginOrRegister;
