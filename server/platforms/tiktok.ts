/**
 * Unggah ke TikTok lewat Content Posting API (Direct Post).
 * Daftar app di https://developers.tiktok.com, aktifkan Login Kit + Content Posting API,
 * scope: user.info.basic, video.publish, video.list. Redirect URI: <PUBLIC_BASE_URL>/api/oauth/tiktok/callback
 * Catatan: sebelum app lolos audit TikTok, video hanya bisa diposting sebagai privat (SELF_ONLY).
 */
import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { baseUrl, getToken, setToken } from "./tokens.ts";

const API = "https://open.tiktokapis.com/v2";
const redirect = () => `${baseUrl()}/api/oauth/tiktok/callback`;
const pendingStates = new Set<string>();

export const ttConfigured = () => Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);

export function ttAuthUrl() {
  const state = randomBytes(12).toString("hex");
  pendingStates.add(state);
  const q = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    scope: "user.info.basic,video.publish,video.list",
    response_type: "code",
    redirect_uri: redirect(),
    state,
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`;
}

interface TokenRes {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  open_id?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY!, client_secret: process.env.TIKTOK_CLIENT_SECRET!, ...body }),
  });
  const j = (await res.json()) as TokenRes;
  if (!res.ok || !j.access_token) throw new Error(`Token TikTok gagal: ${j.error_description ?? j.error ?? res.status}`);
  return j;
}

async function api<T>(access: string, path: string, body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${access}`, "content-type": "application/json; charset=UTF-8" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = (await res.json()) as { data: T; error?: { code: string; message: string } };
  if (!res.ok || (j.error && j.error.code !== "ok")) throw new Error(`TikTok: ${j.error?.message || j.error?.code || res.status}`);
  return j.data;
}

export async function ttCallback(code: string, state: string) {
  if (!pendingStates.delete(state)) throw new Error("State OAuth tidak cocok, coba hubungkan ulang");
  const j = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirect() });
  const info = await api<{ user: { display_name?: string; username?: string } }>(
    j.access_token!,
    "/user/info/?fields=display_name,username",
    undefined,
    "GET",
  ).catch(() => ({ user: {} as { display_name?: string; username?: string } }));
  await setToken("tiktok", {
    access_token: j.access_token!,
    refresh_token: j.refresh_token,
    expires_at: Date.now() + (j.expires_in ?? 86400) * 1000,
    akun: info.user.display_name ?? "Akun TikTok",
    extra: { username: info.user.username ?? "", openId: j.open_id ?? "" },
  });
}

async function access(): Promise<{ token: string; username: string }> {
  const t = await getToken("tiktok");
  if (!t) throw new Error("TikTok belum dihubungkan");
  if (Date.now() < t.expires_at - 60_000) return { token: t.access_token, username: t.extra?.username ?? "" };
  if (!t.refresh_token) throw new Error("Sesi TikTok habis, hubungkan ulang");
  const j = await tokenRequest({ refresh_token: t.refresh_token, grant_type: "refresh_token" });
  await setToken("tiktok", {
    ...t,
    access_token: j.access_token!,
    refresh_token: j.refresh_token ?? t.refresh_token,
    expires_at: Date.now() + (j.expires_in ?? 86400) * 1000,
  });
  return { token: j.access_token!, username: t.extra?.username ?? "" };
}

const MB = 1024 * 1024;

export async function ttUpload(file: string, caption: string, privasi: string): Promise<{ id: string; url?: string }> {
  const { token, username } = await access();
  const creator = await api<{ privacy_level_options: string[] }>(token, "/post/publish/creator_info/query/", {});
  const privacy = creator.privacy_level_options.includes(privasi) ? privasi : "SELF_ONLY";
  if (!creator.privacy_level_options.includes(privacy)) {
    throw new Error(`Privasi tidak tersedia. Pilihan akun ini: ${creator.privacy_level_options.join(", ")}`);
  }

  const data = await fs.readFile(file);
  const size = data.length;
  // TikTok: potongan 5–64 MB; file kecil dikirim utuh, potongan terakhir menampung sisa
  const chunk = size <= 64 * MB ? size : 10 * MB;
  const count = size <= 64 * MB ? 1 : Math.floor(size / chunk);

  const init = await api<{ publish_id: string; upload_url: string }>(token, "/post/publish/video/init/", {
    post_info: {
      title: caption.slice(0, 2200),
      privacy_level: privacy,
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
      is_aigc: true,
    },
    source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunk, total_chunk_count: count },
  });

  for (let i = 0; i < count; i++) {
    const start = i * chunk;
    const end = i === count - 1 ? size : start + chunk;
    const res = await fetch(init.upload_url, {
      method: "PUT",
      headers: { "content-type": "video/mp4", "content-range": `bytes ${start}-${end - 1}/${size}` },
      body: data.subarray(start, end),
    });
    if (!res.ok) throw new Error(`Unggah potongan TikTok gagal (${res.status})`);
  }

  // tunggu TikTok memproses video
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await api<{ status: string; fail_reason?: string; publicaly_available_post_id?: (string | number)[] }>(
      token,
      "/post/publish/status/fetch/",
      { publish_id: init.publish_id },
    );
    if (st.status === "FAILED") throw new Error(`TikTok menolak: ${st.fail_reason ?? "tanpa alasan"}`);
    if (st.status === "PUBLISH_COMPLETE") {
      const postId = st.publicaly_available_post_id?.[0];
      return {
        id: String(postId ?? init.publish_id),
        url: postId && username ? `https://www.tiktok.com/@${username}/video/${postId}` : undefined,
      };
    }
  }
  return { id: init.publish_id };
}

export async function ttStats(ids: string[]) {
  if (!ids.length) return [];
  const { token } = await access();
  const d = await api<{ videos: { id: string; view_count?: number; like_count?: number; comment_count?: number }[] }>(
    token,
    "/video/query/?fields=id,view_count,like_count,comment_count",
    { filters: { video_ids: ids.slice(0, 20) } },
  );
  return d.videos.map((v) => ({ id: String(v.id), views: v.view_count ?? 0, likes: v.like_count ?? 0, komentar: v.comment_count ?? 0 }));
}
