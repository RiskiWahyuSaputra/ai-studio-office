import { Router } from "express";
import { FORMATS, type Format } from "../../src/shared/types.ts";
import {
  createProject,
  deleteProject,
  getProject,
  getSettings,
  listProjects,
  updateSettings,
} from "../store.ts";
import { subscribe } from "../events.ts";

export const projects = Router();

projects.get("/events", (_req, res) => subscribe(res));

projects.get("/state", (_req, res) => {
  res.json({ projects: listProjects(), settings: getSettings() });
});

projects.post("/projects", async (req, res) => {
  const format = req.body?.format as Format;
  if (!(format in FORMATS)) return void res.status(400).json({ error: "Format tidak dikenal" });
  const ide = String(req.body?.ide ?? "").slice(0, 500);
  res.status(201).json(await createProject(format, ide));
});

projects.get("/projects/:id", (req, res) => {
  const p = getProject(req.params.id);
  if (!p) return void res.status(404).json({ error: "Proyek tidak ditemukan" });
  res.json(p);
});

projects.delete("/projects/:id", async (req, res) => {
  await deleteProject(req.params.id);
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
  res.json(await updateSettings(patch));
});
