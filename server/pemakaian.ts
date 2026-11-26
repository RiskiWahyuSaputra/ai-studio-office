/**
 * Catatan pemakaian layanan berbayar/berkuota: ElevenLabs (karakter) dan Antigravity (rancangan & token).
 * ElevenLabs: angka resmi diambil dari API kalau kuncinya punya izin "User → Read"; kalau tidak, pakai hitungan sendiri.
 * Antigravity: agy tidak punya perintah cek kuota, jadi dihitung sendiri dari keluaran JSON tiap rancangan,
 * plus pesan "kuota habis" terakhir kalau pernah muncul.
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./paths.ts";
import type { InfoKuota } from "../src/shared/types.ts";

const FILE = path.join(ROOT, "data", "pemakaian.json");

interface Catatan {
  eleven: { bulan: string; karakter: number; permintaan: number };
  agy: {
    hari: string;
    rancanganHari: number;
    tokenHari: number;
    bulan: string;
    rancanganBulan: number;
    tokenBulan: number;
    galatKuota?: { waktu: string; pesan: string };
  };
}

const hariIni = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
const bulanIni = () => hariIni().slice(0, 7);

function baca(): Catatan {
  let c: Partial<Catatan> = {};
  try {
    c = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    /* belum ada */
  }
  const eleven = c.eleven?.bulan === bulanIni() ? c.eleven : { bulan: bulanIni(), karakter: 0, permintaan: 0 };
  const a = c.agy;
  const agy = {
    hari: hariIni(),
    rancanganHari: a?.hari === hariIni() ? a.rancanganHari : 0,
    tokenHari: a?.hari === hariIni() ? a.tokenHari : 0,
    bulan: bulanIni(),
    rancanganBulan: a?.bulan === bulanIni() ? a.rancanganBulan : 0,
    tokenBulan: a?.bulan === bulanIni() ? a.tokenBulan : 0,
    galatKuota: a?.galatKuota,
  };
  return { eleven, agy };
}

function simpan(c: Catatan) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(c, null, 2));
  fs.renameSync(`${FILE}.tmp`, FILE);
}

export function catatEleven(karakter: number) {
  const c = baca();
  c.eleven.karakter += karakter;
  c.eleven.permintaan += 1;
  simpan(c);
}

export function catatAgy(token: number, rancanganBaru: boolean) {
  const c = baca();
  c.agy.tokenHari += token;
  c.agy.tokenBulan += token;
  if (rancanganBaru) {
    c.agy.rancanganHari += 1;
    c.agy.rancanganBulan += 1;
  }
  simpan(c);
}

export function catatGalatKuotaAgy(pesan: string) {
  const c = baca();
  c.agy.galatKuota = { waktu: new Date().toISOString(), pesan: pesan.slice(0, 300) };
  simpan(c);
}

export const pesanKuota = (s: string) => /quota|rate.?limit|resource.?exhausted|429|too many requests|usage limit|limit reached/i.test(s);

let cacheEleven: { waktu: number; data: InfoKuota["eleven"] } | null = null;

async function kuotaEleven(): Promise<InfoKuota["eleven"]> {
  const kunci = process.env.ELEVENLABS_API_KEY?.trim();
  const lokal = baca().eleven;
  const batasLokal = Number(process.env.ELEVENLABS_BATAS) || 10_000;
  if (!kunci) return { aktif: false, sumber: "lokal", terpakai: lokal.karakter, batas: batasLokal };
  if (cacheEleven && Date.now() - cacheEleven.waktu < 60_000) return cacheEleven.data;
  let data: InfoKuota["eleven"];
  try {
    const r = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": kunci }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(r.status === 401 ? "izin" : `HTTP ${r.status}`);
    const j = (await r.json()) as { tier?: string; character_count: number; character_limit: number; next_character_count_reset_unix?: number };
    data = {
      aktif: true,
      sumber: "api",
      terpakai: j.character_count,
      batas: j.character_limit,
      paket: j.tier,
      reset: j.next_character_count_reset_unix ? new Date(j.next_character_count_reset_unix * 1000).toISOString() : undefined,
    };
  } catch (e) {
    data = {
      aktif: true,
      sumber: "lokal",
      terpakai: lokal.karakter,
      batas: batasLokal,
      catatan:
        (e as Error).message === "izin"
          ? 'Angka dari hitungan Kantor PovQ bulan ini. Untuk angka resmi, aktifkan izin "User → Read" di kunci API ElevenLabs.'
          : "ElevenLabs tidak bisa dihubungi, pakai hitungan Kantor PovQ bulan ini.",
    };
  }
  cacheEleven = { waktu: Date.now(), data };
  return data;
}

export async function infoKuota(agyAktif: boolean): Promise<InfoKuota> {
  return { eleven: await kuotaEleven(), agy: { ...baca().agy, aktif: agyAktif } };
}

/** Setelah narasi baru dibuat, angka ElevenLabs perlu diambil ulang. */
export const segarkanKuotaEleven = () => void (cacheEleven = null);
