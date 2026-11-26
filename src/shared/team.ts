export type StageId =
  | "riset"
  | "naskah"
  | "storyboard"
  | "render"
  | "edit"
  | "paket"
  | "unggah"
  | "analisis";

export interface Look {
  skin: string;
  hair: string;
  hairStyle: "pendek" | "panjang" | "jilbab" | "botak" | "keriting" | "acak";
  shirt: string;
  pants: string;
  accessory?: "kacamata" | "headset" | "topi" | "goggles" | "pita";
  /** helai rambut berwarna (mis. hijau mint milik Kiyu) */
  streak?: string;
  /** warna kedua atasan (mis. hoodie dua warna) */
  shirt2?: string;
}

export interface Member {
  id: string;
  nama: string;
  role: string;
  tugas: string;
  stages: StageId[];
  look: Look;
}

export const TEAM: Member[] = [
  {
    id: "peneliti",
    nama: "Dimas",
    role: "Peneliti Tren",
    tugas: "Mencari topik yang sedang naik dan mengumpulkan fakta pendukung.",
    stages: ["riset"],
    look: { skin: "#c68b5e", hair: "#2b1d14", hairStyle: "pendek", shirt: "#4f8fd6", pants: "#2f3550", accessory: "kacamata" },
  },
  {
    id: "penulis",
    nama: "Sari",
    role: "Penulis Naskah",
    tugas: "Menulis hook, narasi, dan ajakan di akhir video.",
    stages: ["naskah"],
    look: { skin: "#e0a87c", hair: "#5a2f1c", hairStyle: "panjang", shirt: "#d65f8a", pants: "#3a2f4a" },
  },
  {
    id: "sutradara",
    nama: "Bayu",
    role: "Sutradara & Prompt",
    tugas: "Memecah naskah jadi adegan dan menulis prompt Veo untuk Google Flow.",
    stages: ["storyboard"],
    look: { skin: "#a8724c", hair: "#111111", hairStyle: "keriting", shirt: "#2f2f38", pants: "#23232b", accessory: "topi" },
  },
  {
    id: "akuntan",
    nama: "Hadi",
    role: "Akuntan Kredit",
    tugas: "Menghitung kredit Flow per video dan menjaga sisa kredit bulanan.",
    stages: ["render"],
    look: { skin: "#d39a6c", hair: "#8d8d8d", hairStyle: "botak", shirt: "#e8e2cf", pants: "#4a4032", accessory: "kacamata" },
  },
  {
    id: "editor",
    nama: "Nanda",
    role: "Editor Video",
    tugas: "Menggabungkan klip dari Flow, menambah subtitle, dan merender video final.",
    stages: ["edit"],
    look: { skin: "#e6b08a", hair: "#1c1c2b", hairStyle: "pendek", shirt: "#59b37c", pants: "#2b3a33", accessory: "headset" },
  },
  {
    id: "sosmed",
    nama: "Putri",
    role: "Social Media",
    tugas: "Menulis judul, caption, hashtag, lalu mengunggah ke YouTube, TikTok, dan Instagram.",
    stages: ["paket", "unggah"],
    look: { skin: "#c98e66", hair: "#7a4fb0", hairStyle: "jilbab", shirt: "#f0a33c", pants: "#3b3150" },
  },
  {
    id: "analis",
    nama: "Yoga",
    role: "Analis Data",
    tugas: "Membaca views dan engagement, lalu memberi masukan untuk topik berikutnya.",
    stages: ["analisis"],
    look: { skin: "#b9805a", hair: "#3b2a1a", hairStyle: "keriting", shirt: "#6a6fd1", pants: "#2c2c40" },
  },
  {
    id: "produser",
    nama: "Ratna",
    role: "Produser",
    tugas: "Membagi tugas, menjaga jadwal, dan meminta persetujuanmu di titik penting.",
    stages: [],
    look: { skin: "#d9a079", hair: "#2a1a12", hairStyle: "panjang", shirt: "#b8433f", pants: "#2a2230" },
  },
];

/** Pemilik kantor. Bukan bagian dari tim produksi (tidak memegang tahap). */
export const OWNER: Member = {
  id: "owner",
  nama: "Kiyu",
  role: "Owner",
  tugas: "Pemilik PovQ. Menentukan ide, menyetujui hasil kerja tim, dan memutuskan video mana yang tayang.",
  stages: [],
  look: { skin: "#e3b48c", hair: "#2a2236", hairStyle: "acak", shirt: "#26264a", shirt2: "#5b3f8f", pants: "#55585f", accessory: "goggles", streak: "#7ee8b4" },
};

/** Sekretaris pribadi owner (sekaligus pacar Kiyu). Juga tidak memegang tahap produksi. */
export const SEKRETARIS: Member = {
  id: "sekretaris",
  nama: "Laiza",
  role: "Sekretaris Pribadi Owner",
  tugas: "Mengatur agenda Kiyu, merangkum laporan tim, dan mengingatkan proyek yang menunggu keputusan. Pacar Kiyu 💕",
  stages: [],
  look: { skin: "#efc19f", hair: "#3a2218", hairStyle: "panjang", shirt: "#e7a6c8", pants: "#4a3a66", accessory: "pita" },
};

export const memberById = (id: string) =>
  id === OWNER.id ? OWNER : id === SEKRETARIS.id ? SEKRETARIS : TEAM.find((m) => m.id === id);
export const memberForStage = (stage: StageId) => TEAM.find((m) => m.stages.includes(stage)) ?? TEAM[TEAM.length - 1];
