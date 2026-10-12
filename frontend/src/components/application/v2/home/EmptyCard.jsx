import { Plus, Sparkle } from "../icons";
import CardBlobs from "./CardBlobs";

/**
 * EmptyCard — card-shaped welcome shown on the home deck when the account is
 * genuinely empty (no arisan, no patungan). Mirrors StoryCard's layout and the
 * profile-banner gradient, with positive onboarding copy and a CTA that opens
 * the compose sheet.
 *
 * Props:
 *   onCta    () => void — called when "Mulai Sekarang" is pressed (open compose)
 *   onDemo   () => void — optional; renders a secondary "coba grup demo" link
 *                         (testers only — see HomeDeck)
 *   demoBusy boolean    — disables the demo link while it's creating the group
 */
export default function EmptyCard({ onCta, onDemo, demoBusy }) {
  return (
    <div className="story-card card-empty card-active">
      <CardBlobs />

      <div className="card-chips">
        <div className="card-badge">
          <Sparkle size={9} stroke="white" strokeWidth={2.5} />
          Kosong
        </div>
      </div>

      <div className="card-eyebrow">Belum ada Arisan atau Patungan</div>
      <div className="card-hero-amount empty-hero">Kelola uang bareng</div>
      <div className="card-due-line">
        Buat arisan atau patungan — ajak teman, keluarga, dan komunitas kamu! Atau gunakan untuk keperluan business, semua jadi lebih gampang.
      </div>

      <button type="button" className="card-cta empty-cta" onClick={onCta}>
        <Plus size={16} stroke="currentColor" strokeWidth={2.5} />
        Mulai Sekarang
      </button>

      {onDemo && (
        <button
          type="button"
          onClick={onDemo}
          disabled={demoBusy}
          className="empty-cta-secondary"
          style={{
            marginTop: 8, background: "transparent", border: "none",
            color: "white", opacity: 0.85, fontSize: 13, textDecoration: "underline",
          }}
        >
          {demoBusy ? "Bikin grup demo..." : "Coba Grup Demo dulu"}
        </button>
      )}
    </div>
  );
}
