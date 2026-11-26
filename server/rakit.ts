/**
 * Nanda merakit video final dengan Remotion: gambar/klip per adegan + narasi + subtitle karaoke.
 * Kalau Remotion gagal dan semua adegan berupa klip video, jatuh ke editor ffmpeg lama.
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { buatSrt, probe, projectDir, render as renderFfmpeg } from "./editor.ts";
import { renderCerita } from "./remotion.ts";
import { agyTersedia, videoAntigravity } from "./antigravity.ts";
import { buatLatar, efekNarasi } from "./suarafx.ts";
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

/** Pakai waktu kata dari Whisper, tapi teks tampil tetap dari naskah (Whisper menulis "2" untuk "dua"). */
function selaraskan(teks: string, ukur: KataWaktu[] | undefined, mulai: number, panjang: number): KataWaktu[] {
  const kata = teks.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!ukur?.length) return waktuKata(teks, mulai, panjang);
  if (ukur.length === kata.length) return kata.map((k, i) => ({ teks: k, mulai: mulai + ukur[i].mulai, akhir: mulai + ukur[i].akhir }));
  // jumlah kata beda: sebar sebanding huruf di rentang bicara yang sebenarnya
  const a = ukur[0].mulai;
  const b = ukur[ukur.length - 1].akhir;
  return waktuKata(teks, mulai + a, Math.max(0.3, b - a));
}

export interface OpsiRakit {
  /** efek narasi & suasana latar per format (bawaan aktif) */
  efekSuara?: boolean;
  /** waktu kata per adegan dari Whisper (relatif awal narasi) */
  kataUkur?: (KataWaktu[] | undefined)[];
  subtitle: boolean;
  /** file narasi per adegan (urut), atau undefined */
  narasi?: string[];
  volumeKlip: number;
  keluaran?: string;
  subtitleFile?: string;
  label?: string;
  judul?: string;
  /** "antigravity": kode video dirancang khusus oleh agen Antigravity (agy) */
  mesinVideo?: "template" | "antigravity";
  onProgress?: (persen: number) => void;
  onStatus?: (pesan: string) => void;
}

export async function rakit(
  p: Project,
  adegan: Adegan[],
  o: OpsiRakit,
): Promise<{ file: string; durasi: number; mesin: "remotion" | "ffmpeg" | "antigravity"; agy?: string }> {
  const dir = projectDir(p.id);
  if (!adegan.length) throw new Error("Belum ada adegan");
  // full Antigravity: adegan tanpa gambar/klip digambar sendiri oleh agy lewat kode
  const tanpaMedia = adegan.some((a) => !a.klip);
  if (tanpaMedia && o.mesinVideo !== "antigravity") throw new Error("Masih ada adegan tanpa gambar/klip");
  if (tanpaMedia && !agyTersedia()) throw new Error("Antigravity (agy) belum terpasang, padahal visual proyek ini dirancang Antigravity");
  const keluaran = o.keluaran ?? "final.mp4";
  const srt = o.subtitleFile ?? "subtitle.srt";
  const port = process.env.PORT ?? 8787;
  const url = (f: string) => `http://127.0.0.1:${port}/media/${p.id}/${encodeURIComponent(f)}`;

  // sound design: efek narasi per format (mis. horor) + geser waktu kata sesuai narasi yang diregangkan
  if (o.efekSuara !== false && o.narasi?.some(Boolean)) {
    const fx = await efekNarasi(dir, o.narasi, p.format);
    if (fx.regang !== 1 && o.kataUkur) {
      o.kataUkur = o.kataUkur.map((k) => k?.map((w) => ({ ...w, mulai: w.mulai * fx.regang, akhir: w.akhir * fx.regang })));
    }
    o.narasi = fx.files;
  }

  const info = await Promise.all(
    adegan.map(async (a, i) => {
      const gambar = !a.klip || GAMBAR.test(a.klip);
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

  const totalDetik = info.reduce((n, x) => n + x.detik, 0);
  const latar = o.efekSuara !== false ? await buatLatar(dir, p.format, totalDetik) : null;

  const props: PropsCerita = {
    latar: latar ? { src: url(latar.file), volume: latar.volume } : null,
    fps: FPS,
    judul: o.judul ?? "",
    // selalu kirim eksplisit: properti yang kosong akan diisi defaultProps contoh oleh Remotion
    label: o.label ?? "",
    suasana: SUASANA[p.format],
    subtitle: o.subtitle,
    adegan: adegan.map((a, i) => ({
      media: a.klip ? url(a.klip) : "",
      jenis: info[i].gambar ? "gambar" : "video",
      volumeMedia: o.narasi?.[i] ? o.volumeKlip : 1,
      narasi: o.narasi?.[i] ? url(o.narasi[i]) : undefined,
      mulaiNarasi: JEDA_AWAL,
      durasi: Math.ceil(info[i].detik * FPS),
      gerak: a.gerak ?? rapikanGerak(undefined, p.format, i),
      kata: info[i].nar ? selaraskan(a.narasi, o.kataUkur?.[i], JEDA_AWAL, info[i].nar) : [],
    })),
  };

  if (o.mesinVideo === "antigravity" && agyTersedia()) {
    try {
      const v = await videoAntigravity({
        p,
        dirProyek: dir,
        keluaran,
        fps: FPS,
        judul: props.judul,
        label: props.label ?? "",
        subtitle: o.subtitle,
        latar: latar ? { file: path.join(dir, latar.file), volume: latar.volume } : null,
        adegan: adegan.map((a, i) => ({
          no: a.no,
          media: a.klip ? path.join(dir, a.klip) : undefined,
          jenis: a.klip ? props.adegan[i].jenis : "kode",
          narasi: o.narasi?.[i] ? path.join(dir, o.narasi[i]) : undefined,
          mulaiNarasi: props.adegan[i].mulaiNarasi,
          durasiFrame: props.adegan[i].durasi,
          teks: a.narasi,
          visual: a.visual,
          arahan: a.promptMentah ?? a.prompt,
          kata: props.adegan[i].kata,
          gerak: props.adegan[i].gerak,
        })),
        onStatus: o.onStatus,
        onProgress: o.onProgress,
      });
      return { file: v.file, durasi: v.durasi, mesin: "antigravity", agy: path.relative(dir, v.folder) };
    } catch (e) {
      if (tanpaMedia) throw new Error(`Antigravity gagal merancang video: ${(e as Error).message}`);
      console.warn(`[rakit] Antigravity gagal (${(e as Error).message}), pakai template`);
      o.onStatus?.("Antigravity gagal, pakai template bawaan...");
    }
  }

  // video yang sudah pernah dirender dengan isi persis sama tidak dirender ulang
  // (mis. part 1 tetap aman kalau render part 2 terputus di tengah jalan)
  const sidik = path.join(dir, `${keluaran}.sidik`);
  const kunciRender = createHash("sha1").update(JSON.stringify(props)).digest("hex");
  const lamaSidik = await fs.readFile(sidik, "utf8").catch(() => "");
  if (lamaSidik === kunciRender && (await fs.stat(path.join(dir, keluaran)).catch(() => null))) {
    o.onProgress?.(100);
    return { file: keluaran, durasi: (await probe(path.join(dir, keluaran))).durasi, mesin: "remotion" };
  }
  await fs.rm(sidik, { force: true });

  try {
    await renderCerita(props, path.join(dir, keluaran), o.onProgress);
    await fs.writeFile(sidik, kunciRender);
    const hasil = await probe(path.join(dir, keluaran));
    return { file: keluaran, durasi: hasil.durasi, mesin: "remotion" };
  } catch (e) {
    if (info.some((x) => x.gambar)) throw new Error(`Remotion gagal merender: ${(e as Error).message}`);
    console.warn(`[rakit] Remotion gagal (${(e as Error).message}), pakai ffmpeg`);
    const v = await renderFfmpeg({ ...p, adegan }, { subtitle: o.subtitle, narasi: o.narasi, volumeKlip: o.volumeKlip, keluaran, subtitleFile: srt });
    return { ...v, mesin: "ffmpeg" };
  }
}
