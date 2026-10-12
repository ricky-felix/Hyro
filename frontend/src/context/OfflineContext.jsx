import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { config } from "../config";
import { useAuth } from "./AuthContext";
import { db } from "../offline/db";
import * as outbox from "../offline/outbox";
import { syncNow as runSyncNow, getLastSyncAt } from "../offline/sync";
import { enqueueContribution as enqueueContributionWrite, enqueueGroupSettingsUpdate as enqueueGroupSettingsUpdateWrite } from "../offline/writes";

const OfflineContext = createContext(null);

const SYNC_INTERVAL_MS = 30_000;

/**
 * Owns the offline layer's runtime state: online/offline, last sync time,
 * outbox counts, and the sync triggers (reconnect, app foreground, manual,
 * periodic fallback — iOS has no reliable background sync, so foreground
 * is the trigger that matters most there).
 *
 * A no-op shell when `config.offlineEnabled` is false — every value is a
 * harmless default and syncNow()/enqueue*() are no-ops, so call sites don't
 * need to branch on the flag themselves.
 */
export function OfflineProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [outboxItems, setOutboxItems] = useState([]);
  const [lastError, setLastError] = useState(null);
  const syncingRef = useRef(false);

  const refreshOutboxState = useCallback(async () => {
    if (!config.offlineEnabled) return;
    const [items, p, f, last] = await Promise.all([
      outbox.listOutbox(),
      outbox.pendingCount(),
      outbox.failedCount(),
      getLastSyncAt(),
    ]);
    setOutboxItems(items);
    setPending(p);
    setFailed(f);
    setLastSyncAt(last);
  }, []);

  const syncNow = useCallback(async () => {
    if (!config.offlineEnabled || !isAuthenticated) return { skipped: true };
    if (syncingRef.current) return { skipped: true, reason: "already-syncing" };
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await runSyncNow();
      const failure = result?.outboxResults?.find((r) => !r.ok && r.kind !== "retryable");
      setLastError(failure ? failure.error?.message : null);
      await refreshOutboxState();
      return result;
    } catch (err) {
      setLastError(err?.message || "Gagal sinkronisasi");
      return { skipped: false, error: err };
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isAuthenticated, refreshOutboxState]);

  // ── Network status ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!config.offlineEnabled) return;
    const goOnline = () => {
      setIsOnline(true);
      syncNow();
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [syncNow]);

  // ── App foreground (iOS has no reliable background sync) ───────────────
  useEffect(() => {
    if (!config.offlineEnabled) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") syncNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [syncNow]);

  // ── Periodic fallback (re-checks backoff timers even with no other trigger) ──
  useEffect(() => {
    if (!config.offlineEnabled || !isAuthenticated) return;
    const id = setInterval(syncNow, SYNC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [syncNow, isAuthenticated]);

  // ── Initial sync once authenticated ─────────────────────────────────────
  useEffect(() => {
    if (!config.offlineEnabled || !isAuthenticated) return;
    syncNow();
    refreshOutboxState();
  }, [isAuthenticated, syncNow, refreshOutboxState]);

  // ── Debug-panel / e2e-test bridge ────────────────────────────────────────
  useEffect(() => {
    if (!config.offlineEnabled || typeof window === "undefined") return;
    window.__hyroOffline = {
      db,
      // The raw engine functions, NOT the context's isAuthenticated-gated/
      // current-user-bound wrappers above — a deliberate manual/test-driven
      // sync or write should run (with an explicit userId) even before the
      // auth-gated automatic triggers would fire.
      enqueueContribution: enqueueContributionWrite,
      enqueueGroupSettingsUpdate: enqueueGroupSettingsUpdateWrite,
      syncNow: runSyncNow,
      refreshOutboxState,
      retryItem: async (localId) => {
        await outbox.retryItem(localId);
        await refreshOutboxState();
      },
    };
    return () => {
      delete window.__hyroOffline;
    };
  }, [refreshOutboxState]);

  // Both mutation types are plain functions in src/offline/writes.js (not
  // tied to React context) so useSettlement can call them directly without
  // needing <OfflineProvider> in its render tree. The context just wraps
  // them to also refresh the debug-panel state afterward.
  const enqueueContribution = useCallback(
    async ({ groupId, roundId, amount, proofUrl = null, notes = "" }) => {
      const result = await enqueueContributionWrite({
        userId: user?.id,
        groupId,
        roundId,
        amount,
        proofUrl,
        notes,
      });
      await refreshOutboxState();
      return result;
    },
    [user, refreshOutboxState]
  );

  const enqueueGroupSettingsUpdate = useCallback(
    async ({ groupId, changes, baseSnapshot }) => {
      await enqueueGroupSettingsUpdateWrite({ groupId, changes, baseSnapshot });
      await refreshOutboxState();
    },
    [refreshOutboxState]
  );

  const value = {
    offlineEnabled: config.offlineEnabled,
    isOnline,
    isSyncing,
    lastSyncAt,
    pending,
    failed,
    outboxItems,
    lastError,
    syncNow,
    enqueueContribution,
    enqueueGroupSettingsUpdate,
    retryItem: async (localId) => {
      await outbox.retryItem(localId);
      await refreshOutboxState();
      syncNow();
    },
  };

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used inside <OfflineProvider>");
  return ctx;
}
