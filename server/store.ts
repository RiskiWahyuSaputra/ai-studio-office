import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ROOT } from "./paths.ts";
import { broadcast } from "./events.ts";
import type { Format, Gaya, Project, Settings } from "../src/shared/types.ts";

interface Db {
  projects: Project[];
  settings: Settings;
}

const FILE = path.join(ROOT, "data", "db.json");

const periodeSekarang = () => new Date().toISOString().slice(0, 7);

const defaultSettings = (): Settings => ({
  kreditBulanan: 1000,
  kreditTerpakai: 0,
  periode: periodeSekarang(),
  biayaFast: 20,
  biayaQuality: 100,
  modeRender: "fast",
  durasiKlip: 8,
  otomatis: true,
  subtitle: true,
  narasiTts: true,
  volumeKlip: 0.3,
});

let db: Db;
let writing = Promise.resolve();

export async function loadDb() {
  try {
    db = JSON.parse(await fs.readFile(FILE, "utf8"));
    db.settings = { ...defaultSettings(), ...db.settings };
  } catch {
    db = { projects: [], settings: defaultSettings() };
  }
  // reset kredit tiap bulan baru
  if (db.settings.periode !== periodeSekarang()) {
    db.settings.periode = periodeSekarang();
    db.settings.kreditTerpakai = 0;
  }
  // tugas yang terputus saat server mati dikembalikan ke antrean
  for (const p of db.projects) if (p.status === "jalan") p.status = "antre";
  await save();
}

function save() {
  const snapshot = JSON.stringify(db, null, 2);
  writing = writing.then(async () => {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    const tmp = `${FILE}.tmp`;
    await fs.writeFile(tmp, snapshot);
    await fs.rename(tmp, FILE);
  });
  return writing;
}

export const listProjects = () => [...db.projects].sort((a, b) => b.dibuat.localeCompare(a.dibuat));
export const getProject = (id: string) => db.projects.find((p) => p.id === id);
export const getSettings = () => db.settings;

export async function createProject(format: Format, ide: string, gaya: Gaya): Promise<Project> {
  const now = new Date().toISOString();
  const p: Project = {
    id: randomUUID().slice(0, 8),
    format,
    gaya,
    ide: ide.trim(),
    dibuat: now,
    diubah: now,
    tahap: "riset",
    status: "antre",
    unggahan: [],
    statistik: [],
    log: [],
  };
  db.projects.push(p);
  await save();
  broadcast({ type: "project", project: p });
  return p;
}

export async function updateProject(id: string, fn: (p: Project) => void): Promise<Project> {
  const p = getProject(id);
  if (!p) throw new Error("Proyek tidak ditemukan");
  fn(p);
  p.diubah = new Date().toISOString();
  await save();
  broadcast({ type: "project", project: p });
  return p;
}

/** Proyek lanjutan dari sebuah cerita: riset, gaya, dan suara diwarisi; mulai dari tahap Naskah. */
export async function createLanjutan(asal: Project, totalPart: number): Promise<Project> {
  const now = new Date().toISOString();
  const seriAsal = asal.seri ?? { id: asal.id, part: 1, totalPart, sebelumnya: [] };
  const p: Project = {
    id: randomUUID().slice(0, 8),
    format: asal.format,
    gaya: asal.gaya,
    suara: asal.suara,
    modelSuara: asal.modelSuara,
    ide: asal.ide,
    dibuat: now,
    diubah: now,
    tahap: "naskah",
    status: "antre",
    riset: asal.riset ? structuredClone(asal.riset) : undefined,
    karakter: asal.karakter ? structuredClone(asal.karakter) : undefined,
    seri: { id: seriAsal.id, part: seriAsal.part + 1, totalPart, sebelumnya: [...seriAsal.sebelumnya, asal.id] },
    unggahan: [],
    statistik: [],
    log: [],
  };
  // pastikan Part 1 juga tahu dirinya bagian dari seri
  if (!asal.seri) asal.seri = seriAsal;
  else asal.seri.totalPart = totalPart;
  db.projects.push(p);
  await save();
  broadcast({ type: "project", project: asal });
  broadcast({ type: "project", project: p });
  return p;
}

export async function deleteProject(id: string) {
  db.projects = db.projects.filter((p) => p.id !== id);
  await save();
  broadcast({ type: "hapus", id });
}

export async function updateSettings(patch: Partial<Settings>) {
  db.settings = { ...db.settings, ...patch };
  await save();
  broadcast({ type: "settings", settings: db.settings });
  return db.settings;
}

export function addLog(p: Project, oleh: string, pesan: string) {
  p.log.push({ waktu: new Date().toISOString(), oleh, pesan });
  if (p.log.length > 200) p.log.splice(0, p.log.length - 200);
}
