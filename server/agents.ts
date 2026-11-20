/**
 * Tugas tiap karyawan. Masing-masing memakai Gemini bila tersedia, kalau tidak memakai templat.
 */
import { aiAktif, generateJson } from "./ai.ts";
import { getProject } from "./store.ts";
import { adeganTemplat, naskahTemplat, paketTemplat, risetTemplat } from "./templates.ts";
import { ATURAN_AMAN } from "../src/shared/kebijakan.ts";
import { kembangkan } from "../src/shared/karakter.ts";
import { GAYA, FORMATS, type Karakter, type Adegan, type Naskah, type PaketUnggah, type Project, type Riset, type Settings } from "../src/shared/types.ts";

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
${FORMATS[p.format].riset}
Sudut cerita harus dari sudut pandang orang DEWASA biasa (bukan anak/remaja, bukan tokoh terkenal), karena videonya dibuat dengan Google Veo yang menolak keduanya.

Balas JSON:
{"topik": string, "sudut": string (kalimat pembuka konsep, mis. "POV: kamu ..."), "alasan": string (kenapa berpotensi ditonton), "fakta": string[] (3-5 fakta pendek), "kataKunci": string[] (3-6 kata kunci pencarian)}`);
}

/** Part-part sebelumnya dari cerita bersambung (yang masih ada). */
function partSebelumnya(p: Project): Project[] {
  return (p.seri?.sebelumnya ?? []).map((id) => getProject(id)).filter((x): x is Project => Boolean(x?.naskah));
}

function arahanSeri(p: Project): string {
  if (!p.seri) return "";
  const { part, totalPart } = p.seri;
  const lalu = partSebelumnya(p)
    .map((x) => `--- Part ${x.seri?.part ?? "?"} ---\nHook: ${x.naskah!.hook}\n${x.naskah!.narasi}`)
    .join("\n\n");
  const akhir = part >= totalPart;
  return `
INI CERITA BERSAMBUNG: Part ${part} dari ${totalPart}.
Naskah part sebelumnya:
${lalu || "(tidak tersedia)"}

- Lanjutkan LANGSUNG dari akhir part terakhir di atas; jangan mengulang kejadian yang sudah diceritakan.
- Tokoh, tempat, dan sudut pandang ("aku" atau "kamu") harus sama dengan part sebelumnya; jangan mencampur keduanya.
- hook: buka dengan "Part ${part}." lalu satu kalimat pengingat singkat yang bikin penasaran.
- ${
    akhir
      ? "Ini PART TERAKHIR: tuntaskan ceritanya (ungkap misterinya atau beri twist penutup yang memuaskan). cta: ajak follow untuk cerita baru, sebut bahwa cerita ini tamat."
      : `Akhiri dengan cliffhanger yang kuat. cta: ajak follow dan sebut "Part ${part + 1}" menyusul.`
  }
- judulKerja: judul cerita yang sama dengan part sebelumnya, ditambah " (Part ${part})".`;
}

export async function naskah(p: Project): Promise<Naskah> {
  const r = p.riset!;
  if (!aiAktif()) return naskahTemplat(p.format, r, p.seri);
  return generateJson<Naskah>(`${KONTEKS(p)}

Peranmu: Penulis Naskah.
Riset: ${JSON.stringify(r)}

Tulis naskah video 40–60 detik dalam bahasa Indonesia yang santai dan mudah dipahami.
- hook: 1 kalimat, harus membuat orang berhenti scroll dalam 2 detik pertama.
- narasi: 4–6 baris, dipisah "\\n". Tiap baris dibacakan sekitar 8 detik (maks 20 kata). Masukkan fakta riset secara alami.
- cta: 1 kalimat ajakan komentar/follow.
${FORMATS[p.format].naskah}

${ATURAN_AMAN}
${arahanSeri(p)}

Nama tokoh nyata boleh muncul di judulKerja, tapi TIDAK di hook, narasi, atau cta (karena kalimat itu diucapkan di video).
Aturan usia dewasa itu untuk deskripsi visual nanti; JANGAN menyebut usia tokoh di narasi (terdengar janggal saat dibacakan).

Balas JSON: {"judulKerja": string, "hook": string, "narasi": string, "cta": string}`);
}

const ATURAN_KARAKTER = `Deskripsi karakter WAJIB sangat spesifik supaya wajahnya sama di setiap klip: jenis kelamin, usia angka, bentuk wajah, warna kulit, model & warna rambut, alis/mata, ciri khas (tahi lalat, bekas luka kecil, kacamata, dll), tinggi & bentuk badan, pakaian lengkap dengan warna (atasan, bawahan, alas kaki), dan aksesori. Untuk hewan: spesies, ukuran, warna & pola bulu, ciri khas, aksesori. Tulis dalam satu kalimat panjang bahasa Indonesia, tanpa menyebut nama.`;

export async function storyboard(p: Project, s: Settings): Promise<{ adegan: Adegan[]; karakter?: Karakter[] }> {
  const n = p.naskah!;
  if (!aiAktif()) return { adegan: adeganTemplat(p.format, p.ide || p.riset!.topik, n, s.durasiKlip, p.gaya, s.narasiTts) };
  // lembar karakter: milik proyek ini, atau warisan part sebelumnya
  const warisan = p.karakter?.length ? p.karakter : partSebelumnya(p).at(-1)?.karakter;
  const aturanSuara = s.narasiTts
    ? `SUARA: narasi akan diisi TERPISAH oleh pengisi suara (TTS) supaya suaranya konsisten. Jadi JANGAN tulis kalimat ucapan di prompt. ${
        FORMATS[p.format].bicaraKeKamera
          ? "Tokoh tetap tampak berbicara ke kamera (mulut bergerak, ekspresif), tapi tanpa suara ucapan."
          : "Tokoh tidak berbicara."
      } Akhiri setiap prompt dengan "Tanpa dialog, tanpa ucapan, tanpa suara narator, hanya efek suara latar. Tanpa teks, tanpa subtitle, tanpa watermark."`
    : `SUARA: ucapan/narasi ditulis dalam bahasa Indonesia di dalam tanda kutip di prompt (Veo membuat suaranya). Akhiri dengan "Tanpa teks, tanpa subtitle, tanpa watermark."`;
  const hasil = await generateJson<{ karakter?: Karakter[]; adegan: Omit<Adegan, "no" | "durasi">[] }>(`${KONTEKS(p)}

Peranmu: Sutradara & Prompt Engineer untuk Google Veo.
Naskah: ${JSON.stringify(n)}
Riset: ${JSON.stringify(p.riset)}

${(() => {
    const lalu = partSebelumnya(p).at(-1);
    const contoh = lalu?.adegan?.slice(0, 3).map((a) => a.prompt).join("\n");
    return contoh
      ? `INI LANJUTAN CERITA (Part ${p.seri?.part}). Pakai deskripsi tokoh, pakaian, dan latar yang SAMA PERSIS dengan prompt Part sebelumnya ini:\n${contoh}\n`
      : "";
  })()}
Pecah naskah menjadi ${s.durasiKlip <= 5 ? "8–10" : "5–7"} adegan (hook = adegan 1, cta = adegan terakhir). Untuk tiap adegan tulis:
- visual: deskripsi singkat bahasa Indonesia.
- narasi: kalimat yang diucapkan di adegan itu (ambil dari naskah).
- prompt: prompt Veo dalam BAHASA INDONESIA (jangan pakai bahasa Inggris), satu paragraf, diawali "${GAYA[p.gaya ?? "sinematik"].kepala}", lalu subjek, aksi, latar, gaya kamera, pencahayaan, suara ambient. Jaga karakter dan latar tetap konsisten antar adegan dengan mengulang deskripsi fisik yang sama persis.
- narasi tiap adegan maksimal ${Math.max(6, Math.floor(s.durasiKlip * 2.2))} kata supaya muat dibacakan dalam satu klip ${s.durasiKlip} detik. Kalau naskah lebih panjang, pecah jadi lebih banyak adegan (maksimal 10) atau ringkas kalimatnya.
${aturanSuara}
${FORMATS[p.format].sutradara}

${ATURAN_AMAN}
GAYA VISUAL: ${GAYA[p.gaya ?? "sinematik"].nama}. Masukkan frasa gaya ini di setiap prompt: "${GAYA[p.gaya ?? "sinematik"].prompt}".
${GAYA[p.gaya ?? "sinematik"].tokoh ? `Jangan pakai kata fotorealistis, realistis, atau film sinematik. Deskripsikan tokoh sebagai ${GAYA[p.gaya ?? "sinematik"].tokoh} dengan ciri warna dan pakaian yang sama persis di tiap adegan supaya konsisten.` : ""}

Frasa gaya di atas hanya mengatur gaya gambar; pencahayaan dan suasana ikuti arahan format.
Kalau narasi menyebut usia tokoh (mis. "pria berusia 30 tahun"), hapus bagian itu dari narasi; usia cukup ditulis di prompt.
Kalau naskah melanggar aturan di atas, ubah kalimat narasinya agar aman (dan tulis versi aman itu di field "narasi").

LEMBAR KARAKTER:
${
  warisan?.length
    ? `Pakai karakter yang SUDAH ADA ini (jangan ubah deskripsinya):\n${warisan.map((k) => `- ${k.nama}: ${k.deskripsi}`).join("\n")}\nKalau butuh tokoh baru yang belum ada, tambahkan di "karakter" dengan aturan berikut. ${ATURAN_KARAKTER}`
    : `Buat 1–3 karakter yang muncul di video di field "karakter" (nama panggilan singkat + deskripsi). ${ATURAN_KARAKTER}`
}
Di setiap prompt, JANGAN menulis ulang deskripsi tokoh. Tulis penanda {{Nama}} (dengan kurung kurawal ganda) di tempat tokoh itu muncul, mis. "{{Raka}} berjalan pelan menyusuri lorong". Aplikasi akan menempelkan deskripsi lengkapnya secara otomatis. Tokoh figuran tanpa wajah jelas (siluet, bayangan) boleh dideskripsikan langsung.

Balas JSON: {"karakter": [{"nama": string, "deskripsi": string}], "adegan": [{"visual": string, "narasi": string, "prompt": string}]}`);
  const karakter = [...(warisan ?? [])];
  for (const k of hasil.karakter ?? []) {
    if (k?.nama && k?.deskripsi && !karakter.some((x) => x.nama.toLowerCase() === k.nama.toLowerCase())) karakter.push({ nama: k.nama.trim(), deskripsi: k.deskripsi.trim() });
  }
  const adegan = hasil.adegan.slice(0, 10).map((a, i) => ({
    ...a,
    no: i + 1,
    durasi: s.durasiKlip,
    promptMentah: a.prompt,
    prompt: kembangkan(a.prompt, karakter),
  }));
  return { adegan, karakter: karakter.length ? karakter : undefined };
}

/** Buat lembar karakter dari prompt yang sudah ada (untuk proyek lama tanpa lembar karakter). */
export async function ekstrakKarakter(p: Project): Promise<Karakter[]> {
  if (!aiAktif()) throw new Error("Butuh GEMINI_API_KEY untuk membuat lembar karakter");
  const hasil = await generateJson<{ karakter: Karakter[] }>(`${KONTEKS(p)}

Peranmu: Sutradara. Berikut prompt adegan sebuah video:
${(p.adegan ?? []).map((a) => `- ${a.prompt}`).join("\n")}

Buat lembar karakter untuk 1–3 tokoh utama yang muncul (abaikan siluet/figuran). Pertahankan semua ciri yang sudah disebut di prompt, lalu lengkapi detail yang belum ada agar konsisten. ${ATURAN_KARAKTER}
${ATURAN_AMAN}

Balas JSON: {"karakter": [{"nama": string, "deskripsi": string}]}`);
  return (hasil.karakter ?? []).filter((k) => k?.nama && k?.deskripsi).slice(0, 3);
}

export async function paket(p: Project): Promise<PaketUnggah> {
  const n = p.naskah!;
  const r = p.riset!;
  if (!aiAktif()) return paketTemplat(n, r);
  return generateJson<PaketUnggah>(`${KONTEKS(p)}

Peranmu: Social Media Manager.
${p.seri ? `Video ini Part ${p.seri.part} dari ${p.seri.totalPart} sebuah cerita bersambung: cantumkan "Part ${p.seri.part}" di judul dan caption${p.seri.part >= p.seri.totalPart ? ", dan sebut bahwa ini part terakhir (tamat)" : `, dan sebut Part ${p.seri.part + 1} menyusul`}.` : ""}
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
