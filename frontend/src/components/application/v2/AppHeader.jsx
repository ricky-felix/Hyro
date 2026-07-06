import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useNotifications } from "../../../hooks/useNotifications";
import { Bell, DigiIcon, UserSingle } from "./icons";

// ─────────────────────────────────────────────────────────────
// AppHeader — global v2 app-shell top bar.
//
// This is the outermost chrome for the Hyro v2 app, sitting
// *above* any per-page ScreenHeader. Think "app tab bar" rather
// than "page header".
//
// Layout:
//   [logo + wordmark + greeting]  ...spacer...  [bell] [avatar]
//
// The inner content is aligned to the same 1200px band that
// ScreenHeader uses (mx-auto max-w-[1200px] px-5 lg:px-8), so
// the brand mark and the ScreenHeader's back button share the
// same invisible horizontal rail on every screen.
//
// Props:
//   None — reads auth context for name/initials and notification
//   context for the unread dot. All navigation is internal.
//
// Integration:
//   Render at the top of a v2 screen's v2-inner element, or
//   insert once in AppLayout to cover AppLayout-wrapped screens.
//   HomeDeck's card-deck mode uses its own bespoke StoryTopBar
//   overlay and should suppress AppHeader by not rendering it
//   (StoryTopBar already provides bell + avatar actions).
// ─────────────────────────────────────────────────────────────

/**
 * Derive up-to-two-letter initials from a display name.
 * "Ricky Felix" → "RF", "Ricky" → "RI", "" → null (trigger icon fallback).
 */
function getInitials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AppHeader() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { unreadCount } = useNotifications();

  const displayName = profile?.name?.trim() || "";
  const firstName = displayName.split(" ")[0] || "";
  const initials = getInitials(displayName);
  const hasUnread = unreadCount > 0;

  return (
    <header
      className="app-header-shell sticky top-0 z-40 shrink-0 border-b border-line-soft bg-surface/95 backdrop-blur-sm"
      aria-label="Navigasi aplikasi"
    >
      {/* 1200px inner band — mirrors ScreenHeader's max-w-[1200px] band */}
      <div className="mx-auto flex w-full max-w-[1200px] items-center gap-3 px-5 lg:px-8" style={{ height: 56 }}>

        {/* ── Brand / logo (left) ──────────────────────────────────── */}
        <button
          type="button"
          aria-label="Beranda Hyro"
          onClick={() => navigate("/app")}
          className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-[10px] bg-transparent p-0 border-0 transition-opacity active:opacity-70"
        >
          {/* Logo badge — emerald bg, DigiIcon white */}
          <span
            aria-hidden="true"
            className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] bg-brand-primary"
          >
            <DigiIcon size={16} stroke="white" strokeWidth={2.5} />
          </span>

          {/* Wordmark + greeting */}
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-extrabold tracking-[-0.02em] text-ink-1 lg:text-[16px]">
              Hyro
            </span>
            {/* Greeting sub-line: "Halo, Ricky" — soft contextual touch */}
            <span className="mt-[1px] max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-medium text-ink-2">
              {firstName ? `Halo, ${firstName}` : "Selamat datang"}
            </span>
          </span>
        </button>

        {/* ── Spacer ────────────────────────────────────────────────── */}
        <span className="flex-1" aria-hidden="true" />

        {/* ── Right-side action cluster ─────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-1.5">

          {/* Notification bell */}
          <button
            type="button"
            aria-label={hasUnread ? `Notifikasi (${unreadCount} belum dibaca)` : "Notifikasi"}
            onClick={() => navigate("/app/notifikasi")}
            className="relative grid h-9 w-9 place-items-center rounded-[12px] bg-gray-soft text-ink-1 transition-colors hover:bg-line active:bg-line"
          >
            <Bell size={17} strokeWidth={2.2} />
            {/* Unread dot — danger red, white border */}
            {hasUnread && (
              <span
                aria-hidden="true"
                className="absolute right-[5px] top-[5px] h-2 w-2 rounded-full border-2 border-surface bg-error"
              />
            )}
          </button>

          {/* Profile avatar */}
          <button
            type="button"
            aria-label="Profil saya"
            onClick={() => navigate("/app/profil")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-brand-primary-soft bg-brand-primary text-[12px] font-extrabold tracking-[-0.01em] text-white transition-[border-color,transform] hover:border-brand-primary active:scale-90"
          >
            {initials ? (
              initials
            ) : (
              /* Fallback icon while profile loads */
              <UserSingle size={16} stroke="white" strokeWidth={2.25} />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
