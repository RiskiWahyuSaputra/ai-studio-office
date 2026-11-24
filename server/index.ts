import express from "express";
import path from "node:path";
import { ROOT, UPLOADS } from "./paths.ts";
import { media } from "./routes/media.ts";
import { social } from "./routes/social.ts";
import { addLog, listProjects, loadDb, updateProject } from "./store.ts";
import { projects } from "./routes/projects.ts";
import { kick } from "./pipeline.ts";
import { lanjutkanGambarTertunda } from "./gambar.ts";
import { namaModel } from "./ai.ts";
import "./stages.ts";

const PORT = Number(process.env.PORT ?? 8787);
const PROD = process.env.NODE_ENV === "production";

await loadDb();

// tahap yang terputus karena server mati (mis. kehabisan RAM) dijalankan ulang otomatis
for (const p of listProjects().filter((x) => x.status === "jalan")) {
  await updateProject(p.id, (x) => {
    x.status = "antre";
    addLog(x, "Sistem", "Server sempat mati, tahap ini dilanjutkan lagi");
  });
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api", projects);
app.use("/api", media);
app.use("/api", social);
// renderer Remotion berjalan di origin lain dan mengambil gambar/audio/video dari sini
app.use("/media", (_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});
app.use("/media", express.static(UPLOADS, { fallthrough: false }));

app.use("/api", (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

if (PROD) {
  app.use(express.static(path.join(ROOT, "dist")));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(ROOT, "dist", "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

app.listen(PORT, () => {
  console.log(`Kantor PovQ buka di http://localhost:${PORT} (otak karyawan: ${namaModel()})`);
  kick();
  lanjutkanGambarTertunda();
});
