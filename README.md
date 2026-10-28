# FindLit Campus

Web barang hilang/ditemukan di kampus. HTML + CSS + JavaScript murni, tanpa build.

## Cara menjalankan di VS Code
1. Buka folder ini di VS Code (File > Open Folder).
2. Install ekstensi **Live Server** (Ritwick Dey), klik kanan `index.html` > *Open with Live Server*.
   Atau cukup klik dua kali `index.html` untuk membukanya di browser.

## Struktur
- `index.html`  markup + form + modal
- `style.css`   tampilan (papan pengumuman, mode terang/gelap)
- `app.js`      logika: render, filter, simpan, upload foto

## Catatan
- Data disimpan di `localStorage` (hanya di browser itu). Fungsi `persist()` dan `start()` di `app.js` adalah titik untuk mengganti ke backend (Firebase / Supabase / API sendiri) agar data dibagi ke semua pengguna.
- Foto dikecilkan otomatis (maks 640px, ~150 KB) lalu disimpan sebagai data URL JPEG.

## Halaman & alur
- `login.html` – halaman masuk (email + password).
- `register.html` – halaman daftar (nama, email, password + konfirmasi). Setelah berhasil langsung masuk.
- `index.html` – halaman utama; otomatis diarahkan ke `login.html` bila belum masuk.
- `auth.js` – logika akun bersama (daftar, masuk, keluar, cek sesi).
- Mulai dari `login.html` atau `index.html`. Bila sudah masuk, membuka login/register otomatis ke `index.html`.

## Catatan keamanan
Akun disimpan di `localStorage` browser (password di-hash PBKDF2 + salt), jadi hanya cocok untuk belajar/prototipe. Data tidak dibagi antar perangkat dan bisa diubah lewat DevTools. Untuk akun sungguhan pakai versi Firebase.

## Verifikasi sebelum selesai / hapus
Laporan tidak bisa diselesaikan atau dihapus sembarangan.
- **Selesai** hanya lewat alur klaim: pengguna lain menekan "Ini barang saya" / "Saya menemukannya" dan mendapat **kode serah terima 4 angka**. Kode itu diberikan ke pelapor hanya saat barang benar-benar diserahkan. Pelapor menekan **Verifikasi & selesaikan**, memasukkan kode, dan baru jika cocok laporan jadi Selesai (bertanda "terverifikasi"). Salah 3 kali, klaim dibatalkan otomatis.
- **Tolak klaim** mengembalikan laporan ke status terbuka. Pengklaim bisa **Batalkan klaim**.
- **Hapus** hanya untuk pelapor, tidak bisa saat laporan sedang diklaim, dan wajib memasukkan ulang **password akun** lewat dialog konfirmasi (ikon peringatan, tombol "Tidak, simpan" dan "Ya, hapus!").
- Tombol "Tandai selesai" langsung sudah dihapus.
- Catatan: aturan ini dijalankan di browser dan kode disimpan di `localStorage`, jadi orang yang membuka DevTools masih bisa melihat atau mengubahnya. Untuk penegakan sungguhan, pencocokan kode dan hak hapus harus dilakukan di server (mis. Firebase Cloud Functions + Firestore Rules).
