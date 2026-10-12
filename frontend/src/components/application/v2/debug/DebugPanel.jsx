import { useEffect, useState } from "react";
import { useOffline } from "../../../../context/OfflineContext";
import { AlertTriangle, Clock, Replay, X } from "../icons";

const STORAGE_KEY = "hyro_debug";

/** Unlocked via ?debug=1 once, then remembered in localStorage — this is a
 * tester/support tool, not something that should be one tap away for every user. */
function useDebugUnlocked() {
  const [unlocked, setUnlocked] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1"
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") {
      localStorage.setItem(STORAGE_KEY, "1");
      setUnlocked(true);
    }
  }, []);

  return unlocked;
}

const TYPE_LABEL = {
  "payment.create": "Catat iuran",
  "group.update": "Ubah setting grup",
};

function formatTime(iso) {
  if (!iso) return "Belum pernah";
  const d = new Date(iso);
  return d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

/** Hidden debug panel — pending outbox queue, last sync time, errors.
 * Unlock once via /app?debug=1 (see TESTING.md), then it's a small floating
 * button bottom-right for the rest of the session. */
export default function DebugPanel() {
  const unlocked = useDebugUnlocked();
  const [open, setOpen] = useState(false);
  const offline = useOffline();

  if (!unlocked || !offline.offlineEnabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Buka panel debug offline"
        className="fixed bottom-24 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-ink-1 text-white shadow-card-lg"
        style={{ opacity: 0.85 }}
      >
        <span className="text-xs font-semibold">
          {offline.isOnline ? "🟢" : "🔴"}
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-9999 flex items-end justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-t-card bg-surface p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink-1">Debug: Sinkronisasi Offline</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup" className="text-ink-2">
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-gray-soft p-3">
                <div className="text-ink-2">Status</div>
                <div className="font-semibold text-ink-1">
                  {offline.isOnline ? "Online" : "Offline"}
                  {offline.isSyncing ? " · Sinkron..." : ""}
                </div>
              </div>
              <div className="rounded-lg bg-gray-soft p-3">
                <div className="text-ink-2">Sinkron terakhir</div>
                <div className="font-semibold text-ink-1">{formatTime(offline.lastSyncAt)}</div>
              </div>
              <div className="rounded-lg bg-gray-soft p-3">
                <div className="text-ink-2">Menunggu</div>
                <div className="font-semibold text-ink-1">{offline.pending}</div>
              </div>
              <div className="rounded-lg bg-gray-soft p-3">
                <div className="text-ink-2">Gagal</div>
                <div className="font-semibold text-ink-1">{offline.failed}</div>
              </div>
            </div>

            {offline.lastError && (
              <div className="mb-4 flex items-start gap-2 rounded-lg bg-error-light p-3 text-sm text-ink-1">
                <AlertTriangle size={16} />
                <span>{offline.lastError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => offline.syncNow()}
              disabled={offline.isSyncing}
              className="mb-4 w-full rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              Sinkron Sekarang
            </button>

            <h3 className="mb-2 text-sm font-semibold text-ink-1">Antrean ({offline.outboxItems.length})</h3>
            {offline.outboxItems.length === 0 && (
              <p className="text-sm text-ink-2">Tidak ada yang menunggu dikirim.</p>
            )}
            <ul className="space-y-2">
              {offline.outboxItems.map((item) => (
                <li key={item.localId} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink-1">
                      {TYPE_LABEL[item.type] ?? item.type}
                    </span>
                    <span
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                        item.status === "failed" ? "bg-error-light text-ink-1" : "bg-warning-light text-ink-1"
                      }`}
                    >
                      {item.status === "failed" ? <AlertTriangle size={12} /> : <Clock size={12} />}
                      {item.status === "failed" ? "Gagal" : "Menunggu"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-ink-2">
                    Dibuat {formatTime(item.createdAt)} · {item.attemptCount}x percobaan
                  </div>
                  {item.lastError && (
                    <div className="mt-1 text-xs text-error">{item.lastError}</div>
                  )}
                  {item.status === "failed" && (
                    <button
                      type="button"
                      onClick={() => offline.retryItem(item.localId)}
                      className="mt-2 flex items-center gap-1 rounded-lg bg-gray-soft px-2.5 py-1 text-xs font-medium text-ink-1"
                    >
                      <Replay size={12} /> Coba lagi
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
