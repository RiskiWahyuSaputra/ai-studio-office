/**
 * Pendaftaran tugas tiap tahap ke alur produksi.
 */
import * as agen from "./agents.ts";
import * as editor from "./editor.ts";
import { rakit } from "./rakit.ts";
import { narasiLokal, voxcpmTersedia } from "./voxcpm.ts";
import type { Adegan, Project } from "../src/shared/types.ts";
import type { KataWaktu } from "../src/shared/video.ts";
import { activity } from "./events.ts";
import * as tts from "./tts.ts";
import * as analis from "./analyst.ts";
import { kick, registerStage } from "./pipeline.ts";
import { addLog, buatProyekPart, getProject, getSettings, updateProject, updateSettings } from "./store.ts";
import fs from "node:fs/promises";
import path from "node:path";

registerStage("riset", {
  status: "Riset topik...",
  async run(p) {
    const r = await agen.riset(p);
    return { apply: (x) => void (x.riset = r), pesan: `Topik: ${r.topik}` };
  },
});

registerStage("naskah", {
  status: "Nulis naskah...",
  async run(p) {
    const n = await agen.naskah(p);
    return { apply: (x) => void (x.naskah = n), pesan: `Naskah "${n.judulKerja}" siap` };
  },
});

registerStage("storyboard", {
  status: "Bikin prompt Veo...",
  async run(p) {
    const { adegan, karakter } = await agen.storyboard(p, getSettings());
    return {
      apply: (x) => {
        x.adegan = adegan;
        if (karakter) x.karakter = karakter;
      },
      pesan: `${adegan.length} adegan + prompt siap${karakter ? `, ${karakter.length} karakter tetap` : ""}`,
    };
  },
});

registerStage("render", {
  status: "Hitung kredit...",
  async run(p) {
    mulaiNarasiAwal(p);
    if (p.sumberVisual === "ilustrasi") {
      const n = p.adegan?.length ?? 0;
      return {
        apply: () => {},
        pesan: `Tanpa kredit Flow. Buat ${n} gambar di aplikasi Gemini lalu seret ke panel.`,
        tunggu: true,
      };
    }
    const s = getSettings();
    const perKlip = s.modeRender === "fast" ? s.biayaFast : s.biayaQuality;
    const jumlahKlip = p.adegan?.length ?? 0;
    const total = perKlip * jumlahKlip;
    const sisa = s.kreditBulanan - s.kreditTerpakai;
    const pesan =
      total > sisa
        ? `Butuh ${total} kredit, sisa cuma ${sisa}. Kurangi adegan atau pakai mode Fast.`
        : `Estimasi ${total} kredit (${jumlahKlip} klip × ${perKlip}). Silakan render di Flow.`;
    return {
      apply: (x) => void (x.kredit = { mode: s.modeRender, perKlip, jumlahKlip, total, dicatat: false }),
      pesan,
      tunggu: true,
    };
  },
  siap: (p) => {
    const kurang = (p.adegan ?? []).filter((a) => !a.klip).map((a) => a.no);
    return kurang.length ? `${p.sumberVisual === "ilustrasi" ? "Gambar" : "Klip"} adegan ${kurang.join(", ")} belum diunggah` : null;
  },
  async saatLanjut(p) {
    if (!p.kredit || p.kredit.dicatat) return;
    const s = getSettings();
    await updateSettings({ kreditTerpakai: s.kreditTerpakai + p.kredit.total });
    p.kredit.dicatat = true;
  },
});

/** Narasi semua adegan dengan mesin yang dipilih. VoxCPM: satu batch (model dimuat sekali). */
async function narasiAdegan(
  p: Project,
  kelompok: Adegan[][],
  modelAwal: string | undefined,
): Promise<{ files: (string[] | undefined)[]; kata: ((KataWaktu[] | undefined)[] | undefined)[]; modelSuara?: string; acuan?: Project["acuanSuara"] }> {
  const s = getSettings();
  if (!s.narasiTts) return { files: kelompok.map(() => undefined), kata: kelompok.map(() => undefined) };
  if (s.mesinSuara === "voxcpm" && voxcpmTersedia()) {
    const semua = kelompok.flat().map((a) => a.narasi);
    const h = await narasiLokal(p, semua, (pesan) => activity({ type: "kerja", memberId: "editor", status: pesan }));
    let i = 0;
    const files: string[][] = [];
    const kata: (KataWaktu[] | undefined)[][] = [];
    for (const g of kelompok) {
      files.push(h.files.slice(i, i + g.length));
      kata.push(h.kata.slice(i, i + g.length));
      i += g.length;
    }
    return { files, kata, acuan: h.acuan };
  }
  const dir = editor.projectDir(p.id);
  const suara = p.suara ?? tts.suaraBawaan(p.format);
  let model = modelAwal;
  const files: string[][] = [];
  for (const g of kelompok) {
    const h = await tts.narasiSemua(dir, g.map((a) => a.narasi), suara, p.format, model);
    files.push(h.files);
    model = h.model;
  }
  return { files, kata: kelompok.map(() => undefined), modelSuara: model };
}

/** Mulai narasi lokal lebih awal (selagi kamu membuat gambar), tanpa ditunggu. */
function mulaiNarasiAwal(p: Project) {
  const s = getSettings();
  if (!s.narasiTts || s.mesinSuara !== "voxcpm" || !voxcpmTersedia() || !p.adegan?.length) return;
  narasiLokal(p, p.adegan.map((a) => a.narasi)).then(
    async (h) => {
      if (getProject(p.id)) await updateProject(p.id, (x) => {
        x.acuanSuara ??= h.acuan;
        addLog(x, "Nanda", "Narasi suara lokal sudah siap duluan");
      });
    },
    (e) => console.warn(`[narasi awal] ${(e as Error).message}`),
  );
}

registerStage("edit", {
  status: "Ngedit video...",
  async run(p) {
    const s = getSettings();
    const dir = editor.projectDir(p.id);
    const semua = p.adegan ?? [];
    const nPart = p.naskah?.part?.length ?? 1;

    if (nPart <= 1 || !semua.some((a) => a.part)) {
      const n = await narasiAdegan(p, [semua], p.modelSuara);
      const modelSuara = n.modelSuara;
      const v = await rakit(p, semua, {
        subtitle: s.subtitle,
        narasi: n.files[0],
        kataUkur: n.kata[0],
        volumeKlip: s.volumeKlip,
        label: p.seri ? `Part ${p.seri.part}${p.seri.part >= p.seri.totalPart ? " · Tamat" : ""}` : undefined,
        judul: p.seri ? p.naskah?.judulKerja.replace(/\s*\(Part \d+\)\s*$/i, "") : undefined,
        onProgress: (x) => activity({ type: "kerja", memberId: "editor", status: `Render ${x}%...` }),
      });
      return {
        apply: (x) => {
          x.video = { file: v.file, durasi: v.durasi, subtitle: "subtitle.srt", dibuat: new Date().toISOString() };
          if (modelSuara) x.modelSuara = modelSuara;
          if (n.acuan) x.acuanSuara ??= n.acuan;
        },
        pesan: `Video final ${Math.round(v.durasi)} detik siap (${v.mesin === "remotion" ? "React/Remotion" : "ffmpeg"})`,
      };
    }

    // cerita utuh: satu video per part, suara narasi memakai model yang sama untuk semua part
    const kelompok = Array.from({ length: nPart }, (_, i) => semua.filter((a) => a.part === i + 1));
    const n = await narasiAdegan(p, kelompok, p.modelSuara);
    const modelSuara = n.modelSuara;
    const bagian: Parameters<typeof buatProyekPart>[1] = [];
    for (let k = 1; k <= nPart; k++) {
      const adeganPart = kelompok[k - 1];
      const v = await rakit(p, adeganPart, {
        subtitle: s.subtitle,
        narasi: n.files[k - 1],
        kataUkur: n.kata[k - 1],
        volumeKlip: s.volumeKlip,
        keluaran: `final-part-${k}.mp4`,
        subtitleFile: `subtitle-part-${k}.srt`,
        label: `Part ${k}${k === nPart ? " · Tamat" : ""}`,
        judul: p.naskah!.judulKerja,
        onProgress: (x) => activity({ type: "kerja", memberId: "editor", status: `Part ${k}: render ${x}%...` }),
      });
      const b = p.naskah!.part![k - 1];
      bagian.push({
        part: k,
        naskah: { judulKerja: `${p.naskah!.judulKerja} (Part ${k})`, hook: b.hook, narasi: b.narasi, cta: b.cta },
        adegan: adeganPart.map((a, i) => ({ ...a, no: i + 1, klip: undefined })),
        video: { file: v.file, durasi: v.durasi, subtitle: `subtitle-part-${k}.srt`, dibuat: new Date().toISOString() },
      });
    }
    let idPart: string[] = [];
    return {
      apply: (x) => {
        if (modelSuara) x.modelSuara = modelSuara;
        if (n.acuan) x.acuanSuara ??= n.acuan;
      },
      pesan: `${nPart} video part siap (${bagian.map((b) => `${Math.round(b.video.durasi)} dtk`).join(", ")}), dipecah jadi ${nPart} proyek`,
      selesai: true,
      sesudah: async () => {
        const induk = getProject(p.id);
        if (!induk) return;
        const lama = (induk.dipecahMenjadi ?? []).map((id) => getProject(id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
        if (lama.length === bagian.length) {
          // render ulang: perbarui video proyek part yang sudah ada, jangan buat dobel
          for (const [i, x] of lama.entries()) {
            const tujuan = editor.projectDir(x.id);
            await fs.mkdir(tujuan, { recursive: true });
            await fs.copyFile(path.join(dir, bagian[i].video.file), path.join(tujuan, bagian[i].video.file));
            await fs.copyFile(path.join(dir, bagian[i].video.subtitle), path.join(tujuan, bagian[i].video.subtitle));
            await updateProject(x.id, (y) => {
              y.video = bagian[i].video;
              y.adegan = bagian[i].adegan;
              addLog(y, "Nanda", "Video part diperbarui dari render ulang proyek produksi");
            });
          }
          return;
        }
        const dibuat = await buatProyekPart({ ...induk, modelSuara, acuanSuara: induk.acuanSuara ?? n.acuan }, bagian);
        idPart = dibuat.map((x) => x.id);
        // pindahkan video & subtitle tiap part ke folder proyek part-nya
        for (const [i, x] of dibuat.entries()) {
          const tujuan = editor.projectDir(x.id);
          await fs.mkdir(tujuan, { recursive: true });
          await fs.copyFile(path.join(dir, bagian[i].video.file), path.join(tujuan, bagian[i].video.file));
          await fs.copyFile(path.join(dir, bagian[i].video.subtitle), path.join(tujuan, bagian[i].video.subtitle));
        }
        await updateProject(p.id, (x) => {
          x.dipecahMenjadi = idPart;
          addLog(x, "Nanda", `Dipecah menjadi ${idPart.length} proyek part: ${idPart.join(", ")}`);
        });
        kick();
      },
    };
  },
  siap: (p) => (p.video || p.dipecahMenjadi?.length ? null : "Video final belum ada"),
});

registerStage("paket", {
  status: "Nulis caption...",
  async run(p) {
    const k = await agen.paket(p);
    return { apply: (x) => void (x.paket = k), pesan: "Judul, caption & hashtag siap. Cek dulu ya!", tunggu: true };
  },
});

registerStage("unggah", {
  status: "Siap upload",
  async run() {
    return { apply: () => {}, pesan: "Tinggal pilih platform untuk diunggah", tunggu: true };
  },
  siap: (p) => (p.unggahan.some((u) => u.status === "berhasil") ? null : "Belum ada unggahan yang berhasil"),
});

registerStage("analisis", {
  status: "Baca statistik...",
  async run(p) {
    const { stats, catatan } = await analis.tarikStatistik(p);
    const a = await analis.analisis(p, stats);
    const views = stats.reduce((n, s) => n + s.views, 0);
    return {
      apply: (x) => {
        x.statistik = stats;
        x.analisis = a;
      },
      pesan: `${views.toLocaleString("id-ID")} views terkumpul${catatan.length ? ` (${catatan.join("; ")})` : ""}`,
    };
  },
});
