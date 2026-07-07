---
name: project-test-setup
description: Frontend unit test infra — framework, runner, commands, and key patterns for Hyro
metadata:
  type: project
---

Test runner: **Vitest 4** + jsdom, configured in `frontend/vite.config.js` (test block). Globals are enabled (describe/it/expect/vi without imports). Setup file at `frontend/src/test/setup.js` loads jest-dom and calls cleanup().

**Commands:**
- `npm test` — watch mode
- `npm run test:run` — single run
- `npm run test:coverage` — coverage (v8)

**Conventions established:**
- Tests co-located next to source: `formatRupiah.js` → `formatRupiah.test.js`
- For components: `ScreenHeader.jsx` → `ScreenHeader.test.jsx` beside the component
- Services are thin wrappers over `api.js` — mock `'../lib/api'` with `{ api: { get, post, patch, put, delete: vi.fn() } }`
- Supabase is mocked via `vi.mock('../lib/supabase', ...)`; the mock needs to include `onAuthStateChange` returning a subscription with `unsubscribe`
- Framer Motion mock for Toast/animation tests: mock `'framer-motion'` with `AnimatePresence` as passthrough and `motion.div` as a plain div

**Known gotcha — ToastContext:**
Do NOT use `userEvent.setup({ advanceTimers })` with `vi.useFakeTimers()` inside individual tests — it causes 5 s timeouts. Use `fireEvent.click` + `act(() => { vi.advanceTimersByTime(...) })` instead.

**Known gotcha — AuthContext "throws outside provider":**
React prints two `console.error` lines when a component throws outside an error boundary. These are cosmetic — the test PASSES. Suppress with `vi.spyOn(console, 'error').mockImplementation(() => {})` in a try/finally.

**Coverage baseline (first run 2026-06-08):**
- Statements: 88% (367/417)
- Branches: 84.61% (209/247)
- Functions: 77.01% (124/161)
- Lines: 88.94% (338/380)
- 240 tests across 18 test files, duration ~2 s

**Coverage after expansion (2026-06-15):**
- Statements: 91.18% (579/635)
- Branches: 87.53% (330/377)
- Functions: 84.74% (200/236)
- Lines: 92.2% (532/577)
- 414 tests across 38 test files, duration ~3.5 s
- New files added: contacts/payments/storage/transactions/users services; useCreateGroup/useCreateBill/useInvite/useSettlement hooks; NotifBubble/GroupLabel/ReminderButton/ProgressIuran/RecipientCard/DeleteConfirmModal/MethodCard/WalletCard/MenuSection/SegFilter/FauxQr components

**SegFilter selector pattern:** Both desktop pill and mobile trigger render buttons with matching names. Use `getAllByRole` + `.find(t => t.getAttribute('aria-haspopup') === 'listbox')` to get the mobile trigger specifically.

**WalletCard/MethodCard:** Some values appear in multiple DOM locations (stats + due-strip). Use `getAllByText` + length assertion instead of `getByText` when text naturally duplicates.

**Why:** [[project-context]]
