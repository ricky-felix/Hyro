import { useState, useLayoutEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "./icons";

/**
 * CoachMarks — first-run guided tour overlaid on the home deck.
 *
 * Rendered inside `.v2-inner`, it MEASURES the real target elements
 * (getBoundingClientRect, relative to .v2-inner) rather than hard-coding
 * offsets. That keeps the highlight rings and tooltip aligned across every
 * breakpoint — phone, tablet, desktop — and re-measures on resize/step change.
 *
 * Each step lists the selectors to highlight and which element the tooltip
 * anchors to. Styling lives in app-v2.css under `.v2-home`.
 *
 * Props:
 *   onDone () => void — called when the user finishes or skips the tour
 */
const STEPS = [
  {
    key: "swipe",
    title: "Geser antar kartu",
    body: "Setiap kartu adalah satu tagihan. Ketuk atau geser sisi kiri / kanan untuk berpindah.",
    targets: [".nav-prev", ".nav-next"],
    swipe: true,
    tipSide: "center",
  },
  {
    key: "filter",
    title: "Saring tagihan",
    body: "Pilih jenis — arisan atau patungan — atau status jatuh tempo di sini.",
    targets: [".seg-wrap.seg-grouped", ".seg-collapse"],
    tipTo: ".seg-row",
    tipSide: "below",
  },
  {
    key: "compose",
    title: "Mulai sesuatu baru",
    body: "Buat arisan, patungan, atau gabung lewat undangan teman dari sini.",
    targets: [".compose-pill"],
    tipTo: ".compose-pill",
    tipSide: "above",
  },
  {
    key: "actions",
    title: "Dompet, notifikasi & profil",
    body: "Akses saldo grup, pengingat, dan akun kamu dari bar atas.",
    targets: [".story-list-btn", ".story-topbar-right"],
    tipTo: ".story-topbar-right",
    tipSide: "below",
  },
  {
    key: "done",
    title: "Selamat mencoba!",
    body: "Ada pertanyaan atau butuh bantuan? Hubungi kami lewat email di bawah, atau cari Hyro di halaman Profil.",
    targets: [],
    tipSide: "center",
    email: "arisandigital@outlook.com",
  },
];

const TIP_MAX = 320; // tooltip max width (px)
const PAD = 6; // halo padding around each highlighted element

export default function CoachMarks({ onDone }) {
  const [i, setI] = useState(0);
  const [layout, setLayout] = useState(null);
  const overlayRef = useRef(null);
  const step = STEPS[i];
  const isLast = i === STEPS.length - 1;

  useLayoutEffect(() => {
    const root = overlayRef.current?.parentElement; // .v2-inner
    if (!root) return;

    const isVisible = (el) =>
      el && el.offsetParent !== null && el.getClientRects().length > 0;

    function measure() {
      const base = root.getBoundingClientRect();
      const rel = (el) => {
        const r = el.getBoundingClientRect();
        return {
          left: r.left - base.left,
          top: r.top - base.top,
          width: r.width,
          height: r.height,
        };
      };

      const spots = step.targets
        .map((sel) => root.querySelector(sel))
        .filter(isVisible)
        .map(rel);

      let tip;
      const tipEl = step.tipTo ? root.querySelector(step.tipTo) : null;
      if (step.tipSide === "center" || !isVisible(tipEl)) {
        tip = { side: "center" };
      } else {
        const r = rel(tipEl);
        const w = Math.min(TIP_MAX, base.width - 32);
        const cx = r.left + r.width / 2;
        const left = Math.max(16, Math.min(cx - w / 2, base.width - w - 16));
        tip = { side: step.tipSide, left, w, top: r.top, bottom: r.top + r.height };
      }

      setLayout({ spots, tip });
    }

    measure();
    // Re-measure after layout settles (fonts/transitions) and on resize so the
    // overlay stays aligned across orientation changes and breakpoints.
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [step]);

  function next() {
    if (isLast) onDone();
    else setI((n) => n + 1);
  }

  function back() {
    setI((n) => Math.max(0, n - 1));
  }

  const tip = layout?.tip;
  const tipStyle =
    tip?.side === "below"
      ? { left: tip.left, top: tip.bottom + 12, width: tip.w }
      : tip?.side === "above"
      ? { left: tip.left, top: tip.top - 12, width: tip.w, transform: "translateY(-100%)" }
      : { left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: `min(${TIP_MAX}px, calc(100% - 32px))` };

  return (
    <div className="coach-overlay" ref={overlayRef}>
      {/* Dim backdrop with holes cut out over the highlighted target(s) —
          tap anywhere to advance */}
      <svg className="coach-backdrop" onClick={next}>
        <defs>
          <mask id="coach-mask">
            <rect width="100%" height="100%" fill="white" />
            {layout?.spots.map((s, idx) => (
              <rect
                key={idx}
                x={s.left - PAD}
                y={s.top - PAD}
                width={s.width + PAD * 2}
                height={s.height + PAD * 2}
                rx="14"
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(10,15,25,.62)" mask="url(#coach-mask)" />
      </svg>

      {/* Highlight rings around the measured target(s) */}
      {layout?.spots.map((s, idx) => (
        <div
          key={idx}
          className="coach-spot"
          style={{
            left: s.left - PAD,
            top: s.top - PAD,
            width: s.width + PAD * 2,
            height: s.height + PAD * 2,
          }}
        >
          {step.swipe && idx === 0 && (
            <span className="coach-swipe-l">
              <ChevronLeft size={36} stroke="currentColor" strokeWidth={2.5} />
            </span>
          )}
          {step.swipe && idx === 1 && (
            <span className="coach-swipe-r">
              <ChevronRight size={36} stroke="currentColor" strokeWidth={2.5} />
            </span>
          )}
        </div>
      ))}

      {/* Tooltip */}
      {layout && (
        <div className="coach-tip" style={tipStyle}>
          <div className="coach-card">
            <div className="coach-header">Cara Menggunakan</div>
            <div className="coach-dots">
              {STEPS.map((s, idx) => (
                <span key={s.key} className={`coach-dot${idx === i ? " active" : ""}`} />
              ))}
            </div>

            <div className="coach-title">{step.title}</div>
            <div className="coach-body">{step.body}</div>
            {step.email && (
              <a className="coach-contact" href={`mailto:${step.email}`}>
                {step.email}
              </a>
            )}

            <div className="coach-actions">
              <button type="button" className="coach-skip" onClick={onDone}>
                Lewati
              </button>
              <div className="coach-nav">
                {i > 0 && (
                  <button type="button" className="coach-back" onClick={back}>
                    <ChevronLeft size={14} stroke="currentColor" strokeWidth={2.75} />
                    Sebelum
                  </button>
                )}
                <button type="button" className="coach-next" onClick={next}>
                  {isLast ? "Selesai" : "Lanjut"}
                  {!isLast && (
                    <ChevronRight size={14} stroke="currentColor" strokeWidth={2.75} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
