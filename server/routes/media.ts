import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import { projectDir, probe } from "../editor.ts";
import { bongkarZip, pasangkan, type Kandidat } from "../pasangkan.ts";
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

/** Unggahan massal: banyak video dan/atau ZIP "download proyek" dari Flow, dipasangkan otomatis ke adegan. */
const uploadMassal = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      const dir = path.join(projectDir(String(req.params.id)), `_masuk-${(req as unknown as { masuk: string }).masuk}`);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(_req, file, cb) {
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 7)}${path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "")}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 40 },
  fileFilter(_req, file, cb) {
    cb(null, file.mimetype.startsWith("video/") || /zip/.test(file.mimetype) || /\.zip$/i.test(file.originalname));
  },
});

media.post(
  "/projects/:id/klip-massal",
  (req, _res, next) => {
    (req as unknown as { masuk: string }).masuk = String(Date.now());
    next();
  },
  uploadMassal.array("files", 40),
  async (req, res) => {
    const p = getProject(String(req.params.id));
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const tmp = path.join(projectDir(String(req.params.id)), `_masuk-${(req as unknown as { masuk: string }).masuk}`);
    const bersihkan = () => fs.promises.rm(tmp, { recursive: true, force: true }).catch(() => {});
    if (!p?.adegan?.length) {
      bersihkan();
      return void res.status(400).json({ error: "Proyek ini belum punya adegan" });
    }
    if (!files.length) {
      bersihkan();
      return void res.status(400).json({ error: "Tidak ada video atau ZIP yang diterima" });
    }
    try {
      let waktuAsli: Record<string, number> = {};
      try {
        waktuAsli = JSON.parse(String(req.body?.waktu ?? "{}"));
      } catch {
        // abaikan
      }
      const kandidat: Kandidat[] = [];
      for (const [i, f] of files.entries()) {
        if (/zip/.test(f.mimetype) || /\.zip$/i.test(f.originalname)) {
          kandidat.push(...(await bongkarZip(f.path, path.join(tmp, `zip-${i}`))));
        } else {
          kandidat.push({ nama: f.originalname, path: f.path, waktu: Number(waktuAsli[f.originalname]) || i });
        }
      }
      if (!kandidat.length) {
        bersihkan();
        return void res.status(400).json({ error: "Tidak ada file video di dalam unggahan/ZIP" });
      }
      const { pasangan, sisa } = pasangkan(kandidat, p.adegan);
      const dir = projectDir(p.id);
      const lama: string[] = [];
      const pindah: { no: number; file: string }[] = [];
      for (const ps of pasangan) {
        const ext = (path.extname(ps.kandidat.nama) || ".mp4").toLowerCase().replace(/[^.a-z0-9]/g, "");
        const file = `klip-${ps.no}-${Date.now()}-${ps.no}${ext}`;
        await fs.promises.rename(ps.kandidat.path, path.join(dir, file));
        pindah.push({ no: ps.no, file });
      }
      const hasil = await updateProject(p.id, (x) => {
        for (const { no, file } of pindah) {
          const a = x.adegan!.find((y) => y.no === no)!;
          if (a.klip) lama.push(a.klip);
          a.klip = file;
        }
        addLog(x, "Kamu", `Mengunggah ${pasangan.length} klip sekaligus${files.some((f) => /\.zip$/i.test(f.originalname)) ? " dari ZIP Flow" : ""}`);
      });
      lama.forEach((f) => hapusFile(p.id, f));
      await bersihkan();
      res.json({
        project: hasil,
        pasangan: pasangan.map((x) => ({ no: x.no, nama: x.kandidat.nama, alasan: x.alasan })),
        sisa: sisa.map((k) => k.nama),
      });
    } catch (e) {
      bersihkan();
      res.status(400).json({ error: (e as Error).message });
    }
  },
);

/** Tukar klip dua adegan (kalau pencocokan otomatis tertukar). */
media.post("/projects/:id/klip-tukar", async (req, res) => {
  const p = getProject(String(req.params.id));
  const a = Number(req.body?.a);
  const b = Number(req.body?.b);
  const A = p?.adegan?.find((x) => x.no === a);
  const B = p?.adegan?.find((x) => x.no === b);
  if (!p || !A || !B || a === b) return void res.status(400).json({ error: "Adegan tidak valid" });
  res.json(
    await updateProject(p.id, (x) => {
      const xa = x.adegan!.find((y) => y.no === a)!;
      const xb = x.adegan!.find((y) => y.no === b)!;
      [xa.klip, xb.klip] = [xb.klip, xa.klip];
      addLog(x, "Kamu", `Menukar klip adegan ${a} dan ${b}`);
    }),
  );
});
