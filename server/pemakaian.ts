/**
 * Catatan pemakaian layanan berbayar/berkuota: ElevenLabs (karakter) dan Antigravity (rancangan & token).
 * ElevenLabs: angka resmi diambil dari API kalau kuncinya punya izin "User → Read"; kalau tidak, pakai hitungan sendiri.
 * Antigravity: agy tidak punya perintah cek kuota, jadi dihitung sendiri dari keluaran JSON tiap rancangan,
 * plus pesan "kuota habis" terakhir kalau pernah muncul.
 */
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./paths.ts";
import type { InfoKuota } from "../src/shared/types.ts";

const FILE = path.join(ROOT, "data", "pemakaian.json");

interface Catatan {
  /** bulan yang sudah diisi dari file lama di uploads/ (pemakaian sebelum fitur kuota ada) */
  diisi?: string;
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
  const hasil: Catatan = { diisi: c.diisi, eleven, agy };
  if (hasil.diisi !== bulanIni()) isiDariBerkas(hasil);
  return hasil;
}

/**
 * Pemakaian yang terjadi sebelum dicatat: narasi ElevenLabs (suara-el-*.mp3, tiap file = satu permintaan)
 * dan rancangan Antigravity (src/Video.tsx yang sudah dirancang) bulan ini.
 */
function isiDariBerkas(c: Catatan) {
  const awalBulan = new Date(`${bulanIni()}-01T00:00:00+07:00`).getTime();
  let karakter = 0;
  let permintaan = 0;
  let rancangan = 0;
  let rancanganHari = 0;
  const uploads = path.join(ROOT, "uploads");
  for (const proyek of fs.existsSync(uploads) ? fs.readdirSync(uploads) : []) {
    const dir = path.join(uploads, proyek);
    let isi: string[];
    try {
      isi = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const f of isi) {
      if (/^suara-el-.*\.mp3\.kata\.json$/.test(f)) {
        const p = path.join(dir, f);
        if (fs.statSync(p).mtimeMs < awalBulan) continue;
        try {
          const kata = JSON.parse(fs.readFileSync(p, "utf8")) as { teks: string }[];
          karakter += kata.map((k) => k.teks).join(" ").length;
          permintaan += 1;
        } catch {
          /* rusak, lewati */
        }
      } else if (f.startsWith("agy-")) {
        const v = path.join(dir, f, "src", "Video.tsx");
        try {
          const st = fs.statSync(v);
          if (st.mtimeMs < awalBulan || fs.readFileSync(v, "utf8").includes("POVQ-BELUM-DIRANCANG")) continue;
          rancangan += 1;
          if (new Date(st.mtimeMs).toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }) === hariIni()) rancanganHari += 1;
        } catch {
          /* belum ada rancangan */
        }
      }
    }
  }
  c.eleven.karakter = Math.max(c.eleven.karakter, karakter);
  c.eleven.permintaan = Math.max(c.eleven.permintaan, permintaan);
  c.agy.rancanganBulan = Math.max(c.agy.rancanganBulan, rancangan);
  c.agy.rancanganHari = Math.max(c.agy.rancanganHari, rancanganHari);
  c.diisi = bulanIni();
  simpan(c);
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

export const pesanKuota = (s: string) => /quota|rate.?limit|resource.?exhausted|429|too many requests|usage limit|limit reached|increase your limits|resets in|switch to gemini/i.test(s);

let cacheEleven: { waktu: number; data: InfoKuota["eleven"] } | null = null;

async function kuotaEleven(): Promise<InfoKuota["eleven"]> {
  const kunci = process.env.ELEVENLABS_API_KEY?.trim();
  const lokal = baca().eleven;
  const batasLokal = Number(process.env.ELEVENLABS_BATAS) || 10_000;
  if (!kunci) return { aktif: false, sumber: "lokal", terpakai: lokal.karakter, batas: batasLokal };
  // angka resmi disimpan 60 detik; kalau gagal, coba lagi setelah 15 detik
  if (cacheEleven && Date.now() - cacheEleven.waktu < (cacheEleven.data.sumber === "api" ? 60_000 : 15_000)) return cacheEleven.data;
  let data: InfoKuota["eleven"];
  try {
    const ambil = () => fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": kunci }, signal: AbortSignal.timeout(15_000) });
    // koneksi kadang lambat: coba sekali lagi kalau gagal tersambung
    const r = await ambil().catch(() => ambil());
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
          ? 'Perkiraan dari narasi yang dibuat Kantor PovQ bulan ini (contoh suara yang dibuat di luar aplikasi tidak ikut terhitung). Untuk angka resmi, aktifkan izin "User → Read" di kunci API ElevenLabs.'
          : "ElevenLabs tidak bisa dihubungi, pakai hitungan Kantor PovQ bulan ini.",
    };
  }
  cacheEleven = { waktu: Date.now(), data };
  return data;
}

let cacheAgy: { waktu: number; data: NonNullable<InfoKuota["agy"]["resmi"]> | undefined } | null = null;

/** Sisa kuota resmi Antigravity lewat `agy -p /quota` (perintah baca saja, tidak memakai kuota). */
async function kuotaAgy(): Promise<InfoKuota["agy"]["resmi"]> {
  if (cacheAgy && Date.now() - cacheAgy.waktu < 120_000) return cacheAgy.data;
  const bin = process.env.AGY_BIN || path.join(os.homedir(), ".local", "bin", "agy");
  const keluaran = await new Promise<string>((ok) =>
    execFile(bin, ["-p", "/quota"], { cwd: os.tmpdir(), timeout: 30_000 }, (_e, stdout) => ok(String(stdout ?? ""))),
  );
  const data = keluaran
    .split("\n")
    .map((b) => b.split("\t"))
    .filter((k) => k.length >= 4 && /%$/.test(k[2]))
    .map((k) => ({
      grup: k[0].trim(),
      jendela: (/five hour/i.test(k[1]) ? "5jam" : "mingguan") as "5jam" | "mingguan",
      sisa: Number(k[2].replace("%", "")),
      reset: k[3].trim(),
    }));
  cacheAgy = { waktu: Date.now(), data: data.length ? data : undefined };
  return cacheAgy.data;
}

/** Setelah agy dipakai, angka kuotanya perlu diambil ulang. */
export const segarkanKuotaAgy = () => void (cacheAgy = null);

export async function infoKuota(agyAktif: boolean): Promise<InfoKuota> {
  const [eleven, resmi] = await Promise.all([kuotaEleven(), agyAktif ? kuotaAgy() : Promise.resolve(undefined)]);
  return { eleven, agy: { ...baca().agy, aktif: agyAktif, resmi } };
}

/** Setelah narasi baru dibuat, angka ElevenLabs perlu diambil ulang. */
export const segarkanKuotaEleven = () => void (cacheEleven = null);
