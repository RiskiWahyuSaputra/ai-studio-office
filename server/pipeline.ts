/**
 * Alur produksi: tiap tahap dikerjakan satu karyawan. Satu karyawan hanya memegang
 * satu proyek dalam satu waktu; proyek lain menunggu di antrean.
 */
import { memberForStage, memberById, type StageId } from "../src/shared/team.ts";
import { STAGES, type Project } from "../src/shared/types.ts";
import { activity } from "./events.ts";
import { addLog, getProject, getSettings, listProjects, updateProject } from "./store.ts";

export interface StageResult {
  apply: (p: Project) => void;
  pesan: string;
  /** true = tahap ini butuh tindakanmu sebelum lanjut */
  tunggu?: boolean;
}

export interface StageDef {
  status: string;
  run: (p: Project) => Promise<StageResult>;
  /** pesan galat bila tahap belum boleh dilanjutkan */
  siap?: (p: Project) => string | null;
  /** dipanggil saat kamu menekan "Lanjut" dari tahap ini */
  saatLanjut?: (p: Project) => Promise<void> | void;
}

const defs: Partial<Record<StageId, StageDef>> = {};
const busy = new Set<string>();

export function registerStage(stage: StageId, def: StageDef) {
  defs[stage] = def;
}

export const nextStage = (s: StageId): StageId | null => {
  const i = STAGES.findIndex((x) => x.id === s);
  return STAGES[i + 1]?.id ?? null;
};

export function kick() {
  const antre = listProjects()
    .filter((p) => p.status === "antre")
    .reverse();
  for (const p of antre) {
    const def = defs[p.tahap];
    if (!def) continue;
    const m = memberForStage(p.tahap);
    if (busy.has(m.id)) continue;
    busy.add(m.id);
    void jalankan(p.id, p.tahap, def, m.id).finally(() => {
      busy.delete(m.id);
      setTimeout(kick, 400);
    });
  }
}

async function jalankan(id: string, stage: StageId, def: StageDef, memberId: string) {
  const m = memberById(memberId)!;
  try {
    const p = await updateProject(id, (x) => {
      x.status = "jalan";
      x.galat = undefined;
    });
    activity({ type: "kerja", memberId, status: def.status });
    // jeda minimum supaya karyawan sempat terlihat bekerja di kantor
    const minimum = new Promise((r) => setTimeout(r, 4000 + Math.random() * 3000));
    const [hasil] = await Promise.all([def.run(structuredClone(p)), minimum]);
    if (!getProject(id)) return;
    let pindahKe: StageId | null = null;
    await updateProject(id, (x) => {
      if (x.tahap !== stage) return;
      hasil.apply(x);
      addLog(x, m.nama, hasil.pesan);
      if (hasil.tunggu || !getSettings().otomatis) {
        x.status = "menunggu-kamu";
      } else {
        pindahKe = nextStage(stage);
        if (pindahKe) {
          x.tahap = pindahKe;
          x.status = "antre";
        } else {
          x.status = "selesai";
        }
      }
    });
    activity({ type: "selesai-kerja", memberId });
    if (pindahKe) serah(memberId, pindahKe, hasil.pesan);
    else activity({ type: "bicara", memberId, teks: hasil.tunggu ? "Giliranmu, Bos!" : "Beres!" });
  } catch (e) {
    const pesan = e instanceof Error ? e.message : String(e);
    activity({ type: "selesai-kerja", memberId });
    activity({ type: "bicara", memberId, teks: "Waduh, ada kendala..." });
    if (getProject(id)) {
      await updateProject(id, (x) => {
        x.status = "gagal";
        x.galat = pesan;
        addLog(x, m.nama, `Gagal: ${pesan}`);
      });
    }
  }
}

function serah(dari: string, ke: StageId, label: string) {
  const tujuan = memberForStage(ke);
  activity({ type: "serah", dari, ke: tujuan.id, label: label.length > 28 ? `${label.slice(0, 26)}…` : label });
}

/** Tombol "Lanjut": konfirmasi tahap sekarang lalu pindah ke tahap berikutnya. */
export async function lanjut(id: string) {
  const p = getProject(id);
  if (!p) throw new Error("Proyek tidak ditemukan");
  if (p.status === "jalan") throw new Error("Tahap ini masih dikerjakan");
  const def = defs[p.tahap];
  const belum = def?.siap?.(p);
  if (belum) throw new Error(belum);
  await def?.saatLanjut?.(p);
  const dari = memberForStage(p.tahap);
  const ke = nextStage(p.tahap);
  const hasil = await updateProject(id, (x) => {
    addLog(x, "Kamu", `Menyetujui tahap ${STAGES.find((s) => s.id === x.tahap)?.nama}`);
    if (ke) {
      x.tahap = ke;
      x.status = "antre";
    } else {
      x.status = "selesai";
    }
  });
  if (ke) serah(dari.id, ke, "Lanjut!");
  kick();
  return hasil;
}

/** Ulangi tahap tertentu (misal minta naskah baru). */
export async function ulang(id: string, stage: StageId) {
  const p = getProject(id);
  if (!p) throw new Error("Proyek tidak ditemukan");
  if (p.status === "jalan") throw new Error("Tunggu tahap yang sedang jalan selesai dulu");
  const urutan = STAGES.findIndex((s) => s.id === stage);
  if (urutan < 0 || urutan > STAGES.findIndex((s) => s.id === p.tahap)) throw new Error("Tahap belum dicapai");
  const hasil = await updateProject(id, (x) => {
    x.tahap = stage;
    x.status = defs[stage] ? "antre" : "menunggu-kamu";
    x.galat = undefined;
    addLog(x, "Kamu", `Minta ulang tahap ${STAGES[urutan].nama}`);
  });
  kick();
  return hasil;
}
