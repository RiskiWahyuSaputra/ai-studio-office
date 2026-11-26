/**
 * Mesin video "Antigravity": Nanda menyiapkan folder Remotion (aset + data + brief), lalu agen Antigravity
 * (`agy` CLI, dengan skill Remotion) MENULIS kode video khusus untuk cerita itu. Aplikasi sendiri yang merender,
 * karena agy berjalan di sandbox (tidak bisa menjalankan npm/render). Kalau render gagal, error dikirim balik
 * ke agy untuk diperbaiki sekali; kalau tetap gagal, pemanggil jatuh ke template bawaan.
 *
 * Folder kerja tetap ada setelah selesai: kamu bisa membukanya di Antigravity untuk menyempurnakan kodenya,
 * lalu klik "Render ulang". Kode yang sudah ada dipakai lagi selama datanya (narasi, gambar) tidak berubah.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { probe } from "./editor.ts";
import { renderFolder } from "./remotion.ts";
import { FORMATS, type Project } from "../src/shared/types.ts";
import type { KataWaktu } from "../src/shared/video.ts";

const AGY = process.env.AGY_BIN || path.join(os.homedir(), ".local", "bin", "agy");
const ID_KOMPOSISI = "PovQAgy";
const PENANDA_KOSONG = "// POVQ-BELUM-DIRANCANG";
const BATAS_MENIT = Number(process.env.AGY_TIMEOUT_MENIT) || 25;

let cekAgy: boolean | null = null;
export function agyTersedia(): boolean {
  if (cekAgy === null) cekAgy = existsSync(AGY) && spawnSync(AGY, ["--version"], { timeout: 15000 }).status === 0;
  return cekAgy;
}

export interface AdeganAgy {
  no: number;
  /** path file gambar/klip di folder proyek; kosong = visual adegan ini digambar agy dengan kode */
  media?: string;
  jenis: "gambar" | "video" | "kode";
  narasi?: string;
  /** detik narasi mulai di dalam adegan */
  mulaiNarasi: number;
  durasiFrame: number;
  teks: string;
  visual: string;
  /** arahan visual rinci dari sutradara (penanda {{Nama}} = tokoh di lembar karakter) */
  arahan?: string;
  kata: KataWaktu[];
  gerak: unknown;
}

export interface OpsiAgy {
  p: Project;
  dirProyek: string;
  /** nama file keluaran di folder proyek, mis. final.mp4 / final-part-2.mp4 */
  keluaran: string;
  fps: number;
  judul: string;
  label: string;
  subtitle: boolean;
  latar: { file: string; volume: number } | null;
  adegan: AdeganAgy[];
  onStatus?: (pesan: string) => void;
  onProgress?: (persen: number) => void;
}

/** Folder kerja Antigravity untuk satu video keluaran. */
export const folderAgy = (dirProyek: string, keluaran: string) => path.join(dirProyek, `agy-${keluaran.replace(/\.mp4$/i, "")}`);

const sha = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 16);

/** Siapkan folder lalu dapatkan video: pakai kode yang ada, atau minta agy merancangnya. */
export async function videoAntigravity(o: OpsiAgy): Promise<{ file: string; durasi: number; folder: string }> {
  const dir = folderAgy(o.dirProyek, o.keluaran);
  const keluar = path.join(o.dirProyek, o.keluaran);
  const { berubah } = await siapkanFolder(dir, o);

  const videoTsx = path.join(dir, "src", "Video.tsx");
  const belumDirancang = (await fs.readFile(videoTsx, "utf8")).includes(PENANDA_KOSONG);
  if (berubah || belumDirancang) {
    o.onStatus?.("Antigravity merancang video...");
    await jalankanAgy(dir, promptRancang(o), o.onStatus);
    if ((await fs.readFile(videoTsx, "utf8")).includes(PENANDA_KOSONG)) throw new Error("Antigravity tidak menulis src/Video.tsx");
  }

  // render ulang hanya kalau kode atau data berubah sejak render terakhir
  const sidik = await sidikKode(dir);
  const fileSidik = `${keluar}.sidik-agy`;
  if ((await fs.readFile(fileSidik, "utf8").catch(() => "")) === sidik && existsSync(keluar)) {
    return { file: o.keluaran, durasi: (await probe(keluar)).durasi, folder: dir };
  }
  await fs.rm(fileSidik, { force: true });

  try {
    o.onStatus?.("Merender rancangan Antigravity...");
    await renderFolder(dir, ID_KOMPOSISI, keluar, o.onProgress);
  } catch (e) {
    const pesan = (e as Error).message.slice(0, 2500);
    o.onStatus?.("Antigravity memperbaiki error render...");
    await jalankanAgy(
      dir,
      `Kode Remotion di folder ini gagal di-bundle/dirender oleh aplikasi dengan error berikut:\n\n${pesan}\n\nPerbaiki file di src/ (jangan ubah src/index.ts, src/Root.tsx, src/data.ts). Ingat: hanya boleh memakai paket remotion, @remotion/media, @remotion/transitions, @remotion/google-fonts. Jangan menjalankan npm atau render. Balas singkat apa yang kamu perbaiki.`,
      o.onStatus,
    );
    await renderFolder(dir, ID_KOMPOSISI, keluar, o.onProgress);
  }
  await fs.writeFile(fileSidik, await sidikKode(dir));
  return { file: o.keluaran, durasi: (await probe(keluar)).durasi, folder: dir };
}

/** Kosongkan rancangan sehingga render berikutnya meminta Antigravity merancang dari awal. */
export async function resetRancangan(dirProyek: string, folder?: string[]) {
  const daftar = folder ?? (await fs.readdir(dirProyek).catch(() => [] as string[])).filter((n) => n.startsWith("agy-")).map((n) => path.join(dirProyek, n));
  for (const d of daftar) {
    if (existsSync(path.join(d, "src"))) await fs.writeFile(path.join(d, "src", "Video.tsx"), VIDEO_KOSONG);
  }
}

async function sidikKode(dir: string): Promise<string> {
  const src = path.join(dir, "src");
  const isi: string[] = [];
  const telusuri = async (d: string) => {
    for (const e of (await fs.readdir(d, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await telusuri(p);
      else isi.push(`${path.relative(src, p)}\n${await fs.readFile(p, "utf8")}`);
    }
  };
  await telusuri(src);
  return sha(isi.join("\n---\n"));
}

const VIDEO_KOSONG = `${PENANDA_KOSONG}
import { AbsoluteFill } from "remotion";

export const Video: React.FC = () => <AbsoluteFill style={{ backgroundColor: "black" }} />;
`;

async function siapkanFolder(dir: string, o: OpsiAgy): Promise<{ berubah: boolean }> {
  const pub = path.join(dir, "public");
  const src = path.join(dir, "src");
  await fs.mkdir(pub, { recursive: true });
  await fs.mkdir(src, { recursive: true });

  const salin = async (asal: string, nama: string) => {
    const tujuan = path.join(pub, nama);
    const [a, b] = await Promise.all([fs.stat(asal), fs.stat(tujuan).catch(() => null)]);
    if (!b || b.size !== a.size || b.mtimeMs < a.mtimeMs) await fs.copyFile(asal, tujuan);
  };

  let mulai = 0;
  const adegan = [];
  for (const a of o.adegan) {
    let media: string | null = null;
    if (a.media) {
      media = `adegan-${a.no}${path.extname(a.media).toLowerCase() || (a.jenis === "video" ? ".mp4" : ".jpg")}`;
      await salin(a.media, media);
    }
    let narasi: string | null = null;
    if (a.narasi) {
      narasi = `narasi-${a.no}${path.extname(a.narasi).toLowerCase() || ".wav"}`;
      await salin(a.narasi, narasi);
    }
    adegan.push({
      no: a.no,
      media,
      jenis: a.jenis,
      mulaiFrame: mulai,
      durasiFrame: a.durasiFrame,
      narasi: narasi ? { file: narasi, mulaiDetikDalamAdegan: a.mulaiNarasi } : null,
      teks: a.teks,
      visual: a.visual,
      arahan: a.arahan ? a.arahan.replace(/\{\{\s*([^}]+?)\s*\}\}/g, "$1") : null,
      kata: a.kata,
      gerakSaran: a.gerak,
    });
    mulai += a.durasiFrame;
  }
  if (o.latar) await salin(o.latar.file, "latar.wav");

  const data = {
    judul: o.judul,
    label: o.label,
    format: FORMATS[o.p.format].nama,
    fps: o.fps,
    width: 1080,
    height: 1920,
    totalFrame: mulai,
    subtitle: o.subtitle,
    latar: o.latar ? { file: "latar.wav", volume: o.latar.volume } : null,
    adegan,
  };
  const isiData = `// Dibuat otomatis oleh Kantor PovQ. Jangan diubah: dibuat ulang setiap render.\nexport const DATA = ${JSON.stringify(data, null, 2)} as const;\n`;
  const fileData = path.join(src, "data.ts");
  const lama = await fs.readFile(fileData, "utf8").catch(() => "");
  const berubah = lama !== "" && lama !== isiData;
  await fs.writeFile(fileData, isiData);

  await fs.writeFile(path.join(src, "index.ts"), `import { registerRoot } from "remotion";\nimport { RemotionRoot } from "./Root";\n\nregisterRoot(RemotionRoot);\n`);
  await fs.writeFile(
    path.join(src, "Root.tsx"),
    `import { Composition } from "remotion";
import { DATA } from "./data";
import { Video } from "./Video";

export const RemotionRoot: React.FC = () => (
  <Composition id="${ID_KOMPOSISI}" component={Video} durationInFrames={DATA.totalFrame} fps={DATA.fps} width={DATA.width} height={DATA.height} />
);
`,
  );
  await fs.writeFile(
    path.join(dir, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", jsx: "react-jsx", strict: true, skipLibCheck: true, esModuleInterop: true, lib: ["DOM", "ES2022"] }, include: ["src"] }, null, 2),
  );
  const videoTsx = path.join(src, "Video.tsx");
  // data baru (narasi/gambar berubah) → rancangan lama tidak cocok lagi
  if (!existsSync(videoTsx) || berubah) await fs.writeFile(videoTsx, VIDEO_KOSONG);
  await fs.writeFile(path.join(dir, "BRIEF.md"), brief(o, data.totalFrame));
  return { berubah };
}

function brief(o: OpsiAgy, totalFrame: number): string {
  const f = FORMATS[o.p.format];
  const kode = o.adegan.some((a) => !a.media);
  const n = o.p.naskah;
  return `# Brief video PovQ: ${o.judul}${o.label ? ` (${o.label})` : ""}

Kanal: **PovQ** (TikTok, YouTube Shorts, Instagram Reels). Format: **${f.nama}**. Bahasa: Indonesia.

## Cerita
- Judul: ${o.judul}
${n ? `- Hook: ${n.hook}\n- Ajakan akhir: ${n.cta}` : ""}

${o.p.karakter?.length ? `## Tokoh (desain harus SAMA di semua adegan)\n${o.p.karakter.map((k) => `- **${k.nama}**: ${k.deskripsi}`).join("\n")}\n` : ""}
## Adegan (lihat src/data.ts untuk angka persisnya)
${o.adegan.map((a, i) => `${i + 1}. ${a.visual}${a.media ? "" : " _(tanpa aset: gambar dengan kode)_"}\n   Narasi: "${a.teks}"`).join("\n")}

## Aturan teknis (wajib)
- Komposisi sudah dibuat: id \`${ID_KOMPOSISI}\`, 1080x1920, ${o.fps} fps, **${totalFrame} frame**. Tulis komponen \`Video\` di \`src/Video.tsx\` (boleh menambah file lain di \`src/\`).
- JANGAN ubah \`src/index.ts\`, \`src/Root.tsx\`, \`src/data.ts\`. Ambil semua angka dari \`DATA\` di \`src/data.ts\`.
${kode ? `- Adegan dengan \`media: null\` (jenis \`"kode"\`) TIDAK punya gambar/klip: kamu yang membuat seluruh visualnya dengan kode. Ikuti \`arahan\` dan \`visual\` tiap adegan.\n` : ""}- Aset ada di \`public/\`, panggil dengan \`staticFile(...)\`. Gambar pakai \`<Img>\`, klip video pakai \`<Video>\` dari \`@remotion/media\` (suara klip pelan, ~0.3), audio pakai \`<Audio>\` dari \`@remotion/media\`.
- Narasi tiap adegan HARUS diputar tepat di \`mulaiFrame + mulaiDetikDalamAdegan*fps\`, dengan volume 1. Ini suara narator tetap kanal, jangan diubah/diganti.
- Suara latar \`latar.wav\` (kalau ada) diputar sepanjang video dengan volume dari DATA.
- Paket yang tersedia HANYA: \`remotion\`, \`@remotion/media\`, \`@remotion/transitions\`, \`@remotion/google-fonts\`. Jangan menambah paket, jangan memakai gambar/font dari internet selain lewat @remotion/google-fonts.
- Semua animasi deterministik (pakai \`useCurrentFrame\`, \`interpolate\`, \`spring\`, \`random(seed)\` dari remotion; jangan Math.random/Date).
- JANGAN menjalankan npm, npx, atau render. Aplikasi Kantor PovQ yang akan merender.

## Gaya PovQ
${o.subtitle ? "- Subtitle karaoke besar di bawah tengah (di atas 300px terbawah, aman dari UI TikTok), font tebal (mis. Montserrat 800), kata yang sedang diucapkan disorot. Pastikan ada jarak antar kata (mis. flex dengan `gap`), termasuk di sebelah kata yang disorot, jangan sampai kata menempel. Waktu kata ada di `kata` (detik relatif awal adegan).\n" : ""}- Watermark kecil \`PovQ\` di pojok kanan atas.
${o.label ? `- Tampilkan kartu judul singkat di awal: "${o.judul}" + "${o.label}".\n` : ""}${kode ? `- **Visual dibuat sepenuhnya dengan kode** (tanpa Google Flow / AI gambar). Bangun tiap adegan sebagai ilustrasi vektor berlapis: SVG/div untuk langit, bangunan, jalan, pepohonan, kendaraan, siluet tokoh, dengan gradien, cahaya (lampu, senter, bulan), bayangan, kabut, dan partikel. Gunakan parallax antar lapisan supaya terasa sinematik. Buat tokoh sebagai komponen SVG yang dipakai ulang supaya desainnya konsisten di semua adegan. Kualitas setara video motion graphics premium, bukan slide statis: setiap adegan harus ada gerak.\n` : ""}- Gerak kamera halus pada gambar diam (zoom/geser, Ken Burns), transisi antar adegan.
${o.p.format === "cerita-horor" ? "- Suasana HOROR: vignette gelap, grain, lampu berkedip, kabut, warna dingin kebiruan/hijau, sedikit guncangan kamera di momen kaget, jumpscare ringan di klimaks (tanpa gore). Boleh overlay ala CCTV/VHS bila cocok." : "- Suasana hangat dan hidup sesuai format, teks yang enak dibaca."}
- Pakai skill Remotion yang tersedia untuk praktik terbaik.
`;
}

function promptRancang(o: OpsiAgy): string {
  return `Kamu sutradara motion graphics untuk kanal PovQ. Baca BRIEF.md dan src/data.ts di folder ini, lalu tulis video Remotion yang sinematik dan memukau di src/Video.tsx (export const Video), mengikuti semua aturan teknis di BRIEF.md. Adegan tanpa media (jenis "kode") harus kamu gambar sendiri seluruhnya dengan kode (ilustrasi vektor berlapis, cahaya, partikel, tokoh SVG yang konsisten). Pakai skill Remotion. Jangan menjalankan npm, npx, atau render; aplikasi yang merender. Setelah selesai, balas ringkas apa saja yang kamu buat.`;
}

function jalankanAgy(dir: string, prompt: string, onStatus?: (pesan: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const mulai = Date.now();
    const ps = spawn(AGY, ["-p", prompt, "--print-timeout", `${BATAS_MENIT}m`], { cwd: dir, env: process.env });
    let out = "";
    ps.stdout.on("data", (d) => (out = (out + d).slice(-4000)));
    ps.stderr.on("data", (d) => (out = (out + d).slice(-4000)));
    const detak = setInterval(() => onStatus?.(`Antigravity merancang video (${Math.round((Date.now() - mulai) / 60000)} mnt)...`), 30000);
    ps.on("error", (e) => {
      clearInterval(detak);
      reject(new Error(`agy tidak bisa dijalankan: ${e.message}`));
    });
    ps.on("close", (code) => {
      clearInterval(detak);
      fs.writeFile(path.join(dir, "agy-terakhir.log"), out).catch(() => {});
      if (code === 0) resolve();
      else reject(new Error(`agy berhenti (kode ${code}): ${out.slice(-300)}`));
    });
  });
}
