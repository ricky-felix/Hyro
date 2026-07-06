"use client";

import React from "react";
import { Link } from "react-router-dom";
import { handleAnchorClick } from "../../utils/smoothScroll";

const PRODUK = [
  { id: "produk", label: "Arisan" },
  { id: "produk", label: "Patungan" },
  { id: "galeri", label: "Galeri" },
];

const NAVIGASI = [
  { id: "siapa", label: "Untuk Siapa" },
  { id: "cara", label: "Cara Kerja" },
  { id: "fitur", label: "Fitur" },
  { id: "faq", label: "FAQ" },
];

export function Footer() {
  return (
    <footer className="site-foot" id="hubungi">
      <div className="foot-glow" />
      <div className="foot-watermark" aria-hidden="true">
        Saku Saku Saku
      </div>
      <div className="wrap foot-inner">
        <div className="foot-top">
          <div className="foot-brand">
            <img
              src="/Arisan-Digital-Full-Logo-no-bg.webp"
              alt="Saku"
            />
            <p>
              Arisan &amp; patungan dalam satu app — modern, transparan, dan
              aman. Tanpa buku catatan, tanpa drama.
            </p>
            <div className="socials">
              <a href="https://www.instagram.com/arisan_digital/" aria-label="Instagram">◎</a>
            </div>
          </div>

          <div className="foot-col">
            <h4>Produk</h4>
            <ul>
              {PRODUK.map((item) => (
                <li key={item.label}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => handleAnchorClick(e, item.id)}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="foot-col">
            <h4>Navigasi</h4>
            <ul>
              {NAVIGASI.map((item) => (
                <li key={item.label}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => handleAnchorClick(e, item.id)}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="foot-contact">
            <span className="h">Hubungi</span>
            <span>Lokasi</span>
            <p>Medan, Indonesia</p>
            <span>Email</span>
            <a href="mailto:arisandigital@outlook.com">arisandigital@outlook.com</a>
          </div>
        </div>

        <div className="foot-bot">
          <p>© 2026 Saku. All rights reserved.</p>
          <div className="foot-legal">
            <Link to="/syarat-ketentuan">Syarat &amp; Ketentuan</Link>
            <Link to="/kebijakan-privasi">Kebijakan Privasi</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
