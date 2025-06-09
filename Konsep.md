Konsep & Rekomendasi Teknologi untuk "Rumah Kita"
Dokumen ini merinci konsep, fitur, alur pengguna, dan rekomendasi teknologi untuk membangun website "Rumah Kita" menggunakan platform yang sepenuhnya gratis untuk memulai.

1. Visi Proyek
Nama: Rumah Kita
Tujuan: Menciptakan ruang privat online (seperti rumah digital) bagi pasangan, teman, atau sahabat untuk terhubung, berbagi, dan berinteraksi secara real-time melalui berbagai fitur kolaboratif.
Kunci Utama: Privat, real-time, dan mudah digunakan.

2. Fitur Utama
Setiap fitur dirancang agar berfungsi secara real-time, artinya setiap perubahan yang dibuat oleh satu pengguna akan langsung terlihat oleh pengguna lainnya tanpa perlu me-refresh halaman.

Otentikasi & "Rumah" Privat:

Pengguna mendaftar dan masuk menggunakan email atau akun Google.

Setelah masuk, satu pengguna dapat membuat "Rumah" baru yang akan menghasilkan kode undangan unik.

Pengguna lain dapat menggunakan kode ini untuk masuk ke "Rumah" yang sama. Setelah itu, kedua pengguna akan terhubung secara permanen di dalam aplikasi.

Notes Bersama:

Sebuah halaman seperti papan tulis atau buku catatan digital.

Kedua pengguna bisa mengetik, mengedit, dan menghapus teks secara bersamaan.

Sangat berguna untuk menulis rencana, catatan penting, atau sekadar corat-coret ide.

Wishlist Bersama:

Daftar keinginan yang bisa diisi bersama.

Setiap item dalam daftar bisa memiliki judul (misal: "Sepatu Lari"), deskripsi, dan mungkin link ke toko online.

Ada tombol "check" yang bisa ditandai jika salah satu pengguna telah membelikan atau mendapatkan barang tersebut, memberikan notifikasi kepada pasangannya.

Chat Real-time:

Fitur obrolan teks privat antara kedua pengguna.

Lengkap dengan penanda waktu dan status "telah dibaca".

Panggilan Suara & Video / Berbagi Layar (Voice/Video Call & Screen Sharing):

Pengguna dapat memulai panggilan suara atau video langsung dari website.

Fitur ini menggunakan koneksi peer-to-peer (P2P), yang berarti data audio/video dikirim langsung antar browser pengguna, membuatnya sangat privat dan cepat (tidak melalui server pusat).

Fitur berbagi layar juga dimungkinkan dengan teknologi yang sama.

3. Rekomendasi Teknologi (100% Gratis untuk Memulai)
Pilihan teknologi ini sangat modern, populer, dan memiliki "free tier" (tingkatan gratis) yang sangat besar, cukup untuk ribuan pengguna aktif. Bahasa pemrograman utamanya adalah JavaScript.

Frontend (Tampilan Website): React.js

Apa itu? Sebuah library JavaScript untuk membangun antarmuka pengguna yang interaktif dan modern.

Mengapa ini? Sangat cocok untuk aplikasi yang datanya sering berubah (seperti chat, notes, dll.). Komunitasnya besar dan banyak tutorial tersedia. Website akan terasa cepat dan responsif seperti aplikasi mobile.

Backend, Database & Hosting: Firebase (dari Google)

Apa itu? Platform all-in-one yang menyediakan database, sistem otentikasi pengguna, hosting, dan banyak lagi tanpa perlu mengelola server sendiri (serverless).

Mengapa ini? Sempurna untuk proyek ini.

Firestore Database: Digunakan untuk menyimpan data Notes, Wishlist, dan pesan Chat. Sifatnya real-time secara bawaan.

Firebase Authentication: Mengurus semua hal tentang login pengguna (email, Google, dll.) dengan aman.

Firebase Hosting: Tempat untuk menaruh file website Anda agar bisa diakses online. Gratis dan cepat.

Firebase Realtime Database: Bisa digunakan sebagai "Signaling Server" untuk membantu menghubungkan panggilan suara/video.

Panggilan Suara/Video: WebRTC

Apa itu? Teknologi bawaan browser modern yang memungkinkan komunikasi audio, video, dan data secara peer-to-peer.

Mengapa ini? Ini adalah standar industri untuk panggilan video di web (digunakan oleh Google Meet, Discord, dll.). Karena P2P, biayanya nol karena tidak membebani server Anda. Firebase akan digunakan hanya untuk "perkenalan" awal antar dua browser.

4. Alur Pengguna (User Flow)
Pengguna A mengunjungi website rumahkita.com.

Ia mendaftar menggunakan akun Google-nya.

Setelah masuk, ia akan melihat dashboard yang masih kosong dan tombol "Buat Rumah Baru".

Ia mengklik tombol tersebut dan langsung mendapatkan kode undangan (contoh: ABC-123-XYZ).

Pengguna A mengirimkan kode ini ke Pengguna B.

Pengguna B mengunjungi website, mendaftar, lalu memilih opsi "Gabung dengan Rumah".

Ia memasukkan kode ABC-123-XYZ.

Sistem berhasil menghubungkan mereka. Sekarang, setiap kali mereka masuk, mereka akan langsung melihat dashboard "Rumah" bersama mereka, lengkap dengan fitur Notes, Wishlist, dan Chat yang sudah tersinkronisasi.