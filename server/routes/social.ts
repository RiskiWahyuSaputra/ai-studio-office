import { Router } from "express";
import path from "node:path";
import { projectDir } from "../editor.ts";
import { activity } from "../events.ts";
import { getToken, setToken } from "../platforms/tokens.ts";
import { ytAuthUrl, ytCallback, ytConfigured, ytUpload } from "../platforms/youtube.ts";
import { ttAuthUrl, ttCallback, ttConfigured, ttUpload } from "../platforms/tiktok.ts";
import { igConfigured, igPublicPath, igUpload } from "../platforms/instagram.ts";
import { addLog, getProject, updateProject } from "../store.ts";
import type { Platform, Project } from "../../src/shared/types.ts";

export const social = Router();

const NAMA: Record<Platform, string> = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram" };

interface Uploader {
  configured: () => boolean;
  catatan: string;
  authUrl?: () => string;
  upload: (p: Project, file: string, opsi: Record<string, string>) => Promise<{ id: string; url?: string }>;
}

export const uploaders: Partial<Record<Platform, Uploader>> = {
  youtube: {
    configured: ytConfigured,
    catatan: "Isi GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET di .env",
    authUrl: ytAuthUrl,
    upload: (p, file, o) =>
      ytUpload(file, {
        judul: p.paket!.youtube.judul,
        deskripsi: p.paket!.youtube.deskripsi,
        tags: p.paket!.youtube.tags,
        privasi: o.privasi === "public" || o.privasi === "unlisted" ? o.privasi : "private",
        kategori: p.format === "pov-sejarah" ? "27" : "24",
      }),
  },
  tiktok: {
    configured: ttConfigured,
    catatan: "Isi TIKTOK_CLIENT_KEY dan TIKTOK_CLIENT_SECRET di .env",
    authUrl: ttAuthUrl,
    upload: (p, file, o) => ttUpload(file, p.paket!.tiktok.caption, o.privasi || "SELF_ONLY"),
  },
  instagram: {
    configured: igConfigured,
    catatan: "Isi INSTAGRAM_USER_ID dan INSTAGRAM_ACCESS_TOKEN di .env",
    upload: (p, file) => igUpload(file, igPublicPath(p.id, file), p.paket!.instagram.caption),
  },
};

export async function platformStatus() {
  const out: Record<string, { siap: boolean; akun?: string; catatan?: string; perluLogin: boolean }> = {};
  for (const [k, u] of Object.entries(uploaders) as [Platform, Uploader][]) {
    const t = await getToken(k);
    out[k] = {
      siap: u.configured() && (!u.authUrl || Boolean(t)),
      akun: t?.akun ?? (k === "instagram" && u.configured() ? `ID ${process.env.INSTAGRAM_USER_ID}` : undefined),
      catatan: u.configured() ? undefined : u.catatan,
      perluLogin: Boolean(u.authUrl),
    };
  }
  return out;
}

social.get("/oauth/:platform", (req, res) => {
  const u = uploaders[req.params.platform as Platform];
  if (!u?.authUrl) return void res.status(404).send("Platform tidak dikenal");
  if (!u.configured()) return void res.status(400).send(u.catatan);
  res.redirect(u.authUrl());
});

social.get("/oauth/youtube/callback", async (req, res) => {
  try {
    if (req.query.error) throw new Error(String(req.query.error));
    await ytCallback(String(req.query.code ?? ""), String(req.query.state ?? ""));
    res.redirect("/?terhubung=youtube");
  } catch (e) {
    res.redirect(`/?gagal=${encodeURIComponent((e as Error).message)}`);
  }
});

social.get("/oauth/tiktok/callback", async (req, res) => {
  try {
    if (req.query.error) throw new Error(String(req.query.error_description ?? req.query.error));
    await ttCallback(String(req.query.code ?? ""), String(req.query.state ?? ""));
    res.redirect("/?terhubung=tiktok");
  } catch (e) {
    res.redirect(`/?gagal=${encodeURIComponent((e as Error).message)}`);
  }
});

social.post("/oauth/:platform/putus", async (req, res) => {
  await setToken(req.params.platform as Platform, undefined);
  res.json(await platformStatus());
});

social.get("/platform", async (_req, res) => {
  res.json(await platformStatus());
});

social.post("/projects/:id/unggah/:platform", async (req, res) => {
  const platform = req.params.platform as Platform;
  const u = uploaders[platform];
  const p = getProject(req.params.id);
  if (!u) return void res.status(404).json({ error: "Platform tidak dikenal" });
  if (!p) return void res.status(404).json({ error: "Proyek tidak ditemukan" });
  if (!p.video || !p.paket) return void res.status(400).json({ error: "Video final dan caption belum siap" });
  if (!(await platformStatus())[platform].siap) return void res.status(400).json({ error: `${NAMA[platform]} belum dihubungkan` });
  if (p.unggahan.some((x) => x.platform === platform && x.status === "proses")) {
    return void res.status(409).json({ error: `Masih mengunggah ke ${NAMA[platform]}` });
  }

  const mulai = new Date().toISOString();
  const hasil = await updateProject(p.id, (x) => {
    x.unggahan.push({ platform, status: "proses", waktu: mulai });
    addLog(x, "Putri", `Mulai unggah ke ${NAMA[platform]}`);
  });
  res.json(hasil);

  activity({ type: "kerja", memberId: "sosmed", status: `Upload ke ${NAMA[platform]}...` });
  const file = path.join(projectDir(p.id), path.basename(p.video.file));
  const opsi = Object.fromEntries(Object.entries(req.body ?? {}).map(([k, v]) => [k, String(v)]));
  try {
    const r = await u.upload(structuredClone(p), file, opsi);
    await updateProject(p.id, (x) => {
      const e = x.unggahan.find((y) => y.platform === platform && y.waktu === mulai);
      if (e) Object.assign(e, { status: "berhasil", idEksternal: r.id, url: r.url, waktu: new Date().toISOString() });
      addLog(x, "Putri", `Tayang di ${NAMA[platform]}${r.url ? `: ${r.url}` : ""}`);
    });
    activity({ type: "bicara", memberId: "sosmed", teks: `Sudah naik di ${NAMA[platform]}!` });
  } catch (e) {
    const pesan = (e as Error).message;
    if (getProject(p.id)) {
      await updateProject(p.id, (x) => {
        const en = x.unggahan.find((y) => y.platform === platform && y.waktu === mulai);
        if (en) Object.assign(en, { status: "gagal", pesan });
        addLog(x, "Putri", `Gagal unggah ke ${NAMA[platform]}: ${pesan}`);
      });
    }
    activity({ type: "bicara", memberId: "sosmed", teks: `${NAMA[platform]} gagal...` });
  } finally {
    activity({ type: "selesai-kerja", memberId: "sosmed" });
  }
});
