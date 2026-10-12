"use client";

import React from "react";
import { Reveal } from "./Reveal";

const STEPS = [
  {
    color: "var(--emerald)",
    title: "Buat grup arisan",
    desc: "Atur nama, iuran per ronde, frekuensi, dan metode giliran. Undang anggota lewat satu link.",
  },
  {
    color: "var(--lavender-dark)",
    title: "Catat setiap kontribusi",
    desc: "Setiap pembayaran tercatat otomatis dan real-time. Semua anggota lihat siapa sudah bayar.",
  },
  {
    color: "var(--gold)",
    title: "Kelola giliran transparan",
    desc: "Pilih undian acak atau urutan yang disepakati. Ingatkan anggota yang belum bayar dengan satu ketukan.",
  },
];

export function HowToUse() {
  return (
    <section className="block band-em" id="cara" aria-labelledby="how-to-use-heading">
      <Reveal className="wrap">
        <div className="sec-head reveal-up">
          <span className="kicker">Tiga Langkah Arisan</span>
          <h2 id="how-to-use-heading">Arisan langsung jalan dalam menit</h2>
          <p>Dari nol sampai grup berjalan lancar dalam hitungan menit.</p>
        </div>
        <div className="steps">
          {STEPS.map((step, i) => (
            <div
              className="step reveal-up"
              key={step.title}
              style={{ "--reveal-delay": `${0.1 + i * 0.1}s` }}
            >
              <div className="num" style={{ background: step.color }}>
                {i + 1}
              </div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export default HowToUse;
