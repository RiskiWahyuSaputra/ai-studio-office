/** Data yang dikirim server ke komposisi Remotion "PovQCerita". */
export type Kamera = "zoom-masuk" | "zoom-keluar" | "geser-kiri" | "geser-kanan" | "geser-atas" | "geser-bawah" | "diam";
export type Efek = "kabut" | "kedip" | "hujan" | "debu" | "getar" | "gelap";
export const KAMERA: Kamera[] = ["zoom-masuk", "zoom-keluar", "geser-kiri", "geser-kanan", "geser-atas", "geser-bawah", "diam"];
export const EFEK: Efek[] = ["kabut", "kedip", "hujan", "debu", "getar", "gelap"];

export interface Gerak {
  kamera: Kamera;
  efek: Efek[];
}

export interface KataWaktu {
  teks: string;
  /** detik, relatif terhadap awal adegan */
  mulai: number;
  akhir: number;
}

export interface AdeganVideo {
  /** URL gambar atau video klip */
  media: string;
  jenis: "gambar" | "video";
  /** volume suara asli klip video (0..1) */
  volumeMedia?: number;
  /** URL narasi (opsional) */
  narasi?: string;
  /** detik narasi dimulai di dalam adegan */
  mulaiNarasi: number;
  /** panjang adegan dalam frame */
  durasi: number;
  gerak: Gerak;
  kata: KataWaktu[];
}

export interface PropsCerita {
  [key: string]: unknown;
  fps: number;
  judul: string;
  /** mis. "Part 1" atau "Part 2 · Tamat" */
  label?: string;
  suasana: "horor" | "ceria" | "hangat";
  subtitle: boolean;
  adegan: AdeganVideo[];
}

/** Panjang tumpang-tindih antar adegan (frame) untuk transisi silang. */
export const TRANSISI = 8;

export const totalFrame = (p: Pick<PropsCerita, "adegan">) => Math.max(1, p.adegan.reduce((n, a) => n + a.durasi, 0));
