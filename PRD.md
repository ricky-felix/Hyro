# PRD — Hyro

**Status:** MVP · **Versi:** 1.0 · **Tanggal:** 15 Juni 2026 · **Owner:** Titik Jalin Projects

---

## 1. Ringkasan

Hyro adalah WebApp untuk mendigitalisasi sistem **arisan** tradisional Indonesia, plus **patungan** (bill splitting) bareng teman. Dirancang untuk pengguna Gen Z dengan format lokal penuh (Rupiah, nomor HP, tanggal, Bahasa Indonesia).

## 2. Masalah

- Arisan manual rawan salah catat, susah lacak giliran, dan iuran sering telat.
- Bagi tagihan rame-rame ribet dihitung manual, dan utang antar teman menumpuk tanpa kejelasan siapa bayar siapa.

## 3. Tujuan & Metrik

| Tujuan | Metrik |
| --- | --- |
| Memudahkan kelola arisan grup | Jumlah grup aktif, ronde selesai tepat waktu |
| Mempermudah patungan & pelunasan | Tagihan dibuat/bulan, rasio settlement terkonfirmasi |
| Monetisasi berkelanjutan | Konversi Free → Boss/Bisnis |

## 4. Target Pengguna

- **Anggota arisan** (Gen Z) yang ikut grup arisan keluarga/teman/komunitas.
- **Admin grup** yang mengelola ronde, anggota, dan verifikasi pembayaran.
- **Teman patungan** yang bagi tagihan makan, transport, sewa, langganan, dll.

## 5. Scope MVP

### 5.1 Arisan (Grup)
- Buat grup: jumlah ronde, jadwal mingguan/bulanan, nominal iuran.
- Pilih giliran **acak otomatis** atau **manual** (drag & drop).
- Undang anggota via tautan token; tetapkan admin per grup.
- Verifikasi pembayaran iuran oleh admin (approve / reject + alasan).
- Auto-scaffolding ronde dari tanggal mulai + frekuensi.
- Status grup: `active` | `completed` | `pending`.

### 5.2 Patungan (Bill Splitting)
- 4 metode pembagian: **equal**, **exact**, **percentage**, **shares**.
- Tagihan berulang (sewa, langganan, listrik bulanan).
- **Penyederhanaan utang** (greedy min-cash-flow): A→B→C jadi A→C.
- Settlement: pelunasan + bukti transfer + konfirmasi penerima.
- Komentar berulir per tagihan; kontak tersimpan (auto-resolve dari nomor HP).

### 5.3 Notifikasi
`payment_due`, `payment_confirmed`, `payment_rejected`, `giliran_announced`, `member_joined`, `round_completed`, `bill_created`, `bill_settled`, `bill_reminder`, `settlement_confirmed`, `settlement_rejected`.

### 5.4 Monetisasi
- **Gratis** (max 2 grup, 5 tagihan/bln), **Boss** (Rp 29.000/bln), **Bisnis** (Rp 199.000/bln).
- Subscription per-user atau per-grup; gateway **Xendit** & **Midtrans** (webhook signature validation).
- Quota enforcement via `PlanGuard` + `usage_tracking`; audit trail di `payment_transactions`.

## 6. Di Luar Scope (MVP)

- Aplikasi mobile native.
- Integrasi rekening bank / auto-debit langsung.
- Multi-currency (hanya IDR).

## 7. Kebutuhan Non-Fungsional

- **Keamanan:** RLS aktif di semua tabel, JWT verification tiap request, service role key hanya di backend, validasi signature webhook, ownership check storage path.
- **RBAC:** `platform_role` (user / super_admin) dan `group_role` (member / admin).
- **Format lokal:** Rupiah (`BIGINT`, no desimal), nomor HP `+62`, tanggal `8 Januari 2026`, default bahasa `id`.

## 8. Arsitektur Teknis

- **Frontend:** Vite + React 18, Tailwind v4, React Router 7 (port 5173).
- **Backend:** NestJS 10 + TypeScript strict, Supabase service role (port 3000).
- **Database:** Supabase PostgreSQL (schema v3, 20 tabel, RLS aktif).
- Browser pakai anon key hanya untuk upload Storage; semua mutasi data lewat NestJS.

## 9. Risiko & Asumsi

- Kepercayaan pengguna pada verifikasi pembayaran manual (belum auto-rekonsiliasi bank).
- Ketergantungan pada uptime Supabase & gateway pembayaran.
- Asumsi: pengguna utama transaksi dalam IDR dan berbasis di Indonesia.
