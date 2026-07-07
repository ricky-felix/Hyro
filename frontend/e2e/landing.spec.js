/**
 * landing.spec.js — Public landing page smoke tests.
 *
 * These tests run without auth (the landing page "/" is fully public).
 * They verify the marketing page renders key sections and navigation works.
 */

import { test, expect } from "playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders the page without crashing", async ({ page }) => {
    await expect(page).toHaveTitle(/Hyro/i);
  });

  test("shows the hero section with a CTA button", async ({ page }) => {
    // The hero renders as <header aria-label="Hero section"> (not a <section>).
    // Match by the accessible name rather than the element type.
    const heroSection = page.locator('[aria-label="Hero section"]');
    await expect(heroSection).toBeVisible({ timeout: 10_000 });

    // The primary hero CTA renders as an <a href="/app"> link.
    const appLink = page.locator('a[href="/app"]').first();
    await expect(appLink).toBeVisible();
  });

  test("navbar is visible and contains the brand logo", async ({ page }) => {
    const nav = page.getByRole("navigation");
    await expect(nav).toBeVisible();
    // The navbar contains the brand logo image (alt text includes "Hyro")
    await expect(nav.getByAltText(/Hyro/i)).toBeVisible();
  });

  test("shows the FAQ section", async ({ page }) => {
    // Target the FAQ section heading directly (#faq-heading = "Pertanyaan umum").
    // Avoids matching the collapsed mobile nav "FAQ" link, which is hidden at the
    // 390px viewport and would never scroll into view.
    const faqHeading = page.locator("#faq-heading");
    await faqHeading.scrollIntoViewIfNeeded();
    await expect(faqHeading).toBeVisible();
  });

  test("navigating to /app from CTA works", async ({ page }) => {
    // The primary CTA links to /app. In the MVP /app opens directly; if auth is
    // enforced it redirects to /masuk. Accept either landing URL.
    const cta = page.locator('a[href="/app"]').first();
    await cta.click();
    await expect(page).toHaveURL(/\/(masuk|app)/);
  });
});

test.describe("Login page (/masuk)", () => {
  test("renders login form", async ({ page }) => {
    await page.goto("/masuk");
    // The page doesn't use <h1> — the tabs "Masuk"/"Daftar" are buttons.
    // Verify the form card and identifier input are present.
    await expect(page.getByPlaceholder(/nama@email\.com|email\.com/i)).toBeVisible();
    // Password field
    await expect(page.locator("#login-password")).toBeVisible();
    // Submit button
    await expect(page.getByRole("button", { name: "Masuk" })).toBeVisible();
  });

  test("shows validation error with wrong credentials", async ({ page }) => {
    await page.goto("/masuk");
    await page.getByPlaceholder(/nama@email\.com|email\.com/i).fill("wrong@example.com");
    await page.locator("#login-password").fill("wrongpassword");
    await page.getByRole("button", { name: "Masuk" }).click();

    // An error alert should appear (role=alert or visible error text)
    const errorAlert = page.getByRole("alert");
    await expect(errorAlert).toBeVisible({ timeout: 10_000 });
  });

  test("can toggle to register tab", async ({ page }) => {
    await page.goto("/masuk");
    // Click the "Daftar" tab button
    await page.getByRole("button", { name: "Daftar" }).click();
    // Register form has Nama Lengkap field (id="reg-name", placeholder="Budi Santoso")
    await expect(page.locator("#reg-name")).toBeVisible();
  });

  test("shows password strength meter on register tab", async ({ page }) => {
    await page.goto("/masuk");
    await page.getByRole("button", { name: "Daftar" }).click();
    // The register password field id is "reg-password"
    const pwField = page.locator("#reg-password");
    await pwField.fill("abc");
    // Strength meter (aria-live region) should appear
    await expect(page.getByText(/lemah|sedang|kuat/i)).toBeVisible();
  });
});
