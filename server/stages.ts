/**
 * Pendaftaran tugas tiap tahap ke alur produksi.
 */
import * as agen from "./agents.ts";
import * as editor from "./editor.ts";
import * as analis from "./analyst.ts";
import { registerStage } from "./pipeline.ts";
import { getSettings, updateSettings } from "./store.ts";

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
    const adegan = await agen.storyboard(p, getSettings());
    return { apply: (x) => void (x.adegan = adegan), pesan: `${adegan.length} adegan + prompt siap` };
  },
});

registerStage("render", {
  status: "Hitung kredit...",
  async run(p) {
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
    return kurang.length ? `Klip adegan ${kurang.join(", ")} belum diunggah` : null;
  },
  async saatLanjut(p) {
    if (!p.kredit || p.kredit.dicatat) return;
    const s = getSettings();
    await updateSettings({ kreditTerpakai: s.kreditTerpakai + p.kredit.total });
    p.kredit.dicatat = true;
  },
});

registerStage("edit", {
  status: "Ngedit video...",
  async run(p) {
    const v = await editor.render(p, getSettings().subtitle);
    return {
      apply: (x) => void (x.video = { file: v.file, durasi: v.durasi, subtitle: "subtitle.srt", dibuat: new Date().toISOString() }),
      pesan: `Video final ${Math.round(v.durasi)} detik siap`,
    };
  },
  siap: (p) => (p.video ? null : "Video final belum ada"),
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
