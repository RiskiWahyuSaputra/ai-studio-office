# Kantor Piksel

Kantor pixel berisi 8 karyawan AI yang memproduksi konten video AI untuk YouTube Shorts, TikTok, dan Instagram Reels. Klip videonya dirender dengan kredit **Google Flow** (Veo) dari langganan Google AI Pro. Karyawan lain mengurus riset, naskah, prompt, editing, caption, unggahan, dan analisis.

Format kanal:

- **POV Sejarah Nusantara**: penonton diajak "hidup" di satu momen sejarah Indonesia.
- **Vlog Hewan Lokal**: hewan khas Indonesia nge-vlog dengan gaya kocak.
- **Cerita Horor Nusantara**: legenda urban dan kisah seram lokal, dituturkan pelan dan mencekam (tanpa darah atau kekerasan).

Gaya visual per proyek: **Animasi 2D** (bawaan), **Animasi 3D**, **Pixel Art**, atau **Sinematik**.

## Tim

| Karyawan | Peran | Tahap |
|---|---|---|
| Ratna | Produser | Menerima proyek baru, membagi tugas |
| Dimas | Peneliti Tren | 1. Riset topik & fakta |
| Sari | Penulis Naskah | 2. Hook, narasi, CTA |
| Bayu | Sutradara & Prompt | 3. Adegan + prompt Veo berbahasa Indonesia (gaya Pixel Art atau Sinematik) |
| Hadi | Akuntan Kredit | 4. Estimasi kredit Flow, catat pemakaian bulanan |
| Nanda | Editor Video | 5. Narasi TTS + gabung klip jadi 1080×1920 + subtitle (ffmpeg) |
| Putri | Social Media | 6. Judul, caption, hashtag · 7. Unggah ke YouTube/TikTok/Instagram |
| Yoga | Analis Data | 8. Tarik statistik & saran video berikutnya |

Klik karyawan di kantor untuk melihat kerjaan dan catatannya. Saat bekerja, karyawan mengetik di mejanya. Setelah selesai, mereka berjalan mengantar berkas ke rekan berikutnya. Kalau sedang tidak ada kerjaan, mereka ngopi atau duduk di sofa.

## Alur kerja

1. Buat proyek: pilih format, isi ide (atau kosongkan).
2. Dimas, Sari, dan Bayu bekerja otomatis sampai prompt Veo siap.
3. **Giliranmu:** buka [Google Flow](https://labs.google/fx/tools/flow), tempel prompt tiap adegan, render, lalu seret ZIP hasil "download proyek" Flow (atau semua klipnya) ke panel. Klip dicocokkan ke adegan lewat angka di nama file, kemiripan nama dengan prompt, lalu urutan waktu dibuat; hasilnya bisa dicek lewat pratinjau dan ditukar. Kredit Flow tidak punya API, jadi langkah ini manual.
4. Klik **Setujui & lanjut**. Hadi mencatat kredit, Nanda merender video final, lalu Putri menulis caption.
5. Cek caption, lalu unggah ke tiap platform dari panel.
6. Yoga menarik statistik dan memberi saran.

**Cerita bersambung sekaligus:** pilih *Jumlah part* (2–5) saat membuat proyek. Sari menulis cerita utuh sampai tamat yang dibagi per part, Bayu membuat adegan untuk semua part, kamu render sekali di Flow dan impor satu ZIP, lalu Nanda merender satu video per part dan memecahnya jadi proyek Part 1, Part 2, dst. untuk caption dan unggah masing-masing.

Sudah mengedit video sendiri? Pakai **Unggah video final** di tahap render untuk melewati Nanda.

## Menjalankan

Butuh Node.js 23.6+ dan `ffmpeg` (dengan libass untuk subtitle).

```bash
npm install
cp .env.example .env   # isi kunci yang dibutuhkan
npm run dev            # http://localhost:8787
```

Produksi: `npm run build && npm start`.

Data proyek tersimpan di `data/db.json`, token akun di `data/tokens.json`, dan video di `uploads/`. Ketiganya tidak ikut di-commit.

## Konfigurasi

### Otak karyawan (Gemini)

Isi `GEMINI_API_KEY` (gratis di [Google AI Studio](https://aistudio.google.com/apikey)). Tanpa kunci, karyawan memakai templat lokal. Alurnya tetap bisa dicoba, tapi isinya terbatas.

### YouTube

1. Di [Google Cloud Console](https://console.cloud.google.com/), aktifkan **YouTube Data API v3**.
2. Buat OAuth Client tipe *Web application*, dengan redirect URI `http://localhost:8787/api/oauth/youtube/callback`.
3. Isi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET`, lalu klik **Hubungkan YouTube** di panel.

Selama project API belum lolos audit Google, video yang diunggah otomatis berstatus privat.

### TikTok

1. Daftar app di [TikTok for Developers](https://developers.tiktok.com/), aktifkan Login Kit dan Content Posting API (Direct Post).
2. Scope: `user.info.basic`, `video.publish` (tambahkan `video.list` lewat `TIKTOK_SCOPES` kalau tersedia, untuk statistik otomatis). Redirect URI: `https://riskiwahyusaputra.github.io/kantor-piksel/tiktok-callback.html`. Halaman itu (`docs/tiktok-callback.html`) meneruskan login ke `http://localhost:8787`, jadi tidak perlu tunnel. Isi `TIKTOK_REDIRECT_URI` dengan alamat yang sama.
3. Isi `TIKTOK_CLIENT_KEY` dan `TIKTOK_CLIENT_SECRET`.

Sebelum app lolos audit TikTok, posting langsung hanya bisa ke akun yang disetel privat. Pakai pilihan **Kirim ke draft TikTok**: video masuk ke kotak masuk TikTok, lalu kamu tempel caption dan posting dari aplikasinya.

### Instagram Reels

Butuh akun Instagram Professional (Business/Creator) dan token long-lived dengan izin `instagram_content_publish`. Isi `INSTAGRAM_USER_ID` dan `INSTAGRAM_ACCESS_TOKEN`. Mode bawaan `resumable` mengirim file langsung dari server, jadi tidak butuh URL publik.

Semua unggahan ditandai sebagai konten AI (`containsSyntheticMedia` di YouTube, `is_aigc` di TikTok), dan deskripsinya mencantumkan bahwa video dibuat dengan AI.

### Narasi suara

Secara bawaan narasi dibacakan oleh **Gemini TTS** dengan satu suara tetap per proyek (pilih dan dengarkan contohnya di bagian "Suara narasi"). Prompt Veo diminta tanpa dialog, lalu Nanda menempelkan narasi di atas klip dan mengecilkan suara asli klip jadi latar. Durasi adegan otomatis menyesuaikan panjang narasi. Matikan di Pengaturan kalau ingin memakai suara dari Veo sendiri.

### Kredit Flow

Atur kredit bulanan dan biaya per klip (Fast/Quality) di **Pengaturan**. Angka bawaannya 1000 kredit/bulan, 20 untuk Fast, dan 100 untuk Quality. Cek angka terbaru di Google Flow karena bisa berubah. Pemakaian kembali ke nol setiap awal bulan.

## Struktur

```
server/
  index.ts          Express + Vite middleware
  pipeline.ts       antrean tahap, satu karyawan satu kerjaan
  stages.ts         daftar tugas tiap tahap
  agents.ts         prompt Gemini tiap karyawan (templates.ts = cadangan)
  editor.ts         ffmpeg: gabung klip + subtitle
  analyst.ts        statistik & analisis
  platforms/        YouTube, TikTok, Instagram
  routes/           API
src/
  office/           kantor pixel (canvas, sprite digambar dengan kode)
  ui/               panel samping
  shared/           tipe & data tim yang dipakai server dan browser
```
