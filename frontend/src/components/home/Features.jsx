"use client";

import React from "react";
import { Reveal } from "./Reveal";

const FEATURES = [
  {
    idx: "01",
    label: "Notifikasi Otomatis",
    title: "Pengingat & update real-time",
    tags: [{ cls: "em", text: "real-time" }],
    desc: "Jadwal iuran, giliran penerima, dan pembayaran masuk tampil di Notifikasi. Ingatkan anggota yang belum bayar cukup dengan satu ketukan.",
  },
  {
    idx: "02",
    label: "Pencatatan Kontribusi",
    title: "Transparansi pembayaran",
    tags: [
      { cls: "em", text: "arisan" },
      { cls: "lv", text: "patungan" },
    ],
    desc: "Setiap iuran tercatat rapi. Semua anggota lihat siapa sudah bayar — nggak ada lagi “aku udah bayar kok”.",
  },
  {
    idx: "03",
    label: "Pengelolaan Giliran",
    title: "Undian fair & transparan",
    tags: [{ cls: "gd", text: "fair" }],
    desc: "Pilih undian acak yang transparan, atau urutan giliran sesuai kesepakatan grup. Jadwal jelas untuk semua.",
  },
  {
    idx: "04",
    label: "Bukti Transfer",
    title: "Struk digital yang rapi",
    tags: [
      { cls: "em", text: "arisan" },
      { cls: "lv", text: "patungan" },
    ],
    desc: "Setiap pembayaran punya struk digital berisi pengirim, penerima, jumlah, dan status — siap dibagikan ke grup atau disimpan sebagai gambar.",
  },
  {
    idx: "05",
    label: "Dompet & Riwayat",
    title: "Rangkuman keuanganmu",
    tags: [{ cls: "gd", text: "ringkas" }],
    desc: "Lihat total iuran, tagihan patungan, dan riwayat transaksi dari semua grupmu di satu tempat.",
  },
  {
    idx: "06",
    label: "Mode Offline",
    title: "Tetap jalan tanpa sinyal",
    tags: [{ cls: "lv", text: "offline" }],
    desc: "Catat pembayaran meski koneksi putus. Begitu online lagi, semua data tersinkron otomatis.",
  },
  {
    idx: "07",
    label: "Keamanan Akun",
    title: "PIN & akses khusus anggota",
    tags: [{ cls: "em", text: "PIN" }],
    desc: "Lindungi akunmu dengan PIN 6 digit. Data grup hanya bisa dilihat oleh anggota grup itu sendiri.",
  },
];

export function Features() {
  return (
    <section className="block band-dark" id="fitur" aria-labelledby="features-heading">
      <Reveal className="wrap">
        <div className="sec-head left reveal-left">
          <span className="kicker">Fitur</span>
          <h2 id="features-heading">Semua yang bikin arisan jalan mulus</h2>
          <p>Tujuh hal inti yang dirancang supaya tiap ronde berjalan tanpa drama.</p>
        </div>
        <div className="rows">
          {FEATURES.map((f, i) => (
            <div
              className="row reveal-up"
              key={f.idx}
              style={{ "--reveal-delay": `${0.05 + i * 0.07}s` }}
            >
              <div className="idx">{f.idx}</div>
              <div>
                <div className="lbl">{f.label}</div>
                <h3>{f.title}</h3>
                <div className="tagrow">
                  {f.tags.map((t) => (
                    <span className={`tg ${t.cls}`} key={t.text}>
                      {t.text}
                    </span>
                  ))}
                </div>
              </div>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export default Features;
