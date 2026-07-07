import React, { useEffect } from "react";
import { Link } from "react-router-dom";

// ── Shared chrome for the public legal pages ──────────────────
// Standalone, on-brand layout for Syarat & Ketentuan and Kebijakan
// Privasi. Mirrors the landing identity (dark logo on white, emerald +
// lavender brand glow) like NotFound, but with a readable long-form
// content column. Public route — not behind the /app login gate.
export function LegalLayout({ title, lastUpdated, intro, children }) {
  // Long pages should open at the top, not wherever the previous route left off.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="relative min-h-svh overflow-hidden bg-background-primary">
      {/* Soft brand glow — emerald (arisan) + lavender (patungan) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-1/3 h-96 w-96 rounded-full bg-brand-secondary/10 blur-3xl"
      />

      {/* Simple header — logo links home (no landing-page anchor nav here) */}
      <header className="relative z-10 border-b border-black/5">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link
            to="/"
            aria-label="Hyro — kembali ke beranda"
            className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            <img
              src="/Arisan-Digital-Full-Logo-no-bg.webp"
              alt="Hyro"
              style={{ height: "44px", width: "auto" }}
            />
          </Link>
          <Link
            to="/"
            className="text-sm font-semibold text-brand-primary hover:underline"
          >
            ← Beranda
          </Link>
        </div>
      </header>

      <main
        id="main-content"
        className="relative z-10 mx-auto max-w-3xl px-6 py-12 sm:py-16"
      >
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">
          {title}
        </h1>
        {lastUpdated && (
          <p className="mt-2 text-sm text-text-secondary">
            Terakhir diperbarui: {lastUpdated}
          </p>
        )}
        {intro && (
          <p className="mt-6 text-base leading-relaxed text-text-secondary">
            {intro}
          </p>
        )}

        <div className="mt-10 space-y-10">{children}</div>

        <div className="mt-16 border-t border-black/5 pt-8 text-sm text-text-secondary">
          <p>
            Ada pertanyaan? Hubungi kami di{" "}
            <a
              href="mailto:arisandigital@outlook.com"
              className="font-semibold text-brand-primary hover:underline"
            >
              arisandigital@outlook.com
            </a>
            .
          </p>
          <p className="mt-4">© 2026 Hyro. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}

// ── Section helpers ───────────────────────────────────────────
export function Section({ heading, children }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-text-primary">{heading}</h2>
      <div className="mt-3 space-y-3 text-base leading-relaxed text-text-secondary">
        {children}
      </div>
    </section>
  );
}

export function List({ items }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default LegalLayout;
