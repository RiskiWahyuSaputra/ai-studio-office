import type { Gerak } from "./video.ts";
import type { StageId } from "./team.ts";

export type Format = "pov-sejarah" | "vlog-hewan" | "cerita-horor";
export type Gaya = "animasi-2d" | "animasi" | "pixel" | "sinematik";

export const GAYA: Record<Gaya, { nama: string; ringkas: string; prompt: string; kepala: string; tokoh?: string; gambar: string; gambarEn?: string; gambarAwal?: string }> = {
  "animasi-2d": {
    nama: "Animasi 2D",
    ringkas: "Kartun 2D imut: garis gelap yang bersih, mata besar, pipi merona, palet biru tua & ungu dengan aksen hijau mint yang berpendar.",
    kepala: "Video vertikal 9:16, animasi 2D",
    tokoh: "karakter kartun 2D imut",
    gambar:
      "ilustrasi kartun 2D imut, garis tepi gelap yang bersih dan tegas, cel-shading lembut, mata bulat besar yang ekspresif, pipi merona, proporsi agak chibi, palet biru tua dan ungu yang kalem dengan aksen hijau mint yang berpendar",
    // ditaruh di awal prompt: model gambar gratis paling memperhatikan kata-kata pertama
    gambarAwal: "Cute 2D cartoon illustration, clean bold dark outlines, soft cel shading, flat colors.",
    gambarEn:
      "cute 2D cartoon illustration, clean bold dark outlines, soft cel shading, big round expressive eyes, rosy cheeks, slightly chibi proportions, muted navy and purple palette with glowing mint-green accents",
    prompt:
      "animasi kartun 2D imut, garis tepi gelap yang bersih dan tegas, cel-shading lembut, mata bulat besar yang ekspresif, pipi merona, proporsi agak chibi, palet biru tua dan ungu dengan aksen hijau mint yang berpendar, gerakan animasi yang halus, tidak 3D dan tidak fotorealistis",
  },
  animasi: {
    nama: "Animasi 3D",
    ringkas: "Kartun 3D ekspresif seperti film animasi. Cocok untuk semua format, termasuk horor yang tetap enak ditonton.",
    kepala: "Video vertikal 9:16, animasi 3D",
    tokoh: "karakter animasi 3D bergaya kartun",
    gambar: "ilustrasi 3D bergaya film animasi modern, karakter berproporsi kartun dengan mata besar dan ekspresi hidup, tekstur halus, komposisi sinematik",
    prompt:
      "animasi 3D bergaya film animasi modern, karakter berproporsi kartun dengan mata besar dan ekspresi wajah yang hidup, tekstur halus, gerakan kamera yang mulus",
  },
  pixel: {
    nama: "Pixel Art",
    ringkas: "Animasi pixel 16-bit ala game retro. Unik, gampang dikenali, dan lebih jarang ditolak Flow.",
    kepala: "Video vertikal 9:16, animasi pixel art",
    tokoh: "karakter pixel art",
    gambar: "pixel art 16-bit bergaya game RPG konsol klasik tahun 1990-an, piksel persegi tajam, palet warna terbatas, bayangan dithering",
    prompt:
      "animasi pixel art 16-bit bergaya game RPG konsol klasik tahun 1990-an, piksel persegi yang tajam dan terlihat jelas, palet warna cerah yang terbatas, bayangan dithering, animasi karakter seperti sprite, latar parallax berlapis, suara latar bernuansa chiptune retro",
  },
  sinematik: {
    nama: "Sinematik",
    ringkas: "Realistis seperti film. Lebih dramatis, tapi lebih sering ditolak untuk tema sensitif.",
    kepala: "Video vertikal 9:16",
    prompt: "sinematik, fotorealistis, pencahayaan alami, suara latar yang realistis",
    gambar: "foto sinematik fotorealistis, pencahayaan dramatis, kedalaman bidang dangkal",
  },
};

export interface PanduanFormat {
  nama: string;
  ringkas: string;
  /** arahan tambahan untuk Peneliti */
  riset: string;
  /** sudut pandang & gaya bahasa narasi untuk Penulis */
  naskah: string;
  /** arahan visual untuk Sutradara */
  sutradara: string;
  /** tokoh utama berbicara langsung ke kamera (mis. vlog) */
  bicaraKeKamera: boolean;
  /** arahan gaya baca untuk Gemini TTS, format resmi "Say …:" supaya tidak ikut dibacakan */
  arahanTts: string;
  /** suara TTS bawaan */
  suara: string;
  /** kategori YouTube: 24 Entertainment, 27 Education */
  kategoriYt: string;
  /** saran lanjutan dari Analis */
  saranSeri: string;
}

export const FORMATS: Record<Format, PanduanFormat> = {
  "pov-sejarah": {
    nama: "POV Sejarah Nusantara",
    ringkas: "Penonton diajak 'hidup' di satu momen sejarah Indonesia lewat sudut pandang orang pertama.",
    riset: "Fakta harus akurat dan bisa dicek; jangan mengarang tanggal atau nama.",
    naskah: 'Narasi orang kedua ("kamu"), membuat penonton merasa ada di sana.',
    sutradara: "Pakai sudut pandang orang pertama (first-person POV) dan detail periode yang akurat. Pencahayaan hangat dan sinematik.",
    bicaraKeKamera: false,
    arahanTts: "Say in a calm, warm, slightly dramatic documentary narrator voice:",
    suara: "Charon",
    kategoriYt: "27",
    saranSeri: "Buat seri lanjutan dari era yang sama supaya penonton menunggu bagian berikutnya.",
  },
  "vlog-hewan": {
    nama: "Vlog Hewan Lokal",
    ringkas: "Hewan khas Indonesia nge-vlog dengan gaya kocak tentang kehidupan sehari-harinya.",
    riset: "Fakta tentang hewannya harus benar (habitat, makanan, kebiasaan).",
    naskah: "Narasi diucapkan oleh hewan itu sendiri (orang pertama), lucu, boleh pakai bahasa gaul ringan.",
    sutradara: "Hewan berbicara langsung ke kamera seperti vlogger; ekspresif dan kocak. Warna cerah dan pencahayaan siang yang ceria.",
    bicaraKeKamera: true,
    arahanTts: "Say in a cheerful, playful, energetic vlogger voice:",
    suara: "Puck",
    kategoriYt: "24",
    saranSeri: "Jadikan karakter hewan ini tokoh tetap supaya penonton kenal.",
  },
  "cerita-horor": {
    nama: "Cerita Horor Nusantara",
    ringkas: "Kisah seram dan legenda urban Indonesia, dituturkan pelan dan mencekam dengan akhir yang bikin merinding.",
    riset:
      "Pilih legenda urban, cerita rakyat seram, atau kisah fiksi horor yang terasa dekat (kos-kosan, rumah nenek, jalan sepi, pasar malam, angkot terakhir). Kalau berasal dari cerita rakyat, sebut daerah asalnya di fakta. Jangan mengaku kisah fiksi sebagai kejadian nyata, dan jangan menyebut nama orang atau alamat nyata.",
    naskah:
      'Dituturkan seperti pendongeng horor, pilih SATU sudut pandang (orang pertama "aku" ATAU orang kedua "kamu") dan pakai konsisten di semua kalimat, pelan dan mencekam, ketegangan naik baris demi baris, akhiri dengan twist atau cliffhanger. Seramnya dari suasana, suara, dan bayangan, bukan dari kekerasan.',
    sutradara:
      "Pencahayaan gelap kebiruan atau cahaya bulan, kontras tinggi; jangan pakai warna cerah atau suasana ceria. Bangun suasana horor lewat cahaya redup, kabut, bayangan panjang, lampu berkedip, sudut kamera rendah, dan sosok misterius yang hanya terlihat samar atau siluet dari kejauhan. Tidak ada darah, luka, mayat, atau wajah menyeramkan close-up.",
    bicaraKeKamera: false,
    arahanTts: "Say in a slow, quiet, eerie whisper like a horror storyteller:",
    suara: "Enceladus",
    kategoriYt: "24",
    saranSeri: "Jadikan seri bersambung (Part 1, Part 2) supaya penonton kembali untuk akhir ceritanya.",
  },
};

/** Sumber visual: gambar diam yang digerakkan Remotion, atau klip video dari Google Flow. */
export type SumberVisual = "ilustrasi" | "flow";

export type Platform = "youtube" | "tiktok" | "instagram";
export type StageStatus = "antre" | "jalan" | "menunggu-kamu" | "selesai" | "gagal";

export const STAGES: { id: StageId; nama: string; pendek: string }[] = [
  { id: "riset", nama: "Riset", pendek: "Riset" },
  { id: "naskah", nama: "Naskah", pendek: "Naskah" },
  { id: "storyboard", nama: "Storyboard & Prompt", pendek: "Prompt" },
  { id: "render", nama: "Buat visual", pendek: "Visual" },
  { id: "edit", nama: "Edit Video", pendek: "Edit" },
  { id: "paket", nama: "Judul & Caption", pendek: "Caption" },
  { id: "unggah", nama: "Unggah", pendek: "Unggah" },
  { id: "analisis", nama: "Analisis", pendek: "Analisis" },
];

export interface LogEntry {
  waktu: string;
  oleh: string;
  pesan: string;
}

export interface Riset {
  topik: string;
  sudut: string;
  alasan: string;
  fakta: string[];
  kataKunci: string[];
}

export interface BagianNaskah {
  hook: string;
  narasi: string;
  cta: string;
}

export interface Naskah {
  judulKerja: string;
  hook: string;
  narasi: string;
  cta: string;
  /** cerita utuh yang dibagi per part (diisi kalau rencanaPart > 1) */
  part?: BagianNaskah[];
}

export interface Adegan {
  no: number;
  durasi: number;
  visual: string;
  narasi: string;
  prompt: string;
  /** prompt dengan penanda {{Nama}}; dipakai untuk menempel ulang lembar karakter */
  promptMentah?: string;
  /** nomor part (cerita utuh yang dipecah jadi beberapa video) */
  part?: number;
  /** gerak kamera & efek untuk gambar diam (mode ilustrasi) */
  gerak?: Gerak;
  /** prompt gambar bahasa Inggris untuk mesin gambar otomatis */
  promptEn?: string;
  klip?: string;
}

export interface Karakter {
  nama: string;
  /** deskripsi fisik & pakaian yang sangat spesifik; ditempel apa adanya ke prompt */
  deskripsi: string;
}

export interface Kredit {
  mode: "fast" | "quality";
  perKlip: number;
  jumlahKlip: number;
  total: number;
  dicatat: boolean;
}

export interface Video {
  file: string;
  durasi: number;
  subtitle: string;
  dibuat: string;
}

export interface PaketUnggah {
  youtube: { judul: string; deskripsi: string; tags: string[] };
  tiktok: { caption: string };
  instagram: { caption: string };
}

export interface Unggahan {
  platform: Platform;
  status: "proses" | "berhasil" | "gagal";
  url?: string;
  idEksternal?: string;
  pesan?: string;
  waktu: string;
}

export interface Statistik {
  platform: Platform;
  views: number;
  likes: number;
  komentar: number;
  diambil: string;
}

export interface Analisis {
  ringkasan: string;
  saran: string[];
  dibuat: string;
}

export interface Seri {
  /** id proyek Part 1, dipakai sebagai id seri */
  id: string;
  part: number;
  totalPart: number;
  /** id proyek part-part sebelumnya, urut dari Part 1 */
  sebelumnya: string[];
}

export interface Project {
  id: string;
  format: Format;
  /** gaya visual klip Veo; proyek lama tanpa field ini dianggap sinematik */
  gaya?: Gaya;
  /** nama suara Gemini TTS untuk narasi; sama di semua adegan */
  suara?: string;
  /** model TTS yang dipakai render terakhir, supaya render ulang memakai warna suara yang sama */
  modelSuara?: string;
  /** bagian dari cerita bersambung */
  seri?: Seri;
  /** lembar karakter tetap; diwariskan ke part berikutnya */
  karakter?: Karakter[];
  /** suara narasi lokal (VoxCPM) dan suara acuan untuk kloning; diwariskan ke part berikutnya */
  suaraLokal?: string;
  acuanSuara?: { proyek: string; file: string; teks: string; suara: string };
  /** gambar diam (ilustrasi) atau klip Flow; proyek lama tanpa field ini = flow */
  sumberVisual?: SumberVisual;
  /** cerita utuh sampai tamat, nanti dipecah jadi sekian video saat edit */
  rencanaPart?: number;
  /** proyek produksi yang sudah dipecah: id proyek tiap part */
  dipecahMenjadi?: string[];
  ide: string;
  dibuat: string;
  diubah: string;
  tahap: StageId;
  status: StageStatus;
  galat?: string;
  riset?: Riset;
  naskah?: Naskah;
  adegan?: Adegan[];
  kredit?: Kredit;
  video?: Video;
  paket?: PaketUnggah;
  unggahan: Unggahan[];
  statistik: Statistik[];
  analisis?: Analisis;
  log: LogEntry[];
}

export interface Settings {
  kreditBulanan: number;
  kreditTerpakai: number;
  periode: string; // YYYY-MM
  biayaFast: number;
  biayaQuality: number;
  modeRender: "fast" | "quality";
  durasiKlip: number;
  otomatis: boolean;
  subtitle: boolean;
  /** narasi dibuat Gemini TTS (suara konsisten) dan prompt Veo diminta tanpa dialog */
  narasiTts: boolean;
  /** volume suara asli klip saat ditimpa narasi, 0..1 */
  volumeKlip: number;
  /** mesin narasi: VoxCPM lokal (tanpa kuota) atau Gemini TTS */
  mesinSuara: "voxcpm" | "gemini";
  /** gambar adegan dibuat otomatis (Pollinations/Flux) atau manual di aplikasi Gemini */
  mesinGambar: "otomatis" | "manual";
  /** efek narasi & suasana latar per format (mis. horor) */
  efekSuara: boolean;
}

export type Activity =
  | { type: "kerja"; memberId: string; status: string }
  | { type: "selesai-kerja"; memberId: string }
  | { type: "serah"; dari: string; ke: string; label: string }
  | { type: "bicara"; memberId: string; teks: string };

export type ServerEvent =
  | { type: "project"; project: Project }
  | { type: "hapus"; id: string }
  | { type: "settings"; settings: Settings }
  | { type: "aktivitas"; activity: Activity };
