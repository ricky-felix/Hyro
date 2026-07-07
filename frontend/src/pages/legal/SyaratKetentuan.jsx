import React from "react";
import { Link } from "react-router-dom";
import { LegalLayout, Section, List } from "./LegalLayout";

// ── Syarat & Ketentuan (Terms of Service) ─────────────────────
// Public, on-brand long-form page. Indonesian copy for the Arisan
// Digital product (arisan rotating savings + patungan bill splits).
// Template content — review with legal counsel before relying on it.
export default function SyaratKetentuan() {
  return (
    <LegalLayout
      title="Syarat & Ketentuan"
      lastUpdated="15 Juni 2026"
      intro={
        <>
          Selamat datang di Hyro. Dengan mengakses atau menggunakan
          aplikasi dan layanan kami, Anda menyetujui Syarat & Ketentuan berikut.
          Mohon dibaca dengan saksama. Jika Anda tidak setuju, mohon untuk tidak
          menggunakan layanan kami.
        </>
      }
    >
      <Section heading="1. Penerimaan Syarat">
        <p>
          Syarat & Ketentuan ini merupakan perjanjian yang mengikat antara Anda
          ("Pengguna") dan Hyro ("kami"). Dengan membuat akun atau
          menggunakan layanan, Anda menyatakan telah membaca, memahami, dan
          menyetujui seluruh ketentuan di halaman ini serta{" "}
          <Link
            to="/kebijakan-privasi"
            className="font-semibold text-brand-primary hover:underline"
          >
            Kebijakan Privasi
          </Link>{" "}
          kami.
        </p>
      </Section>

      <Section heading="2. Definisi">
        <List
          items={[
            <>
              <strong>Layanan</strong> — aplikasi Hyro beserta seluruh
              fitur di dalamnya.
            </>,
            <>
              <strong>Arisan</strong> — kelompok simpanan bergilir di mana
              anggota menyetor iuran secara berkala dan menerima giliran payout.
            </>,
            <>
              <strong>Patungan</strong> — fitur pembagian tagihan atau
              pengumpulan dana satu kali bersama orang lain.
            </>,
            <>
              <strong>Penyelenggara Grup</strong> — Pengguna yang membuat dan
              mengelola sebuah grup arisan atau patungan.
            </>,
          ]}
        />
      </Section>

      <Section heading="3. Kelayakan & Akun">
        <List
          items={[
            "Anda harus berusia minimal 18 tahun atau telah memiliki kapasitas hukum untuk membuat perjanjian yang mengikat.",
            "Anda wajib memberikan informasi yang benar, akurat, dan terkini saat mendaftar.",
            "Anda bertanggung jawab menjaga kerahasiaan akun, PIN, dan kredensial Anda, serta atas seluruh aktivitas yang terjadi melalui akun Anda.",
            "Segera beri tahu kami jika Anda mengetahui adanya penggunaan akun tanpa izin.",
          ]}
        />
      </Section>

      <Section heading="4. Tentang Layanan">
        <p>
          Hyro adalah platform teknologi yang membantu Anda mengelola
          arisan dan patungan secara transparan: mencatat anggota, iuran,
          jadwal, giliran, dan bukti pembayaran. Kami menyediakan alat bantu
          pencatatan dan koordinasi.
        </p>
        <p>
          <strong>Penting:</strong> Hyro bukan bank, bukan lembaga
          keuangan, dan bukan penyelenggara jasa pembayaran. Kami tidak
          menyimpan, menahan, atau menyalurkan dana antar Pengguna. Seluruh
          transfer dana terjadi langsung antar Pengguna melalui rekening atau
          kanal pembayaran masing-masing. Tanggung jawab atas penyetoran dan
          penerimaan dana sepenuhnya berada pada para anggota grup.
        </p>
      </Section>

      <Section heading="5. Kewajiban Pengguna">
        <List
          items={[
            "Menggunakan layanan hanya untuk tujuan yang sah dan sesuai hukum yang berlaku di Indonesia.",
            "Menyetor iuran dan menyelesaikan kewajiban tepat waktu sesuai kesepakatan grup.",
            "Mengunggah bukti pembayaran yang asli dan tidak dimanipulasi.",
            "Menghormati anggota lain dan tidak melakukan penipuan, intimidasi, atau pelecehan.",
          ]}
        />
      </Section>

      <Section heading="6. Pembayaran & Transaksi">
        <List
          items={[
            "Seluruh kesepakatan nominal iuran, jadwal, dan giliran ditentukan oleh anggota grup, bukan oleh Hyro.",
            "Kami tidak menjamin kelancaran pembayaran atau itikad baik anggota lain dalam suatu grup.",
            "Perselisihan terkait dana antar anggota diselesaikan secara langsung antar pihak yang bersangkutan.",
            "Apabila ada biaya layanan tertentu di masa depan, biaya tersebut akan diinformasikan secara jelas sebelum Anda menyetujuinya.",
          ]}
        />
      </Section>

      <Section heading="7. Larangan">
        <p>Anda dilarang untuk:</p>
        <List
          items={[
            "Menggunakan layanan untuk pencucian uang, penipuan, perjudian, atau aktivitas ilegal lainnya.",
            "Menyalahgunakan, meretas, atau mengganggu keamanan dan integritas sistem kami.",
            "Mengakses data atau akun Pengguna lain tanpa izin.",
            "Mengunggah konten yang melanggar hukum, menyesatkan, atau melanggar hak pihak ketiga.",
          ]}
        />
      </Section>

      <Section heading="8. Konten Pengguna">
        <p>
          Anda tetap memiliki konten yang Anda unggah (misalnya nama grup, foto,
          dan bukti transfer). Dengan mengunggahnya, Anda memberi kami lisensi
          terbatas untuk menyimpan dan menampilkan konten tersebut semata-mata
          untuk menjalankan layanan. Anda bertanggung jawab penuh atas konten
          yang Anda bagikan.
        </p>
      </Section>

      <Section heading="9. Hak Kekayaan Intelektual">
        <p>
          Seluruh merek, logo, desain, dan perangkat lunak Hyro adalah
          milik kami dan dilindungi hukum. Anda tidak diperbolehkan menyalin,
          memodifikasi, atau mendistribusikannya tanpa izin tertulis dari kami.
        </p>
      </Section>

      <Section heading="10. Penafian & Batasan Tanggung Jawab">
        <p>
          Layanan disediakan "sebagaimana adanya" tanpa jaminan apa pun. Sejauh
          diizinkan oleh hukum, Hyro tidak bertanggung jawab atas
          kerugian yang timbul dari: gagal bayar anggota lain, perselisihan
          antar anggota, kesalahan input data oleh Pengguna, atau gangguan
          layanan di luar kendali wajar kami.
        </p>
      </Section>

      <Section heading="11. Penghentian">
        <p>
          Kami dapat menangguhkan atau menghentikan akses Anda apabila Anda
          melanggar Syarat & Ketentuan ini atau menggunakan layanan secara
          merugikan. Anda juga dapat berhenti menggunakan layanan dan menutup
          akun kapan saja.
        </p>
      </Section>

      <Section heading="12. Perubahan Syarat">
        <p>
          Kami dapat memperbarui Syarat & Ketentuan ini dari waktu ke waktu.
          Perubahan material akan kami informasikan melalui aplikasi atau email.
          Dengan tetap menggunakan layanan setelah perubahan berlaku, Anda
          dianggap menyetujui versi terbaru.
        </p>
      </Section>

      <Section heading="13. Hukum yang Berlaku">
        <p>
          Syarat & Ketentuan ini diatur oleh hukum Republik Indonesia. Setiap
          perselisihan akan diupayakan diselesaikan secara musyawarah terlebih
          dahulu.
        </p>
      </Section>

      <Section heading="14. Hubungi Kami">
        <p>
          Untuk pertanyaan mengenai Syarat & Ketentuan ini, hubungi kami di{" "}
          <a
            href="mailto:arisandigital@outlook.com"
            className="font-semibold text-brand-primary hover:underline"
          >
            arisandigital@outlook.com
          </a>
          .
        </p>
      </Section>
    </LegalLayout>
  );
}
