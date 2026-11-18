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

/** Bagi narasi tiap adegan jadi potongan pendek (maks 6 kata) supaya enak dibaca di HP. */
export function buatSrt(adegan: Adegan[], durasi: number[]): string {
  const baris: string[] = [];
  let mulai = 0;
  let n = 1;
  adegan.forEach((a, i) => {
    const d = durasi[i];
    const kata = a.narasi.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const potong: string[] = [];
    for (let k = 0; k < kata.length; k += 6) potong.push(kata.slice(k, k + 6).join(" "));
    // sisakan jeda kecil di awal & akhir klip
    const awal = mulai + Math.min(0.3, d * 0.05);
    const ruang = Math.max(0.5, d - Math.min(0.6, d * 0.1));
    potong.forEach((teks, j) => {
      const a0 = awal + (ruang * j) / potong.length;
      const a1 = awal + (ruang * (j + 1)) / potong.length;
      baris.push(`${n++}\n${ts(a0)} --> ${ts(a1)}\n${teks}\n`);
    });
    mulai += d;
  });
  return baris.join("\n");
}

export async function render(p: Project, subtitle: boolean): Promise<{ file: string; durasi: number }> {
  const dir = projectDir(p.id);
  const adegan = p.adegan ?? [];
  if (!adegan.length || adegan.some((a) => !a.klip)) throw new Error("Masih ada adegan tanpa klip");

  const info = await Promise.all(adegan.map((a) => probe(path.join(dir, a.klip!))));
  const durasi = info.map((x) => x.durasi);
  await fs.writeFile(path.join(dir, "subtitle.srt"), buatSrt(adegan, durasi));

  const args: string[] = ["-y", "-hide_banner"];
  adegan.forEach((a) => args.push("-i", a.klip!));
  const filters: string[] = [];
  const concatIn: string[] = [];
  let extra = adegan.length;
  info.forEach((x, i) => {
    filters.push(
      `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p[v${i}]`,
    );
    if (x.adaAudio) {
      filters.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo[a${i}]`);
    } else {
      // klip tanpa suara: isi hening sepanjang klip
      args.push("-f", "lavfi", "-t", x.durasi.toFixed(3), "-i", "anullsrc=r=48000:cl=stereo");
      filters.push(`[${extra}:a]anull[a${i}]`);
      extra++;
    }
    concatIn.push(`[v${i}][a${i}]`);
  });
  filters.push(`${concatIn.join("")}concat=n=${adegan.length}:v=1:a=1[vc][ac]`);
  filters.push(
    subtitle
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
