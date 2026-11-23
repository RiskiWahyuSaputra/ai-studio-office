/**
 * Nanda merakit video final dengan Remotion: gambar/klip per adegan + narasi + subtitle karaoke.
 * Kalau Remotion gagal dan semua adegan berupa klip video, jatuh ke editor ffmpeg lama.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { buatSrt, probe, projectDir, render as renderFfmpeg } from "./editor.ts";
import { renderCerita } from "./remotion.ts";
import { rapikanGerak } from "./agents.ts";
import type { Adegan, Project } from "../src/shared/types.ts";
import type { KataWaktu, PropsCerita } from "../src/shared/video.ts";

const FPS = 30;
const JEDA_AWAL = 0.35;
const JEDA_AKHIR = 0.6;
const DURASI_MIN_GAMBAR = 3.5;
const GAMBAR = /\.(png|jpe?g|webp)$/i;

const SUASANA: Record<Project["format"], PropsCerita["suasana"]> = {
  "cerita-horor": "horor",
  "vlog-hewan": "ceria",
  "pov-sejarah": "hangat",
};

/** Bagi rentang narasi ke tiap kata, sebanding panjang hurufnya. */
function waktuKata(teks: string, mulai: number, panjang: number): KataWaktu[] {
  const kata = teks.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const total = kata.reduce((n, k) => n + k.length + 1, 0) || 1;
  let t = mulai;
  return kata.map((k) => {
    const d = (panjang * (k.length + 1)) / total;
    const w = { teks: k, mulai: t, akhir: t + d };
    t += d;
    return w;
  });
}

export interface OpsiRakit {
  subtitle: boolean;
  /** file narasi per adegan (urut), atau undefined */
  narasi?: string[];
  volumeKlip: number;
  keluaran?: string;
  subtitleFile?: string;
  label?: string;
  judul?: string;
  onProgress?: (persen: number) => void;
}

export async function rakit(p: Project, adegan: Adegan[], o: OpsiRakit): Promise<{ file: string; durasi: number; mesin: "remotion" | "ffmpeg" }> {
  const dir = projectDir(p.id);
  if (!adegan.length || adegan.some((a) => !a.klip)) throw new Error("Masih ada adegan tanpa gambar/klip");
  const keluaran = o.keluaran ?? "final.mp4";
  const srt = o.subtitleFile ?? "subtitle.srt";
  const port = process.env.PORT ?? 8787;
  const url = (f: string) => `http://127.0.0.1:${port}/media/${p.id}/${encodeURIComponent(f)}`;

  const info = await Promise.all(
    adegan.map(async (a, i) => {
      const gambar = GAMBAR.test(a.klip!);
      const media = gambar ? 0 : (await probe(path.join(dir, a.klip!))).durasi;
      const nar = o.narasi?.[i] ? (await probe(path.join(dir, o.narasi[i]))).durasi : 0;
      const detik = Math.max(gambar ? DURASI_MIN_GAMBAR : media, nar ? JEDA_AWAL + nar + JEDA_AKHIR : 0);
      return { gambar, nar, detik };
    }),
  );

  // subtitle .srt tetap dibuat (berguna untuk caption YouTube)
  await fs.writeFile(
    path.join(dir, srt),
    buatSrt(
      adegan,
      info.map((x) => ({ durasi: x.detik, mulaiNarasi: x.nar ? JEDA_AWAL : 0, panjangNarasi: x.nar })),
    ),
  );

  const props: PropsCerita = {
    fps: FPS,
    judul: o.judul ?? "",
    // selalu kirim eksplisit: properti yang kosong akan diisi defaultProps contoh oleh Remotion
    label: o.label ?? "",
    suasana: SUASANA[p.format],
    subtitle: o.subtitle,
    adegan: adegan.map((a, i) => ({
      media: url(a.klip!),
      jenis: info[i].gambar ? "gambar" : "video",
      volumeMedia: o.narasi?.[i] ? o.volumeKlip : 1,
      narasi: o.narasi?.[i] ? url(o.narasi[i]) : undefined,
      mulaiNarasi: JEDA_AWAL,
      durasi: Math.ceil(info[i].detik * FPS),
      gerak: a.gerak ?? rapikanGerak(undefined, p.format, i),
      kata: info[i].nar ? waktuKata(a.narasi, JEDA_AWAL, info[i].nar) : [],
    })),
  };

  try {
    await renderCerita(props, path.join(dir, keluaran), o.onProgress);
    const hasil = await probe(path.join(dir, keluaran));
    return { file: keluaran, durasi: hasil.durasi, mesin: "remotion" };
  } catch (e) {
    if (info.some((x) => x.gambar)) throw new Error(`Remotion gagal merender: ${(e as Error).message}`);
    console.warn(`[rakit] Remotion gagal (${(e as Error).message}), pakai ffmpeg`);
    const v = await renderFfmpeg({ ...p, adegan }, { subtitle: o.subtitle, narasi: o.narasi, volumeKlip: o.volumeKlip, keluaran, subtitleFile: srt });
    return { ...v, mesin: "ffmpeg" };
  }
}
