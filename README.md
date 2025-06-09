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
