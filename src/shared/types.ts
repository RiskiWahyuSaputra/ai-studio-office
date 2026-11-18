import type { StageId } from "./team.ts";

export type Format = "pov-sejarah" | "vlog-hewan";
export type Platform = "youtube" | "tiktok" | "instagram";
export type StageStatus = "antre" | "jalan" | "menunggu-kamu" | "selesai" | "gagal";

export const FORMATS: Record<Format, { nama: string; ringkas: string }> = {
  "pov-sejarah": {
    nama: "POV Sejarah Nusantara",
    ringkas: "Penonton diajak 'hidup' di satu momen sejarah Indonesia lewat sudut pandang orang pertama.",
  },
  "vlog-hewan": {
    nama: "Vlog Hewan Lokal",
    ringkas: "Hewan khas Indonesia nge-vlog dengan gaya kocak tentang kehidupan sehari-harinya.",
  },
};

export const STAGES: { id: StageId; nama: string; pendek: string }[] = [
  { id: "riset", nama: "Riset", pendek: "Riset" },
  { id: "naskah", nama: "Naskah", pendek: "Naskah" },
  { id: "storyboard", nama: "Storyboard & Prompt", pendek: "Prompt" },
  { id: "render", nama: "Render di Flow", pendek: "Render" },
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

export interface Naskah {
  judulKerja: string;
  hook: string;
  narasi: string;
  cta: string;
}

export interface Adegan {
  no: number;
  durasi: number;
  visual: string;
  narasi: string;
  prompt: string;
  klip?: string;
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

export interface Project {
  id: string;
  format: Format;
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
