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
import { ROOT } from "./paths.ts";
import { projectDir } from "./editor.ts";
import type { Format, Project } from "../src/shared/types.ts";
import type { KataWaktu } from "../src/shared/video.ts";

const DIR = path.join(ROOT, "tools", "voxcpm");
const PYTHON = path.join(DIR, ".venv", "bin", "python");
const SKRIP = path.join(DIR, "narasi.py");

export const voxcpmTersedia = () => fs.existsSync(PYTHON) && fs.existsSync(SKRIP);

export const SUARA_LOKAL: { id: string; ket: string; deskripsi: string; acuan?: { file: string; teks: string } }[] = [
  {
    id: "pendongeng-horor",
    ket: "Pria, bisikan berat (suara PovQ)",
    deskripsi: "a deep, raspy adult male voice, whispering slowly and menacingly, eerie horror storyteller",
    // suara pilihan kanal: semua narasi horor mengkloning rekaman ini
    acuan: {
      file: "suara/pendongeng-horor.wav",
      teks: "Malam itu, aku mendengar langkah kaki di loteng. Pelan... lalu berhenti, tepat di atas kamarku.",
    },
  },
  { id: "narator-pria", ket: "Pria, narator dokumenter", deskripsi: "pria dewasa, suara hangat dan jelas, tempo sedang, nada tenang seperti narator dokumenter" },
  { id: "vlogger-ceria", ket: "Pria, ceria & kocak", deskripsi: "pria muda dewasa, suara ceria dan ekspresif, tempo agak cepat, gaya vlogger yang lucu" },
  { id: "narator-wanita", ket: "Wanita, narator lembut", deskripsi: "wanita dewasa, suara lembut dan jernih, tempo sedang, nada hangat seperti narator" },
  { id: "wanita-misterius", ket: "Wanita, misterius", deskripsi: "wanita dewasa, suara rendah dan pelan, setengah berbisik, nada misterius dan dingin" },
];

const BAWAAN: Record<Format, string> = {
  "cerita-horor": "pendongeng-horor",
  "pov-sejarah": "narator-pria",
  "vlog-hewan": "vlogger-ceria",
};

export const suaraLokalProyek = (p: Project) =>
  SUARA_LOKAL.find((s) => s.id === p.suaraLokal) ?? SUARA_LOKAL.find((s) => s.id === BAWAAN[p.format])!;

const PRESET = "_kanal";
const lokasiAcuan = (a: NonNullable<Project["acuanSuara"]>) =>
  a.proyek === PRESET ? path.join(DIR, a.file) : path.join(projectDir(a.proyek), a.file);

export interface HasilNarasi {
  /** nama file narasi per kalimat (di folder proyek), urut */
  files: string[];
  /** waktu kata per kalimat (detik relatif awal file), kalau tersedia */
  kata: (KataWaktu[] | undefined)[];
  acuan: NonNullable<Project["acuanSuara"]>;
}

let antrean: Promise<unknown> = Promise.resolve();
const berjalan = new Map<string, Promise<HasilNarasi>>();

const kunci = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);

/**
 * Buat (atau ambil dari cache) narasi semua kalimat. Pemanggilan ganda dengan isi sama
 * memakai pekerjaan yang sama (dipakai untuk mulai lebih awal di background).
 */
export function narasiLokal(p: Project, kalimat: string[], onProgres?: (pesan: string) => void): Promise<HasilNarasi> {
  const suara = suaraLokalProyek(p);
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

  const kerja = antrean.then(() => jalankan(p, kalimat, suara.id, suara.deskripsi, acuanAda, onProgres));
  antrean = kerja.catch(() => {});
  berjalan.set(id, kerja);
  kerja.catch(() => berjalan.delete(id));
  return kerja;
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
