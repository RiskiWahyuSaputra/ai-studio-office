/**
 * Bayu menggambar otomatis: gambar per adegan dibuat lewat Pollinations (model Flux), gratis tanpa kunci.
 * Batas gratis 1 gambar / 45 detik per IP, jadi gambar dibuat berurutan dalam satu antrean global.
 * Isi POLLINATIONS_KEY di .env (gratis di enter.pollinations.ai) untuk tanpa watermark & lebih cepat.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promptGambarInggris } from "./agents.ts";
import { projectDir } from "./editor.ts";
import { activity } from "./events.ts";
import { fetchUlang } from "./net.ts";
import { lanjut } from "./pipeline.ts";
import { addLog, getProject, getSettings, listProjects, updateProject } from "./store.ts";
import { GAYA, type Project } from "../src/shared/types.ts";

let antrean: Promise<unknown> = Promise.resolve();
const berjalan = new Set<string>();

const benih = (s: string) => parseInt(createHash("sha1").update(s).digest("hex").slice(0, 7), 16);

export const gambarOtomatis = () => getSettings().mesinGambar === "otomatis";

/** Mulai menggambar adegan yang belum punya gambar (atau `nos` tertentu untuk gambar ulang). */
export function mulaiGambar(id: string, nos?: number[]) {
  const kunci = `${id}:${nos?.join(",") ?? "semua"}`;
  if (berjalan.has(kunci)) return;
  berjalan.add(kunci);
  antrean = antrean
    .then(() => kerjakan(id, nos))
    .catch(async (e) => {
      const pesan = (e as Error).message;
      console.warn(`[gambar] ${pesan}`);
      activity({ type: "bicara", memberId: "sutradara", teks: "Gagal menggambar, coba manual ya" });
      if (getProject(id)) await updateProject(id, (x) => addLog(x, "Bayu", `Gambar otomatis gagal: ${pesan}. Buat manual atau klik "Gambar ulang".`));
    })
    .finally(() => {
      berjalan.delete(kunci);
      activity({ type: "selesai-kerja", memberId: "sutradara" });
    });
}

/** Lanjutkan pekerjaan yang terputus saat server mati. */
export function lanjutkanGambarTertunda() {
  if (!gambarOtomatis()) return;
  for (const p of listProjects()) {
    if (p.sumberVisual === "ilustrasi" && p.tahap === "render" && p.adegan?.some((a) => !a.klip)) mulaiGambar(p.id);
  }
}

async function kerjakan(id: string, nos?: number[]) {
  let p = getProject(id);
  if (!p?.adegan?.length) return;
  const target = p.adegan.filter((a) => (nos ? nos.includes(a.no) : !a.klip));
  if (!target.length) return selesaiSemua(id);

  // prompt bahasa Inggris, dibuat sekali per proyek
  if (target.some((a) => !a.promptEn)) {
    activity({ type: "kerja", memberId: "sutradara", status: "Menyiapkan prompt gambar..." });
    const peta = await promptGambarInggris(p);
    p = await updateProject(id, (x) => {
      for (const a of x.adegan ?? []) a.promptEn = peta[a.no] ?? a.promptEn;
    });
  }

  const dir = projectDir(id);
  await fs.mkdir(dir, { recursive: true });
  for (const [i, t] of target.entries()) {
    const sekarang = getProject(id);
    const a = sekarang?.adegan?.find((x) => x.no === t.no);
    if (!sekarang || !a) return;
    if (!nos && a.klip) continue; // sudah diisi manual sementara menunggu
    activity({ type: "kerja", memberId: "sutradara", status: `Menggambar ${i + 1}/${target.length}...` });
    // seed tetap per proyek (gaya konsisten); gambar ulang memakai seed baru
    const seed = nos ? benih(`${id}:${a.no}:${Date.now()}`) : benih(id) + a.no;
    const mentah = path.join(dir, `_gambar-${a.no}-${Date.now()}.jpg`);
    const awal = GAYA[sekarang.gaya ?? "sinematik"].gambarAwal;
    await unduhGambar(`${awal ? `${awal} ` : ""}${a.promptEn ?? a.prompt}`, seed, mentah);
    const file = `klip-${a.no}-auto-${Date.now()}.jpg`;
    await rapikan(mentah, path.join(dir, file));
    await fs.rm(mentah, { force: true });
    let lama: string | undefined;
    await updateProject(id, (x) => {
      const y = x.adegan?.find((z) => z.no === a.no);
      if (!y || (!nos && y.klip)) return;
      lama = y.klip;
      y.klip = file;
    });
    if (lama) await fs.rm(path.join(dir, path.basename(lama)), { force: true });
  }
  await updateProject(id, (x) => addLog(x, "Bayu", `${target.length} gambar dibuat otomatis`));
  activity({ type: "bicara", memberId: "sutradara", teks: "Gambar beres!" });
  return selesaiSemua(id);
}

/** Kalau semua adegan sudah bergambar dan lanjut otomatis aktif, teruskan ke tahap edit. */
async function selesaiSemua(id: string) {
  const p = getProject(id);
  if (!p || p.tahap !== "render" || p.status !== "menunggu-kamu") return;
  if (!p.adegan?.every((a) => a.klip) || !getSettings().otomatis) return;
  await lanjut(id);
}

async function unduhGambar(prompt: string, seed: number, keluar: string) {
  const q = new URLSearchParams({ width: "768", height: "1344", model: "flux", seed: String(seed), nologo: "true", private: "true" });
  if (process.env.POLLINATIONS_KEY) q.set("token", process.env.POLLINATIONS_KEY);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 1500))}?${q}`;
  for (let coba = 0; coba < 10; coba++) {
    const res = await fetchUlang(url, { signal: AbortSignal.timeout(180_000) });
    if (res.ok && (res.headers.get("content-type") ?? "").startsWith("image/")) {
      await fs.writeFile(keluar, Buffer.from(await res.arrayBuffer()));
      return;
    }
    const teks = await res.text().catch(() => "");
    if (res.status === 402 || res.status === 429 || res.status >= 500) {
      // batas gratis: "Retry after 39s"
      const detik = Number(teks.match(/after (\d+)s/i)?.[1] ?? 45);
      await new Promise((r) => setTimeout(r, (detik + 3) * 1000));
      continue;
    }
    throw new Error(`Layanan gambar menolak (${res.status}): ${teks.slice(0, 160)}`);
  }
  throw new Error("Layanan gambar terus sibuk, coba lagi nanti");
}

/** Potong bagian bawah (watermark layanan gratis) lalu jadikan 1080x1920. */
function rapikan(masuk: string, keluar: string): Promise<void> {
  const potong = process.env.POLLINATIONS_KEY ? "" : "crop=iw:ih*0.93:0:0,";
  return new Promise((resolve, reject) => {
    const ps = spawn("ffmpeg", [
      "-y", "-v", "error", "-i", masuk,
      "-vf", `${potong}scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920`,
      "-q:v", "3", keluar,
    ]);
    let err = "";
    ps.stderr.on("data", (d) => (err += d));
    ps.on("error", reject);
    ps.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg gambar gagal: ${err.slice(-200)}`))));
  });
}
