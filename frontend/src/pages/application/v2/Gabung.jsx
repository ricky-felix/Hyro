import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../../../styles/app-v2.css";
import { useToast } from "../../../context/ToastContext";
import { useJoinGroup } from "../../../hooks/useInvite";
import { isDemoMode } from "../../../lib/appMode";
import { ChevronLeft, Users, Split } from "../../../components/application/v2/icons";
import { INVITE } from "../../../components/application/v2/undang/data";

/**
 * Gabung — the invitee's landing screen when opening an invite link.
 * Previews the group, takes a name (no signup), and joins.
 *
 * Custom CSS (flat classes, NOT written to app-v2.css — returned in task response):
 *   .gabung-hero-grad          — arisan green gradient (160deg)
 *   .gabung-hero-grad-patungan — patungan purple gradient (160deg)
 *   Both include a desktop padding-top override via @media (min-width:1024px).
 */

// Real-mode preview: no pre-join group lookup exists yet, so nothing here is
// specific to the group — the real name comes back from the redeem call.
const REAL_PREVIEW = {
  group: {
    name: "Grup Hyro",
    type: "arisan",
    typeLabel: "grup",
    tagline: "Detail grup muncul setelah kamu gabung",
    iuran: "—",
    cadence: "",
    members: 0,
    capacity: "—",
    admin: "—",
  },
  joined: [],
};
export default function Gabung() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  // Demo mode previews the static mockup invite. Real mode has no pre-join
  // preview endpoint yet, so it shows a neutral card with no made-up details.
  const demo = isDemoMode();

  // The token comes from GabungMasuk (or a shared link) via ?token=<code>.
  // Demo mode falls back to the sample code so the preview flow still works.
  const token = searchParams.get("token") ?? (demo ? INVITE.code : null);

  const { join: joinGroup, loading: joining } = useJoinGroup();

  const { group, joined } = demo ? INVITE : REAL_PREVIEW;
  const isArisan = group.type === "arisan";
  const [name, setName] = useState("");

  async function join() {
    if (!name.trim()) {
      toast("Isi nama kamu dulu");
      return;
    }
    if (!token) {
      toast("Kode undangan gak ada — buka lagi tautan undangannya", "error");
      return;
    }
    // Demo mode: the demo API client answers the redeem call, no backend.
    const result = await joinGroup(token);
    if (!result) {
      toast("Gagal gabung — undangan mungkin sudah kedaluwarsa atau penuh", "error");
      return;
    }
    // Backend redeem returns { message, group: { id, name, … } }.
    const joinedGroup = result.group;
    toast(`Selamat datang di ${joinedGroup?.name ?? group.name}! 🎉`);
    navigate(joinedGroup?.id ? `/app/grup/${joinedGroup.id}` : "/app");
  }

  return (
    <div className="v2-screen">
      {/* Scroll wrapper: full-width, full viewport-height, app-bg, scrollable, no scrollbar */}
      <div className="w-full min-h-svh bg-app-bg overflow-y-auto overflow-x-hidden flex flex-col items-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

        {/* Gradient invite hero */}
        <div className={`relative overflow-hidden w-full px-5 pb-7 pt-5 flex flex-col items-center text-center text-white ${isArisan ? "gabung-hero-grad" : "gabung-hero-grad-patungan"}`}>
          {/* Decorative blob g1: 200×200, top:-70 right:-50 */}
          <div className="pointer-events-none absolute -top-17.5 -right-12.5 w-50 h-50 rounded-full bg-white/8" />
          {/* Decorative blob g2: 160×160, bottom:-60 left:-50 */}
          <div className="pointer-events-none absolute -bottom-15 -left-12.5 w-40 h-40 rounded-full bg-white/5" />

          {/* Back button: absolute top-left, backdrop-blur */}
          <button
            type="button"
            className="absolute top-4 left-4 w-9 h-9 rounded-[10px] border-none cursor-pointer bg-white/18 grid place-items-center z-1 backdrop-blur-[6px]"
            onClick={() => navigate(-1)}
            aria-label="Kembali"
          >
            <ChevronLeft size={18} stroke="white" strokeWidth={2.5} />
          </button>

          {/* Icon — backdrop-blurred rounded square */}
          <div className="w-16 h-16 rounded-[20px] mt-4 mb-3.5 bg-white/18 grid place-items-center relative z-1 backdrop-blur-[6px]">
            {isArisan
              ? <Users size={26} stroke="white" strokeWidth={2} />
              : <Split size={26} stroke="white" strokeWidth={2} />}
          </div>

          {/* Text block */}
          <div className="text-[12px] font-bold opacity-85 relative z-1">Kamu diundang ke {group.typeLabel}</div>
          <div className="text-[26px] font-extrabold tracking-[-0.02em] mt-1 relative z-1">{group.name}</div>
          <div className="text-[13px] opacity-80 mt-1 relative z-1">{group.tagline}</div>

          {/* Stacked member avatars */}
          <div className="flex mt-4 relative z-1">
            {joined.slice(0, 4).map((m, i) => (
              <div
                key={m.initials}
                className={`w-9 h-9 rounded-full border-2 border-white/85 grid place-items-center text-white text-[12px] font-bold${i === 0 ? "" : " -ml-2"}`}
                style={{ background: m.color }}
              >
                {m.initials}
              </div>
            ))}
            {group.members > 4 && (
              <div className="w-9 h-9 rounded-full -ml-2 border-2 border-white/85 grid place-items-center text-white text-[12px] font-bold bg-white/25">
                +{group.members - 4}
              </div>
            )}
          </div>
        </div>

        {/* Content column: centered, max-width 460px */}
        <div className="w-full max-w-115 px-4 pb-10 flex flex-col gap-4">

          {/* Key facts card — overlaps the hero bottom edge by 38px */}
          <div className="flex bg-surface border border-line-soft rounded-card p-3.5 -mt-9.5 relative z-2 shadow-[0_6px_20px_rgba(17,24,39,0.08)]">
            {/* Iuran */}
            <div className="flex-1 text-center min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.04em] text-ink-3">Iuran</div>
              <div className="text-[18px] font-extrabold text-ink-1 mt-0.75 tracking-[-0.02em]">
                {group.iuran}<span className="text-[11px] font-semibold text-ink-3">{group.cadence}</span>
              </div>
            </div>
            {/* Anggota */}
            <div className="flex-1 text-center min-w-0 border-l border-line-soft">
              <div className="text-[10px] font-bold uppercase tracking-[0.04em] text-ink-3">Anggota</div>
              <div className="text-[18px] font-extrabold text-ink-1 mt-0.75 tracking-[-0.02em]">
                {group.members}<span className="text-[11px] font-semibold text-ink-3">/{group.capacity}</span>
              </div>
            </div>
            {/* Admin */}
            <div className="flex-1 text-center min-w-0 border-l border-line-soft">
              <div className="text-[10px] font-bold uppercase tracking-[0.04em] text-ink-3">Admin</div>
              <div className="text-[13px] font-extrabold text-ink-1 mt-0.75 tracking-[-0.02em]">{group.admin}</div>
            </div>
          </div>

          {/* Name field (no signup required) */}
          <label className="flex flex-col gap-1.75">
            <span className="text-[12px] font-bold text-ink-2">Masuk sebagai</span>
            <input
              className="w-full border-[1.5px] border-line rounded-[13px] px-3.5 py-3.5 text-[15px] font-[inherit] text-ink-1 outline-none bg-surface transition-[border-color,box-shadow] duration-150 focus:border-brand-primary focus:shadow-[0_0_0_4px_rgba(16,185,129,0.12)]"
              placeholder="Nama kamu"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={40}
            />
          </label>

          {/* CTA button */}
          <button
            type="button"
            className={`w-full border-none cursor-pointer text-white text-[16px] font-extrabold py-4 rounded-[14px] disabled:opacity-60 disabled:cursor-not-allowed ${isArisan ? "bg-brand-primary shadow-[0_6px_18px_rgba(16,185,129,0.32)]" : "bg-brand-secondary-dark shadow-[0_6px_18px_rgba(139,92,246,0.32)]"}`}
            onClick={join}
            disabled={joining}
          >
            {joining ? "Bergabung…" : "Gabung Sekarang"}
          </button>

          <div className="text-[11.5px] text-ink-3 text-center leading-normal">
            Dengan bergabung kamu setuju ikut iuran {group.iuran}{group.cadence}.
          </div>

        </div>
      </div>
    </div>
  );
}
