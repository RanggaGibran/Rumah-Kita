# Rumah Kita

Rumah Kita adalah aplikasi web yang menyediakan ruang privat online (seperti rumah digital) bagi pasangan, teman, atau sahabat untuk terhubung, berbagi, dan berinteraksi secara real-time melalui berbagai fitur kolaboratif.

## Fitur Utama

- **Otentikasi & "Rumah" Privat**: Mendaftar, masuk, dan membuat ruang privat.
- **Notes Bersama**: Papan tulis digital untuk menulis bersama.
- **Wishlist Bersama**: Daftar keinginan yang bisa diisi bersama.
- **Chat Real-time**: Obrolan teks privat.
- **Panggilan Suara & Video**: Komunikasi audio dan video melalui WebRTC.

## Teknologi

- **Frontend**: React.js dengan TypeScript
- **Backend & Database**: Firebase (Authentication, Firestore, Realtime Database, Hosting)
- **Video Call**: WebRTC
- **Styling**: Tailwind CSS

## Cara Menjalankan Aplikasi

1. Clone repository ini
2. Install dependensi dengan menjalankan `npm install`
3. Buat project di [Firebase Console](https://console.firebase.google.com/)
4. Isi file `.env.local` dengan konfigurasi Firebase Anda
5. Jalankan aplikasi dengan perintah `npm start`

## Struktur Folder

```
src/
  ├── App.tsx               # Komponen utama aplikasi
  ├── index.css             # Global CSS
  ├── index.tsx             # Entry point
  ├── assets/               # Gambar, font, dan aset statis lainnya
  ├── components/           # Komponen React
  │   ├── auth/             # Komponen otentikasi (login, register)
  │   ├── call/             # Komponen untuk fitur panggilan video
  │   ├── chat/             # Komponen untuk fitur chat
  │   ├── dashboard/        # Komponen untuk dashboard
  │   ├── home/             # Komponen untuk pengaturan rumah
  │   ├── notes/            # Komponen untuk fitur notes
  │   └── wishlist/         # Komponen untuk fitur wishlist
  ├── contexts/             # Context API untuk state global
  ├── hooks/                # Custom hooks
  ├── services/             # Layanan API dan integrasi pihak ketiga
  │   ├── firebase/         # Konfigurasi dan layanan Firebase
  │   └── webrtc/           # Konfigurasi dan layanan WebRTC
  ├── types/                # TypeScript type definitions
  └── utils/                # Fungsi utilitas
```

## Kontribusi

Silakan membuat pull request untuk kontribusi ke proyek ini.

## Troubleshooting

### WebSocket Connection Error

Jika Anda melihat error `WebSocket connection to 'wss://rumahkita.rnggagib.me:3000/ws' failed` di konsol browser, ini adalah masalah yang sudah ditangani oleh interceptor WebSocket yang ada di aplikasi.

Penyebab error:
- Aplikasi mencoba terhubung ke server WebSocket eksternal yang tidak tersedia
- Koneksi ini tidak dibutuhkan untuk fungsi utama aplikasi karena komunikasi WebRTC menggunakan Firebase Realtime Database untuk signaling

Solusi yang sudah diimplementasi:
1. WebSocket interceptor (`src/utils/webSocketCheck.ts`) yang mencegah koneksi ke server yang tidak diperlukan
2. Kelas `MockWebSocket` yang mensimulasikan koneksi WebSocket tertutup dengan baik
3. Konfigurasi ICE server yang lebih kuat dengan beberapa STUN server alternatif
4. Penanganan error yang lebih spesifik di layanan WebRTC

Cara kerja solusi:
- Saat aplikasi mencoba membuat koneksi WebSocket ke URL yang diblokir, interceptor mendeteksi dan mengalihkannya
- Alih-alih koneksi gagal dengan error, MockWebSocket akan mengeluarkan event close yang terstruktur
- WebRTC service mampu mendeteksi error WebSocket dan mencegahnya mengganggu fungsionalitas video call

Jika masalah WebSocket masih muncul, pastikan Anda menggunakan versi terbaru dari aplikasi ini dan tidak ada ekstensi browser yang mengganggu.
