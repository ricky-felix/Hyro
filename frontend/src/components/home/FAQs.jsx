"use client";

import React from "react";
import { routes } from "../../config";
import { Reveal } from "./Reveal";

const FAQS = [
  {
    q: "Apa itu Hyro dan bagaimana cara kerjanya?",
    a: (
      <>
        Hyro adalah WebApp untuk mengoordinasi <strong>arisan</strong>{" "}
        (tabungan bergilir) dan <strong>patungan</strong> (bagi tagihan) bersama
        teman, keluarga, atau rekan. Kamu membuat grup atau tagihan, mengundang
        anggota lewat link, dan WebApp mencatat siapa yang sudah bayar,
        menghitung giliran, serta mengirim pengingat otomatis — menggantikan grup
        WhatsApp dan catatan manual yang berantakan. Berbasis web, jadi tidak
        perlu unduh WebApp atau daftar akun untuk mulai.
      </>
    ),
  },
  {
    q: "Apa bedanya Arisan dan Patungan?",
    a: (
      <>
        <strong>Arisan</strong> adalah tabungan bergilir: setiap anggota menyetor
        iuran tetap tiap putaran, dan setiap putaran satu orang mendapat giliran
        menerima seluruh dana — berputar sampai semua kebagian.{" "}
        <strong>Patungan</strong> adalah membagi satu tagihan bersama (misalnya
        trip, hotel, atau tiket konser) ke beberapa orang dan melacak siapa yang
        sudah membayar bagiannya.
      </>
    ),
  },
  {
    q: "Bagaimana cara memulai dan mengundang anggota?",
    a: (
      <>
        Buat grup arisan atau tagihan patungan, atur nominal iuran/total, lalu
        bagikan <strong>link undangan</strong> atau QR ke anggotamu. Mereka cukup
        membuka link, memasukkan nama, dan langsung bergabung — tanpa perlu
        mendaftar akun. Grup siap berjalan dalam hitungan menit.
      </>
    ),
  },
  {
    q: "Apakah WebApp menyimpan uang saya — dan apakah aman?",
    a: (
      <>
        Tidak. Hyro adalah{" "}
        <strong>lapisan koordinasi &amp; kepercayaan</strong>, bukan dompet
        digital. Uangmu tidak pernah mampir di WebApp — pembayaran dilakukan
        langsung antar anggota lewat transfer bank atau e-wallet (GoPay, OVO,
        DANA, dan lainnya). Kami hanya mencatat, mengingatkan, dan menjaga
        transparansi. Data dan catatan pembayaran dienkripsi dan tidak bisa
        diubah setelah dikonfirmasi.
      </>
    ),
  },
  {
    q: "Apa itu Bukti Transfer dan bagaimana mengonfirmasi pembayaran?",
    a: (
      <>
        Setelah mentransfer, anggota menandai pembayaran sebagai lunas dan dapat
        membuat <strong>Bukti Transfer</strong> — struk digital rapi berisi
        pengirim, penerima, jumlah, dan status — yang langsung bisa dibagikan ke
        grup atau disimpan sebagai gambar. Semua tercatat dan terlihat oleh
        seluruh anggota, jadi tidak ada lagi tangkapan layar yang tersebar di
        mana-mana.
      </>
    ),
  },
  {
    q: "Bagaimana giliran ditentukan agar adil?",
    a: (
      <>
        Saat membuat arisan kamu bisa memilih <strong>undian acak</strong> yang
        transparan atau <strong>urutan giliran</strong> yang sudah disepakati
        bersama. Hasilnya tercatat dan dapat dilihat semua anggota, sehingga
        prosesnya jujur, terbuka, dan bebas dari kecurangan.
      </>
    ),
  },
  {
    q: "Bagaimana jika ada anggota yang telat bayar?",
    a: (
      <>
        WebApp mengirim pengingat otomatis sebelum jatuh tempo. Admin grup dapat
        memantau status pembayaran secara langsung dan mengingatkan anggota yang
        belum membayar hanya dengan satu ketukan, sehingga putaran tetap berjalan
        lancar tanpa harus menagih satu per satu.
      </>
    ),
  },
  {
    q: "Berapa biaya penggunaannya?",
    a: (
      <>
        Hyro gratis untuk mulai dan untuk kebutuhan sehari-hari. Karena
        uang ditransfer langsung antar anggota, kami{" "}
        <strong>tidak pernah memotong komisi</strong> dari dana grupmu. Ke depan
        akan ada paket premium opsional untuk grup yang lebih besar dan butuh
        fitur lanjutan, namun fitur inti tetap bisa dipakai gratis.
      </>
    ),
  },
  {
    q: "Bagaimana cara menghubungi tim dukungan?",
    a: (
      <>
        Tim dukungan kami siap membantu melalui email di{" "}
        <a href="mailto:arisandigital@outlook.com">arisandigital@outlook.com</a>.
        Kami biasanya merespons dalam waktu kurang dari 24 jam. Layanan dukungan
        via telepon belum tersedia untuk saat ini.
      </>
    ),
  },
];

export function FAQs() {
  return (
    <section className="block" id="faq" aria-labelledby="faq-heading">
      <Reveal className="wrap">
        <div className="sec-head reveal-up">
          <span className="kicker">Tanya Jawab</span>
          <h2 id="faq-heading">Pertanyaan umum</h2>
          <p>
            Jawaban untuk pertanyaan umum tentang Hyro dan cara
            kerjanya.
          </p>
        </div>
        <div className="faq reveal-up" style={{ "--reveal-delay": "0.1s" }}>
          {FAQS.map((faq, i) => (
            <details key={faq.q} {...(i === 0 ? { open: true } : {})}>
              <summary>
                {faq.q}
                <span className="pl" aria-hidden="true">
                  +
                </span>
              </summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export default FAQs;
