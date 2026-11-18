import express from "express";
import path from "node:path";
import { ROOT } from "./paths.ts";
import { loadDb } from "./store.ts";
import { projects } from "./routes/projects.ts";

const PORT = Number(process.env.PORT ?? 8787);
const PROD = process.env.NODE_ENV === "production";

await loadDb();

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/api", projects);

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
  console.log(`Kantor Piksel buka di http://localhost:${PORT}`);
});
