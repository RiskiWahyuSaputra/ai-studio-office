/**
 * Sound design per format: efek pada narasi (mis. horor: lebih lambat, gema ruangan; nada asli dipertahankan)
 * dan suasana latar yang dibuat dari derau (drone rendah + angin), tanpa file musik.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Format } from "../src/shared/types.ts";

interface FxNarasi {
  /** rantai filter ffmpeg untuk narasi */
  filter: string;
  /** narasi jadi lebih panjang sebesar faktor ini (untuk menggeser waktu kata subtitle) */
  regang: number;
}

// hanya tempo yang diperlambat; nada suara asli dipertahankan (tidak mengubah suara perempuan jadi laki-laki)
const TEMPO = 0.9;

const FX: Partial<Record<Format, FxNarasi>> = {
  "cerita-horor": {
    filter: [
      "aresample=48000",
      `atempo=${TEMPO}`,
      "highpass=f=70",
      "lowpass=f=6500",
      "acompressor=threshold=-22dB:ratio=3:attack=5:release=120:makeup=3",
      // gema ruangan kosong
      "aecho=0.85:0.6:55|110|190:0.28|0.17|0.08",
      "volume=1.25",
    ].join(","),
    regang: 1 / TEMPO,
  },
};

/** Suasana latar per format: [rantai lavfi, volume di video]. */
const LATAR: Partial<Record<Format, { sumber: string[]; volume: number }>> = {
  "cerita-horor": {
    sumber: [
      // drone rendah yang "bernafas"
      "anoisesrc=color=brown:amplitude=0.7:seed=7,lowpass=f=160,tremolo=f=0.12:d=0.7,volume=0.9",
      // nada rendah yang sedikit sumbang
      "sine=f=55:sample_rate=48000,volume=0.10",
      "sine=f=58.3:sample_rate=48000,volume=0.07",
      // angin di kejauhan
      "anoisesrc=color=pink:amplitude=0.35:seed=11,bandpass=f=700:width_type=q:w=0.7,tremolo=f=0.1:d=0.9,volume=0.35",
    ],
    volume: 0.32,
  },
};

const jalankan = (args: string[]) =>
  new Promise<void>((resolve, reject) => {
    const ps = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args]);
    let err = "";
    ps.stderr.on("data", (d) => (err += d));
    ps.on("error", reject);
    ps.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg efek suara gagal: ${err.slice(-200)}`))));
  });

export const punyaEfek = (f: Format) => Boolean(FX[f] || LATAR[f]);

/** Beri efek ke file narasi; hasil disimpan di samping file asli dan dipakai ulang. */
export async function efekNarasi(dir: string, files: string[], format: Format): Promise<{ files: string[]; regang: number }> {
  const fx = FX[format];
  if (!fx) return { files, regang: 1 };
  const hasil: string[] = [];
  for (const f of files) {
    const keluar = f.replace(/\.wav$/i, "") + `.fx-${format}.wav`;
    if (!fs.existsSync(path.join(dir, keluar))) {
      await jalankan(["-i", path.join(dir, f), "-af", fx.filter, "-ac", "2", path.join(dir, keluar)]);
    }
    hasil.push(keluar);
  }
  return { files: hasil, regang: fx.regang };
}

/** Buat suasana latar sepanjang `detik`. Mengembalikan nama file dan volume, atau null. */
export async function buatLatar(dir: string, format: Format, detik: number): Promise<{ file: string; volume: number } | null> {
  const l = LATAR[format];
  if (!l) return null;
  const d = Math.ceil(detik) + 1;
  const file = `latar-${format}-${d}.wav`;
  if (!fs.existsSync(path.join(dir, file))) {
    const args: string[] = [];
    l.sumber.forEach((s) => args.push("-f", "lavfi", "-t", String(d), "-i", s));
    const n = l.sumber.length;
    args.push(
      "-filter_complex",
      `${Array.from({ length: n }, (_, i) => `[${i}:a]aresample=48000,aformat=channel_layouts=stereo[s${i}]`).join(";")};` +
        `${Array.from({ length: n }, (_, i) => `[s${i}]`).join("")}amix=inputs=${n}:normalize=0,afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, d - 2)}:d=2[o]`,
      "-map", "[o]", path.join(dir, file),
    );
    await jalankan(args);
  }
  return { file, volume: l.volume };
}
