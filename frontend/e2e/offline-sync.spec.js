/**
 * offline-sync.spec.js — end-to-end tests for the offline-first layer
 * (src/offline/). Covers the 7 required scenarios: single-device record +
 * reconnect, two devices, duplicate submit + flaky network, server
 * rejection, concurrent settings edit, long offline gap, and a local
 * schema migration.
 *
 * These drive the real client code (src/offline/writes.js, outbox.js,
 * sync.js — the same functions useSettlement() calls) through
 * `window.__hyroOffline`, a small bridge OfflineContext exposes only when
 * `VITE_OFFLINE_ENABLED=true` (see context/OfflineContext.jsx). The actual
 * backend is never hit — every request is intercepted with page.route()
 * and answered with fixtures shaped exactly like the real FastAPI
 * endpoints (see backend/app/sync, backend/app/payments,
 * backend/app/groups — covered on the server side by their own pytest
 * suites). This keeps the suite deterministic and independent of whether
 * a live Supabase/backend is reachable from this environment.
 *
 * No real login is needed: OfflineProvider (and its debug bridge) mounts
 * at the top of <App>, above <ProtectedRoute>, so the unguarded dev route
 * /screens/beranda is enough to exercise it. `window.__hyroOffline`'s
 * enqueue-ish functions and syncNow are the raw engine functions (not the
 * auth-gated React context wrappers), so they work the same with or
 * without a session — exactly what a background sync tick needs to do too.
 */
import { test, expect } from "playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

async function gotoApp(page) {
  await page.addInitScript(() => {
    localStorage.setItem("arisan.v2.coachSeen", "1");
  });
  // HomeDeck's own (unrelated) data fetch — silence it so it doesn't spam
  // the console; not what's under test here.
  await page.route("**/groups", (route) => route.fulfill({ json: [] }));
  await page.route("**/bills", (route) => route.fulfill({ json: [] }));

  await page.goto("/screens/beranda?debug=1");
  await page.waitForFunction(() => !!window.__hyroOffline, { timeout: 15_000 });
}

function pullResponse(overrides = {}) {
  return {
    server_time: new Date().toISOString(),
    group_ids: [],
    groups: [],
    group_members: [],
    rounds: [],
    payments: [],
    notifications: [],
    ...overrides,
  };
}

async function mockPull(page, response) {
  await page.route("**/sync/pull**", (route) => route.fulfill({ json: response }));
}

async function outboxCount(page) {
  return page.evaluate(() => window.__hyroOffline.db.outbox.count());
}

async function waitForOutboxEmpty(page) {
  await page.waitForFunction(async () => (await window.__hyroOffline.db.outbox.count()) === 0, {
    timeout: 10_000,
  });
}

test.describe("Offline sync engine", () => {
  // ── 1. Record a contribution offline, reconnect, verify it syncs once ──
  test("records a contribution offline and syncs exactly once on reconnect", async ({
    page,
    context,
  }) => {
    await mockPull(page, pullResponse({ group_ids: ["g1"], rounds: [{ id: "r1", group_id: "g1" }] }));

    let createCalls = 0;
    const sentIds = [];
    await page.route("**/payments", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      createCalls++;
      const body = route.request().postDataJSON();
      sentIds.push(body.id);
      await route.fulfill({
        json: { id: body.id, round_id: body.round_id, amount: body.amount, status: "pending" },
      });
    });

    await gotoApp(page);
    await page.evaluate(() => window.__hyroOffline.syncNow()); // caches round r1
    await page.waitForFunction(() => window.__hyroOffline.db.rounds.get("r1").then(Boolean));

    await context.setOffline(true);
    const row = await page.evaluate(() =>
      window.__hyroOffline.enqueueContribution({ userId: "u1", roundId: "r1", amount: 50000 })
    );
    expect(row.status).toBe("pending");
    expect(row.group_id).toBe("g1"); // resolved from the cached round, no network needed
    expect(createCalls).toBe(0); // nothing sent while offline

    await context.setOffline(false);
    await page.evaluate(() => window.__hyroOffline.syncNow());
    await waitForOutboxEmpty(page);

    expect(createCalls).toBe(1); // sent exactly once
    expect(sentIds).toEqual([row.id]);
    const cached = await page.evaluate((id) => window.__hyroOffline.db.payments.get(id), row.id);
    expect(cached.status).toBe("pending");
  });

  // ── 2. Two devices write offline, then reconnect ────────────────────────
  test("two devices each record their own contribution offline, both land on reconnect", async ({
    browser,
  }) => {
    async function setUpDevice(payerId) {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const page = await ctx.newPage();
      await mockPull(page, pullResponse({ group_ids: ["g1"], rounds: [{ id: "r1", group_id: "g1" }] }));
      let calls = 0;
      await page.route("**/payments", async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        calls++;
        const body = route.request().postDataJSON();
        await route.fulfill({ json: { ...body, status: "pending" } });
      });
      await gotoApp(page);
      await page.evaluate(() => window.__hyroOffline.syncNow());
      await page.waitForFunction(() => window.__hyroOffline.db.rounds.get("r1").then(Boolean));
      return { ctx, page, getCalls: () => calls };
    }

    const deviceA = await setUpDevice("uA");
    const deviceB = await setUpDevice("uB");

    await deviceA.ctx.setOffline(true);
    await deviceB.ctx.setOffline(true);

    const rowA = await deviceA.page.evaluate(() =>
      window.__hyroOffline.enqueueContribution({ userId: "uA", roundId: "r1", amount: 50000 })
    );
    const rowB = await deviceB.page.evaluate(() =>
      window.__hyroOffline.enqueueContribution({ userId: "uB", roundId: "r1", amount: 50000 })
    );
    expect(rowA.id).not.toBe(rowB.id);

    await deviceA.ctx.setOffline(false);
    await deviceB.ctx.setOffline(false);
    await deviceA.page.evaluate(() => window.__hyroOffline.syncNow());
    await deviceB.page.evaluate(() => window.__hyroOffline.syncNow());
    await waitForOutboxEmpty(deviceA.page);
    await waitForOutboxEmpty(deviceB.page);

    expect(deviceA.getCalls()).toBe(1);
    expect(deviceB.getCalls()).toBe(1);

    await deviceA.ctx.close();
    await deviceB.ctx.close();
  });

  // ── 3. Duplicate submit and flaky network — retries must not double-count ──
  test.describe("duplicate submit and flaky network", () => {
    test("a retried send after a network failure uses the same id and settles once", async ({
      page,
    }) => {
      await mockPull(page, pullResponse({ group_ids: ["g1"], rounds: [{ id: "r1", group_id: "g1" }] }));

      let attempts = 0;
      const sentIds = [];
      await page.route("**/payments", async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        attempts++;
        const body = route.request().postDataJSON();
        sentIds.push(body.id);
        if (attempts === 1) {
          await route.abort("failed"); // flaky network on the first attempt
          return;
        }
        await route.fulfill({ json: { ...body, status: "pending" } });
      });

      await gotoApp(page);
      await page.evaluate(() => window.__hyroOffline.syncNow());
      await page.waitForFunction(() => window.__hyroOffline.db.rounds.get("r1").then(Boolean));

      const row = await page.evaluate(() =>
        window.__hyroOffline.enqueueContribution({ userId: "u1", roundId: "r1", amount: 20000 })
      );

      await page.evaluate(() => window.__hyroOffline.syncNow()); // 1st attempt — fails
      expect(await outboxCount(page)).toBe(1); // still queued, backing off

      // Fast-forward past the backoff window instead of waiting for real time.
      await page.evaluate(async () => {
        const items = await window.__hyroOffline.db.outbox.toArray();
        await window.__hyroOffline.db.outbox.update(items[0].localId, {
          lastAttemptAt: new Date(Date.now() - 60_000).toISOString(),
        });
      });

      await page.evaluate(() => window.__hyroOffline.syncNow()); // 2nd attempt — succeeds
      await waitForOutboxEmpty(page);

      expect(attempts).toBe(2);
      expect(sentIds).toEqual([row.id, row.id]); // both attempts carried the SAME client id
      expect(await page.evaluate(() => window.__hyroOffline.db.payments.count())).toBe(1); // not duplicated
    });

    test("a genuine double-submit for the same round is rejected, not double-counted", async ({
      page,
    }) => {
      await mockPull(page, pullResponse({ group_ids: ["g1"], rounds: [{ id: "r1", group_id: "g1" }] }));

      const seenForRound = new Set();
      await page.route("**/payments", async (route) => {
        if (route.request().method() !== "POST") return route.fallback();
        const body = route.request().postDataJSON();
        if (seenForRound.has(body.round_id)) {
          await route.fulfill({
            status: 400,
            json: { message: "You have already submitted a payment for this round" },
          });
          return;
        }
        seenForRound.add(body.round_id);
        await route.fulfill({ json: { ...body, status: "pending" } });
      });

      await gotoApp(page);
      await page.evaluate(() => window.__hyroOffline.syncNow());
      await page.waitForFunction(() => window.__hyroOffline.db.rounds.get("r1").then(Boolean));

      // Simulates a double-tap bypassing the UI's disabled-while-submitting
      // guard: both writes are queued before either's own fire-and-forget
      // sync (enqueueContribution triggers one — see writes.js) has a
      // chance to run, same as two taps a few hundred ms apart would.
      const [first, second] = await page.evaluate(() =>
        Promise.all([
          window.__hyroOffline.enqueueContribution({ userId: "u1", roundId: "r1", amount: 20000 }),
          window.__hyroOffline.enqueueContribution({ userId: "u1", roundId: "r1", amount: 20000 }),
        ])
      );

      // Drive it to completion explicitly rather than trust the two
      // fire-and-forget syncs to land in enqueue order — a real client
      // wouldn't rely on that ordering either, only on the end state: one
      // iuran stuck, one rejected, never two "pending" rows.
      await page.waitForFunction(
        async () => {
          const offline = window.__hyroOffline;
          await offline.syncNow();
          const failedCount = await offline.db.outbox.where("status").equals("failed").count();
          const pendingLeft = await offline.db.outbox.where("status").equals("pending").count();
          return failedCount === 1 && pendingLeft === 0;
        },
        { timeout: 10_000 }
      );

      const rows = await page.evaluate(() => window.__hyroOffline.db.payments.toArray());
      const landed = rows.filter((r) => r.status === "pending");
      const rejected = rows.filter((r) => r.status === "failed");
      expect(landed).toHaveLength(1); // exactly one of the two landed — never double-counted
      expect(rejected).toHaveLength(1); // the other was rejected and surfaced, not silently dropped
      expect([first.id, second.id]).toContain(landed[0].id);
      expect([first.id, second.id]).toContain(rejected[0].id);
    });
  });

  // ── 4. The server rejects an offline write ──────────────────────────────
  test("a rejected settings edit ends up failed and visible in the debug panel, not silently dropped", async ({
    page,
  }) => {
    await mockPull(page, pullResponse({ group_ids: ["g1"], groups: [{ id: "g1", name: "Old Name" }] }));
    await page.route("**/groups/**", async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      await route.fulfill({ status: 403, json: { message: "You are not an admin of this group" } });
    });

    await gotoApp(page);
    await page.evaluate(() => window.__hyroOffline.syncNow()); // caches group g1

    await page.evaluate(() =>
      window.__hyroOffline.enqueueGroupSettingsUpdate({
        groupId: "g1",
        changes: { name: "Sneaky Rename" },
        baseSnapshot: { name: "Old Name" },
      })
    );
    await page.evaluate(() => window.__hyroOffline.syncNow());

    await page.waitForFunction(
      async () => (await window.__hyroOffline.db.outbox.where("status").equals("failed").count()) === 1,
      { timeout: 10_000 }
    );
    const items = await page.evaluate(() => window.__hyroOffline.db.outbox.toArray());
    expect(items[0].lastError).toMatch(/not an admin/i);

    // Surfaced in the debug panel UI too, not just in IndexedDB. The panel
    // reads from React context state, which (unlike the bridge calls above)
    // only refreshes on its own triggers — force one so the UI reflects
    // what we just did to the raw engine state.
    await page.evaluate(() => window.__hyroOffline.refreshOutboxState());
    await page.getByRole("button", { name: "Buka panel debug offline" }).click();
    const queueItem = page.locator("li").filter({ hasText: "Ubah setting grup" });
    await expect(queueItem).toBeVisible();
    await expect(queueItem.getByText("Gagal", { exact: true })).toBeVisible();
    await expect(queueItem.getByText(/not an admin/i)).toBeVisible();
  });

  // ── 5. Organizer changes group settings while a member is offline ──────
  test("the server's per-field conflict resolution wins over this device's own queued edit", async ({
    page,
  }) => {
    await mockPull(page, pullResponse({ group_ids: ["g1"], groups: [{ id: "g1", name: "Old Name", description: "Old Desc" }] }));
    await gotoApp(page);
    await page.evaluate(() => window.__hyroOffline.syncNow()); // this device caches "Old Name" while online

    // The organizer changes the group's name online while this device is
    // offline. The mock PATCH response is exactly the shape the real
    // backend returns (see backend/app/groups/service.py, tested there):
    // the field this device also tried to change collided, so the server's
    // value wins and it's reported back as overridden.
    await page.route("**/groups/**", async (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      await route.fulfill({
        json: {
          id: "g1",
          name: "Organizer's New Name",
          description: "Old Desc",
          overridden_fields: ["name"],
        },
      });
    });
    // syncNow() pulls right after draining the outbox — keep the pull fixture
    // consistent with the organizer's change, same as a real pull would be.
    await mockPull(
      page,
      pullResponse({
        group_ids: ["g1"],
        groups: [{ id: "g1", name: "Organizer's New Name", description: "Old Desc" }],
      })
    );

    await page.evaluate(() =>
      window.__hyroOffline.enqueueGroupSettingsUpdate({
        groupId: "g1",
        changes: { name: "My Offline Guess" },
        baseSnapshot: { name: "Old Name" },
      })
    );
    await page.evaluate(() => window.__hyroOffline.syncNow());
    await waitForOutboxEmpty(page);

    const group = await page.evaluate(() => window.__hyroOffline.db.groups.get("g1"));
    // The organizer's (server-authoritative) value wins, not this device's
    // stale offline guess — and the optimistic local flag is cleared.
    expect(group.name).toBe("Organizer's New Name");
    expect(group._local).toBeUndefined();
  });

  // ── 6. Long offline gap, then reconnect ─────────────────────────────────
  test("a long offline gap still syncs a full catch-up pull and retries old queued writes", async ({
    page,
  }) => {
    await mockPull(page, pullResponse({ group_ids: ["g1"], rounds: [{ id: "r1", group_id: "g1" }] }));
    await page.route("**/payments", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      const body = route.request().postDataJSON();
      await route.fulfill({ json: { ...body, status: "pending" } });
    });

    await gotoApp(page);
    await page.evaluate(() => window.__hyroOffline.syncNow());
    await page.waitForFunction(() => window.__hyroOffline.db.rounds.get("r1").then(Boolean));

    await page.evaluate(() =>
      window.__hyroOffline.enqueueContribution({ userId: "u1", roundId: "r1", amount: 30000 })
    );
    // Simulate several failed background-sync attempts spread across a long
    // offline stretch (e.g. overnight) by back-dating the outbox item far
    // beyond even the longest backoff step.
    await page.evaluate(async () => {
      const items = await window.__hyroOffline.db.outbox.toArray();
      await window.__hyroOffline.db.outbox.update(items[0].localId, {
        attemptCount: 4,
        lastAttemptAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12h ago
      });
    });

    // The server has moved on too — a fresh server_time far later than the
    // stale local cursor is exactly what a real "since=<old cursor>" pull
    // would get back; the client doesn't need any special-case handling.
    const farFuture = new Date(Date.now() + 1000).toISOString();
    await mockPull(
      page,
      pullResponse({
        server_time: farFuture,
        group_ids: ["g1"],
        rounds: [{ id: "r1", group_id: "g1", status: "completed" }], // round moved on while away
      })
    );

    await page.evaluate(() => window.__hyroOffline.syncNow());
    await waitForOutboxEmpty(page); // the long-overdue retry still goes through

    const round = await page.evaluate(() => window.__hyroOffline.db.rounds.get("r1"));
    expect(round.status).toBe("completed");
    expect(await page.evaluate(() => window.__hyroOffline.db.payments.count())).toBe(1);
  });

  // ── 7. Local schema migration ───────────────────────────────────────────
  test("upgrading from the v1 local schema preserves data and backfills new fields", async ({
    page,
  }) => {
    // Seed a v1-shaped IndexedDB database via an init script — it runs
    // before ANY of the app's own scripts (including main.jsx), on the
    // app's actual origin, so this really does land as "existing data from
    // before the update" by the time Dexie (v1+v2 schema, see
    // src/offline/db.js) opens the same database and upgrades it.
    await page.addInitScript(() => {
      const req = indexedDB.open("hyro-offline", 1);
      req.onupgradeneeded = (e) => {
        const idb = e.target.result;
        const groups = idb.createObjectStore("groups", { keyPath: "id" });
        groups.createIndex("updated_at", "updated_at");
        const members = idb.createObjectStore("group_members", { keyPath: "id" });
        members.createIndex("group_id", "group_id");
        members.createIndex("user_id", "user_id");
        const rounds = idb.createObjectStore("rounds", { keyPath: "id" });
        rounds.createIndex("group_id", "group_id");
        const payments = idb.createObjectStore("payments", { keyPath: "id" });
        payments.createIndex("group_id", "group_id");
        payments.createIndex("round_id", "round_id");
        payments.createIndex("payer_id", "payer_id");
        const notifications = idb.createObjectStore("notifications", { keyPath: "id" });
        notifications.createIndex("user_id", "user_id");
        idb.createObjectStore("meta", { keyPath: "key" });
        const outbox = idb.createObjectStore("outbox", { keyPath: "localId", autoIncrement: true });
        outbox.createIndex("status", "status");
        outbox.createIndex("createdAt", "createdAt");
      };
      req.onsuccess = (e) => {
        const idb = e.target.result;
        const tx = idb.transaction(["outbox", "groups"], "readwrite");
        // A write queued by a pre-update build — no attemptCount field yet.
        tx.objectStore("outbox").add({
          type: "payment.create",
          clientId: "legacy-1",
          payload: { id: "legacy-1", round_id: "r1", amount: 10000 },
          status: "pending",
          createdAt: "2026-01-01T00:00:00.000Z",
          lastAttemptAt: null,
          lastError: null,
        });
        tx.objectStore("groups").add({ id: "g1", name: "Pre-Update Group" });
        tx.oncomplete = () => idb.close(); // release it so Dexie's v2 open can upgrade it
      };
    });

    // Now load the real app — its Dexie db.js declares v1 AND v2, so opening
    // this existing v1 database triggers the v2 upgrade automatically.
    await mockPull(page, pullResponse());
    await gotoApp(page);

    const outboxRows = await page.evaluate(() => window.__hyroOffline.db.outbox.toArray());
    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0].clientId).toBe("legacy-1"); // pre-existing data preserved
    expect(outboxRows[0].attemptCount).toBe(0); // backfilled by the v2 upgrade step

    const group = await page.evaluate(() => window.__hyroOffline.db.groups.get("g1"));
    expect(group.name).toBe("Pre-Update Group"); // untouched table preserved too
  });
});
