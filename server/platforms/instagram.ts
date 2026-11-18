/**
 * Unggah Reels ke Instagram lewat Instagram Graph API.
 * Butuh akun Instagram Professional (Business/Creator), INSTAGRAM_USER_ID, dan
 * INSTAGRAM_ACCESS_TOKEN (long-lived) dengan izin instagram_content_publish.
 *
 * Mode unggah:
 *  - "resumable" (bawaan): file dikirim langsung dari server ini ke rupload.facebook.com.
 *  - "url": Instagram mengambil video dari PUBLIC_BASE_URL/media/... (server harus bisa diakses publik).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { baseUrl } from "./tokens.ts";

const host = () => process.env.INSTAGRAM_GRAPH_HOST || "graph.facebook.com";
const ver = () => process.env.INSTAGRAM_API_VERSION || "v23.0";
const token = () => process.env.INSTAGRAM_ACCESS_TOKEN!;
const userId = () => process.env.INSTAGRAM_USER_ID!;

export const igConfigured = () => Boolean(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_USER_ID);

async function graph<T>(method: "GET" | "POST", p: string, params: Record<string, string> = {}): Promise<T> {
  const q = new URLSearchParams({ ...params, access_token: token() });
  const url = `https://${host()}/${ver()}/${p}`;
  const res = method === "GET" ? await fetch(`${url}?${q}`) : await fetch(url, { method, body: q });
  const j = (await res.json()) as T & { error?: { message: string } };
  if (!res.ok || j.error) throw new Error(`Instagram: ${j.error?.message ?? res.status}`);
  return j;
}

export async function igUpload(file: string, publicPath: string, caption: string): Promise<{ id: string; url?: string }> {
  const mode = process.env.INSTAGRAM_UPLOAD_MODE === "url" ? "url" : "resumable";
  const base = { media_type: "REELS", caption: caption.slice(0, 2200), share_to_feed: "true" };

  let containerId: string;
  if (mode === "url") {
    const c = await graph<{ id: string }>("POST", `${userId()}/media`, { ...base, video_url: `${baseUrl()}${publicPath}` });
    containerId = c.id;
  } else {
    const c = await graph<{ id: string; uri?: string }>("POST", `${userId()}/media`, { ...base, upload_type: "resumable" });
    containerId = c.id;
    const data = await fs.readFile(file);
    const res = await fetch(c.uri ?? `https://rupload.facebook.com/ig-api-upload/${ver()}/${c.id}`, {
      method: "POST",
      headers: { authorization: `OAuth ${token()}`, offset: "0", file_size: String(data.length) },
      body: data,
    });
    if (!res.ok) throw new Error(`Unggah file Instagram gagal: ${(await res.text()).slice(0, 300)}`);
  }

  // tunggu Instagram selesai memproses
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await graph<{ status_code: string; status?: string }>("GET", containerId, { fields: "status_code,status" });
    if (st.status_code === "ERROR" || st.status_code === "EXPIRED") throw new Error(`Instagram gagal memproses video: ${st.status ?? st.status_code}`);
    if (st.status_code === "FINISHED") {
      const pub = await graph<{ id: string }>("POST", `${userId()}/media_publish`, { creation_id: containerId });
      const info = await graph<{ permalink?: string }>("GET", pub.id, { fields: "permalink" }).catch(() => ({ permalink: undefined }));
      return { id: pub.id, url: info.permalink };
    }
  }
  throw new Error("Instagram terlalu lama memproses video, cek lagi nanti");
}

export const igPublicPath = (projectId: string, file: string) => `/media/${projectId}/${encodeURIComponent(path.basename(file))}`;
