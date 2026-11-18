/**
 * Unggah ke YouTube lewat YouTube Data API v3 (OAuth 2.0).
 * Buat OAuth Client (Web application) di Google Cloud Console, aktifkan "YouTube Data API v3",
 * lalu tambahkan redirect URI: <PUBLIC_BASE_URL>/api/oauth/youtube/callback
 */
import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { baseUrl, getToken, setToken } from "./tokens.ts";

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];
const redirect = () => `${baseUrl()}/api/oauth/youtube/callback`;
const pendingStates = new Set<string>();

export const ytConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function ytAuthUrl() {
  const state = randomBytes(12).toString("hex");
  pendingStates.add(state);
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirect(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...body }),
  });
  const j = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !j.access_token) throw new Error(`Token Google gagal: ${j.error_description ?? j.error ?? res.status}`);
  return j;
}

export async function ytCallback(code: string, state: string) {
  if (!pendingStates.delete(state)) throw new Error("State OAuth tidak cocok, coba hubungkan ulang");
  const j = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirect() });
  const token = { access_token: j.access_token!, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in ?? 3600) * 1000 };
  const ch = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { authorization: `Bearer ${token.access_token}` },
  }).then((r) => r.json() as Promise<{ items?: { id: string; snippet: { title: string } }[] }>);
  await setToken("youtube", { ...token, akun: ch.items?.[0]?.snippet.title ?? "Channel YouTube", extra: { channelId: ch.items?.[0]?.id ?? "" } });
}

export async function ytAccess(): Promise<string> {
  const t = await getToken("youtube");
  if (!t) throw new Error("YouTube belum dihubungkan");
  if (Date.now() < t.expires_at - 60_000) return t.access_token;
  if (!t.refresh_token) throw new Error("Sesi YouTube habis, hubungkan ulang");
  const j = await tokenRequest({ refresh_token: t.refresh_token, grant_type: "refresh_token" });
  await setToken("youtube", { ...t, access_token: j.access_token!, expires_at: Date.now() + (j.expires_in ?? 3600) * 1000 });
  return j.access_token!;
}

export interface YtMeta {
  judul: string;
  deskripsi: string;
  tags: string[];
  privasi: "private" | "unlisted" | "public";
  kategori: string;
}

export async function ytUpload(file: string, m: YtMeta): Promise<{ id: string; url: string }> {
  const access = await ytAccess();
  const data = await fs.readFile(file);
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      authorization: `Bearer ${access}`,
      "content-type": "application/json; charset=UTF-8",
      "x-upload-content-type": "video/mp4",
      "x-upload-content-length": String(data.length),
    },
    body: JSON.stringify({
      snippet: {
        title: m.judul.slice(0, 100),
        description: m.deskripsi.slice(0, 5000),
        tags: m.tags.slice(0, 30),
        categoryId: m.kategori,
        defaultLanguage: "id",
        defaultAudioLanguage: "id",
      },
      status: {
        privacyStatus: m.privasi,
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: true,
      },
    }),
  });
  if (!init.ok) throw new Error(`YouTube menolak: ${await errText(init)}`);
  const loc = init.headers.get("location");
  if (!loc) throw new Error("YouTube tidak memberi alamat unggah");
  const up = await fetch(loc, { method: "PUT", headers: { "content-type": "video/mp4" }, body: data });
  if (!up.ok) throw new Error(`Unggah YouTube gagal: ${await errText(up)}`);
  const v = (await up.json()) as { id: string };
  return { id: v.id, url: `https://youtube.com/shorts/${v.id}` };
}

export async function ytStats(ids: string[]) {
  if (!ids.length) return [];
  const access = await ytAccess();
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(",")}`, {
    headers: { authorization: `Bearer ${access}` },
  });
  if (!res.ok) throw new Error(`Statistik YouTube gagal: ${await errText(res)}`);
  const j = (await res.json()) as { items?: { id: string; statistics: Record<string, string> }[] };
  return (j.items ?? []).map((i) => ({
    id: i.id,
    views: Number(i.statistics.viewCount ?? 0),
    likes: Number(i.statistics.likeCount ?? 0),
    komentar: Number(i.statistics.commentCount ?? 0),
  }));
}

async function errText(r: Response) {
  const t = await r.text();
  try {
    const j = JSON.parse(t);
    return j.error?.message ?? j.error_description ?? t.slice(0, 300);
  } catch {
    return t.slice(0, 300) || String(r.status);
  }
}
