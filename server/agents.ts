/**
 * Tugas tiap karyawan. Masing-masing memakai Gemini bila tersedia, kalau tidak memakai templat.
 */
import { aiAktif, generateJson } from "./ai.ts";
import { adeganTemplat, naskahTemplat, paketTemplat, risetTemplat } from "./templates.ts";
import { ATURAN_AMAN } from "../src/shared/kebijakan.ts";
import { GAYA, FORMATS, type Adegan, type Naskah, type PaketUnggah, type Project, type Riset, type Settings } from "../src/shared/types.ts";

const KONTEKS = (p: Project) =>
  `Kamu bagian dari tim kreator konten video AI berbahasa Indonesia untuk YouTube Shorts, TikTok, dan Instagram Reels.
Format kanal: ${FORMATS[p.format].nama} — ${FORMATS[p.format].ringkas}
Video dibuat dari klip Google Veo (lewat Google Flow), tiap klip sekitar 8 detik, vertikal 9:16, total 40–60 detik.`;

export async function riset(p: Project): Promise<Riset> {
  if (!aiAktif()) return risetTemplat(p.format, p.ide);
  return generateJson<Riset>(`${KONTEKS(p)}

Peranmu: Peneliti Tren.
${p.ide ? `Ide dari pemilik kanal: "${p.ide}".` : "Pemilik kanal belum memberi ide; pilih sendiri topik yang berpotensi viral bulan ini."}
Pilih satu topik dan satu sudut cerita yang kuat untuk video pendek. Untuk format sejarah, fakta harus akurat dan bisa dicek; jangan mengarang tanggal atau nama.
Sudut cerita harus dari sudut pandang orang DEWASA biasa (bukan anak/remaja, bukan tokoh terkenal), karena videonya dibuat dengan Google Veo yang menolak keduanya.

Balas JSON:
{"topik": string, "sudut": string (kalimat pembuka konsep, mis. "POV: kamu ..."), "alasan": string (kenapa berpotensi ditonton), "fakta": string[] (3-5 fakta pendek), "kataKunci": string[] (3-6 kata kunci pencarian)}`);
}

export async function naskah(p: Project): Promise<Naskah> {
  const r = p.riset!;
  if (!aiAktif()) return naskahTemplat(p.format, r);
  return generateJson<Naskah>(`${KONTEKS(p)}

Peranmu: Penulis Naskah.
Riset: ${JSON.stringify(r)}

Tulis naskah video 40–60 detik dalam bahasa Indonesia yang santai dan mudah dipahami.
- hook: 1 kalimat, harus membuat orang berhenti scroll dalam 2 detik pertama.
- narasi: 4–6 baris, dipisah "\\n". Tiap baris dibacakan sekitar 8 detik (maks 20 kata). Masukkan fakta riset secara alami.
- cta: 1 kalimat ajakan komentar/follow.
${p.format === "vlog-hewan" ? "Narasi diucapkan oleh hewan itu sendiri (orang pertama), lucu, boleh pakai bahasa gaul ringan." : "Narasi orang kedua (\"kamu\"), membuat penonton merasa ada di sana."}

${ATURAN_AMAN}
Nama tokoh nyata boleh muncul di judulKerja, tapi TIDAK di hook, narasi, atau cta (karena kalimat itu diucapkan di video).

Balas JSON: {"judulKerja": string, "hook": string, "narasi": string, "cta": string}`);
}

export async function storyboard(p: Project, s: Settings): Promise<Adegan[]> {
  const n = p.naskah!;
  if (!aiAktif()) return adeganTemplat(p.format, p.ide || p.riset!.topik, n, s.durasiKlip, p.gaya);
  const hasil = await generateJson<{ adegan: Omit<Adegan, "no" | "durasi">[] }>(`${KONTEKS(p)}

Peranmu: Sutradara & Prompt Engineer untuk Google Veo.
Naskah: ${JSON.stringify(n)}
Riset: ${JSON.stringify(p.riset)}

Pecah naskah menjadi 5–7 adegan (hook = adegan 1, cta = adegan terakhir). Untuk tiap adegan tulis:
- visual: deskripsi singkat bahasa Indonesia.
- narasi: kalimat yang diucapkan di adegan itu (ambil dari naskah).
- prompt: prompt Veo dalam BAHASA INGGRIS, satu paragraf, diawali "${GAYA[p.gaya ?? "sinematik"].kepala}", lalu subjek, aksi, latar, gaya kamera, pencahayaan, suara ambient. Ucapan/narasi ditulis dalam bahasa Indonesia di dalam tanda kutip (Veo bisa membuat suara). Jaga karakter dan latar tetap konsisten antar adegan dengan mengulang deskripsi fisik yang sama persis. Akhiri dengan "No text, no subtitles, no watermark."
${p.format === "pov-sejarah" ? "Pakai sudut pandang orang pertama (first-person POV) dan detail periode yang akurat." : "Hewan berbicara langsung ke kamera seperti vlogger; ekspresif dan kocak."}

${ATURAN_AMAN}
GAYA VISUAL: ${GAYA[p.gaya ?? "sinematik"].nama}. Masukkan frasa gaya ini di setiap prompt: "${GAYA[p.gaya ?? "sinematik"].prompt}".
${p.gaya === "pixel" ? "Jangan pakai kata photorealistic, realistic, atau cinematic film. Deskripsikan tokoh sebagai karakter pixel art (pixel art character) dengan ciri warna yang sama persis di tiap adegan supaya konsisten." : ""}

Kalau naskah melanggar aturan di atas, ubah kalimat narasinya agar aman (dan tulis versi aman itu di field "narasi").

Balas JSON: {"adegan": [{"visual": string, "narasi": string, "prompt": string}]}`);
  return hasil.adegan.slice(0, 8).map((a, i) => ({ ...a, no: i + 1, durasi: s.durasiKlip }));
}

export async function paket(p: Project): Promise<PaketUnggah> {
  const n = p.naskah!;
  const r = p.riset!;
  if (!aiAktif()) return paketTemplat(n, r);
  return generateJson<PaketUnggah>(`${KONTEKS(p)}

Peranmu: Social Media Manager.
Naskah: ${JSON.stringify(n)}
Riset: ${JSON.stringify(r)}

Siapkan materi unggah per platform dalam bahasa Indonesia:
- youtube.judul: maks 90 karakter, memancing klik tapi jujur, sertakan "#shorts".
- youtube.deskripsi: 3–6 kalimat + fakta singkat + baris "Video ini dibuat dengan AI (Google Veo)." + 3-5 hashtag.
- youtube.tags: 8–15 tag tanpa tanda #.
- tiktok.caption: maks 150 karakter + 4-6 hashtag (termasuk #fyp).
- instagram.caption: 2–4 kalimat, ajakan komentar, lalu 8-15 hashtag.

Balas JSON: {"youtube": {"judul": string, "deskripsi": string, "tags": string[]}, "tiktok": {"caption": string}, "instagram": {"caption": string}}`);
}
