import { Users, Split } from "../icons";
import NotifBubble from "./NotifBubble";

/**
 * LiveNotifList — renders real notifications (GET /notifications) in the same
 * bubble layout as the static Notifikasi mockup.
 *
 * Props:
 *   notifications  Array<{ id, type, title, body, metadata, is_read, created_at }>
 *   loading        boolean
 *   error          string | null
 *   onOpen         (notification) => void — tapping a bubble (marks it read)
 */

// Types that ask the user to do something sit on the right ("perlu tindakanmu").
const ACTION_TYPES = new Set([
  "payment_due",
  "payment_rejected",
  "bill_reminder",
  "settlement_rejected",
]);

const PATUNGAN_PREFIXES = ["bill_", "settlement_"];

function domainOf(type = "") {
  return PATUNGAN_PREFIXES.some(p => type.startsWith(p)) ? "patungan" : "arisan";
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("id-ID", { weekday: "long", hour: "2-digit", minute: "2-digit" });
}

export default function LiveNotifList({ notifications, loading, error, onOpen }) {
  if (loading) {
    return (
      <div className="convo-wrap">
        <div className="tail-bub">
          <div className="tail-pill">Memuat notifikasi…</div>
        </div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="convo-wrap">
        <div className="tail-bub">
          <div className="tail-pill">
            {error ? "Gagal memuat notifikasi — cek koneksi kamu" : "Belum ada notifikasi"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="convo-wrap">
      {notifications.map(n => {
        const domain = domainOf(n.type);
        const side = ACTION_TYPES.has(n.type) ? "outgoing" : "incoming";
        const groupName = n.metadata?.group_name ?? n.metadata?.bill_title ?? null;
        return (
          <NotifBubble
            key={n.id}
            side={side}
            avatar={domain === "arisan"
              ? <Users size={16} stroke="currentColor" strokeWidth={2} />
              : <Split size={16} stroke="currentColor" strokeWidth={2} />}
          >
            <button
              type="button"
              className={`bub-card ${domain}${n.is_read ? "" : " unread"} w-full text-left`}
              onClick={() => onOpen(n)}
            >
              <div className={`bub-tag ${domain}`}>
                {domain === "arisan"
                  ? <Users size={8} stroke="currentColor" strokeWidth={2.5} />
                  : <Split size={8} stroke="currentColor" strokeWidth={2.5} />}
                {domain === "arisan" ? "Arisan" : "Patungan"}
                {groupName ? ` · ${groupName}` : ""}
              </div>
              <div className="bub-text">
                <strong>{n.title}</strong>
                {n.body ? <> {n.body}</> : null}
              </div>
              <div className="bub-time">{formatTime(n.created_at)}</div>
            </button>
          </NotifBubble>
        );
      })}

      <div className="tail-bub">
        <div className="tail-pill">Itu semua notifikasi terbaru</div>
      </div>
    </div>
  );
}
