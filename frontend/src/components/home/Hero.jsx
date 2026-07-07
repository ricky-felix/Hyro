"use client";

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { routes } from "../../config";
import { handleAnchorClick } from "../../utils/smoothScroll";
import { Reveal } from "./Reveal";

const HERO_SHOT = {
  src: "/pictures/app/beranda.png",
  title: "Beranda",
  caption: "Iuran & giliran dalam satu kartu",
};

export function Hero() {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e) => e.key === "Escape" && setZoomed(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoomed]);

  return (
    <header className="hero" id="beranda" aria-label="Hero section">
      <Reveal className="wrap hero-grid">
        <div className="reveal-up">
          <span className="eyebrow">
            <span className="dot" />
            Arisan &amp; Patungan dalam satu webapp
          </span>
          <h1 className="hero-title">
             <span className="em">Arisan</span> transparan. {" "}
            <span className="lv">Patungan</span> tanpa ribet.
          </h1>
          <p className="hero-sub">
            Kelola putaran arisan dan bagi tagihan bareng teman — pencatatan
            otomatis, giliran adil, dan bukti transfer yang jelas. Tanpa buku
            catatan, tanpa drama.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-emerald btn-lg" to={routes.app}>
              Buat Grup Pertama →
            </Link>
            <a
              className="btn btn-ghost btn-lg"
              href="#galeri"
              onClick={(e) => handleAnchorClick(e, "galeri")}
            >
              Lihat Demo
            </a>
          </div>
          <div className="trust">
            <div className="avatars">
              <span>R</span>
              <span>D</span>
              <span>A</span>
              <span>+</span>
            </div>
            <div>
              <span className="stars">★★★★★</span> &nbsp;Dipakai teman, keluarga,
              komunitas &amp; bisnis
            </div>
          </div>
        </div>

        <div className="hero-visual reveal-right" style={{ "--reveal-delay": "0.1s" }}>
          <button
            type="button"
            className="hero-shot"
            onClick={() => setZoomed(true)}
            aria-label={`Perbesar ${HERO_SHOT.title}`}
          >
            <img src={HERO_SHOT.src} alt="Tampilan beranda Hyro" />
          </button>
          <div className="float f1">
            <div className="ft">Iuran berikutnya</div>
            <div className="fv">Rp 200.000</div>
          </div>
          <div className="float f2">
            <span className="chip em">● Sudah bayar 8/10</span>
          </div>
          <div className="float f3">
            <div className="ft">Giliran bulan ini</div>
            <div className="fv">Dewi 🎉</div>
          </div>
        </div>
      </Reveal>

      {zoomed && (
        <div
          className="gal-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={HERO_SHOT.title}
          onClick={() => setZoomed(false)}
        >
          <button
            type="button"
            className="gal-lightbox-close"
            onClick={() => setZoomed(false)}
            aria-label="Tutup"
          >
            ×
          </button>
          <figure className="gal-lightbox-fig" onClick={(e) => e.stopPropagation()}>
            <img src={HERO_SHOT.src} alt={HERO_SHOT.title} />
            <figcaption>
              <b>{HERO_SHOT.title}</b>
              {HERO_SHOT.caption}
            </figcaption>
          </figure>
        </div>
      )}
    </header>
  );
}

export default Hero;
