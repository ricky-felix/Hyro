import React from "react";
import { Link } from "react-router-dom";
import { LegalLayout, Section, List } from "./LegalLayout";

// ── Kebijakan Privasi (Privacy Policy) ────────────────────────
// Public, on-brand long-form page. Indonesian copy for Hyro.
// Template content — review with legal counsel before relying on it.
export default function KebijakanPrivasi() {
  return (
    <LegalLayout
      title="Kebijakan Privasi"
      lastUpdated="15 Juni 2026"
      intro={
        <>
          Privasi Anda penting bagi kami. Kebijakan Privasi ini menjelaskan data
          apa yang kami kumpulkan, bagaimana kami menggunakannya, dan hak-hak
          Anda saat menggunakan Hyro.
        </>
      }
    >
      <Section heading="1. Pendahuluan">
        <p>
          Kebijakan ini berlaku untuk seluruh layanan Hyro. Dengan
          menggunakan layanan kami, Anda menyetujui pengumpulan dan penggunaan
          informasi sesuai kebijakan ini, yang merupakan satu kesatuan dengan{" "}
          <Link
            to="/syarat-ketentuan"
            className="font-semibold text-brand-primary hover:underline"
          >
            Syarat & Ketentuan
          </Link>{" "}
          kami.
        </p>
      </Section>

      <Section heading="2. Data yang Kami Kumpulkan">
        <List
          items={[
            <>
              <strong>Data akun</strong> — nama, nomor telepon, email, dan foto
              profil yang Anda berikan.
            </>,
            <>
              <strong>Data grup & transaksi</strong> — nama grup arisan/patungan,
              nominal iuran, jadwal, daftar anggota, dan bukti pembayaran yang
              Anda unggah.
            </>,
            <>
              <strong>Data rekening tujuan</strong> — informasi rekening untuk
              keperluan payout yang Anda masukkan secara sukarela.
            </>,
            <>
              <strong>Data teknis</strong> — jenis perangkat, sistem operasi, dan
              data penggunaan untuk menjaga keamanan serta meningkatkan layanan.
            </>,
          ]}
        />
        <p>
          Kami tidak menyimpan PIN Anda dalam bentuk teks biasa, dan kami tidak
          memproses atau menyimpan saldo dana Anda — transfer terjadi langsung
          antar Pengguna.
        </p>
      </Section>

      <Section heading="3. Cara Kami Menggunakan Data">
        <List
          items={[
            "Menyediakan dan menjalankan fitur arisan dan patungan.",
            "Menampilkan ringkasan iuran, giliran, dan riwayat transaksi Anda.",
            "Mengirim notifikasi terkait jadwal, pengingat pembayaran, dan aktivitas grup.",
            "Menjaga keamanan, mencegah penyalahgunaan, dan menanggapi permintaan bantuan.",
            "Meningkatkan kualitas dan pengalaman layanan.",
          ]}
        />
      </Section>

      <Section heading="4. Dasar & Persetujuan">
        <p>
          Kami memproses data Anda berdasarkan persetujuan yang Anda berikan saat
          menggunakan layanan, untuk memenuhi layanan yang Anda minta, dan untuk
          kepentingan sah kami dalam mengoperasikan platform secara aman.
        </p>
      </Section>

      <Section heading="5. Pembagian Data ke Pihak Ketiga">
        <p>Kami tidak menjual data pribadi Anda. Kami hanya membagikan data:</p>
        <List
          items={[
            "Kepada sesama anggota dalam satu grup, sebatas informasi yang memang perlu ditampilkan (misalnya nama dan status pembayaran).",
            "Kepada penyedia layanan tepercaya yang membantu mengoperasikan aplikasi (misalnya penyedia infrastruktur dan autentikasi), dengan kewajiban menjaga kerahasiaan.",
            "Apabila diwajibkan oleh hukum atau permintaan resmi dari otoritas yang berwenang.",
          ]}
        />
      </Section>

      <Section heading="6. Penyimpanan & Keamanan Data">
        <p>
          Kami menerapkan langkah-langkah teknis dan organisasi yang wajar untuk
          melindungi data Anda, termasuk enkripsi pada jalur transmisi dan
          kontrol akses. Namun, tidak ada sistem yang sepenuhnya bebas risiko.
          Kami menyimpan data selama akun Anda aktif atau selama diperlukan untuk
          menjalankan layanan dan memenuhi kewajiban hukum.
        </p>
      </Section>

      <Section heading="7. Hak Anda">
        <List
          items={[
            "Mengakses dan memperbarui data profil Anda melalui aplikasi.",
            "Meminta koreksi atas data yang tidak akurat.",
            "Meminta penghapusan akun dan data pribadi Anda, dengan tetap memperhatikan kewajiban penyimpanan tertentu.",
            "Menarik persetujuan atas pemrosesan data tertentu, yang dapat memengaruhi ketersediaan sebagian fitur.",
          ]}
        />
        <p>
          Untuk menggunakan hak-hak ini, hubungi kami di{" "}
          <a
            href="mailto:arisandigital@outlook.com"
            className="font-semibold text-brand-primary hover:underline"
          >
            arisandigital@outlook.com
          </a>
          .
        </p>
      </Section>

      <Section heading="8. Cookie & Teknologi Serupa">
        <p>
          Kami dapat menggunakan cookie atau penyimpanan lokal untuk menjaga sesi
          login dan preferensi Anda, serta memahami penggunaan layanan secara
          agregat. Anda dapat mengatur preferensi cookie melalui pengaturan
          peramban Anda.
        </p>
      </Section>

      <Section heading="9. Privasi Anak">
        <p>
          Layanan ini tidak ditujukan untuk anak di bawah 18 tahun. Kami tidak
          dengan sengaja mengumpulkan data dari anak-anak. Jika Anda meyakini
          seorang anak telah memberikan data kepada kami, mohon hubungi kami agar
          dapat kami hapus.
        </p>
      </Section>

      <Section heading="10. Perubahan Kebijakan">
        <p>
          Kami dapat memperbarui Kebijakan Privasi ini dari waktu ke waktu.
          Perubahan material akan kami informasikan melalui aplikasi atau email.
          Tanggal "Terakhir diperbarui" di atas menunjukkan versi terkini.
        </p>
      </Section>

      <Section heading="11. Hubungi Kami">
        <p>
          Jika Anda memiliki pertanyaan atau keluhan terkait privasi, hubungi
          kami di{" "}
          <a
            href="mailto:arisandigital@outlook.com"
            className="font-semibold text-brand-primary hover:underline"
          >
            arisandigital@outlook.com
          </a>{" "}
          — Medan, Indonesia.
        </p>
      </Section>
    </LegalLayout>
  );
}
