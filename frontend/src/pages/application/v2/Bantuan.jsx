import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../../styles/app-v2.css";
import { ChevronDown, HelpCircle } from "../../../components/application/v2/icons";
import ScreenHeader from "../../../components/application/v2/ScreenHeader";

// FAQ content adapted from src/components/home/FAQs.jsx for the in-app
// help screen. Plain strings are used here (no JSX children) so they're
// lightweight and don't pull in Relume/Accordion dependencies.
const FAQS = [
  {
    q: "Apa itu Hyro?",
    a: "Hyro adalah WebApp untuk mengoordinasi arisan (tabungan bergilir) dan patungan (bagi tagihan) bersama teman, keluarga, atau rekan. WebApp mencatat siapa yang sudah bayar, menghitung giliran, serta mengirim pengingat otomatis.",
  },
  {
    q: "Apa bedanya Arisan dan Patungan?",
    a: "Arisan adalah tabungan bergilir: setiap anggota menyetor iuran tetap tiap putaran dan satu orang mendapat giliran menerima seluruh dana. Patungan adalah membagi satu tagihan bersama (trip, hotel, tiket) ke beberapa orang.",
  },
  {
    q: "Cara memulai dan mengundang anggota?",
    a: "Buat grup arisan atau tagihan patungan, atur nominal, lalu bagikan link undangan atau QR ke anggotamu. Mereka cukup membuka link dan memasukkan nama — tanpa perlu daftar akun.",
  },
  {
    q: "Apakah Hyro menyimpan uang saya?",
    a: "Tidak. Hyro hanya lapisan koordinasi. Uangmu tidak pernah mampir di WebApp — pembayaran dilakukan langsung antar anggota lewat transfer bank atau e-wallet (GoPay, OVO, DANA, dll.).",
  },
  {
    q: "Apa itu Bukti Transfer?",
    a: "Setelah mentransfer, anggota menandai pembayaran lunas dan dapat membuat Bukti Transfer — struk digital berisi pengirim, penerima, jumlah, dan status — yang bisa dibagikan ke grup atau disimpan sebagai gambar.",
  },
  {
    q: "Bagaimana giliran ditentukan?",
    a: "Saat membuat arisan kamu bisa memilih undian acak yang transparan atau urutan giliran yang sudah disepakati bersama. Hasilnya tercatat dan dapat dilihat semua anggota.",
  },
  {
    q: "Bagaimana jika ada yang telat bayar?",
    a: "WebApp mengirim pengingat otomatis sebelum jatuh tempo. Admin grup dapat memantau status pembayaran dan mengingatkan anggota yang belum membayar dengan satu ketukan.",
  },
  {
    q: "Berapa biaya penggunaan?",
    a: "Gratis untuk mulai dan untuk kebutuhan sehari-hari. Karena uang ditransfer langsung antar anggota, kami tidak pernah memotong komisi dari dana grupmu.",
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line-soft last:border-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 px-4 py-4 text-left transition-colors ${
          open ? "bg-gray-soft/40" : "hover:bg-gray-soft/40"
        }`}
      >
        <span className="flex-1 text-[14px] font-semibold leading-snug text-ink-1">{q}</span>
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gray-soft text-ink-2 transition-transform duration-300 ${
            open ? "rotate-180 bg-brand-primary-soft text-brand-primary-hover" : ""
          }`}
        >
          <ChevronDown size={14} strokeWidth={2.5} />
        </span>
      </button>

      {/* Smooth height + opacity reveal via the grid-rows 0fr→1fr trick */}
      <div
        className={`grid transition-all duration-300 ease-out ${
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-4 pb-4 text-[13px] font-medium leading-relaxed text-ink-2">{a}</p>
        </div>
      </div>
    </div>
  );
}

export default function Bantuan() {
  const navigate = useNavigate();

  return (
    <div className="v2-screen">
      <div className="v2-inner" style={{ overflowY: "auto" }}>

        {/* ── Sticky header ── */}
        <ScreenHeader title="Bantuan" onBack={() => navigate("/app/profil")} />

        {/* ── Content column ── */}
        <div className="mx-auto w-full max-w-[480px] px-5 py-6 lg:max-w-[600px] lg:px-6">

          {/* Hero */}
          <div className="mb-6 flex flex-col items-center gap-3 py-4 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-[20px] bg-gray-soft text-ink-2">
              <HelpCircle size={32} strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[18px] font-extrabold tracking-[-0.02em] text-ink-1">Tanya Jawab</p>
              <p className="mt-1 text-[13px] font-medium text-ink-3">
                Pertanyaan umum tentang Hyro
              </p>
            </div>
          </div>

          {/* FAQ accordion */}
          <div className="overflow-hidden rounded-card bg-surface shadow-card">
            {FAQS.map((faq, i) => (
              <FaqItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>

          {/* Contact section */}
          <div className="mt-6 overflow-hidden rounded-card bg-surface shadow-card">
            <div className="px-4 py-5">
              <p className="mb-1 text-[14px] font-extrabold tracking-[-0.01em] text-ink-1">
                Masih ada pertanyaan?
              </p>
              <p className="mb-4 text-[13px] font-medium leading-relaxed text-ink-3">
                Tim kami siap membantu dalam 24 jam.
              </p>
              <a
                href="mailto:arisandigital@outlook.com"
                className="flex items-center justify-center gap-2 rounded-[13px] bg-brand-primary px-4 py-3 text-[14px] font-bold text-white transition-colors hover:bg-brand-primary-hover"
                aria-label="Kirim email ke tim dukungan Hyro"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                arisandigital@outlook.com
              </a>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] font-medium text-ink-3">
            Hyro v1.0.0
          </p>
        </div>

      </div>
    </div>
  );
}
