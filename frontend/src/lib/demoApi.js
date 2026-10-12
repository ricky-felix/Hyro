/**
 * Simulated API answers for demo mode (see lib/appMode.js).
 *
 * The screen-level mockups (home cards, group detail, members…) come from
 * each screen's static data.js via its hook. This file only covers the
 * requests v2 pages make directly through the services layer, so those
 * pages render something sensible and writes "succeed" without a backend.
 */
import { DemoModeError } from './appMode';

export const DEMO_USER = {
  id: 'demo-user',
  name: 'Ricky Demo',
  email: 'demo@hyro.app',
  phone: '+6281234567890',
  avatar_url: null,
  gender: null,
};

const DEMO_PAYMENT_METHODS = [
  {
    id: 'pm_demo_bca',
    type: 'bank',
    label: 'BCA',
    account_number: '1234567890',
    holder_name: 'Ricky Demo',
    phone: null,
    qris_image_path: null,
    is_primary: true,
    created_at: '2026-06-01T08:00:00Z',
    updated_at: '2026-06-01T08:00:00Z',
  },
  {
    id: 'pm_demo_gopay',
    type: 'gopay',
    label: 'GoPay',
    account_number: null,
    holder_name: null,
    phone: '081234567890',
    qris_image_path: null,
    is_primary: false,
    created_at: '2026-06-02T08:00:00Z',
    updated_at: '2026-06-02T08:00:00Z',
  },
];

const DEMO_TRANSACTIONS = [
  { id: 'tx_demo_1', type: 'arisan',   group_name: 'Arisan Keluarga Sari', description: 'Iuran putaran 8',      amount: 200000, created_at: '2026-10-05T09:00:00Z', status: 'confirmed' },
  { id: 'tx_demo_2', type: 'patungan', group_name: 'Makan Bareng Kantor',  description: 'Bagian tagihan makan', amount: 85000,  created_at: '2026-10-03T12:30:00Z', status: 'confirmed' },
  { id: 'tx_demo_3', type: 'arisan',   group_name: 'Arisan RT 05',         description: 'Iuran putaran 3',      amount: 100000, created_at: '2026-10-01T07:15:00Z', status: 'pending' },
];

// Exact-path GET fixtures.
const GET_FIXTURES = {
  '/users/me': DEMO_USER,
  '/users/me/security': { has_pin: false, app_lock_enabled: false },
  '/users/me/bank-account': {
    bank: 'BCA',
    account_number: '1234567890',
    holder_name: 'Ricky Demo',
  },
  '/users/me/payment-methods': { data: DEMO_PAYMENT_METHODS },
  '/transactions/me': DEMO_TRANSACTIONS,
};

// Pattern GET fixtures (path params).
const GET_PATTERNS = [
  [/^\/users\/[^/]+\/payment-methods$/, { data: DEMO_PAYMENT_METHODS }],
];

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Answer a request in demo mode. GETs resolve from the fixtures above (or
 * reject with DemoModeError, which hooks treat as "show the mockup"). Writes
 * always succeed and echo the body back with a fake id.
 */
export async function demoRequest(method, endpoint, body) {
  await delay(250); // feel like a request, so spinners/toasts still read right
  const path = endpoint.split('?')[0];

  if (method === 'GET') {
    if (path in GET_FIXTURES) return clone(GET_FIXTURES[path]);
    const hit = GET_PATTERNS.find(([re]) => re.test(path));
    if (hit) return clone(hit[1]);
    throw new DemoModeError(endpoint);
  }

  if (method === 'DELETE') return null;

  const now = new Date().toISOString();
  return {
    id: `demo-${Math.random().toString(36).slice(2, 10)}`,
    ...(body ?? {}),
    token: body?.token ?? 'DEMO2026',
    status: body?.status ?? 'pending',
    created_at: now,
    updated_at: now,
  };
}
