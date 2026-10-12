# Testing Hyro — Mode Offline

Makasih udah mau bantu coba-coba Hyro! Dokumen ini isinya cara install Hyro sebagai aplikasi (PWA), cara simulasiin mode offline, apa aja yang bisa dicoba, dan cara lapor kalau nemu masalah.

## 1. Install Hyro sebagai aplikasi (PWA)

Hyro bisa diinstall langsung dari browser, jadi muncul di home screen kayak aplikasi biasa — gak perlu ke Play Store / App Store.

**Android (Chrome):**
1. Buka link Hyro di Chrome.
2. Tap menu titik tiga di pojok kanan atas → **"Tambahkan ke layar utama"** / **"Install app"**.
3. Konfirmasi. Ikon Hyro bakal muncul di home screen kamu.

**iPhone/iPad (Safari — WAJIB Safari, bukan Chrome):**
1. Buka link Hyro di Safari.
2. Tap ikon **Share** (kotak dengan panah ke atas) di bagian bawah.
3. Scroll, tap **"Add to Home Screen"**.
4. Tap **"Add"**. Ikon Hyro muncul di home screen.

**Desktop (Chrome/Edge):**
1. Buka link Hyro.
2. Klik ikon install (biasanya di ujung kanan address bar, gambar monitor+panah).
3. Klik **Install**.

Setelah diinstall, buka Hyro dari ikonnya (bukan dari browser) — biar kerasa kayak aplikasi asli dan service worker-nya aktif penuh.

> Catatan: login pertama kali **wajib** ada koneksi internet. Setelah itu, sesi kamu tetap jalan walau offline.

## 2. Cara masuk mode offline buat testing

Pilih salah satu:

- **Paling gampang:** aktifkan **Mode Pesawat** di HP kamu, atau matikan Wi-Fi + data seluler.
- **Di laptop/desktop (Chrome DevTools):** buka DevTools (F12) → tab **Network** → ubah dropdown "No throttling" jadi **Offline**.
- **Simulasi sinyal jelek:** di DevTools, pilih **Slow 3G** di dropdown yang sama buat ngetes koneksi lemot (bukan putus total).

Buat balik online, matikan mode pesawat / ubah dropdown balik ke "Online" / "No throttling".

## 3. Apa yang bisa dicoba offline

Setelah kamu pernah buka Hyro minimal sekali waktu online (biar datanya ke-download ke HP), coba ini sambil **offline**:

- ✅ **Lihat daftar grup arisan/patungan kamu** — tetap muncul dari data yang udah tersimpan di HP.
- ✅ **Lihat detail grup**: anggota, giliran, progres iuran.
- ✅ **Lihat notifikasi** yang udah pernah masuk.
- ✅ **Catat iuran arisan** (tombol bayar/kirim bukti) — statusnya bakal jadi **"Menunggu konfirmasi"** (pending), dan otomatis terkirim ke server begitu HP kamu online lagi. Coba catat 2-3 iuran sambil offline, lalu online-kan HP dan lihat apakah semuanya terkirim (dan gak dobel!).
- ✅ **Buka aplikasi lagi setelah lama offline** (misal semaleman) — harus tetap kebuka pakai data lama, lalu nge-sync otomatis begitu online.

## 4. Apa yang SENGAJA tidak bisa offline

Ini bukan bug — ini aturan keamanan karena menyangkut uang:

- ❌ **Bayar online** (lewat Xendit/metode pembayaran digital) — butuh koneksi, gak bisa diantrekan.
- ❌ **Konfirmasi/tolak pembayaran** (aksi admin/penerima giliran) — harus online, server yang nentuin.
- ❌ **Urutan giliran / siapa dapat giliran** — ini keputusan server, gak pernah ditentuin di HP kamu.

Kalau kamu coba aksi yang gak diizinkan offline, tombolnya harus kelihatan nonaktif atau ada pesan jelas — bukan diam-diam gagal.

## 5. Panel Debug (buat lihat "dalemannya")

Ada panel tersembunyi buat lihat status sinkronisasi — berguna banget kalau nemu masalah.

1. Buka Hyro, tambahin `?debug=1` di belakang URL (contoh: `https://hyro.app/app?debug=1`), lalu enter. Cukup sekali — setelahnya bakal keinget terus di HP itu.
2. Muncul tombol bulat kecil 🟢/🔴 di pojok kanan bawah. Tap buat buka panel.
3. Panel nunjukin:
   - Status online/offline & waktu sinkron terakhir
   - Berapa perubahan yang masih nunggu dikirim ("Menunggu")
   - Berapa yang gagal ("Gagal") + alasannya
   - Tombol **"Sinkron Sekarang"** buat maksa sinkron manual
   - Tombol **"Coba lagi"** di tiap item yang gagal

## 6. Grup Demo

Kalau akun kamu masih kosong (belum ada grup), di halaman utama ada tombol **"Coba Grup Demo dulu"** — tap itu buat langsung dapet 1 grup arisan contoh (aman dicoba-coba, bukan arisan beneran) tanpa perlu ngajak orang lain dulu.

## 7. Skenario yang paling kami butuh feedback-nya

1. Catat iuran offline → online-in HP → cek iurannya masuk sekali (gak dobel, gak hilang).
2. Catat beberapa iuran dari 2 HP berbeda (dua anggota beda) sambil sama-sama offline → online-in keduanya → cek semua masuk bener.
3. Catat iuran yang sama berkali-kali waktu sinyal jelek/putus-nyambung → pastikan gak jadi dobel kecatat.
4. Kalau ada aksi yang ditolak server (misal kamu bukan admin tapi nyoba ubah setting grup) → pastikan ada pesan error yang jelas, bukan diem aja.
5. Admin ubah setting grup pas ada anggota lain yang offline → pastikan yang offline lihat versi terbaru pas online lagi, dan dapet info kalau ada perubahannya ketimpa.
6. Offline semaleman (atau lebih) → buka lagi → pastikan tetap kebuka & ke-sync bener, gak logout sendiri.
7. Setelah update aplikasi Hyro ke versi baru, pastikan data lama kamu tetap ada (gak ilang).

## 8. Cara lapor masalah

Kalau nemu yang aneh:
1. Buka panel debug (`?debug=1`) dan screenshot isinya.
2. Catat: lagi ngapain, lagi online/offline, dan apa yang seharusnya terjadi vs yang beneran terjadi.
3. Kirim ke tim lewat channel yang udah disediain (WhatsApp/Slack/email tim Hyro).

Makasih banyak bantuannya! 🙏
