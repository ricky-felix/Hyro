import { Link } from "react-router-dom";
import { Button } from "../components/home/Button";

// ── Marketing 404 ────────────────────────────────────────────
// Standalone, on-brand page shown for any unknown public route.
// Mirrors the landing site identity: dark logo on white, emerald
// + lavender brand glow, gradient "404", and the same Button CTAs.
export default function NotFound() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background-primary px-6 py-16 text-center">
      {/* Soft brand glow — emerald (arisan) + lavender (patungan) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-brand-secondary/10 blur-3xl"
      />

      <Link
        to="/"
        aria-label="Hyro — kembali ke beranda"
        className="mb-10 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
      >
        <img
          src="/Arisan-Digital-Full-Logo-no-bg.webp"
          alt="Hyro"
          style={{ height: "120px", width: "auto" }}
        />
      </Link>

      <p className="gradient-text-animate text-[88px] font-extrabold leading-none sm:text-[120px]">
        404
      </p>
      <h1 className="mt-2 text-2xl font-bold text-text-primary sm:text-3xl">
        Halaman tidak ditemukan
      </h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-text-secondary">
        Sepertinya halaman yang kamu cari sudah dipindahkan atau tidak pernah
        ada. Yuk kembali ke jalur yang benar.
      </p>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <Button href="/" variant="primary">
          Kembali ke Beranda
        </Button>
        <Button variant="secondary" onClick={() => alert("Nice try!")}>
          Buka WebApp
        </Button>
      </div>
    </div>
  );
}
