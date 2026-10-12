import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../../../styles/app-v2.css";
import ScreenHeader from "../../../components/application/v2/ScreenHeader";
import { DANCE_PARAMS, RADIUS_MOBILE, RADIUS_DESKTOP, ORBIT_DUR, AV_HALF } from "../../../components/application/v2/members/data";
import { useMembers } from "../../../hooks/useMembers";
import Legend from "../../../components/application/v2/members/Legend";
import SummaryStrip from "../../../components/application/v2/members/SummaryStrip";
import MemberList from "../../../components/application/v2/members/MemberList";

/*
 * Custom CSS kept for orbit/animation classes — applied as flat class names:
 *   orbit-bg-ring, obr-1, obr-2, ring-rotate-1, ring-rotate-2
 *   center-pot, pot-fill, pot-emoji, pot-pct
 *   orbit-ring, revolving, orbit-member, entered, orbit-inner, orbit-av
 *   orbit-name, member-tooltip, show, mt-name, mt-status, mt-sub
 *
 * All @keyframes (v2RingRotate, v2PotFill, v2MemberDance, v2CounterRotate,
 * v2OrbitSpin, v2GlowPulse) are defined in app-v2.css and must remain there.
 * The JSX references only the class names — no CSS written here.
 */

export default function MembersOrbit() {
  const navigate = useNavigate();
  // Route may include /app/anggota/:groupId
  const { id: groupId } = useParams();

  // Mockup members in demo mode; live members (or none) in real mode.
  const { members: MEMBERS } = useMembers(groupId ?? null);

  const [revolving, setRevolving] = useState(false);
  const [ring1Rotate, setRing1Rotate] = useState(false);
  const [entered, setEntered] = useState([]);
  const [tooltip, setTooltip] = useState({ visible: false, idx: -1 });
  // Stage dimensions: measured after mount so they respond to CSS breakpoints
  const [stageDims, setStageDims] = useState({ w: 390, h: 330 });
  const stageRef = useRef(null);

  // Re-measure stage on mount and on resize
  useEffect(() => {
    function measure() {
      if (stageRef.current) {
        const { offsetWidth, offsetHeight } = stageRef.current;
        setStageDims({ w: offsetWidth, h: offsetHeight });
      }
    }
    measure();
    const ro = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(measure)
      : null;
    if (ro && stageRef.current) ro.observe(stageRef.current);
    return () => ro && ro.disconnect();
  }, []);

  // Staggered entrance — re-runs when members list changes (e.g. after API load).
  // setEntered([]) is called via setTimeout(0) to avoid a synchronous setState
  // inside an effect body (react-hooks/set-state-in-effect lint rule).
  useEffect(() => {
    const ids = [];
    const resetId = setTimeout(() => setEntered([]), 0);
    ids.push(resetId);
    MEMBERS.forEach((_, i) => {
      const id = setTimeout(() => {
        setEntered(prev => [...prev, i]);
      }, 80 + i * 55);
      ids.push(id);
    });
    return () => ids.forEach(clearTimeout);
  }, [MEMBERS]);

  function toggleRotate(on) {
    setRevolving(on);
    setRing1Rotate(on);
  }

  function showTooltip(idx) {
    setTooltip(t => t.idx === idx && t.visible ? { visible: false, idx: -1 } : { visible: true, idx });
  }

  const closeTooltip = useCallback((e) => {
    if (!e.target.closest?.(".orbit-member") && !e.target.closest?.(".member-tooltip")) {
      setTooltip({ visible: false, idx: -1 });
    }
  }, []);

  const tt = tooltip.visible && tooltip.idx >= 0 ? MEMBERS[tooltip.idx] : null;

  const CX = stageDims.w / 2;
  const CY = stageDims.h / 2;
  // Scale orbit radius proportionally — desktop stage is 480×480 vs 390×330 mobile
  const RADIUS = stageDims.w >= 440 ? RADIUS_DESKTOP : RADIUS_MOBILE;

  const ttStyle = tooltip.idx < 6
    ? { left: Math.min(CX + 20, stageDims.w - 180) + "px", top: "60px" }
    : { left: Math.max(10, CX - 200) + "px", top: Math.min(CY + 20, stageDims.h - 100) + "px" };

  return (
    <div className="v2-screen">
      <div className="v2-inner overflow-y-auto">

        {/* Header */}
        <ScreenHeader title="Keluarga Sari" sub="12 anggota · orbit bayar/belum" onBack={() => navigate(-1)} />

        {/* Rotate toggle row
            Mobile:  flex items-center justify-end, pt-[10px] px-5, gap-2
            Desktop: same but px uses the same clamp formula */}
        <div className="flex items-center justify-end gap-2 px-5 pt-2.5 lg:px-[max(clamp(24px,5vw,64px),calc(50%-600px))]">
          {/* rotate-label: 11px/700/ink-2 */}
          <span className="text-[11px] font-bold text-ink-2">Putar orbit</span>
          {/* v2-toggle, v2-toggle-track, v2-toggle-thumb — shared primitives, kept as-is */}
          <button
            type="button"
            className="v2-toggle"
            aria-label={revolving ? "Nonaktifkan rotasi orbit" : "Aktifkan rotasi orbit"}
            aria-pressed={revolving}
            onClick={() => toggleRotate(!revolving)}
          >
            <div className={`v2-toggle-track${revolving ? " on" : ""}`} />
            <div className={`v2-toggle-thumb${revolving ? " on" : ""}`} />
          </button>
        </div>

        {/* Desktop two-column layout wrapper
            Mobile:  flex flex-col (transparent wrapper, children flow normally)
            Tablet (min-[481px]):  max-w-[720px] mx-auto px-6
            Desktop (lg): grid grid-cols-[auto_auto] gap-8 items-start justify-center
                          px-[clamp(24px,5vw,64px)] py-6 pb-12 */}
        <div className="flex flex-col min-[481px]:mx-auto min-[481px]:max-w-180 min-[481px]:px-6 lg:grid lg:max-w-none lg:grid-cols-[auto_auto] lg:items-start lg:justify-center lg:gap-8 lg:px-[clamp(24px,5vw,64px)] lg:pb-12 lg:pt-6">

          {/* Left column
              Mobile:  display:contents (transparent)
              Desktop: flex flex-col items-center gap-3 shrink-0 */}
          <div className="contents lg:flex lg:flex-col lg:shrink-0 lg:items-center lg:gap-3">

            {/* Orbit stage
                Mobile:  relative w-full h-[330px] flex items-center justify-center overflow-hidden
                Tablet:  max-w-[480px] mx-auto
                Desktop: w-[480px] h-[480px] */}
            <div
              className="relative flex h-82.5 w-full items-center justify-content overflow-hidden min-[481px]:mx-auto min-[481px]:max-w-120 lg:h-120 lg:w-120"
              style={{ justifyContent: "center" }}
              ref={stageRef}
              onClick={closeTooltip}
            >
              {/* Background rings — class names deliberately avoid Tailwind's
                  `ring`/`ring-1`/`ring-2` utilities, which would otherwise paint a
                  dark currentColor box-shadow over these.
                  orbit-bg-ring: absolute, rounded-full, 3px dotted #cbd5e1 border,
                  centered via translate(-50%,-50%), pointer-events-none.
                  obr-1/obr-2: size — custom (animations via @keyframes in CSS).
                  ring-rotate-1/ring-rotate-2: animation classes — custom. */}
              <div className={`orbit-bg-ring obr-1${ring1Rotate ? " ring-rotate-1" : ""}`} />
              <div className={`orbit-bg-ring obr-2${ring1Rotate ? " ring-rotate-2" : ""}`} />

              {/* Center pot — custom class: absolute, centered, 88×88, circle,
                  bg-white, brand-primary-soft ring + glow shadow, flex-col centered, z-5, overflow-hidden */}
              <div className="center-pot">
                <div className="pot-fill" />
                {/* pot-emoji: text-[26px] relative z-[1] */}
                <div className="pot-emoji">🏺</div>
                {/* pot-pct: text-[11px] font-extrabold text-brand-primary-hover relative z-[1] leading-none */}
                <div className="pot-pct">67%</div>
              </div>

              {/* Orbit ring — custom animation class when revolving */}
              <div
                className={`orbit-ring${revolving ? " revolving" : ""}`}
                style={revolving ? { "--orbit-dur": `${ORBIT_DUR}s` } : {}}
              >
                {MEMBERS.map((m, i) => {
                  const angle = (i / MEMBERS.length) * 2 * Math.PI - Math.PI / 2;
                  const ox = Math.round(Math.cos(angle) * RADIUS);
                  const oy = Math.round(Math.sin(angle) * RADIUS);
                  const p = DANCE_PARAMS[i];
                  const isEntered = entered.includes(i);

                  return (
                    <div
                      key={m.initials}
                      className={`orbit-member${isEntered ? " entered" : ""}`}
                      style={{
                        left: CX - AV_HALF + "px",
                        top:  CY - AV_HALF + "px",
                        transform: `translate(${ox}px, ${oy}px)`,
                      }}
                      onClick={() => showTooltip(i)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${m.name} — ${m.statusText}`}
                      onKeyDown={e => e.key === "Enter" && showTooltip(i)}
                    >
                      <div
                        className="orbit-inner"
                        style={revolving ? {} : {
                          "--dance-dur": `${p.dur}s`,
                          "--dance-delay": `${p.delay}s`,
                        }}
                      >
                        {/* orbit-av: 42×42 circle, grid place-items-center,
                            text-[12px] font-extrabold text-white, border-3 border-white,
                            shadow, transition; status-specific ring shadows via custom classes */}
                        <div className={`orbit-av ${m.status}`} style={{ background: m.color }}>
                          {m.initials}
                        </div>
                        {/* orbit-name: text-[8px] font-bold text-ink-2 text-center max-w-[50px] leading-[1.2] */}
                        <div className="orbit-name">{m.name.split(" ")[0]}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tooltip
                  Base: absolute, bg-white, rounded-[12px], p-[10px_14px],
                        shadow-[0_4px_20px_rgba(17,24,39,.15)], z-20, min-w-[160px],
                        pointer-events-none, opacity-0, translate-y-1, transition
                  show: opacity-100, translate-y-0, pointer-events-auto
                  (show/hide managed via CSS classes — custom) */}
              {tt && (
                <div className="member-tooltip show" style={ttStyle}>
                  {/* mt-name: text-[13px] font-extrabold text-ink-1 mb-[3px] */}
                  <div className="mt-name">{tt.name}</div>
                  {/* mt-status + status color modifier — custom class */}
                  <div className={`mt-status ${tt.status}`}>{tt.statusText}</div>
                  {/* mt-sub: text-[10px] text-ink-3 font-medium mt-[2px] */}
                  <div className="mt-sub">{tt.sub}</div>
                </div>
              )}
            </div>

            <Legend />

          </div>{/* end left col */}

          {/* Right column
              Mobile:  display:contents (transparent)
              Desktop: flex flex-col w-[640px] max-w-full min-w-0 */}
          <div className="contents lg:flex lg:min-w-0 lg:max-w-full lg:w-160 lg:flex-col">
            <SummaryStrip />
            <MemberList members={MEMBERS} onSelect={showTooltip} />
          </div>{/* end right col */}

        </div>{/* end desktop layout */}

        <div className="h-8" />
      </div>
    </div>
  );
}
