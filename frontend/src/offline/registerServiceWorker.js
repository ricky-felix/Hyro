/**
 * Registers the PWA service worker (app-shell caching only — see
 * vite.config.js). Deliberately NOT a React hook: it's called once from
 * main.jsx, outside the React tree, so component tests never have to deal
 * with the `virtual:pwa-register` module. Lifecycle events are broadcast
 * as window CustomEvents instead; <PwaToastBridge> (inside the React tree,
 * where useToast is available) listens for them.
 */
export function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  import("virtual:pwa-register")
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onOfflineReady() {
          window.dispatchEvent(new CustomEvent("hyro:offline-ready"));
        },
        onNeedRefresh() {
          window.dispatchEvent(new CustomEvent("hyro:update-available"));
        },
      });
    })
    .catch(() => {
      // Not running under Vite's PWA build (e.g. a plain `vite preview` of an
      // old build, or the module genuinely isn't there) — app-shell caching
      // just won't be available this session; the app itself is unaffected.
    });
}
