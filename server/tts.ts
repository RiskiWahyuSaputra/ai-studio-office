/**
 * Narasi dengan Gemini TTS: satu suara tetap per proyek supaya konsisten di semua adegan.
 * Hasil disimpan sebagai WAV di folder proyek dan dipakai ulang selama teks & suaranya sama.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { GeminiSibuk } from "./ai.ts";
import type { Format } from "../src/shared/types.ts";

const DEFAULT_TTS = "gemini-2.5-flash-preview-tts,gemini-3.1-flash-tts-preview,gemini-3.8-flash-tts";
const ttsModels = () =>
  (process.env.GEMINI_TTS_MODEL || DEFAULT_TTS)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

export const ARAHAN: Record<Format, string> = {
  "pov-sejarah": "Bacakan dalam bahasa Indonesia dengan suara narator yang tenang, hangat, dan sedikit dramatis, tempo sedang:",
  "vlog-hewan": "Ucapkan dalam bahasa Indonesia dengan gaya vlogger yang lucu, ceria, dan ekspresif, tempo agak cepat:",
};

export const suaraBawaan = (f: Format) => (f === "vlog-hewan" ? "Puck" : "Charon");

const kunci = (teks: string, suara: string, arahan: string, model: string) =>
  createHash("sha1").update(`${model}\n${suara}\n${arahan}\n${teks}`).digest("hex").slice(0, 12);

function ffmpeg(args: string[], input?: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const ps = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args]);
    let err = "";
    ps.stderr.on("data", (d) => (err += d));
    ps.on("error", reject);
    ps.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg TTS gagal: ${err.slice(-300)}`))));
    if (input) ps.stdin.end(input);
    else ps.stdin.end();
  });
}

class TtsSibuk extends Error {
  readonly kuotaHabis: boolean;
  constructor(msg: string, kuotaHabis = false) {
    super(msg);
    this.kuotaHabis = kuotaHabis;
  }
}

async function panggilTts(model: string, key: string, teks: string, suara: string, arahan: string) {
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${arahan}\n${teks}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: suara } } },
        },
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (e) {
    throw new TtsSibuk(`${model}: ${(e as Error).name === "TimeoutError" ? "tidak menjawab" : (e as Error).message}`);
  }
  const j = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[];
    error?: { message?: string };
  };
  if (res.status === 429) throw new TtsSibuk(`${model} kuota habis (429)`, true);
  if (res.status >= 500 || res.status === 404) throw new TtsSibuk(`${model} sibuk (${res.status})`);
  if (!res.ok) throw new Error(`TTS gagal: ${j.error?.message ?? res.status}`);
  const data = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!data) throw new TtsSibuk(`${model} tidak mengembalikan audio`);
  return { mime: data.mimeType, bytes: Buffer.from(data.data, "base64") };
}

/** Satu kalimat dengan satu model tertentu; dicoba ulang beberapa kali kalau model sibuk. */
async function satuKalimat(dir: string, teks: string, suara: string, format: Format, model: string): Promise<string> {
  const arahan = ARAHAN[format];
  const nama = `suara-${kunci(teks, suara, arahan, model)}.wav`;
  const file = path.join(dir, nama);
  try {
    await fs.access(file);
    return nama;
  } catch {
    // belum ada, buat baru
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY belum diisi, narasi suara butuh Gemini TTS");
  let terakhir: unknown;
  for (const jeda of [0, 4000, 10000]) {
    if (jeda) await new Promise((r) => setTimeout(r, jeda));
    try {
      const r = await panggilTts(model, key, teks, suara, arahan);
      await fs.mkdir(dir, { recursive: true });
      if (/wav/i.test(r.mime)) {
        await ffmpeg(["-f", "wav", "-i", "pipe:0", "-ar", "48000", "-ac", "2", file], r.bytes);
      } else {
        const rate = r.mime.match(/rate=(\d+)/)?.[1] ?? "24000";
        await ffmpeg(["-f", "s16le", "-ar", rate, "-ac", "1", "-i", "pipe:0", "-ar", "48000", "-ac", "2", file], r.bytes);
      }
      return nama;
    } catch (e) {
      if (!(e instanceof TtsSibuk)) throw e;
      terakhir = e;
      if (e.kuotaHabis) break;
    }
  }
  throw terakhir;
}

async function simpanAudio(file: string, mime: string, bytes: Buffer) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  if (/wav/i.test(mime)) {
    await ffmpeg(["-f", "wav", "-i", "pipe:0", "-ar", "48000", "-ac", "2", file], bytes);
  } else {
    const rate = mime.match(/rate=(\d+)/)?.[1] ?? "24000";
    await ffmpeg(["-f", "s16le", "-ar", rate, "-ac", "1", "-i", "pipe:0", "-ar", "48000", "-ac", "2", file], bytes);
  }
}

function deteksiJeda(file: string, noise: string, minDur: number): Promise<{ mulai: number; akhir: number }[]> {
  return new Promise((resolve, reject) => {
    const ps = spawn("ffmpeg", ["-hide_banner", "-i", file, "-af", `silencedetect=noise=${noise}:d=${minDur}`, "-f", "null", "-"]);
    let err = "";
    ps.stderr.on("data", (d) => (err += d));
    ps.on("error", reject);
    ps.on("close", () => {
      const hasil: { mulai: number; akhir: number }[] = [];
      let mulai: number | null = null;
      for (const baris of err.split("\n")) {
        const a = baris.match(/silence_start: ([\d.]+)/);
        const b = baris.match(/silence_end: ([\d.]+)/);
        if (a) mulai = Number(a[1]);
        if (b && mulai !== null) {
          hasil.push({ mulai, akhir: Number(b[1]) });
          mulai = null;
        }
      }
      resolve(hasil);
    });
  });
}

async function durasiAudio(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ps = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
    let out = "";
    ps.stdout.on("data", (d) => (out += d));
    ps.on("error", reject);
    ps.on("close", () => resolve(Number(out.trim()) || 0));
  });
}

/**
 * Semua kalimat dibacakan dalam SATU permintaan TTS (suara identik, hemat kuota),
 * lalu dipotong di jeda terpanjang. Mengembalikan null kalau potongannya meragukan.
 */
async function gabungan(dir: string, teks: string[], suara: string, format: Format, model: string): Promise<string[] | null> {
  const arahan = `${ARAHAN[format]} Berhenti sekitar satu setengah detik di antara setiap baris.`;
  const id = kunci(teks.join("\n\n"), suara, arahan, model);
  const keluaran = teks.map((_, i) => `suara-${id}-${i + 1}.wav`);
  try {
    await Promise.all(keluaran.map((f) => fs.access(path.join(dir, f))));
    return keluaran;
  } catch {
    // belum ada
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY belum diisi, narasi suara butuh Gemini TTS");
  if (teks.length === 1) return null;

  const utuh = path.join(dir, `suara-${id}-utuh.wav`);
  try {
    await fs.access(utuh);
  } catch {
    const r = await panggilTts(model, key, teks.join("\n\n"), suara, arahan);
    await simpanAudio(utuh, r.mime, r.bytes);
  }
  const potong = await titikPotong(utuh, teks);
  if (!potong) {
    console.warn(`[tts] jeda di rekaman gabungan tidak cocok dengan ${teks.length} kalimat, pakai per kalimat`);
    return null;
  }
  await Promise.all(
    potong.map(([a, b], i) =>
      ffmpeg(["-i", utuh, "-ss", a.toFixed(3), "-to", b.toFixed(3), "-ar", "48000", "-ac", "2", path.join(dir, keluaran[i])]),
    ),
  );
  return keluaran;
}

/** Cari titik potong per kalimat di rekaman gabungan; null kalau hasilnya meragukan. */
export async function titikPotong(utuh: string, teks: string[]): Promise<[number, number][] | null> {
  const total = await durasiAudio(utuh);
  const butuh = teks.length - 1;

  for (const [noise, minDur] of [["-38dB", 0.45], ["-35dB", 0.3], ["-32dB", 0.25]] as const) {
    // abaikan jeda di paling awal/akhir rekaman
    const jeda = (await deteksiJeda(utuh, noise, minDur)).filter((j) => j.mulai > 0.2 && j.akhir < total - 0.2);
    if (jeda.length < butuh) continue;
    const urutPanjang = [...jeda].sort((a, b) => b.akhir - b.mulai - (a.akhir - a.mulai));
    const pilih = urutPanjang.slice(0, butuh).sort((a, b) => a.mulai - b.mulai);
    // jeda pemisah harus jelas lebih panjang dari jeda lain (jeda di tengah kalimat)
    const terpendekDipilih = Math.min(...pilih.map((j) => j.akhir - j.mulai));
    const sisa = urutPanjang[butuh];
    if (sisa && terpendekDipilih < (sisa.akhir - sisa.mulai) * 1.5) continue;
    const potong: [number, number][] = [];
    let awal = 0;
    for (const j of pilih) {
      potong.push([awal, j.mulai + 0.08]);
      awal = Math.max(j.mulai, j.akhir - 0.08);
    }
    potong.push([awal, total]);
    // cek kewajaran: kecepatan bicara tiap potongan harus mirip
    const laju = potong.map(([a, b], i) => teks[i].split(/\s+/).length / Math.max(0.1, b - a));
    const median = [...laju].sort((a, b) => a - b)[Math.floor(laju.length / 2)];
    if (potong.some(([a, b]) => b - a < 0.4) || laju.some((l) => l < median / 1.6 || l > median * 1.6)) continue;
    return potong;
  }
  return null;
}

/**
 * Narasi semua adegan dengan SATU model TTS, supaya warna suaranya sama di setiap adegan.
 * Model pilihan (mis. yang dipakai render sebelumnya) dicoba duluan. Kalau model sibuk
 * di tengah jalan, semua adegan dibuat ulang dengan model berikutnya — tidak dicampur.
 */
export async function narasiSemua(
  dir: string,
  teks: string[],
  suara: string,
  format: Format,
  modelPilihan?: string,
): Promise<{ files: string[]; model: string }> {
  const semua = ttsModels();
  const urut = modelPilihan && semua.includes(modelPilihan) ? [modelPilihan, ...semua.filter((m) => m !== modelPilihan)] : semua;
  const alasan: string[] = [];
  for (const model of urut) {
    try {
      const sekaligus = await gabungan(dir, teks, suara, format, model);
      if (sekaligus) return { files: sekaligus, model };
      const files: string[] = [];
      for (const t of teks) files.push(await satuKalimat(dir, t, suara, format, model));
      return { files, model };
    } catch (e) {
      if (!(e instanceof TtsSibuk)) throw e;
      alasan.push(e.message);
      console.warn(`[tts] ${e.message}, ulang semua adegan dengan model lain`);
    }
  }
  throw new GeminiSibuk(`Gemini TTS sedang sibuk (${alasan.join("; ")})`);
}

/** Contoh satu kalimat (untuk tombol "Dengar contoh"). */
export async function narasi(dir: string, teks: string, suara: string, format: Format, modelPilihan?: string) {
  const semua = ttsModels();
  const urut = modelPilihan && semua.includes(modelPilihan) ? [modelPilihan, ...semua.filter((m) => m !== modelPilihan)] : semua;
  const alasan: string[] = [];
  for (const model of urut) {
    try {
      return await satuKalimat(dir, teks, suara, format, model);
    } catch (e) {
      if (!(e instanceof TtsSibuk)) throw e;
      alasan.push(e.message);
    }
  }
  throw new GeminiSibuk(`Gemini TTS sedang sibuk (${alasan.join("; ")})`);
}

/** Daftar suara bawaan Gemini yang cocok untuk konten ini. */
export const SUARA = [
  { id: "Charon", ket: "Pria, informatif (narator dokumenter)" },
  { id: "Puck", ket: "Pria, ceria (vlogger)" },
  { id: "Fenrir", ket: "Pria, bersemangat" },
  { id: "Orus", ket: "Pria, tegas" },
  { id: "Algenib", ket: "Pria, serak berat" },
  { id: "Sadaltager", ket: "Pria, berwawasan" },
  { id: "Kore", ket: "Wanita, tegas" },
  { id: "Aoede", ket: "Wanita, santai" },
  { id: "Leda", ket: "Wanita, muda" },
  { id: "Sulafat", ket: "Wanita, hangat" },
  { id: "Laomedeia", ket: "Wanita, ceria" },
  { id: "Gacrux", ket: "Wanita, dewasa" },
];
