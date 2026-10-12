/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Expose these exact names to the client in addition to VITE_*. envPrefix is
// a prefix match, so list full names only — never 'SUPABASE_': Vercel's
// Supabase integration also sets SUPABASE_SERVICE_ROLE_KEY, SUPABASE_SECRET_KEY
// and SUPABASE_JWT_SECRET, which must never be bundled.
const ENV_PREFIX = [
  'VITE_',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'GATE_PASSWORD_REAL',
]

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    envPrefix: ENV_PREFIX,
    plugins: [
      react(),
      tailwindcss(),
      // App-shell caching only — installable PWA shell + offline fallback for
      // navigation. Does NOT cache API calls; those are handled by the offline
      // sync engine (src/offline/), which is a separate, feature-flagged layer.
      VitePWA({
        registerType: 'autoUpdate',
        // Registered manually from src/main.jsx via virtual:pwa-register so we
        // can surface "ready offline" / "update available" toasts.
        injectRegister: false,
        // We already ship our own public/favicon/site.webmanifest (linked from
        // index.html with start_url/scope/id set) — don't generate a second one.
        manifest: false,
        includeManifestIcons: false,
        devOptions: { enabled: true, type: 'module' },
        workbox: {
          // Precache the built app shell (JS/CSS/HTML/fonts/images) and fall
          // back to index.html for any same-origin navigation that isn't
          // precached — lets the app open offline on a deep link.
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        },
      }),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      css: true,
      // Unit/component tests only — Playwright e2e specs live under e2e/ and run separately.
      exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    },
  }
})
