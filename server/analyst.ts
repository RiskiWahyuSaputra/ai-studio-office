/**
 * Yoga si analis: tarik statistik dari tiap platform lalu beri saran untuk video berikutnya.
 */
import { aiAktif, generateJson } from "./ai.ts";
import { ttStats } from "./platforms/tiktok.ts";
import { igStats } from "./platforms/instagram.ts";
import { ytStats } from "./platforms/youtube.ts";
import { platformStatus } from "./routes/social.ts";
import { listProjects } from "./store.ts";
import { FORMATS, type Analisis, type Platform, type Project, type Statistik } from "../src/shared/types.ts";

export async function tarikStatistik(p: Project): Promise<{ stats: Statistik[]; catatan: string[] }> {
  const status = await platformStatus();
  const catatan: string[] = [];
  const now = new Date().toISOString();
  const stats: Statistik[] = [];
  const idPer = (pl: Platform) =>
    p.unggahan.filter((u) => u.platform === pl && u.status === "berhasil" && u.idEksternal).map((u) => u.idEksternal!);

  const ambil = async (pl: Platform, fn: () => Promise<{ views: number; likes: number; komentar: number }[]>) => {
    if (!idPer(pl).length) return;
    if (!status[pl]?.siap) return void catatan.push(`${NAMA[pl]} belum terhubung, statistik tidak diambil`);
    try {
      const r = await fn();
      if (r.length) {
        stats.push({
          platform: pl,
          views: r.reduce((a, x) => a + x.views, 0),
          likes: r.reduce((a, x) => a + x.likes, 0),
          komentar: r.reduce((a, x) => a + x.komentar, 0),
          diambil: now,
        });
      }
    } catch (e) {
      catatan.push(`${NAMA[pl]}: ${(e as Error).message}`);
    }
  };

  await ambil("youtube", () => ytStats(idPer("youtube")));
  await ambil("tiktok", () => ttStats(idPer("tiktok")));
  await ambil("instagram", () => Promise.all(idPer("instagram").map(igStats)));

  // pertahankan angka manual untuk platform yang tidak bisa ditarik otomatis
  for (const lama of p.statistik) if (!stats.some((s) => s.platform === lama.platform)) stats.push(lama);
  return { stats, catatan };
}

const NAMA: Record<Platform, string> = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram" };

const total = (p: Project) => p.statistik.reduce((a, s) => a + s.views, 0);

export async function analisis(p: Project, stats: Statistik[]): Promise<Analisis> {
  const lain = listProjects()
    .filter((x) => x.id !== p.id && x.statistik.length)
    .slice(0, 15)
    .map((x) => ({ format: x.format, topik: x.riset?.topik, judul: x.naskah?.judulKerja, views: total(x) }));
  const views = stats.reduce((a, s) => a + s.views, 0);

  if (aiAktif()) {
    const r = await generateJson<{ ringkasan: string; saran: string[] }>(`Kamu Analis Data di tim kreator video AI berbahasa Indonesia (YouTube Shorts, TikTok, Instagram Reels).
Format: ${FORMATS[p.format].nama}
Video ini: ${JSON.stringify({ topik: p.riset?.topik, hook: p.naskah?.hook, judul: p.paket?.youtube.judul, statistik: stats })}
Video lain di kanal: ${JSON.stringify(lain)}

Tulis analisis singkat dan jujur (jangan mengarang angka). Bandingkan dengan video lain bila ada.
Balas JSON: {"ringkasan": string (2-4 kalimat), "saran": string[] (3-5 saran konkret: topik berikutnya, perbaikan hook, jam unggah, dll)}`);
    return { ...r, dibuat: new Date().toISOString() };
  }

  const rata = lain.length ? lain.reduce((a, x) => a + x.views, 0) / lain.length : 0;
  const likes = stats.reduce((a, s) => a + s.likes, 0);
  const er = views ? ((likes / views) * 100).toFixed(1) : "0";
  const terbaik = stats.slice().sort((a, b) => b.views - a.views)[0];
  return {
    ringkasan: stats.length
      ? `Total ${views.toLocaleString("id-ID")} views, rasio like ${er}%.` +
        (terbaik ? ` Platform terkuat: ${NAMA[terbaik.platform]}.` : "") +
        (rata ? ` Rata-rata video lain ${Math.round(rata).toLocaleString("id-ID")} views, jadi video ini ${views >= rata ? "di atas" : "di bawah"} rata-rata.` : "")
      : "Belum ada statistik. Hubungkan platform atau isi angka manual, lalu minta Yoga menganalisis ulang.",
    saran: [
      views < rata ? "Coba hook yang lebih mengejutkan di 2 detik pertama." : "Pertahankan gaya hook ini untuk video berikutnya.",
      FORMATS[p.format].saranSeri,
      "Unggah di jam ramai (sekitar 18.00–21.00 WIB) dan bandingkan hasilnya.",
    ],
    dibuat: new Date().toISOString(),
  };
}
