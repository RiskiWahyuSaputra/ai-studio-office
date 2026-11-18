/**
 * Nanda si editor: gabungkan klip Flow jadi satu video vertikal 1080x1920 dengan subtitle.
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { UPLOADS } from "./paths.ts";
import type { Adegan, Project } from "../src/shared/types.ts";

export const projectDir = (id: string) => path.join(UPLOADS, id);

function run(cmd: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ps = spawn(cmd, args, { cwd });
    let out = "";
    let err = "";
    ps.stdout.on("data", (d) => (out += d));
    ps.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
    ps.on("error", (e) => reject(new Error(`${cmd} tidak bisa dijalankan: ${e.message}. Pastikan ffmpeg terpasang.`)));
    ps.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} gagal (kode ${code}): ${err.split("\n").slice(-4).join(" ")}`))));
  });
}

interface Probe {
  durasi: number;
  adaAudio: boolean;
}

export async function probe(file: string): Promise<Probe> {
  const out = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", file]);
  const j = JSON.parse(out) as { format?: { duration?: string }; streams?: { codec_type: string }[] };
  return {
    durasi: Number(j.format?.duration ?? 0),
    adaAudio: (j.streams ?? []).some((s) => s.codec_type === "audio"),
  };
}

const ts = (t: number) => {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
};

export interface Waktu {
  /** panjang adegan di video final */
  durasi: number;
  /** detik mulai narasi di dalam adegan */
  mulaiNarasi: number;
  /** panjang narasi (setelah dipercepat); 0 = tanpa narasi, subtitle disebar sepanjang adegan */
  panjangNarasi: number;
}

/** Bagi narasi tiap adegan jadi potongan pendek (maks 6 kata) supaya enak dibaca di HP. */
export function buatSrt(adegan: Adegan[], waktu: Waktu[]): string {
  const baris: string[] = [];
  let mulai = 0;
  let n = 1;
  adegan.forEach((a, i) => {
    const w = waktu[i];
    const kata = a.narasi.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const potong: string[] = [];
    for (let k = 0; k < kata.length; k += 6) potong.push(kata.slice(k, k + 6).join(" "));
    const awal = mulai + (w.panjangNarasi ? w.mulaiNarasi : Math.min(0.3, w.durasi * 0.05));
    const ruang = w.panjangNarasi || Math.max(0.5, w.durasi - Math.min(0.6, w.durasi * 0.1));
    // bobot per jumlah huruf supaya potongan panjang tampil lebih lama
    const total = potong.reduce((x, t) => x + t.length, 0) || 1;
    let t0 = awal;
    potong.forEach((teks) => {
      const t1 = t0 + (ruang * teks.length) / total;
      baris.push(`${n++}\n${ts(t0)} --> ${ts(t1)}\n${teks}\n`);
      t0 = t1;
    });
    mulai += w.durasi;
  });
  return baris.join("\n");
}

export interface OpsiRender {
  subtitle: boolean;
  /** nama file WAV narasi per adegan (urut sesuai adegan), atau undefined bila tanpa narasi */
  narasi?: string[];
  /** volume suara asli klip saat ada narasi (0..1) */
  volumeKlip: number;
}

const JEDA_AWAL = 0.25;
const JEDA_AKHIR = 0.35;
const TEMPO_MAKS = 1.12;
/** klip boleh diperlambat sampai 2x (slow-motion) sebelum frame terakhir ditahan */
const LAMBAT_MAKS = 2;

export async function render(p: Project, o: OpsiRender): Promise<{ file: string; durasi: number }> {
  const dir = projectDir(p.id);
  const adegan = p.adegan ?? [];
  if (!adegan.length || adegan.some((a) => !a.klip)) throw new Error("Masih ada adegan tanpa klip");

  const info = await Promise.all(adegan.map((a) => probe(path.join(dir, a.klip!))));
  const infoNarasi = o.narasi ? await Promise.all(o.narasi.map((f) => probe(path.join(dir, f)))) : [];

  // hitung panjang tiap adegan: narasi dipercepat sedikit bila perlu, sisanya klip ditahan di frame terakhir
  const rencana = info.map((x, i) => {
    const nar = infoNarasi[i]?.durasi ?? 0;
    if (!nar) return { durasi: x.durasi, mulaiNarasi: 0, panjangNarasi: 0, tempo: 1, lambat: 1, tahan: 0 };
    // 1) percepat narasi sedikit, 2) perlambat klip (slow-motion), 3) baru tahan frame terakhir
    const muat = Math.max(0.5, x.durasi - JEDA_AWAL - JEDA_AKHIR);
    const tempo = Math.min(TEMPO_MAKS, Math.max(1, nar / muat));
    const panjang = nar / tempo;
    const butuh = JEDA_AWAL + panjang + JEDA_AKHIR;
    const lambat = Math.min(LAMBAT_MAKS, Math.max(1, butuh / x.durasi));
    const durVideo = x.durasi * lambat;
    const durasi = Math.max(durVideo, butuh);
    return { durasi, mulaiNarasi: JEDA_AWAL, panjangNarasi: panjang, tempo, lambat, tahan: durasi - durVideo };
  });
  await fs.writeFile(path.join(dir, "subtitle.srt"), buatSrt(adegan, rencana));

  const args: string[] = ["-y", "-hide_banner"];
  adegan.forEach((a) => args.push("-i", a.klip!));
  let next = adegan.length;
  const filters: string[] = [];
  const concatIn: string[] = [];
  info.forEach((x, i) => {
    const r = rencana[i];
    const D = r.durasi.toFixed(3);
    filters.push(
      `[${i}:v]${r.lambat > 1.001 ? `setpts=${r.lambat.toFixed(4)}*PTS,` : ""}scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p` +
        `${r.tahan > 0.01 ? `,tpad=stop_mode=clone:stop_duration=${r.tahan.toFixed(3)}` : ""},trim=0:${D},setpts=PTS-STARTPTS[v${i}]`,
    );
    // suara asli klip (atau hening), dikecilkan bila ada narasi
    let amb: string;
    if (x.adaAudio) {
      amb = `[${i}:a]`;
    } else {
      args.push("-f", "lavfi", "-t", D, "-i", "anullsrc=r=48000:cl=stereo");
      amb = `[${next++}:a]`;
    }
    const vol = o.narasi ? o.volumeKlip : 1;
    filters.push(`${amb}aresample=48000,aformat=channel_layouts=stereo,volume=${vol},apad,atrim=0:${D},asetpts=PTS-STARTPTS[amb${i}]`);
    if (o.narasi) {
      args.push("-i", o.narasi[i]);
      const ms = Math.round(r.mulaiNarasi * 1000);
      filters.push(
        `[${next++}:a]aresample=48000,aformat=channel_layouts=stereo${r.tempo > 1.001 ? `,atempo=${r.tempo.toFixed(3)}` : ""},adelay=${ms}|${ms},apad,atrim=0:${D},asetpts=PTS-STARTPTS[nar${i}]`,
      );
      filters.push(`[amb${i}][nar${i}]amix=inputs=2:duration=first:normalize=0[a${i}]`);
    } else {
      filters.push(`[amb${i}]anull[a${i}]`);
    }
    concatIn.push(`[v${i}][a${i}]`);
  });
  filters.push(`${concatIn.join("")}concat=n=${adegan.length}:v=1:a=1[vc][ac]`);
  filters.push(
    o.subtitle
      ? `[vc]subtitles=subtitle.srt:force_style='FontName=Montserrat,FontSize=13,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=70'[vo]`
      : `[vc]null[vo]`,
  );
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[vo]", "-map", "[ac]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "aac", "-b:a", "160k",
    "-movflags", "+faststart",
    "final.mp4",
  );
  await run("ffmpeg", args, dir);
  const hasil = await probe(path.join(dir, "final.mp4"));
  return { file: "final.mp4", durasi: hasil.durasi };
}
