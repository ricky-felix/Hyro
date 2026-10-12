import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../../styles/app-v2.css";
import { useToast } from "../../../context/ToastContext";
import { useJoinGroup } from "../../../hooks/useInvite";
import { Camera, Upload, Link, QrJoin, X, Check } from "../../../components/application/v2/icons";
import ScreenHeader from "../../../components/application/v2/ScreenHeader";
import { INVITE } from "../../../components/application/v2/undang/data";
import { isDemoMode } from "../../../lib/appMode";

// Pull the invite token out of whatever the user pasted: a full join link
// (…/app/gabung/preview?token=ABC), an older path-style link (…/gabung/ABC),
// or a bare code.
function extractToken(raw) {
  const v = raw.trim();
  const fromQuery = v.match(/[?&]token=([^&#]+)/);
  if (fromQuery) return decodeURIComponent(fromQuery[1]);
  return v.includes("/") ? v.split("/").filter(Boolean).pop() : v;
}

/**
 * GabungMasuk — the in-app "how do you want to join?" entry screen.
 * Three ways in: scan a QR with the camera, upload a QR image, or paste
 * the invite link / code. Any valid entry routes to the group preview
 * (Gabung) where the user confirms and joins.
 *
 * Camera: live preview via getUserMedia, preferring the rear camera on
 * phones (facingMode "environment") and falling back to the default
 * webcam on laptops. QR *decoding* is still mocked for the MVP — capturing
 * resolves to the sample invite — but the camera itself is real.
 *
 * Custom CSS (flat classes, NOT written to app-v2.css — returned in task response):
 *   .join-scan-grad  — scan card gradient background (135deg green→purple)
 *   .join-scan-sweep — @keyframes scan line sweep animation
 */
export default function GabungMasuk() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [value, setValue] = useState("");
  const [scanning, setScanning] = useState(false);

  // Real invite-redeem hook — used when a code is pasted or decoded.
  // TODO(wave2-auth): Supabase session token required for join() to work.
  const { validate, loading: validating } = useJoinGroup();

  // Decoded QR token — extracted from camera/upload (currently mocked, see below).

  // Attach the live stream once the <video> is in the DOM.
  useEffect(() => {
    if (scanning && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [scanning]);

  // Always release the camera when leaving the screen.
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  function stopCamera() {
    stopStream();
    setScanning(false);
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast("Browser ini tidak mendukung kamera — tempel link saja 👇");
      return;
    }
    try {
      // Prefer the rear camera on phones; laptops just use their webcam.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setScanning(true);
    } catch (err) {
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
        toast("Izin kamera ditolak. Aktifkan di pengaturan browser.");
      } else if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") {
        toast("Kamera tidak ditemukan di perangkat ini.");
      } else {
        toast("Tidak bisa membuka kamera. Coba upload QR atau tempel link.");
      }
    }
  }

  // Navigate to the preview screen, optionally passing the resolved token.
  function goToPreview(token) {
    stopCamera();
    const dest = token
      ? `/app/gabung/preview?token=${encodeURIComponent(token)}`
      : "/app/gabung/preview";
    navigate(dest);
  }

  function onUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // TODO(wave2-qr-decode): QR *decoding* is mocked — a real decoder (e.g.
    // jsQR) would extract the token here. Only demo mode fakes a result;
    // real mode must not redeem a made-up code.
    if (!isDemoMode()) {
      toast("Scan QR belum tersedia — tempel link undangannya di bawah", "error");
      return;
    }
    const mockDecodedToken = INVITE.code;
    toast("QR terbaca ✓");
    setTimeout(() => goToPreview(mockDecodedToken), 400);
  }

  async function submitLink() {
    const v = value.trim();
    if (!v) {
      toast("Tempel link atau masukkan kode undangan dulu");
      return;
    }
    const code = extractToken(v);

    // Validate the code against the real API before navigating
    // TODO(wave2-auth): requires a valid Supabase session.
    const result = await validate(code);
    if (result) {
      toast("Undangan ditemukan ✓");
      setTimeout(() => goToPreview(code), 400);
    } else {
      // validate() logs the error; show a user-facing message
      toast("Undangan tidak ditemukan atau sudah kadaluwarsa");
      // Still navigate to preview with static data as fallback for MVP
      setTimeout(() => goToPreview(null), 400);
    }
  }

  return (
    <div className="v2-screen">
      {/* Scroll wrapper: full-width, full viewport-height, app-bg, scrollable, no scrollbar */}
      <div className="w-full min-h-svh bg-app-bg overflow-y-auto overflow-x-hidden flex flex-col items-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        {/* Sticky header */}
        <ScreenHeader title="Gabung Arisan / Patungan" onBack={() => { stopCamera(); navigate("/app"); }} />

        {/* Content column: centered, max-width 460px */}
        <div className="w-full max-w-115 px-4 pb-10 pt-4 flex flex-col gap-3.5">

          <p className="text-[13px] text-ink-2 leading-[1.55] my-0.5">
            Punya undangan dari teman? Scan kode QR-nya, unggah gambarnya, atau tempel
            link undangan untuk melihat grup sebelum bergabung.
          </p>

          {/* Scan QR — live camera preview when active */}
          {scanning ? (
            <div className="join-scan-grad w-full text-white rounded-[20px] px-5 pt-6 pb-5.5 flex flex-col items-center gap-3.5 shadow-[0_10px_28px_rgba(76,29,149,0.30)] cursor-default">
              {/* Scanning frame: expanded to 220×220 with black bg for video */}
              <div className="relative w-55 h-55 rounded-[18px] bg-black grid place-items-center text-white/92 overflow-hidden">
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" playsInline muted autoPlay />
                {/* Corner brackets */}
                <span className="absolute top-3 left-3 w-5.5 h-5.5 border-3 border-white rounded-sm border-r-0 border-b-0" />
                <span className="absolute top-3 right-3 w-5.5 h-5.5 border-3 border-white rounded-sm border-l-0 border-b-0" />
                <span className="absolute bottom-3 left-3 w-5.5 h-5.5 border-3 border-white rounded-sm border-r-0 border-t-0" />
                <span className="absolute bottom-3 right-3 w-5.5 h-5.5 border-3 border-white rounded-sm border-l-0 border-t-0" />
                {/* Animated scan line */}
                <span className="join-scan-sweep absolute top-0 left-4 right-4 h-0.5 bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
              </div>
              <div className="text-[12px] opacity-85">Arahkan kotak ke kode QR undangan</div>
              <div className="flex gap-2.5 w-full">
                <button type="button" className="flex-1 border-none cursor-pointer inline-flex items-center justify-center gap-1.75 text-[14px] font-extrabold py-3.25 rounded-lg bg-white/20 text-white" onClick={stopCamera}>
                  <X size={16} stroke="currentColor" strokeWidth={2.5} />
                  Tutup
                </button>
                <button
                  type="button"
                  className="flex-1 border-none cursor-pointer inline-flex items-center justify-center gap-1.75 text-[14px] font-extrabold py-3.25 rounded-lg bg-white text-brand-primary-hover"
                  onClick={() => {
                    // TODO(wave2-qr-decode): decoding the camera stream is mocked —
                    // a real decoder (jsQR / zxing-wasm) would read videoRef frames.
                    // Only demo mode fakes a result.
                    if (!isDemoMode()) {
                      toast("Scan QR belum tersedia — tempel link undangannya di bawah", "error");
                      return;
                    }
                    goToPreview(INVITE.code);
                  }}
                >
                  <Check size={16} stroke="currentColor" strokeWidth={3} />
                  Gunakan QR ini
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="join-scan-grad w-full border-none cursor-pointer text-center text-white rounded-[20px] px-5 pt-6 pb-5.5 flex flex-col items-center gap-3.5 shadow-[0_10px_28px_rgba(76,29,149,0.30)]" onClick={startCamera}>
              {/* Idle scan frame: 150×150 with backdrop blur and corner brackets */}
              <div className="relative w-37.5 h-37.5 rounded-[18px] bg-white/12 grid place-items-center text-white/92 backdrop-blur-xs overflow-hidden">
                {/* Corner brackets */}
                <span className="absolute top-3 left-3 w-5.5 h-5.5 border-3 border-white rounded-sm border-r-0 border-b-0" />
                <span className="absolute top-3 right-3 w-5.5 h-5.5 border-3 border-white rounded-sm border-l-0 border-b-0" />
                <span className="absolute bottom-3 left-3 w-5.5 h-5.5 border-3 border-white rounded-sm border-r-0 border-t-0" />
                <span className="absolute bottom-3 right-3 w-5.5 h-5.5 border-3 border-white rounded-sm border-l-0 border-t-0" />
                {/* Animated scan line */}
                <span className="join-scan-sweep absolute top-0 left-4 right-4 h-0.5 bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                <QrJoin size={42} stroke="currentColor" strokeWidth={1.6} />
              </div>
              <div className="inline-flex items-center gap-2 text-[16px] font-extrabold tracking-[-0.01em]">
                <Camera size={18} stroke="white" strokeWidth={2} />
                Scan Kode QR
              </div>
              <div className="text-[12px] opacity-85">Buka kamera untuk memindai kode QR undangan</div>
            </button>
          )}

          {/* Upload QR image */}
          <button
            type="button"
            className="w-full cursor-pointer text-left flex items-center gap-3 bg-surface border-[1.5px] border-dashed border-line rounded-card p-3.5 transition-[border-color,background] duration-150 hover:border-brand-primary hover:bg-brand-primary-tint"
            onClick={() => fileRef.current?.click()}
          >
            <div className="w-10 h-10 rounded-lg shrink-0 grid place-items-center text-brand-primary-hover bg-brand-primary-soft">
              <Upload size={18} stroke="currentColor" strokeWidth={2} />
            </div>
            <div>
              <div className="text-[14px] font-extrabold text-ink-1">Unggah gambar QR</div>
              <div className="text-[11.5px] text-ink-2 mt-px">Pilih screenshot atau foto kode dari galeri</div>
            </div>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onUpload}
          />

          {/* Divider */}
          <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3 my-0.5 before:content-[''] before:flex-1 before:h-px before:bg-line-soft after:content-[''] after:flex-1 after:h-px after:bg-line-soft">
            atau
          </div>

          {/* Paste link / code */}
          <label className="flex flex-col gap-1.75">
            <span className="text-[12px] font-bold text-ink-2">Link atau kode undangan</span>
            <div className="flex items-center gap-2.25 border-[1.5px] border-line rounded-[13px] px-3.5 bg-surface transition-[border-color,box-shadow] duration-150 focus-within:border-brand-primary focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.12)]">
              <Link size={16} stroke="var(--ink-3)" strokeWidth={2} />
              <input
                className="flex-1 min-w-0 border-none outline-none bg-transparent py-3.5 text-[15px] font-[inherit] text-ink-1"
                placeholder={isDemoMode() ? INVITE.link : "Tempel link atau kode undangan"}
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => e.key === "Enter" && submitLink()}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </label>

          <button
            type="button"
            className="w-full border-none cursor-pointer bg-brand-primary text-white text-[16px] font-extrabold py-4 rounded-[14px] shadow-[0_6px_18px_rgba(16,185,129,0.32)] disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={submitLink}
            disabled={validating}
          >
            {validating ? "Memeriksa…" : "Lihat Undangan"}
          </button>

          <div className="text-[11.5px] text-ink-3 text-center leading-normal">
            Tanpa perlu daftar akun. Kamu bisa melihat detail grup dulu sebelum memutuskan gabung.
          </div>

        </div>
      </div>
    </div>
  );
}
