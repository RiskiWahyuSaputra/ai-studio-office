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

const kunci = (teks: string, suara: string, arahan: string) =>
  createHash("sha1").update(`${suara}\n${arahan}\n${teks}`).digest("hex").slice(0, 12);

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
    return { sibuk: `${model}: ${(e as Error).name === "TimeoutError" ? "tidak menjawab" : (e as Error).message}` };
  }
  const j = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { inlineData?: { mimeType: string; data: string } }[] } }[];
    error?: { message?: string };
  };
  if (res.status === 429 || res.status >= 500 || res.status === 404) return { sibuk: `${model} sibuk (${res.status})` };
  if (!res.ok) throw new Error(`TTS gagal: ${j.error?.message ?? res.status}`);
  const data = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!data) return { sibuk: `${model} tidak mengembalikan audio` };
  return { mime: data.mimeType, bytes: Buffer.from(data.data, "base64") };
}

/** Buat (atau ambil dari cache) file WAV narasi. Mengembalikan nama file di folder proyek. */
export async function narasi(dir: string, teks: string, suara: string, format: Format): Promise<string> {
  const arahan = ARAHAN[format];
  const nama = `suara-${kunci(teks, suara, arahan)}.wav`;
  const file = path.join(dir, nama);
  try {
    await fs.access(file);
    return nama;
  } catch {
    // belum ada, buat baru
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY belum diisi, narasi suara butuh Gemini TTS");
  const alasan: string[] = [];
  for (const model of ttsModels()) {
    const r = await panggilTts(model, key, teks, suara, arahan);
    if ("sibuk" in r) {
      alasan.push(r.sibuk!);
      continue;
    }
    await fs.mkdir(dir, { recursive: true });
    if (/wav/i.test(r.mime)) {
      await ffmpeg(["-f", "wav", "-i", "pipe:0", "-ar", "48000", "-ac", "2", file], r.bytes);
    } else {
      const rate = r.mime.match(/rate=(\d+)/)?.[1] ?? "24000";
      await ffmpeg(["-f", "s16le", "-ar", rate, "-ac", "1", "-i", "pipe:0", "-ar", "48000", "-ac", "2", file], r.bytes);
    }
    return nama;
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
