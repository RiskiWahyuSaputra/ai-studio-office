/**
 * Narasi dengan ElevenLabs (akun yang sama dengan yang terhubung di Antigravity).
 * Kunci dibaca dari ELEVENLABS_API_KEY di .env. Endpoint "with-timestamps" memberi waktu tiap huruf,
 * yang diubah jadi waktu tiap kata untuk subtitle karaoke (tanpa Whisper).
 * Hasil disimpan per kalimat (suara-el-<hash>.mp3 + .kata.json), jadi render ulang tidak memakai kredit lagi.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Format } from "../src/shared/types.ts";
import { catatEleven, segarkanKuotaEleven } from "./pemakaian.ts";
import type { KataWaktu } from "../src/shared/video.ts";

const API = "https://api.elevenlabs.io/v1";
const MODEL = process.env.ELEVENLABS_MODEL?.trim() || "eleven_v3";

export const elevenTersedia = () => Boolean(process.env.ELEVENLABS_API_KEY?.trim());

/**
 * Pengaturan suara per format: horor lebih stabil & datar (dingin), format ceria lebih ekspresif.
 * v3: stabilitas 0 = "Creative" (paling ekspresif), 0.5 = "Natural"; tag emosi (mis. [excited]) ditaruh di depan
 * kalimat dan tidak ikut dibacakan.
 */
const GAYA_SUARA: Record<Format, { stability: number; similarity_boost: number; style: number; speed: number; v3: { stability: number; tag?: string } }> = {
  "ide-bermanfaat": { stability: 0.45, similarity_boost: 0.8, style: 0.45, speed: 1.05, v3: { stability: 0, tag: "[excited]" } },
  "cerita-horor": { stability: 0.6, similarity_boost: 0.8, style: 0.3, speed: 0.92, v3: { stability: 0.5 } },
  "pov-sejarah": { stability: 0.55, similarity_boost: 0.8, style: 0.25, speed: 1, v3: { stability: 0.5 } },
  "vlog-hewan": { stability: 0.4, similarity_boost: 0.75, style: 0.5, speed: 1.05, v3: { stability: 0, tag: "[excited]" } },
};

/**
 * multilingual_v2 menebak bahasanya sendiri; v2.5 (flash/turbo) & v3 bisa dipaksa membaca sebagai bahasa Indonesia.
 * v3 hanya menerima stability 0 / 0.5 / 1 dan mengatur emosi dari teks, jadi pengaturan lain tidak dikirim.
 */
function badan(teks: string, format: Format) {
  const { v3, ...g } = GAYA_SUARA[format];
  if (MODEL === "eleven_multilingual_v2") return { text: teks, model_id: MODEL, voice_settings: g };
  if (MODEL.startsWith("eleven_v3")) {
    return { text: v3.tag ? `${v3.tag} ${teks}` : teks, model_id: MODEL, language_code: "id", voice_settings: { stability: v3.stability, similarity_boost: g.similarity_boost } };
  }
  return { text: teks, model_id: MODEL, language_code: "id", voice_settings: g };
}

const kunci = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);

/** Huruf + waktunya → kata + waktunya. */
function keKata(al: { characters: string[]; character_start_times_seconds: number[]; character_end_times_seconds: number[] }): KataWaktu[] {
  const kata: KataWaktu[] = [];
  let teks = "";
  let mulai = 0;
  let akhir = 0;
  al.characters.forEach((c, i) => {
    if (/\s/.test(c)) {
      if (teks) kata.push({ teks, mulai, akhir });
      teks = "";
      return;
    }
    if (!teks) mulai = al.character_start_times_seconds[i];
    teks += c;
    akhir = al.character_end_times_seconds[i];
  });
  if (teks) kata.push({ teks, mulai, akhir });
  // tag emosi v3 (mis. "[excited]") tidak dibacakan, jadi bukan kata subtitle
  return kata.filter((k) => !/^\[[^\]]*\]$/.test(k.teks)).map((k) => ({ teks: k.teks, mulai: Math.round(k.mulai * 1000) / 1000, akhir: Math.round(k.akhir * 1000) / 1000 }));
}

async function satu(teks: string, voiceId: string, format: Format, out: string): Promise<KataWaktu[]> {
  for (let coba = 0; ; coba++) {
    let r: Response;
    try {
      r = await fetch(`${API}/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY!.trim(), "content-type": "application/json" },
        body: JSON.stringify(badan(teks, format)),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (e) {
      // koneksi/DNS putus sesaat: coba lagi dulu sebelum menyerah (dan jatuh ke Edge)
      if (coba < 3) {
        await new Promise((ok) => setTimeout(ok, 2000 + coba * 3000));
        continue;
      }
      throw e;
    }
    if (r.ok) {
      const j = (await r.json()) as { audio_base64: string; alignment?: Parameters<typeof keKata>[0] };
      const kata = j.alignment ? keKata(j.alignment) : [];
      fs.writeFileSync(`${out}.part`, Buffer.from(j.audio_base64, "base64"));
      fs.renameSync(`${out}.part`, out);
      fs.writeFileSync(`${out}.kata.json`, JSON.stringify(kata));
      // biaya pasti dari ElevenLabs (header character-cost); kalau tidak ada, pakai panjang teks
      catatEleven(Number(r.headers.get("character-cost")) || teks.length);
      segarkanKuotaEleven();
      return kata;
    }
    const isi = (await r.text()).slice(0, 300);
    // 429 = terlalu banyak permintaan bersamaan: tunggu sebentar; selain itu (kuota habis, kunci salah) langsung gagal
    if ((r.status === 429 || r.status >= 500) && coba < 3) {
      await new Promise((ok) => setTimeout(ok, 3000 + coba * 4000));
      continue;
    }
    throw new Error(`ElevenLabs ${r.status}: ${isi}`);
  }
}

/** Narasi semua kalimat dengan satu suara ElevenLabs. Kalimat yang sudah pernah dibuat diambil dari cache. */
export async function narasiEleven(
  dir: string,
  kalimat: string[],
  voiceId: string,
  format: Format,
  onProgres?: (pesan: string) => void,
): Promise<{ files: string[]; kata: KataWaktu[][] }> {
  if (!elevenTersedia()) throw new Error("ELEVENLABS_API_KEY belum diisi di .env");
  fs.mkdirSync(dir, { recursive: true });
  const g = GAYA_SUARA[format];
  // kunci cache sama seperti sebelum ada pengaturan v3 untuk format yang gayanya tidak berubah (horor, sejarah),
  // supaya render ulang proyek lama tidak memakai kredit lagi
  const { v3, ...lama } = g;
  const sidik = JSON.stringify(lama) + (v3.stability !== 0.5 || v3.tag ? JSON.stringify(v3) : "");
  const files = kalimat.map((t) => `suara-el-${kunci(`${voiceId}|${MODEL}|${sidik}|${t}`)}.mp3`);
  const kata: KataWaktu[][] = [];
  for (const [i, t] of kalimat.entries()) {
    const out = path.join(dir, files[i]);
    if (fs.existsSync(out) && fs.existsSync(`${out}.kata.json`)) {
      kata.push(JSON.parse(fs.readFileSync(`${out}.kata.json`, "utf8")));
      continue;
    }
    onProgres?.(`Narasi ElevenLabs ${i + 1}/${kalimat.length}...`);
    kata.push(await satu(t, voiceId, format, out));
  }
  return { files, kata };
}
