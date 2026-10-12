// Vitest global setup — runs before every test file.
// Adds jest-dom matchers (toBeInTheDocument, toHaveClass, …) and clears the
// DOM between tests so component renders don't leak across cases.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
// jsdom has no IndexedDB — the offline layer (src/offline/) uses Dexie, so
// tests need this polyfill to exercise it without a real browser.
import 'fake-indexeddb/auto'

afterEach(() => {
  cleanup()
})
