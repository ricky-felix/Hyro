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
    <section className="block" id="Hyro" aria-labelledby="Hyro-heading">
      <Reveal className="wrap">
        <div className="sec-head reveal-up">
          <span className="kicker">Kenalan dulu</span>
          <h2 id="Hyro-heading">
            Apa itu <span className="dg-name">Hyro</span>?
          </h2>
          <p>
            Hyro reads as <strong>Hero</strong>. The infrastructure platform that turns informal savings groups (arisan) into automated, trust-enabled financial infrastructure. Simply evokes speed, flow, technology
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
