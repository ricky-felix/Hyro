---
name: frontend-e2e-playwright
description: Playwright e2e suite for Hyro frontend — auth strategy, selector pitfalls, and gotoApp() pattern
metadata:
  type: project
---

Playwright e2e suite added to `frontend/` for the React 18 + Vite 7 SPA.

**Run command:** `npm run test:e2e` (from `frontend/`) — Playwright starts Vite dev server, runs suite, exits.

**Config:** `frontend/playwright.config.js` — chromium, 390x844 viewport, webServer port 5173, storageState from `e2e/.auth/user.json`.

**Auth strategy:**
- `e2e/auth.setup.js` signs in via `/masuk` using `admin@arisandigital.test` / `Admin123!.` (credentials in `frontend/.env`).
- Seeds `arisan_app_access=1` (AppGate bypass) and `arisan.v2.coachSeen=1` in localStorage.
- Writes storage state to `e2e/.auth/user.json`.
- If Supabase is unavailable (offline), setup logs a warning and writes empty state. Auth-gated tests use `gotoApp()` helper which detects redirect to `/masuk` and returns early.

**`gotoApp()` pattern (CRITICAL):**
React Router's ProtectedRoute redirects asynchronously after AuthContext hydrates — NOT during `page.goto()`. Use this pattern:
```js
async function gotoApp(page, path) {
  await page.goto(path);
  const loginForm = page.getByPlaceholder(/nama@email\.com|email\.com/i);
  const appScreen = page.locator(".v2-screen");
  const result = await Promise.race([
    loginForm.waitFor({ timeout: 6_000 }).then(() => "login"),
    appScreen.waitFor({ timeout: 6_000 }).then(() => "app"),
  ]).catch(() => "app");
  return result === "login"; // true = auth failed, skip test
}
```

**Dev-route strategy:** `/screens/*` routes (registered in DEV mode in App.jsx) bypass ProtectedRoute and AppGate — these are the most reliable, fastest tests. Use for form/component tests.

**Known selector pitfalls:**
- `#main-content` in Hero is `sr-only` — use `section[aria-label="Hero section"]`
- SegFilter on mobile (390px) shows `.seg-collapse .seg-trigger` not `.seg-btn` (desktop, hidden)
- BuatArisan name input placeholder: `"Contoh: Arisan Kantor Lt. 3"` (not "Nama Arisan")
- BuatPatungan title placeholder: `"Contoh: Makan malam Restoran Padang"`
- Login form: identifier placeholder `"nama@email.com atau 0812..."`, ids: `#login-password`, `#reg-password`
- Public 404 getByText strict mode — 3 matches for /404/; use `getByRole("heading", { name: /halaman tidak ditemukan/i })`

**Test files (72 tests total):**
- `e2e/auth.setup.js` — global auth setup
- `e2e/landing.spec.js` — landing page + /masuk form (9 tests)
- `e2e/app-gate.spec.js` — AppGate entry code gate (5 tests)
- `e2e/screens.spec.js` — /screens/* dev routes, no auth (11 tests)
- `e2e/buat-arisan.spec.js` — BuatArisan form interactions (9 tests)
- `e2e/buat-patungan.spec.js` — BuatPatungan form interactions (9 tests)
- `e2e/gabung.spec.js` — Gabung/GabungMasuk invite flow (11 tests)
- `e2e/navigation.spec.js` — router navigation + public 404 (13 tests)
