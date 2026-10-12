import { useEffect } from "react";
import { useToast } from "../../../context/ToastContext";
import { config } from "../../../config";

/**
 * Bridges service-worker lifecycle events (dispatched from
 * src/offline/registerServiceWorker.js, outside the React tree) to toasts.
 * Kept separate from the SW registration itself so registration doesn't
 * need to run inside a mounted component.
 */
export default function PwaToastBridge() {
  const toast = useToast();

  useEffect(() => {
    if (!config.offlineEnabled) return;
    const onOfflineReady = () => toast("Hyro siap dipakai offline sekarang ✓");
    const onUpdateAvailable = () =>
      toast("Ada versi baru Hyro — muat ulang biar dapat update terbaru", "warn");
    window.addEventListener("hyro:offline-ready", onOfflineReady);
    window.addEventListener("hyro:update-available", onUpdateAvailable);
    return () => {
      window.removeEventListener("hyro:offline-ready", onOfflineReady);
      window.removeEventListener("hyro:update-available", onUpdateAvailable);
    };
  }, [toast]);

  return null;
}
