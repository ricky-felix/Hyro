import { useOffline } from "../../../context/OfflineContext";

/**
 * Subtle, app-wide offline/online indicator + manual "sync now". Renders
 * nothing when online with an empty queue — it should be unnoticeable
 * during normal use and only speak up when it matters.
 */
export default function OfflineBanner() {
  const offline = useOffline();

  if (!offline.offlineEnabled) return null;
  if (offline.isOnline && offline.pending === 0 && offline.failed === 0) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-2 bg-ink-1 px-4 py-1.5 text-center text-xs font-medium text-white">
      {!offline.isOnline && <span>Lagi offline — perubahanmu aman, nanti disinkron otomatis</span>}
      {offline.isOnline && offline.failed > 0 && (
        <span>{offline.failed} perubahan gagal dikirim — cek lagi datanya</span>
      )}
      {offline.isOnline && offline.failed === 0 && offline.pending > 0 && (
        <span>Menyinkronkan {offline.pending} perubahan...</span>
      )}
      {offline.isOnline && (offline.pending > 0 || offline.failed > 0) && (
        <button
          type="button"
          onClick={() => offline.syncNow()}
          disabled={offline.isSyncing}
          className="underline disabled:opacity-60"
        >
          Sinkron sekarang
        </button>
      )}
    </div>
  );
}
