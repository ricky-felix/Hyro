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

export function TentangSaku() {
  return (
    <section className="block" id="Saku" aria-labelledby="Saku-heading">
      <Reveal className="wrap">
        <div className="sec-head reveal-up">
          <span className="kicker">Kenalan dulu</span>
          <h2 id="Saku-heading">
            Apa itu <span className="dg-name">Saku</span>?
          </h2>
          <p>
            <strong>Saku</strong> artinya <em>poket</em> dalam bahasa Indonesia, karena aplikasi ini
            menyimpan semua catatan arisan dan patungan di satu tempat. <strong>Saku</strong> juga
            merupakan singkatan dari <em>sistem arisan dan patungan</em>
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

export default TentangSaku;
