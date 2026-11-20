/**
 * Memasangkan banyak klip (dari ZIP "download proyek" Flow atau banyak file) ke adegan.
 * Urutan bukti: angka di nama file → kemiripan nama file dengan prompt → urutan waktu dibuat.
 */
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { Adegan } from "../src/shared/types.ts";

export interface Kandidat {
  nama: string;
  path: string;
  waktu: number;
}

export interface Pasangan {
  no: number;
  kandidat: Kandidat;
  alasan: "nomor" | "nama mirip prompt" | "urutan";
}

const EKSTENSI_VIDEO = /\.(mp4|mov|webm|mkv|m4v)$/i;

/** Bongkar ZIP dan kembalikan semua video di dalamnya (termasuk di subfolder). */
export async function bongkarZip(zip: string, tujuan: string): Promise<Kandidat[]> {
  await fs.mkdir(tujuan, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    // -j: tanpa struktur folder, -o: timpa, -D tidak dipakai supaya waktu file asli dipertahankan
    const ps = spawn("unzip", ["-j", "-o", zip, "-d", tujuan]);
    let err = "";
    ps.stderr.on("data", (d) => (err += d));
    ps.on("error", (e) => reject(new Error(`unzip tidak bisa dijalankan: ${e.message}`)));
    ps.on("close", (c) => (c === 0 || c === 1 ? resolve() : reject(new Error(`ZIP tidak bisa dibuka: ${err.slice(-200)}`))));
  });
  const hasil: Kandidat[] = [];
  for (const nama of await fs.readdir(tujuan)) {
    if (!EKSTENSI_VIDEO.test(nama) || nama.startsWith(".")) continue;
    const p = path.join(tujuan, nama);
    const st = await fs.stat(p);
    if (st.isFile() && st.size > 0) hasil.push({ nama, path: p, waktu: st.mtimeMs });
  }
  return hasil;
}

const KATA_UMUM = new Set(
  "video vertikal animasi gaya dengan yang dan atau dari untuk pada ini itu tanpa teks subtitle watermark dialog ucapan suara narator efek latar hanya kamera mp4 mov flow veo clip klip scene adegan".split(" "),
);

function kata(teks: string): string[] {
  return teks
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((k) => k.length >= 4 && !KATA_UMUM.has(k) && !/^\d+$/.test(k));
}

export function pasangkan(kandidat: Kandidat[], adegan: Adegan[]): { pasangan: Pasangan[]; sisa: Kandidat[] } {
  const nos = adegan.map((a) => a.no);
  const pasangan: Pasangan[] = [];
  const terpakaiNo = new Set<number>();
  let belum = [...kandidat].sort((a, b) => a.nama.localeCompare(b.nama, undefined, { numeric: true }));

  // 1) angka di nama file (angka terakhir yang cocok dengan nomor adegan)
  belum = belum.filter((k) => {
    // hanya angka 1–2 digit yang berdiri sendiri (mis. "3.mp4", "adegan-3", "Flow 20261120 6"),
    // bukan digit di dalam ID acak seperti "a8f3c1"
    const angka = [...k.nama.replace(EKSTENSI_VIDEO, "").matchAll(/(?:^|[^a-z0-9])(\d{1,2})(?=[^a-z0-9]|$)/gi)]
      .map((m) => Number(m[1]))
      .reverse();
    const no = angka.find((n) => nos.includes(n) && !terpakaiNo.has(n));
    if (no !== undefined) {
      pasangan.push({ no, kandidat: k, alasan: "nomor" });
      terpakaiNo.add(no);
      return false;
    }
    return true;
  });

  // 2) kemiripan nama file dengan prompt (Flow kadang menamai file dari awal prompt)
  if (belum.length) {
    // kata yang muncul di lebih dari separuh adegan dianggap boilerplate gaya, bukan pembeda
    const frek = new Map<string, number>();
    const kataAdegan = new Map<number, Set<string>>();
    for (const a of adegan) {
      const s = new Set(kata(`${a.visual} ${a.promptMentah ?? a.prompt}`));
      kataAdegan.set(a.no, s);
      for (const k of s) frek.set(k, (frek.get(k) ?? 0) + 1);
    }
    const batas = Math.max(1, adegan.length / 2);
    const skor: { k: Kandidat; no: number; s: number }[] = [];
    for (const k of belum) {
      const kk = [...new Set(kata(k.nama))].filter((w) => (frek.get(w) ?? 0) <= batas);
      if (!kk.length) continue;
      const perAdegan = adegan
        .filter((a) => !terpakaiNo.has(a.no))
        .map((a) => {
          const cocok = kk.filter((w) => kataAdegan.get(a.no)!.has(w));
          // kata langka (muncul di sedikit adegan) lebih menentukan
          return { no: a.no, n: cocok.length, s: cocok.reduce((t, w) => t + 1 / (frek.get(w) ?? 1), 0) };
        })
        .sort((x, y) => y.s - x.s);
      const [terbaik, kedua] = perAdegan;
      // butuh minimal 2 kata cocok dan harus jelas lebih unggul dari kandidat kedua
      if (terbaik && terbaik.n >= 2 && (!kedua || terbaik.s > kedua.s * 1.25)) skor.push({ k, no: terbaik.no, s: terbaik.s });
    }
    skor.sort((a, b) => b.s - a.s);
    const dipakai = new Set<Kandidat>();
    for (const { k, no } of skor) {
      if (dipakai.has(k) || terpakaiNo.has(no)) continue;
      pasangan.push({ no, kandidat: k, alasan: "nama mirip prompt" });
      dipakai.add(k);
      terpakaiNo.add(no);
    }
    belum = belum.filter((k) => !dipakai.has(k));
  }

  // 3) sisanya: urutan waktu dibuat (Flow merender berurutan sesuai prompt) ke adegan yang belum terisi
  belum.sort((a, b) => a.waktu - b.waktu || a.nama.localeCompare(b.nama, undefined, { numeric: true }));
  const kosongDulu = [
    ...adegan.filter((a) => !a.klip && !terpakaiNo.has(a.no)),
    ...adegan.filter((a) => a.klip && !terpakaiNo.has(a.no)),
  ].map((a) => a.no);
  const sisa: Kandidat[] = [];
  for (const k of belum) {
    const no = kosongDulu.shift();
    if (no === undefined) {
      sisa.push(k);
      continue;
    }
    pasangan.push({ no, kandidat: k, alasan: "urutan" });
    terpakaiNo.add(no);
  }
  return { pasangan: pasangan.sort((a, b) => a.no - b.no), sisa };
}
