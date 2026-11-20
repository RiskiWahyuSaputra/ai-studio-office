import { Router } from "express";
import fs from "node:fs/promises";
import { projectDir } from "../editor.ts";
import { SUARA, narasi as buatNarasi, suaraBawaan } from "../tts.ts";
import { FORMATS, GAYA, type Format, type Gaya } from "../../src/shared/types.ts";
import {
  createLanjutan,
  createProject,
  deleteProject,
  getProject,
  getSettings,
  listProjects,
  updateSettings,
} from "../store.ts";
import { activity, subscribe } from "../events.ts";
import { namaModel } from "../ai.ts";
import { platformStatus } from "./social.ts";
import { kick, lanjut, ulang } from "../pipeline.ts";
import { STAGES } from "../../src/shared/types.ts";
import type { StageId } from "../../src/shared/team.ts";
import { addLog, updateProject } from "../store.ts";

export const projects = Router();

projects.get("/events", (_req, res) => subscribe(res));

projects.get("/state", async (_req, res) => {
  res.json({ projects: listProjects(), settings: getSettings(), ai: namaModel(), platform: await platformStatus(), suara: SUARA });
});

projects.post("/projects", async (req, res) => {
  const format = req.body?.format as Format;
  if (!(format in FORMATS)) return void res.status(400).json({ error: "Format tidak dikenal" });
  const ide = String(req.body?.ide ?? "").slice(0, 500);
  const gaya: Gaya = req.body?.gaya in GAYA ? req.body.gaya : "animasi";
  const p = await createProject(format, ide, gaya);
  activity({ type: "bicara", memberId: "produser", teks: "Proyek baru masuk!" });
  activity({ type: "serah", dari: "produser", ke: "peneliti", label: ide ? ide.slice(0, 26) : "Cari topik ya" });
  setTimeout(kick, 2500);
  res.status(201).json(p);
});

/** Buat part berikutnya dari cerita ini. */
projects.post("/projects/:id/lanjutan", async (req, res) => {
  const asal = getProject(req.params.id);
  if (!asal) return void res.status(404).json({ error: "Proyek tidak ditemukan" });
  if (!asal.naskah) return void res.status(400).json({ error: "Part ini belum punya naskah" });
  const partSekarang = asal.seri?.part ?? 1;
  const totalPart = Math.floor(Number(req.body?.totalPart ?? asal.seri?.totalPart ?? partSekarang + 1));
  if (!Number.isFinite(totalPart) || totalPart <= partSekarang || totalPart > 10) {
    return void res.status(400).json({ error: `Total part harus antara ${partSekarang + 1} dan 10` });
  }
  const sudahAda = listProjects().find((x) => x.seri?.sebelumnya.at(-1) === asal.id);
  if (sudahAda) return void res.status(409).json({ error: "Part berikutnya untuk cerita ini sudah dibuat", id: sudahAda.id });
  const p = await createLanjutan(asal, totalPart);
  await updateProject(p.id, (x) => addLog(x, "Ratna", `Lanjutan Part ${x.seri!.part} dari ${totalPart} dibuat dari proyek ${asal.id}`));
  activity({ type: "bicara", memberId: "produser", teks: `Part ${p.seri!.part} dimulai!` });
  activity({ type: "serah", dari: "produser", ke: "penulis", label: `Lanjutan Part ${p.seri!.part}` });
  setTimeout(kick, 2500);
  res.status(201).json(getProject(p.id));
});

projects.post("/projects/:id/lanjut", async (req, res) => {
  try {
    res.json(await lanjut(req.params.id));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

projects.post("/projects/:id/ulang", async (req, res) => {
  const tahap = req.body?.tahap as StageId;
  if (!STAGES.some((s) => s.id === tahap)) return void res.status(400).json({ error: "Tahap tidak dikenal" });
  try {
    res.json(await ulang(req.params.id, tahap));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/** Contoh suara narasi: bacakan adegan pertama dengan suara pilihan. */
projects.post("/projects/:id/suara/contoh", async (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return void res.status(404).json({ error: "Proyek tidak ditemukan" });
  const suara = SUARA.some((v) => v.id === req.body?.suara) ? String(req.body.suara) : (p.suara ?? suaraBawaan(p.format));
  const teks = p.adegan?.[0]?.narasi || p.naskah?.hook;
  if (!teks) return void res.status(400).json({ error: "Belum ada naskah untuk dibacakan" });
  try {
    const file = await buatNarasi(projectDir(p.id), teks, suara, p.format, p.modelSuara);
    res.json({ url: `/media/${p.id}/${file}` });
  } catch (e) {
    res.status(503).json({ error: (e as Error).message });
  }
});

/** Isi statistik manual (mis. TikTok yang belum lolos audit API). */
projects.post("/projects/:id/statistik", async (req, res) => {
  const b = req.body ?? {};
  const p = getProject(req.params.id);
  if (!p) return void res.status(404).json({ error: "Proyek tidak ditemukan" });
  if (!["youtube", "tiktok", "instagram"].includes(b.platform)) return void res.status(400).json({ error: "Platform tidak dikenal" });
  const n = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
  const hasil = await updateProject(p.id, (x) => {
    x.statistik = x.statistik.filter((s) => s.platform !== b.platform);
    x.statistik.push({ platform: b.platform, views: n(b.views), likes: n(b.likes), komentar: n(b.komentar), diambil: new Date().toISOString() });
    addLog(x, "Kamu", `Mengisi statistik ${b.platform} manual`);
  });
  res.json(hasil);
});

/** Simpan suntinganmu pada hasil kerja karyawan. */
projects.patch("/projects/:id", async (req, res) => {
  const b = req.body ?? {};
  const p = getProject(req.params.id);
  if (!p) return void res.status(404).json({ error: "Proyek tidak ditemukan" });
  const hasil = await updateProject(p.id, (x) => {
    if (b.gaya in GAYA) x.gaya = b.gaya;
    if (typeof b.suara === "string" && SUARA.some((v) => v.id === b.suara)) x.suara = b.suara;
    if (b.naskah && x.naskah) x.naskah = { ...x.naskah, ...pickStr(b.naskah, ["judulKerja", "hook", "narasi", "cta"]) };
    if (Array.isArray(b.adegan) && x.adegan) {
      for (const a of b.adegan) {
        const t = x.adegan.find((y) => y.no === a.no);
        if (t) Object.assign(t, pickStr(a, ["visual", "narasi", "prompt"]));
      }
    }
    if (b.paket && x.paket) {
      if (b.paket.youtube) {
        Object.assign(x.paket.youtube, pickStr(b.paket.youtube, ["judul", "deskripsi"]));
        if (Array.isArray(b.paket.youtube.tags)) x.paket.youtube.tags = b.paket.youtube.tags.map(String).slice(0, 30);
      }
      if (b.paket.tiktok) Object.assign(x.paket.tiktok, pickStr(b.paket.tiktok, ["caption"]));
      if (b.paket.instagram) Object.assign(x.paket.instagram, pickStr(b.paket.instagram, ["caption"]));
    }
    addLog(x, "Kamu", "Menyunting hasil kerja");
  });
  res.json(hasil);
});

projects.get("/projects/:id", (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return void res.status(404).json({ error: "Proyek tidak ditemukan" });
  res.json(p);
});

projects.delete("/projects/:id", async (req, res) => {
  await deleteProject(req.params.id);
  await fs.rm(projectDir(req.params.id), { recursive: true, force: true });
  res.status(204).end();
});

projects.patch("/settings", async (req, res) => {
  const b = req.body ?? {};
  const patch: Record<string, unknown> = {};
  for (const k of ["kreditBulanan", "kreditTerpakai", "biayaFast", "biayaQuality", "durasiKlip"]) {
    if (k in b) {
      const n = Number(b[k]);
      if (!Number.isFinite(n) || n < 0) return void res.status(400).json({ error: `${k} harus angka >= 0` });
      patch[k] = n;
    }
  }
  if (b.modeRender === "fast" || b.modeRender === "quality") patch.modeRender = b.modeRender;
  if (typeof b.otomatis === "boolean") patch.otomatis = b.otomatis;
  if (typeof b.subtitle === "boolean") patch.subtitle = b.subtitle;
  if (typeof b.narasiTts === "boolean") patch.narasiTts = b.narasiTts;
  if ("volumeKlip" in b) {
    const v = Number(b.volumeKlip);
    if (!Number.isFinite(v) || v < 0 || v > 1) return void res.status(400).json({ error: "volumeKlip harus 0 sampai 1" });
    patch.volumeKlip = v;
  }
  res.json(await updateSettings(patch));
});

function pickStr(o: Record<string, unknown>, keys: string[]) {
  const out: Record<string, string> = {};
  for (const k of keys) if (typeof o?.[k] === "string") out[k] = (o[k] as string).slice(0, 5000);
  return out;
}
