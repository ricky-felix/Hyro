"use client";

import React from "react";
import { Reveal } from "./Reveal";

const PRODUCTS = [
  {
    variant: "arisan",
    tag: "ARISAN",
    title: "Putaran tabungan bersama",
    desc: "Setiap anggota menyetor iuran tetap tiap putaran, dan satu orang menerima giliran — berputar sampai semua kebagian.",
    points: [
      "Undian giliran transparan",
      "Pengingat iuran otomatis",
      "Riwayat lengkap tiap ronde",
    ],
  },
  {
    variant: "patungan",
    tag: "PATUNGAN",
    title: "Bagi tagihan tanpa hitung manual",
    desc: "Patungan makan, liburan, atau hadiah. Masukkan total sekali, terbagi rata otomatis ke semua peserta.",
    points: [
      "Hitung bagian otomatis",
      "Lacak siapa sudah bayar",
      "Bukti transfer digital",
    ],
  },
];

export function DuaProduk() {
  return (
    <section className="block" id="produk" aria-labelledby="produk-heading">
      <Reveal className="wrap">
        <div className="sec-head reveal-up">
          <span className="kicker">Dua Produk</span>
          <h2 id="produk-heading">Satu webapp untuk arisan &amp; patungan</h2>
        </div>
        <div className="dual">
          {PRODUCTS.map((p, i) => (
            <div
              className={`pcard ${p.variant} ${i === 0 ? "reveal-left" : "reveal-right"}`}
              key={p.tag}
              style={{ "--reveal-delay": "0.1s" }}
            >
              <div className="glow" />
              <span className="tag">{p.tag}</span>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
              <ul>
                {p.points.map((point) => (
                  <li key={point}>✓ {point}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export default DuaProduk;
