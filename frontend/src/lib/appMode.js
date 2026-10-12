/**
 * App mode — chosen at the /masuk password gate (see LoginOrRegister.jsx).
 *
 *   "demo" — the demo gate password. No login, no network: every v2 screen
 *            renders its static mockup data and writes are simulated.
 *   "real" — the real gate password. Normal login, and screens show only
 *            live API data (or the offline cache) — never mockups.
 *
 * Stored in sessionStorage so it lasts for the tab and resets when the tab
 * closes. Every access is wrapped in try/catch because storage can throw
 * (private mode, blocked site data).
 */
const MODE_KEY = 'hyro_app_mode';

export const MODE_DEMO = 'demo';
export const MODE_REAL = 'real';

export function getAppMode() {
  try {
    const mode = sessionStorage.getItem(MODE_KEY);
    return mode === MODE_DEMO || mode === MODE_REAL ? mode : null;
  } catch {
    return null;
  }
}

export function setAppMode(mode) {
  try {
    sessionStorage.setItem(MODE_KEY, mode);
  } catch {
    // Storage unavailable — the gate will simply ask again next load.
  }
}

export function clearAppMode() {
  try {
    sessionStorage.removeItem(MODE_KEY);
  } catch {
    // ignore
  }
}

export const isDemoMode = () => getAppMode() === MODE_DEMO;

/**
 * Error thrown by the API client in demo mode for any request it has no
 * simulated answer for, so nothing ever reaches the real backend.
 */
export class DemoModeError extends Error {
  constructor(endpoint) {
    super(`Demo mode: no network request made (${endpoint})`);
    this.name = 'DemoModeError';
    this.isDemo = true;
  }
}
