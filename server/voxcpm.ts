/**
 * Narasi lokal dengan VoxCPM2 (tools/voxcpm). Model dijalankan per pekerjaan lalu ditutup lagi
 * supaya RAM tidak tertahan. Hanya satu pekerjaan berjalan dalam satu waktu.
 * Suara konsisten: kalimat pertama dibuat dari deskripsi suara, lalu jadi "acuan" yang dikloning
 * oleh semua kalimat berikutnya (termasuk part-part lanjutan cerita).
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { antreBerat } from "./berat.ts";
import { ROOT } from "./paths.ts";
import { projectDir } from "./editor.ts";
import type { Format, Project } from "../src/shared/types.ts";
import type { KataWaktu } from "../src/shared/video.ts";

const DIR = path.join(ROOT, "tools", "voxcpm");
const PYTHON = path.join(DIR, ".venv", "bin", "python");
const SKRIP = path.join(DIR, "narasi.py");
const SKRIP_EDGE = path.join(DIR, "edge.py");

export const voxcpmTersedia = () => fs.existsSync(PYTHON) && fs.existsSync(SKRIP);

interface SuaraLokal {
  id: string;
  ket: string;
  deskripsi: string;
  /** rekaman tetap yang dikloning VoxCPM */
  acuan?: { file: string; teks: string };
  /** suara Edge TTS (cepat, beberapa detik per kalimat) dan bukan VoxCPM */
  edge?: { suara: string; pitch: string; pitchHoror: string };
}

export const SUARA_LOKAL: SuaraLokal[] = [
  { id: "edge-ardi", ket: "Pria, Ardi (cepat)", deskripsi: "", edge: { suara: "id-ID-ArdiNeural", pitch: "-4Hz", pitchHoror: "-12Hz" } },
  { id: "edge-gadis", ket: "Wanita, Gadis (cepat)", deskripsi: "", edge: { suara: "id-ID-GadisNeural", pitch: "-4Hz", pitchHoror: "-8Hz" } },
  {
    id: "pendongeng-horor",
    ket: "Pria, bisikan berat (VoxCPM, lambat)",
    deskripsi: "a deep, raspy adult male voice, whispering slowly and menacingly, eerie horror storyteller",
    // suara pilihan kanal: semua narasi horor mengkloning rekaman ini
    acuan: {
      file: "suara/pendongeng-horor.wav",
      teks: "Malam itu, aku mendengar langkah kaki di loteng. Pelan... lalu berhenti, tepat di atas kamarku.",
    },
  },
  { id: "narator-pria", ket: "Pria, narator dokumenter (VoxCPM, lambat)", deskripsi: "pria dewasa, suara hangat dan jelas, tempo sedang, nada tenang seperti narator dokumenter" },
  { id: "vlogger-ceria", ket: "Pria, ceria & kocak (VoxCPM, lambat)", deskripsi: "pria muda dewasa, suara ceria dan ekspresif, tempo agak cepat, gaya vlogger yang lucu" },
  { id: "narator-wanita", ket: "Wanita, narator lembut (VoxCPM, lambat)", deskripsi: "wanita dewasa, suara lembut dan jernih, tempo sedang, nada hangat seperti narator" },
  { id: "wanita-misterius", ket: "Wanita, misterius (VoxCPM, lambat)", deskripsi: "wanita dewasa, suara rendah dan pelan, setengah berbisik, nada misterius dan dingin" },
];

export const BAWAAN_LOKAL: Record<Format, string> = {
  "cerita-horor": "edge-ardi",
  "pov-sejarah": "edge-ardi",
  "vlog-hewan": "edge-ardi",
};

/** Tempo bicara Edge per format: horor lebih pelan, vlog sedikit lebih cepat. */
// horor: lebih lambat & nada lebih rendah (pilihan kanal, contoh: povq-uji-suara/seram/1-ardi-pelan-dalam.wav)
const TEMPO_EDGE: Record<Format, string> = { "cerita-horor": "-18%", "pov-sejarah": "+0%", "vlog-hewan": "+6%" };

export const suaraLokalProyek = (p: Project) =>
  SUARA_LOKAL.find((s) => s.id === p.suaraLokal) ?? SUARA_LOKAL.find((s) => s.id === BAWAAN_LOKAL[p.format])!;

const PRESET = "_kanal";
const lokasiAcuan = (a: NonNullable<Project["acuanSuara"]>) =>
  a.proyek === PRESET ? path.join(DIR, a.file) : path.join(projectDir(a.proyek), a.file);

export interface HasilNarasi {
  /** nama file narasi per kalimat (di folder proyek), urut */
  files: string[];
  /** waktu kata per kalimat (detik relatif awal file), kalau tersedia */
  kata: (KataWaktu[] | undefined)[];
  /** suara acuan VoxCPM (tidak ada untuk Edge) */
  acuan?: NonNullable<Project["acuanSuara"]>;
}

const berjalan = new Map<string, Promise<HasilNarasi>>();

const kunci = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);

/**
 * Buat (atau ambil dari cache) narasi semua kalimat. Pemanggilan ganda dengan isi sama
 * memakai pekerjaan yang sama (dipakai untuk mulai lebih awal di background).
 */
export function narasiLokal(p: Project, kalimat: string[], onProgres?: (pesan: string) => void): Promise<HasilNarasi> {
  const suara = suaraLokalProyek(p);
  if (suara.edge) {
    const id = `${p.id}:${suara.id}:${kunci(kalimat.join("\n"))}`;
    const lama = berjalan.get(id);
    if (lama) return lama;
    const kerja = jalankanEdge(p, kalimat, suara, onProgres);
    berjalan.set(id, kerja);
    kerja.finally(() => berjalan.delete(id)).catch(() => {});
    return kerja;
  }
  // suara tetap milik kanal (rekaman pilihan) didahulukan daripada acuan per proyek
  const preset =
    suara.acuan && fs.existsSync(path.join(DIR, suara.acuan.file))
      ? { proyek: PRESET, file: suara.acuan.file, teks: suara.acuan.teks, suara: suara.id }
      : undefined;
  const acuanAda =
    preset ??
    (p.acuanSuara?.suara === suara.id && fs.existsSync(lokasiAcuan(p.acuanSuara)) ? p.acuanSuara : undefined);
  const id = `${p.id}:${suara.id}:${acuanAda?.file ?? "-"}:${kunci(kalimat.join("\n"))}`;
  const lama = berjalan.get(id);
  if (lama) return lama;

  const kerja = antreBerat(() => jalankan(p, kalimat, suara.id, suara.deskripsi, acuanAda, onProgres));
  berjalan.set(id, kerja);
  kerja.catch(() => berjalan.delete(id));
  return kerja;
}

/** Edge TTS: ringan (tanpa model lokal), jadi tidak perlu antre dengan pekerjaan berat. */
async function jalankanEdge(p: Project, kalimat: string[], suara: SuaraLokal, onProgres?: (pesan: string) => void): Promise<HasilNarasi> {
  if (!voxcpmTersedia() || !fs.existsSync(SKRIP_EDGE)) throw new Error("Edge TTS belum terpasang di tools/voxcpm (lihat README)");
  const dir = projectDir(p.id);
  fs.mkdirSync(dir, { recursive: true });
  const e = suara.edge!;
  const rate = TEMPO_EDGE[p.format];
  const pitch = p.format === "cerita-horor" ? e.pitchHoror : e.pitch;
  const files = kalimat.map((t) => `suara-ed-${kunci(`${e.suara}|${rate}|${pitch}|${t}`)}.mp3`);
  const fileTugas = path.join(dir, `tugas-ed-${Date.now()}.json`);
  fs.writeFileSync(
    fileTugas,
    JSON.stringify({ kalimat: kalimat.map((teks, i) => ({ teks, out: path.join(dir, files[i]) })), suara: e.suara, rate, pitch }),
  );
  const akhir = await new Promise<{ kata: Record<string, KataWaktu[]> }>((resolve, reject) => {
    const ps = spawn(PYTHON, [SKRIP_EDGE, fileTugas], { cwd: DIR, env: { ...process.env, PYTHONUNBUFFERED: "1" } });
    let sisa = "";
    let galat = "";
    let selesai: { kata: Record<string, KataWaktu[]> } | null = null;
    ps.stdout.on("data", (d) => {
      sisa += d;
      const baris = sisa.split("\n");
      sisa = baris.pop() ?? "";
      for (const b of baris) {
        try {
          const j = JSON.parse(b);
          if (j.galat) galat = String(j.galat);
          else if (j.selesai) selesai = j;
          else if (j.tahap === "kalimat") onProgres?.(`Narasi ${j.ke}/${j.dari}...`);
        } catch {
          /* bukan JSON */
        }
      }
    });
    ps.stderr.on("data", (d) => (galat ||= /Error/.test(String(d)) ? String(d).slice(-300) : ""));
    ps.on("error", (err) => reject(new Error(`Edge TTS tidak bisa dijalankan: ${err.message}`)));
    ps.on("close", (code) => {
      fs.rm(fileTugas, { force: true }, () => {});
      if (selesai && code === 0) resolve(selesai);
      else reject(new Error(`Edge TTS gagal (cek koneksi internet): ${galat || `kode ${code}`}`));
    });
  });
  return { files, kata: files.map((f) => akhir.kata[path.join(dir, f)]) };
}

async function jalankan(
  p: Project,
  kalimat: string[],
  suaraId: string,
  deskripsi: string,
  acuan: Project["acuanSuara"],
  onProgres?: (pesan: string) => void,
): Promise<HasilNarasi> {
  if (!voxcpmTersedia()) throw new Error("VoxCPM belum terpasang di tools/voxcpm (lihat README)");
  const dir = projectDir(p.id);
  fs.mkdirSync(dir, { recursive: true });
  const files = kalimat.map((t) => `suara-vx-${kunci(`${suaraId}|${acuan?.file ?? ""}|${t}`)}.wav`);
  const acuanBaru = `acuan-vx-${suaraId}.wav`;
  const tugas = {
    kalimat: kalimat.map((teks, i) => ({ teks, out: path.join(dir, files[i]) })),
    deskripsi,
    acuan: acuan ? { wav: lokasiAcuan(acuan), teks: acuan.teks } : null,
    acuan_out: path.join(dir, acuanBaru),
    timesteps: Number(process.env.VOXCPM_TIMESTEPS) || 10,
    kata: true,
  };
  const fileTugas = path.join(dir, `tugas-vx-${Date.now()}.json`);
  fs.writeFileSync(fileTugas, JSON.stringify(tugas));

  // batasi memori supaya laptop tidak kehabisan RAM (kalau systemd-run tersedia)
  const pakaiScope = spawnSync("systemd-run", ["--version"]).status === 0;
  const batas = process.env.VOXCPM_MEMORY_MAX || "7G";
  const [cmd, args] = pakaiScope
    ? ["systemd-run", ["--user", "--scope", "-q", "-p", `MemoryMax=${batas}`, "-p", "MemorySwapMax=1G", PYTHON, SKRIP, fileTugas]]
    : [PYTHON, [SKRIP, fileTugas]];

  const akhir = await new Promise<{ acuan: { wav: string; teks: string }; kata: Record<string, KataWaktu[]> }>((resolve, reject) => {
    const ps = spawn(cmd as string, args as string[], { cwd: DIR, env: { ...process.env, PYTHONUNBUFFERED: "1", TOKENIZERS_PARALLELISM: "false" } });
    let sisa = "";
    let galat = "";
    let selesai: { acuan: { wav: string; teks: string }; kata: Record<string, KataWaktu[]> } | null = null;
    ps.stdout.on("data", (d) => {
      sisa += d;
      const baris = sisa.split("\n");
      sisa = baris.pop() ?? "";
      for (const b of baris) {
        let j: Record<string, unknown>;
        try {
          j = JSON.parse(b);
        } catch {
          continue;
        }
        if (j.galat) galat = String(j.galat);
        else if (j.selesai) selesai = j as never;
        else if (j.tahap === "muat-model") onProgres?.("Memuat model suara...");
        else if (j.tahap === "acuan-dibuat") onProgres?.("Suara acuan dibuat");
        else if (j.tahap === "kalimat") onProgres?.(`Narasi ${j.ke}/${j.dari}...`);
        else if (j.tahap === "ukur-kata") onProgres?.("Mengukur waktu kata...");
      }
    });
    ps.stderr.on("data", (d) => (galat ||= /Error|Killed/.test(String(d)) ? String(d).slice(-300) : ""));
    ps.on("error", (e) => reject(new Error(`VoxCPM tidak bisa dijalankan: ${e.message}`)));
    ps.on("close", (code) => {
      fs.rm(fileTugas, { force: true }, () => {});
      if (selesai && code === 0) resolve(selesai);
      else reject(new Error(galat || (code === 137 || code === null ? "VoxCPM kehabisan memori, tutup aplikasi berat lalu coba lagi" : `VoxCPM berhenti (kode ${code})`)));
    });
  });

  const acuanFinal = acuan ?? { proyek: p.id, file: acuanBaru, teks: akhir.acuan.teks, suara: suaraId };
  return {
    files,
    kata: files.map((f) => akhir.kata[path.join(dir, f)]),
    acuan: acuanFinal,
  };
}
