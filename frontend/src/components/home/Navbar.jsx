"use client";

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { handleAnchorClick } from "../../utils/smoothScroll";
import { routes } from "../../config";

const NAV_LINKS = [
  { id: "Saku", label: "Saku" },
  { id: "siapa", label: "Untuk Siapa" },
  { id: "cara", label: "Cara Kerja" },
  { id: "produk", label: "Produk" },
  { id: "fitur", label: "Fitur" },
  { id: "faq", label: "FAQ" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <nav id="navbar" role="navigation" aria-label="Main navigation">
      <div className="wrap nav-in">
        <a
          href="#beranda"
          className="brand"
          onClick={(e) => handleAnchorClick(e, "beranda")}
          aria-label="Saku - Beranda"
        >
          <img src="/Arisan-Digital-Logo-nobg.png" alt="Arisan Digital" />
          <span>Saku</span>
        </a>

        <div className="nav-links">
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={(e) => handleAnchorClick(e, link.id)}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="nav-cta">
          <Link className="btn btn-emerald" to={routes.app}>
            Mulai Gratis
          </Link>
          <button
            type="button"
            className={`nav-toggle${open ? " open" : ""}`}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Tutup menu" : "Buka menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {open && (
        <div id="mobile-menu" className="mobile-menu">
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              onClick={(e) => handleAnchorClick(e, link.id, close)}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  );
}

export default Navbar;
