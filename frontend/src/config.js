export const config = {
  webappUrl: import.meta.env.VITE_WEBAPP_URL || 'http://localhost:3000',
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  // Feature flag for the offline-first layer (local cache, outbox, PWA
  // install prompt wiring). Defaults OFF so the existing online-only
  // behavior is unaffected unless explicitly enabled.
  offlineEnabled: import.meta.env.VITE_OFFLINE_ENABLED === 'true',
};

export const routes = {
  login: "/login",
  // MVP has no login — "Coba Sekarang" CTAs open the app directly.
  app: "/app",
};
