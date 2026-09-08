# Klin Chat Modern Dark-Mode Gemini AI Workspace

> Aplikasi web chatbot AI interaktif berbasis **Node.js**, **Express**, dan **Google Gemini AI API** (`@google/genai`) dengan antarmuka Desktop Dark Mode modern, dukungan multimodal (gambar & PDF), serta konfigurasi API Key dinamis langsung dari UI.

---

## Daftar Isi

- [Fitur Utama](#-fitur-utama)
- [Tech Stack](#-tech-stack)
- [Struktur Proyek](#-struktur-proyek)
- [Prasyarat](#-prasyarat)
- [Instalasi & Menjalankan](#-instalasi--menjalankan)
- [Konfigurasi](#-konfigurasi)
- [Panduan Penggunaan](#-panduan-penggunaan)
- [API Endpoint](#-api-endpoint)
- [Error Handling](#-error-handling)
- [Lisensi](#-lisensi)

---

## Fitur Utama

### Desktop Dark Workspace
Antarmuka dua kolom (**Sidebar** + **Chat Canvas**) dengan desain sistem *Taste-Skill* + *Soft-Skill*:
- Tema **OLED Slate** — palet warna gelap mendalam berbasis CSS Design Tokens
- **Glassmorphism Header** dengan `backdrop-filter` blur dan indikator status koneksi live
- **Double-bezel Composer** — area input berlapis dengan animasi fokus indigo
- Responsif penuh: overlay drawer di tablet, panel tetap di desktop

### Dynamic API Key Configuration
Konfigurasi Google Gemini API Key langsung dari antarmuka web tanpa perlu menyentuh file server:
- Modal **Pengaturan** (⚙️) dengan input `type="password"` dan tombol show/hide
- API Key disimpan aman di `localStorage` browser (`klin_api_key`)
- **Fallback otomatis** ke `GEMINI_API_KEY` di file `.env` server jika field dikosongkan
- Pilihan **model Gemini** dari dropdown (dapat diubah kapan saja)

### Multimodal Upload — Gambar & PDF
Lampirkan file langsung ke percakapan untuk dianalisis Gemini:
- Tombol **paperclip** (📎) di dalam composer
- Mendukung format: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`
- **Preview chip** dengan thumbnail gambar atau ikon PDF sebelum dikirim
- **Drag & drop** file ke area composer sebagai shortcut
- Konversi otomatis ke Base64 via `FileReader` API — tidak ada upload ke server perantara
- Batas ukuran: **20 MB** (client) / **25 MB** (server JSON body)

### Preset Prompts & Chat History
- **Quick Chips** di empty state dan **Preset Buttons** di sidebar untuk memulai percakapan cepat
- **Panel riwayat percakapan** di sidebar diperbarui real-time setiap pesan dikirim
- Tombol **New Chat** untuk memulai sesi baru sepenuhnya

### Multi-turn Context
Seluruh riwayat percakapan dikirim ke backend pada setiap request, memberikan model konteks lengkap untuk percakapan multi-gilir yang koheren.

---

## Tech Stack

### Backend
| Komponen | Library / Teknologi | Versi |
|---|---|---|
| Runtime | Node.js (ESM `"type": "module"`) | `≥ 18.0.0` |
| Framework | Express.js | `^4.22.2` |
| AI SDK | `@google/genai` | `^1.52.0` |
| Environment | `dotenv` | `^16.6.1` |
| CORS | `cors` | `^2.8.6` |

### Frontend
| Komponen | Teknologi |
|---|---|
| Markup | Vanilla HTML5 (Semantic, ARIA-compliant) |
| Styling | Modern CSS — Design Tokens, Glassmorphism, CSS Custom Properties |
| Logic | Vanilla JavaScript (ES2022+, Fetch API, FileReader, localStorage) |
| Font | Plus Jakarta Sans (Google Fonts) |

### Model Gemini yang Didukung
| Model ID | Karakteristik |
|---|---|
| `gemini-3.5-flash` | ✅ Default — Cepat, kapabilitas tinggi, ketersediaan luas |
| `gemini-3.5-flash-lite` | ⚡ Paling ringan dan tercepat |

---

## Struktur Proyek

```
Klin-AI-Chatbot/
│
├── index.html          # SPA shell — seluruh UI (header, sidebar, chat, modal)
├── index.js            # Express server — POST /api/chat, static serving
├── script.js           # Frontend logic — state, rendering, events, FileReader
├── style.css           # Seluruh styling — Design Tokens, komponen, animasi
│
├── .env                # Konfigurasi environment (TIDAK di-commit ke git)
├── .gitignore          # Git ignore rules
├── package.json        # Manifest proyek & dependensi
├── package-lock.json   # Lockfile dependensi
└── README.md           # Dokumentasi ini
```

---

## Prasyarat

Sebelum memulai, pastikan sudah terpasang:

- **Node.js** `v18.0.0` atau lebih baru → [nodejs.org](https://nodejs.org/)
- **npm** (tersedia bersama Node.js)
- **Google Gemini API Key** → [Google AI Studio](https://aistudio.google.com/app/apikey)

---

## Instalasi & Menjalankan

### 1. Clone Repositori

```bash
git clone <url-repositori-anda>
cd Project-
```

### 2. Install Dependensi

```bash
npm install
```

### 3. Buat File `.env`

Buat file `.env` di root proyek (sejajar dengan `index.js`):

```env
# Google Gemini API Key (wajib jika tidak menggunakan API Key via UI)
GEMINI_API_KEY=AIzaSy...your_key_here

# Port server (opsional, default: 3000)
PORT=3000
```

> **Catatan:** File `.env` sudah terdaftar di `.gitignore`. Jangan pernah commit API Key ke repositori publik.

### 4. Jalankan Server

**Mode development** (auto-restart saat file berubah):
```bash
npm run dev
```

**Mode production:**
```bash
npm start
# atau
node index.js
```

### 5. Buka di Browser

```
http://localhost:3000
```

---

## Konfigurasi

### Prioritas API Key

Aplikasi menentukan API Key yang digunakan dengan urutan prioritas berikut:

```
1. API Key dari UI Settings (localStorage browser)  ← Prioritas tertinggi
        ↓ (jika kosong)
2. GEMINI_API_KEY dari file .env server             ← Fallback
        ↓ (jika tidak ada)
3. HTTP 400 — pesan error ditampilkan ke pengguna
```

### Variabel Environment (`.env`)

| Variabel | Wajib | Default | Keterangan |
|---|---|---|---|
| `GEMINI_API_KEY` | Opsional* | — | API Key Gemini dari Google AI Studio |
| `PORT` | Tidak | `3000` | Port server Express |

*Wajib jika API Key tidak dimasukkan via UI Settings.

---

## Panduan Penggunaan

### Cara 1: API Key via UI (Direkomendasikan)

1. Klik ikon **⚙️ (gear)** di pojok kanan atas header
2. Masukkan **Google Gemini API Key** Anda di field yang tersedia
3. Gunakan ikon 👁️ untuk menampilkan/menyembunyikan key
4. Pilih **Model Gemini** dari dropdown sesuai kebutuhan
5. Klik **Simpan Pengaturan** — key tersimpan di `localStorage` browser

> Key yang disimpan di browser hanya tersedia di perangkat dan browser yang sama. Tidak dikirim ke mana pun selain Gemini API.

### Cara 2: API Key via File `.env`

Tambahkan `GEMINI_API_KEY=AIza...` ke file `.env` di server, lalu restart server. Semua pengguna yang mengakses instance server tersebut akan menggunakan key yang sama tanpa perlu mengisi modal.

---

### Melampirkan File (Multimodal)

| Langkah | Tindakan |
|---|---|
| **1** | Klik ikon **📎 (paperclip)** di sisi kiri composer |
| **2** | Pilih file gambar (JPEG, PNG, GIF, WebP) atau dokumen PDF (maks. 20 MB) |
| **3** | Preview chip akan muncul di atas composer dengan nama file & thumbnail |
| **4** | Ketik pertanyaan Anda tentang file tersebut (opsional) |
| **5** | Tekan **Enter** atau tombol kirim — file dan teks dikirim bersama ke Gemini |

**Alternatif:** Seret (drag & drop) file langsung ke area composer.

Untuk membatalkan lampiran sebelum dikirim, klik ikon **✕** pada chip preview.

---

### Shortcut Keyboard

| Shortcut | Fungsi |
|---|---|
| `Enter` | Kirim pesan |
| `Shift` + `Enter` | Baris baru di dalam composer |
| `Escape` | Tutup modal Pengaturan / Tutup sidebar (mobile) |

---

### Preset & Quick Chips

- **Quick Chips** tersedia di halaman kosong (empty state) — klik untuk langsung mengirim prompt
- **Preset Buttons** di sidebar kiri — klik untuk mengisi dan mengirim prompt yang sudah dikurasi
- Gunakan tombol **New Chat** (ikon `+`) untuk memulai percakapan baru

---

## API Endpoint

### `POST /api/chat`

Endpoint utama untuk percakapan dengan model Gemini.

**Request Body:**

```json
{
  "conversation": [
    { "role": "user",  "text": "Halo Klin!" },
    { "role": "model", "text": "Halo! Ada yang bisa saya bantu?" },
    { "role": "user",  "text": "Jelaskan apa itu machine learning." }
  ],
  "apiKey": "AIza...your_key (opsional)",
  "model":  "gemini-2.0-flash (opsional)",
  "attachment": {
    "mimeType": "image/jpeg",
    "data":     "<base64_string_tanpa_prefix>",
    "fileName": "foto.jpg"
  }
}
```

**Response Sukses `200`:**

```json
{
  "result": "Machine learning adalah cabang dari kecerdasan buatan..."
}
```

**Response Error:**

| HTTP Status | Kondisi | Pesan |
|---|---|---|
| `400` | Tidak ada API Key sama sekali | Instruksi konfigurasi key |
| `400` | Format `conversation` tidak valid | Deskripsi format yang benar |
| `422` | Model tidak tersedia / tidak ditemukan | Saran ganti model |
| `429` | Kuota habis / rate limit | Saran tunggu atau cek kuota |
| `503` | Model overload / high demand | Saran coba lagi atau ganti model |
| `500` | Error lain dari Gemini API | Pesan umum |

---

## Error Handling

Backend mendeteksi dan mengembalikan pesan error yang spesifik dan actionable dalam Bahasa Indonesia:

```
503 UNAVAILABLE  → "Model sedang mengalami lonjakan permintaan..."
404 NOT_FOUND    → "Model yang dipilih tidak tersedia..."
429 QUOTA        → "Kuota API Key habis..."
400/403 AUTH     → "API Key tidak valid atau tidak memiliki izin..."
```

Frontend menampilkan error via **Toast Notification** di bagian atas chat workspace dengan auto-dismiss setelah 5 detik, disertai pesan yang sama di dalam bubble chat untuk menjaga kelengkapan log percakapan.

---

## Lisensi

**MIT License** — Bebas digunakan, dimodifikasi, dan didistribusikan dengan atribusi.

```
Copyright (c) 2025 Klin Chat Contributors
```

---

<div align="center">

Dibuat dengan menggunakan Node.js & Google Gemini AI

</div>
