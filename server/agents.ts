import { EFEK, KAMERA, type Efek, type Gerak, type Kamera } from "../src/shared/video.ts";
/**
 * Tugas tiap karyawan. Masing-masing memakai Gemini bila tersedia, kalau tidak memakai templat.
 */
import { aiAktif, generateJson } from "./ai.ts";
import { getProject } from "./store.ts";
import { adeganTemplat, naskahTemplat, paketTemplat, risetTemplat } from "./templates.ts";
import { ATURAN_AMAN } from "../src/shared/kebijakan.ts";
import { kembangkan } from "../src/shared/karakter.ts";
import { GAYA, FORMATS, type BagianNaskah, type Karakter, type Adegan, type Naskah, type PaketUnggah, type Project, type Riset, type Settings } from "../src/shared/types.ts";

/** Target panjang per video: teks untuk prompt, jumlah baris narasi, dan jumlah adegan. */
export function ukuranDurasi(p: Project) {
  const T = p.durasiTarget;
  if (!T) return { teks: "40–60 detik", baris: "4–6", adegan: [6, 8] as const, maks: 10 };
  const menit = T / 60;
  const teks = `sekitar ${String(menit).replace(".", ",")} menit (${T} detik)`;
  // narasi horor dibaca pelan: ±9 detik per baris (maks 20 kata), ±8 detik per adegan
  return { teks, baris: `${Math.round(T / 10)}–${Math.round(T / 8.5)}`, adegan: [Math.round(T / 9), Math.round(T / 7)] as const, maks: Math.round(T / 6) };
}

const KONTEKS = (p: Project) =>
  `Kamu bagian dari tim kreator konten video AI berbahasa Indonesia untuk YouTube Shorts, TikTok, dan Instagram Reels.
Format kanal: ${FORMATS[p.format].nama} — ${FORMATS[p.format].ringkas}
${p.sumberVisual === "flow" ? "Video dibuat dari klip Google Veo (lewat Google Flow), tiap klip sekitar 8 detik" : "Video dianimasikan per adegan"}, vertikal 9:16, panjang tiap video ${ukuranDurasi(p).teks}.`;

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

/** Gabungkan naskah per part ke field utama (hook part 1, semua narasi, cta part terakhir). */
export function rangkumPart(judulKerja: string, part: BagianNaskah[]): Naskah {
  return {
    judulKerja,
    hook: part[0]?.hook ?? "",
    narasi: part.map((b, i) => `[Part ${i + 1}]\n${b.narasi}`).join("\n"),
    cta: part.at(-1)?.cta ?? "",
    part,
  };
}

export async function naskah(p: Project): Promise<Naskah> {
  const r = p.riset!;
  const N = p.rencanaPart ?? 1;
  if (!aiAktif()) {
    if (N <= 1) return naskahTemplat(p.format, r, p.seri);
    const part = Array.from({ length: N }, (_, i) => naskahTemplat(p.format, r, { id: p.id, part: i + 1, totalPart: N, sebelumnya: [] }));
    return rangkumPart(r.sudut, part.map(({ hook, narasi, cta }) => ({ hook, narasi, cta })));
  }
  if (N > 1) {
    const hasil = await generateJson<{ judulKerja: string; part: BagianNaskah[] }>(`${KONTEKS(p)}

Peranmu: Penulis Naskah.
Riset: ${JSON.stringify(r)}

Tulis SATU cerita utuh dari awal sampai TAMAT dalam bahasa Indonesia, dibagi menjadi ${N} part. Tiap part adalah video terpisah ${ukuranDurasi(p).teks} yang diunggah berurutan.
Untuk tiap part:
- hook: 1 kalimat pembuka yang bikin berhenti scroll. Part 2 dst diawali "Part N." lalu pengingat singkat yang bikin penasaran.
- narasi: ${ukuranDurasi(p).baris} baris, dipisah "\\n", tiap baris maks 20 kata, melanjutkan langsung dari part sebelumnya tanpa mengulang.
- cta: part 1 sampai ${N - 1} diakhiri cliffhanger + ajakan follow untuk part berikutnya; part ${N} menuntaskan cerita (ungkap misteri / twist penutup yang memuaskan) dan bilang ceritanya tamat.
${FORMATS[p.format].naskah}

${ATURAN_AMAN}

Nama tokoh nyata boleh muncul di judulKerja, tapi TIDAK di hook, narasi, atau cta.
JANGAN menyebut usia tokoh di narasi.

Balas JSON: {"judulKerja": string, "part": [{"hook": string, "narasi": string, "cta": string}]} dengan tepat ${N} part.`);
    const part = (hasil.part ?? []).slice(0, N).filter((b) => b?.hook && b?.narasi);
    if (part.length < N) throw new Error(`Naskah hanya berisi ${part.length} dari ${N} part, coba ulangi`);
    return rangkumPart(hasil.judulKerja, part);
  }
  return generateJson<Naskah>(`${KONTEKS(p)}

Peranmu: Penulis Naskah.
Riset: ${JSON.stringify(r)}

Tulis naskah video ${ukuranDurasi(p).teks} dalam bahasa Indonesia yang santai dan mudah dipahami.
- hook: 1 kalimat, harus membuat orang berhenti scroll dalam 2 detik pertama.
- narasi: ${ukuranDurasi(p).baris} baris, dipisah "\\n". Tiap baris dibacakan sekitar 8 detik (maks 20 kata). Masukkan fakta riset secara alami.
- cta: 1 kalimat ajakan komentar/follow.
${FORMATS[p.format].naskah}

${ATURAN_AMAN}
${arahanSeri(p)}

Nama tokoh nyata boleh muncul di judulKerja, tapi TIDAK di hook, narasi, atau cta (karena kalimat itu diucapkan di video).
Aturan usia dewasa itu untuk deskripsi visual nanti; JANGAN menyebut usia tokoh di narasi (terdengar janggal saat dibacakan).

Balas JSON: {"judulKerja": string, "hook": string, "narasi": string, "cta": string}`);
}

const ATURAN_KARAKTER = `Deskripsi karakter WAJIB sangat spesifik supaya wajahnya sama di setiap klip: jenis kelamin, usia angka, bentuk wajah, warna kulit, model & warna rambut, alis/mata, ciri khas (tahi lalat, bekas luka kecil, kacamata, dll), tinggi & bentuk badan, pakaian lengkap dengan warna (atasan, bawahan, alas kaki), dan aksesori. Untuk hewan: spesies, ukuran, warna & pola bulu, ciri khas, aksesori. Tulis dalam satu kalimat panjang bahasa Indonesia, tanpa menyebut nama.`;

const GERAK_BAWAAN: Record<Project["format"], Gerak["efek"]> = {
  "fakta-unik": [],
  "cerita-horor": ["kabut", "gelap"],
  "pov-sejarah": ["debu"],
  "vlog-hewan": [],
};

/** Validasi gerak dari AI; nilai yang tidak dikenal diganti bawaan per format. */
export function rapikanGerak(g: unknown, format: Project["format"], i: number): Gerak {
  const x = (g ?? {}) as { kamera?: string; efek?: unknown };
  const kamera = KAMERA.includes(x.kamera as Kamera) ? (x.kamera as Kamera) : (["zoom-masuk", "geser-kiri", "zoom-keluar", "geser-kanan"] as Kamera[])[i % 4];
  const efek = Array.isArray(x.efek) ? (x.efek.filter((e) => EFEK.includes(e as Efek)) as Efek[]).slice(0, 3) : GERAK_BAWAAN[format];
  return { kamera, efek: [...new Set(efek)] };
}

export async function storyboard(p: Project, s: Settings): Promise<{ adegan: Adegan[]; karakter?: Karakter[] }> {
  const n = p.naskah!;
  const N = n.part?.length ?? 1;
  if (!aiAktif()) {
    if (N <= 1) return { adegan: adeganTemplat(p.format, p.ide || p.riset!.topik, n, s.durasiKlip, p.gaya, s.narasiTts) };
    const semua: Adegan[] = [];
    n.part!.forEach((b, i) => {
      const per = adeganTemplat(p.format, p.ide || p.riset!.topik, { judulKerja: n.judulKerja, ...b }, s.durasiKlip, p.gaya, s.narasiTts);
      for (const a of per) semua.push({ ...a, no: semua.length + 1, part: i + 1 });
    });
    return { adegan: semua };
  }
  const kode = p.sumberVisual === "antigravity";
  const ilustrasi = p.sumberVisual === "ilustrasi" || kode;
  const gayaGambar = GAYA[p.gaya ?? "sinematik"];
  const u = ukuranDurasi(p);
  const jumlahAdegan = ilustrasi
    ? `${u.adegan[0]}–${u.adegan[1]}`
    : p.durasiTarget
    ? `${Math.round(p.durasiTarget / (s.durasiKlip + 1))}–${Math.round(p.durasiTarget / s.durasiKlip)}`
    : s.durasiKlip <= 5 ? "8–10" : "5–7";
  // lembar karakter: milik proyek ini, atau warisan part sebelumnya
  const warisan = p.karakter?.length ? p.karakter : partSebelumnya(p).at(-1)?.karakter;
  const aturanSuara = kode
    ? `Narasi diisi TERPISAH oleh pengisi suara, jadi jangan tulis ucapan di prompt. Sisakan sepertiga bawah layar untuk subtitle. Tulis arahan yang bisa digambar dengan bentuk vektor (siluet, bangunan, pepohonan, kendaraan, lampu, kabut, partikel), hindari detail wajah yang rumit.`
    : ilustrasi
    ? `Ini GAMBAR DIAM untuk dibuat di aplikasi Gemini, jadi JANGAN tulis gerakan kamera, suara, atau ucapan di prompt. Sisakan ruang yang tidak terlalu ramai di sepertiga bawah gambar untuk subtitle. Akhiri setiap prompt dengan "Tanpa teks, tanpa tulisan, tanpa watermark."`
    : s.narasiTts
    ? `SUARA: narasi akan diisi TERPISAH oleh pengisi suara (TTS) supaya suaranya konsisten. Jadi JANGAN tulis kalimat ucapan di prompt. ${
        FORMATS[p.format].bicaraKeKamera
          ? "Tokoh tetap tampak berbicara ke kamera (mulut bergerak, ekspresif), tapi tanpa suara ucapan."
          : "Tokoh tidak berbicara."
      } Akhiri setiap prompt dengan "Tanpa dialog, tanpa ucapan, tanpa suara narator, hanya efek suara latar. Tanpa teks, tanpa subtitle, tanpa watermark."`
    : `SUARA: ucapan/narasi ditulis dalam bahasa Indonesia di dalam tanda kutip di prompt (Veo membuat suaranya). Akhiri dengan "Tanpa teks, tanpa subtitle, tanpa watermark."`;
  const hasil = await generateJson<{ karakter?: Karakter[]; adegan: Omit<Adegan, "no" | "durasi">[] }>(`${KONTEKS(p)}

${kode ? "Peranmu: Sutradara & Art Director. Videonya dianimasikan SELURUHNYA dengan kode (motion graphics Remotion) oleh motion designer: latar, tokoh bergaya ilustrasi vektor, cahaya, partikel, dan tipografi. Jadi field prompt adalah arahan visual yang jelas untuk motion designer itu (komposisi, elemen yang bergerak, warna, cahaya), bukan prompt untuk AI gambar." : ilustrasi ? "Peranmu: Sutradara & Ilustrator. Videonya dibuat dari satu GAMBAR DIAM per adegan yang nanti digerakkan (zoom/geser kamera, efek kabut, hujan, dll) dan diberi narasi." : "Peranmu: Sutradara & Prompt Engineer untuk Google Veo."}
Naskah: ${JSON.stringify(n)}
Riset: ${JSON.stringify(p.riset)}

${(() => {
    const lalu = partSebelumnya(p).at(-1);
    const contoh = lalu?.adegan?.slice(0, 3).map((a) => a.prompt).join("\n");
    return contoh
      ? `INI LANJUTAN CERITA (Part ${p.seri?.part}). Pakai deskripsi tokoh, pakaian, dan latar yang SAMA PERSIS dengan prompt Part sebelumnya ini:\n${contoh}\n`
      : "";
  })()}
${
  N > 1
    ? `Naskah ini satu cerita utuh yang terdiri dari ${N} part (lihat field "part"). Untuk SETIAP part, pecah menjadi ${jumlahAdegan} adegan: adegan pertama part = hook part itu, adegan terakhir part = cta part itu. Urutkan adegan dari part 1 sampai part ${N}, dan isi field "part" (angka) di tiap adegan.`
    : `Pecah naskah menjadi ${jumlahAdegan} adegan (hook = adegan 1, cta = adegan terakhir).`
} Untuk tiap adegan tulis:
- visual: deskripsi singkat bahasa Indonesia.
- narasi: kalimat yang diucapkan di adegan itu (ambil dari naskah).
${
  ilustrasi
    ? `- prompt: prompt GAMBAR dalam BAHASA INDONESIA, satu paragraf, diawali "Ilustrasi vertikal 9:16, ${gayaGambar.gambar}", lalu subjek & pose, ekspresi, latar, sudut pandang/komposisi, pencahayaan, dan suasana. Jaga tokoh dan latar konsisten antar adegan.
- gerak: {"kamera": salah satu dari ${KAMERA.map((k) => `"${k}"`).join(", ")}, "efek": daftar 0–3 dari ${EFEK.map((e) => `"${e}"`).join(", ")}}. Pilih yang memperkuat suasana (mis. horor: zoom-masuk pelan + kabut/kedip/gelap; hujan hanya kalau adegannya memang hujan; getar untuk momen kaget). Variasikan kamera antar adegan.
- narasi tiap adegan 1–2 kalimat, maksimal 22 kata.`
    : `- prompt: prompt Veo dalam BAHASA INDONESIA (jangan pakai bahasa Inggris), satu paragraf, diawali "${gayaGambar.kepala}", lalu subjek, aksi, latar, gaya kamera, pencahayaan, suara ambient. Jaga karakter dan latar tetap konsisten antar adegan dengan mengulang deskripsi fisik yang sama persis.
- narasi tiap adegan maksimal ${Math.max(6, Math.floor(s.durasiKlip * 2.2))} kata supaya muat dibacakan dalam satu klip ${s.durasiKlip} detik. Kalau naskah lebih panjang, pecah jadi lebih banyak adegan (maksimal ${Math.max(10, u.maks)}) atau ringkas kalimatnya.`
}
${aturanSuara}
${FORMATS[p.format].sutradara}

${ATURAN_AMAN}
GAYA VISUAL: ${gayaGambar.nama}. Masukkan frasa gaya ini di setiap prompt: "${ilustrasi ? gayaGambar.gambar : gayaGambar.prompt}".
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

Balas JSON: {"karakter": [{"nama": string, "deskripsi": string}], "adegan": [{"visual": string, "narasi": string, "prompt": string${N > 1 ? ', "part": number' : ""}${ilustrasi ? ', "gerak": {"kamera": string, "efek": string[]}' : ""}}]}`);
  const karakter = [...(warisan ?? [])];
  for (const k of hasil.karakter ?? []) {
    if (k?.nama && k?.deskripsi && !karakter.some((x) => x.nama.toLowerCase() === k.nama.toLowerCase())) karakter.push({ nama: k.nama.trim(), deskripsi: k.deskripsi.trim() });
  }
  const adegan = hasil.adegan.slice(0, Math.max(10, u.maks) * N).map((a, i) => ({
    ...a,
    gerak: ilustrasi ? rapikanGerak(a.gerak, p.format, i) : undefined,
    part: N > 1 ? Math.min(N, Math.max(1, Math.round(Number(a.part) || 1))) : undefined,
    no: i + 1,
    durasi: s.durasiKlip,
    promptMentah: a.prompt,
    prompt: kembangkan(a.prompt, karakter),
  }));
  if (N > 1) {
    // part harus naik berurutan dan setiap part punya adegan
    let terakhir = 1;
    for (const a of adegan) {
      a.part = Math.max(terakhir, a.part ?? terakhir);
      terakhir = a.part;
    }
    const kosong = Array.from({ length: N }, (_, i) => i + 1).filter((k) => !adegan.some((a) => a.part === k));
    if (kosong.length) throw new Error(`Adegan untuk part ${kosong.join(", ")} tidak dibuat, coba ulangi`);
  }
  return { adegan, karakter: karakter.length ? karakter : undefined };
}

/**
 * Prompt gambar bahasa Inggris untuk mesin gambar otomatis (model Flux lebih paham bahasa Inggris).
 * Satu panggilan untuk semua adegan supaya deskripsi tokoh seragam.
 */
export async function promptGambarInggris(p: Project): Promise<Record<number, string>> {
  const adegan = p.adegan ?? [];
  if (!aiAktif()) return Object.fromEntries(adegan.map((a) => [a.no, a.prompt]));
  const g = GAYA[p.gaya ?? "sinematik"];
  const hasil = await generateJson<{ adegan: { no: number; prompt: string }[] }>(`Terjemahkan & ringkas prompt gambar berikut menjadi prompt BAHASA INGGRIS untuk model gambar Flux.
Aturan (urutan penting, model gambar paling memperhatikan kata-kata awal):
1. Mulai dengan LATAR dan AKSI adegan, lalu jenis bidikan yang memperlihatkan lingkungan (mis. "wide shot", "medium shot, full room visible"). Tokoh tidak boleh jadi potret close-up di latar polos, kecuali adegannya memang close-up.
2. Lalu pencahayaan & suasana yang tegas (mis. "dark night, eerie bluish moonlight, deep shadows, horror mood").
3. Lalu tokoh dengan ciri UTAMA saja (maks 20 kata: jenis kelamin & usia, rambut, pakaian & warna). Ciri ini harus SAMA PERSIS kata per kata di semua prompt tempat tokoh itu muncul.
4. ${g.gambarEn ? `Tutup dengan gaya ini PERSIS kata per kata (jangan diubah): "${g.gambarEn}"` : `Tutup dengan gaya singkat: "${g.gambar}" (terjemahkan & ringkas jadi maks 12 kata)`}, "vertical 9:16", "no text, no letters, no watermark".
- Maksimal ${g.gambarEn ? 95 : 75} kata per prompt, satu paragraf, BAHASA INGGRIS.
- Tokoh manusia selalu dewasa; tanpa darah, luka, atau kekerasan.
Lembar karakter: ${JSON.stringify(p.karakter ?? [])}
Prompt:
${adegan.map((a) => `${a.no}. ${a.prompt}`).join("\n")}

Balas JSON: {"adegan": [{"no": number, "prompt": string}]}`);
  const peta: Record<number, string> = {};
  for (const x of hasil.adegan ?? []) if (x?.prompt && adegan.some((a) => a.no === Number(x.no))) peta[Number(x.no)] = x.prompt;
  for (const a of adegan) peta[a.no] ??= a.prompt;
  return peta;
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
  if (!aiAktif()) return { ...paketTemplat(n, r), komentar: komentarTemplat(n) };
  const hasil = await generateJson<PaketUnggah>(`${KONTEKS(p)}

Peranmu: Social Media Manager.
${p.seri ? `Video ini Part ${p.seri.part} dari ${p.seri.totalPart} sebuah cerita bersambung: cantumkan "Part ${p.seri.part}" di judul dan caption${p.seri.part >= p.seri.totalPart ? ", dan sebut bahwa ini part terakhir (tamat)" : `, dan sebut Part ${p.seri.part + 1} menyusul`}.` : ""}
Naskah: ${JSON.stringify(n)}
Riset: ${JSON.stringify(r)}

Siapkan materi unggah per platform dalam bahasa Indonesia:
- youtube.judul: maks 90 karakter, memancing klik tapi jujur, sertakan "#shorts".
- youtube.deskripsi: 3–6 kalimat + fakta singkat + baris "${p.sumberVisual === "flow" ? "Video ini dibuat dengan AI (Google Veo)." : "Visual dan suara video ini dibuat dengan AI."}" + 3-5 hashtag.
- youtube.tags: 8–15 tag tanpa tanda #.
- tiktok.caption: maks 150 karakter + 4-6 hashtag (termasuk #fyp).
- instagram.caption: 2–4 kalimat, ajakan komentar, lalu 8-15 hashtag.
- komentar: ${ATURAN_KOMENTAR}

Balas JSON: {"youtube": {"judul": string, "deskripsi": string, "tags": string[]}, "tiktok": {"caption": string}, "instagram": {"caption": string}, "komentar": string[]}`);
  return { ...hasil, komentar: rapikanKomentar(hasil.komentar) ?? komentarTemplat(n) };
}

const ATURAN_KOMENTAR = `3 pilihan komentar yang ditulis AKUN KANAL SENDIRI (PovQ) di videonya lalu disematkan (pin). Tiap komentar maks 150 karakter, gaya santai anak muda, 1 emoji cukup. Isinya pertanyaan yang gampang dijawab dan memancing penonton bercerita atau menebak (mis. "kalau kamu jadi ..., bakal ...?", "pernah ngalamin ...? cerita dong", tebakan untuk part berikutnya). Jangan berpura-pura jadi penonton, jangan memuji video sendiri, jangan minta like/follow, jangan spoiler akhir cerita.`;

/** Komentar tersemat saja (untuk video yang paketnya sudah ada). */
export async function komentarTersemat(p: Project): Promise<string[]> {
  const n = p.naskah!;
  if (!aiAktif()) return komentarTemplat(n);
  const h = await generateJson<{ komentar: string[] }>(`${KONTEKS(p)}

Peranmu: Social Media Manager.
${p.seri ? `Video ini Part ${p.seri.part} dari ${p.seri.totalPart} sebuah cerita bersambung.` : ""}
Naskah: ${JSON.stringify(n)}

Tulis komentar: ${ATURAN_KOMENTAR}

Balas JSON: {"komentar": string[]}`);
  return rapikanKomentar(h.komentar) ?? komentarTemplat(n);
}

export function rapikanKomentar(k: unknown): string[] | undefined {
  if (!Array.isArray(k)) return undefined;
  const bersih = k.map((x) => String(x ?? "").trim()).filter(Boolean).map((x) => x.slice(0, 150)).slice(0, 3);
  return bersih.length ? bersih : undefined;
}

export function komentarTemplat(n: Naskah): string[] {
  return [`Kalau kamu ada di posisi ini, bakal ngapain? 👀`, `Pernah ngalamin kejadian mirip? Cerita di sini dong 👇`, n.cta.slice(0, 150)];
}
