import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { projectDir, probe } from "../editor.ts";
import { kick } from "../pipeline.ts";
import { addLog, getProject, getSettings, updateProject, updateSettings } from "../store.ts";

export const media = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      const dir = projectDir(String(req.params.id));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(req, file, cb) {
      const ext = (path.extname(file.originalname) || ".mp4").toLowerCase().replace(/[^.a-z0-9]/g, "");
      const nama = req.params.no ? `klip-${req.params.no}` : "video-unggahan";
      cb(null, `${nama}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    cb(null, file.mimetype.startsWith("video/"));
  },
});

const hapusFile = (id: string, file?: string) => {
  if (file) fs.rm(path.join(projectDir(id), path.basename(file)), { force: true }, () => {});
};

/** Unggah klip hasil render Flow untuk satu adegan. */
media.post("/projects/:id/klip/:no", upload.single("file"), async (req, res) => {
  const p = getProject(String(req.params.id));
  const no = Number(req.params.no);
  if (!req.file) return void res.status(400).json({ error: "File harus berupa video" });
  const a = p?.adegan?.find((x) => x.no === no);
  if (!p || !a) {
    hapusFile(String(req.params.id), req.file.filename);
    return void res.status(404).json({ error: "Adegan tidak ditemukan" });
  }
  const lama = a.klip;
  const hasil = await updateProject(p.id, (x) => {
    x.adegan!.find((y) => y.no === no)!.klip = req.file!.filename;
    addLog(x, "Kamu", `Mengunggah klip adegan ${no}`);
  });
  hapusFile(p.id, lama);
  res.json(hasil);
});

/** Lewati Nanda: unggah video final yang sudah kamu edit sendiri. */
media.post("/projects/:id/video", upload.single("file"), async (req, res) => {
  const p = getProject(String(req.params.id));
  if (!req.file) return void res.status(400).json({ error: "File harus berupa video" });
  if (!p) return void res.status(404).json({ error: "Proyek tidak ditemukan" });
  if (p.status === "jalan") return void res.status(400).json({ error: "Tunggu tahap yang sedang jalan selesai" });
  let durasi = 0;
  try {
    durasi = (await probe(req.file.path)).durasi;
  } catch {
    hapusFile(p.id, req.file.filename);
    return void res.status(400).json({ error: "Video tidak bisa dibaca" });
  }
  if (p.kredit && !p.kredit.dicatat) {
    await updateSettings({ kreditTerpakai: getSettings().kreditTerpakai + p.kredit.total });
  }
  const lama = p.video?.file;
  const hasil = await updateProject(p.id, (x) => {
    x.video = { file: req.file!.filename, durasi, subtitle: "", dibuat: new Date().toISOString() };
    if (x.kredit) x.kredit.dicatat = true;
    if (["riset", "naskah", "storyboard", "render", "edit"].includes(x.tahap)) {
      x.tahap = "paket";
      x.status = "antre";
    }
    addLog(x, "Kamu", "Mengunggah video final sendiri");
  });
  if (lama && lama !== "final.mp4") hapusFile(p.id, lama);
  kick();
  res.json(hasil);
});
