"use client";

import React from "react";
import { Reveal } from "./Reveal";

const PILLARS = [
  {
    icon: "🔄",
    title: "Arisan",
    desc: "Putaran tabungan bersama dengan giliran yang adil dan transparan.",
  },
  {
    icon: "🤝",
    title: "Patungan",
    desc: "Bagi tagihan bareng teman tanpa hitung manual atau salah catat.",
  },
  {
    icon: "📱",
    title: "Satu webapp",
    desc: "Semua tercatat otomatis, lengkap dengan bukti transfer digital.",
  },
];

export function TentangHyro() {
  return (
    <section className="block" id="tentang" aria-labelledby="tentang-heading">
      <Reveal className="wrap">
        <div className="sec-head reveal-up">
          <span className="kicker">Kenalan dulu</span>
          <h2 id="tentang-heading">
            Apa itu <span className="dg-name">Hyro</span>?
          </h2>
          <p>
            <strong>Hyro</strong> (dibaca &ldquo;Hero&rdquo;) membantu arisan dan
            patungan berjalan otomatis dan bisa dipercaya — semua iuran,
            giliran, dan bukti transfer tercatat rapi di satu tempat.
          </p>
        </div>
        <div className="dg-pillars">
          {PILLARS.map((p, i) => (
            <div
              className="dg-pillar reveal-up"
              key={p.title}
              style={{ "--reveal-delay": `${0.1 * (i + 1)}s` }}
            >
              <span className="dg-pillar-icon" aria-hidden="true">
                {p.icon}
              </span>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export default TentangHyro;
