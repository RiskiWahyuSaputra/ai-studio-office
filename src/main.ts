import "./style.css";
import "./ui/panel.css";
import { api, listen } from "./api.ts";
import { createOffice } from "./office/office.ts";
import { memberForStage } from "./shared/team.ts";
import { STAGES, type Project, type ServerEvent } from "./shared/types.ts";
import { esc, renderPanel, type UiState, type View } from "./ui/panel.ts";

const office = createOffice(document.querySelector<HTMLCanvasElement>("#office")!);
const panel = document.querySelector<HTMLElement>("#panel")!;
const info = document.querySelector<HTMLElement>("#topbar-info")!;
const toastBox = document.createElement("div");
toastBox.className = "toasts";
toastBox.setAttribute("role", "status");
document.body.appendChild(toastBox);

let state: UiState;
let online = false;
let pending = false;

function toast(text: string, bad = false) {
  const el = document.createElement("div");
  el.className = `toast${bad ? " toast-bad" : ""}`;
  el.textContent = text;
  toastBox.appendChild(el);
  setTimeout(() => el.remove(), bad ? 6000 : 3000);
}

function setView(v: View) {
  state.view = v;
  office.select(v.kind === "member" ? v.id : null);
  render(true);
  panel.scrollTop = 0;
}

function sedangMengetik() {
  const a = document.activeElement;
  return !!a && panel.contains(a) && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && (a as HTMLInputElement).type !== "radio" && (a as HTMLInputElement).type !== "checkbox"));
}

function render(force = false) {
  renderTopbar();
  syncBoard();
  if (!force && sedangMengetik()) {
    pending = true;
    return;
  }
  pending = false;
  const open = [...panel.querySelectorAll("details")].map((d) => d.open);
  const scroll = panel.scrollTop;
  panel.innerHTML = renderPanel(state);
  // pertahankan details yang dibuka/ditutup
  const ds = panel.querySelectorAll("details");
  if (!force && ds.length === open.length) ds.forEach((d, i) => (d.open = open[i]));
  panel.scrollTop = scroll;
}

panel.addEventListener("focusout", () => {
  setTimeout(() => pending && !sedangMengetik() && render(), 150);
});

function renderTopbar() {
  const s = state.settings;
  const sisa = s.kreditBulanan - s.kreditTerpakai;
  const pct = s.kreditBulanan ? Math.max(0, Math.min(100, (sisa / s.kreditBulanan) * 100)) : 0;
  info.innerHTML = `
    <span class="meter" title="Sisa kredit Google Flow bulan ini">
      <span class="meter-label">Kredit Flow</span>
      <span class="meter-bar"><span style="width:${pct}%" class="${pct < 20 ? "low" : ""}"></span></span>
      <strong>${sisa}</strong>/${s.kreditBulanan}
    </span>
    <span title="Otak karyawan">Otak: <strong>${esc(state.ai)}</strong></span>
    <span class="dot ${online ? "on" : ""}" title="${online ? "Tersambung" : "Terputus"}">${online ? "Live" : "Offline"}</span>`;
}

function syncBoard() {
  const ps = [...state.projects.values()];
  const di = (ids: string[]) => ps.filter((p) => p.status !== "selesai" && ids.includes(p.tahap)).length;
  office.setBoard([
    { label: "Ide", count: di(["riset", "naskah", "storyboard"]), color: "#f2b33d" },
    { label: "Produksi", count: di(["render", "edit"]), color: "#6ab8f0" },
    { label: "Rilis", count: di(["paket", "unggah"]), color: "#d65f8a" },
    { label: "Tayang", count: ps.filter((p) => p.tahap === "analisis" || p.status === "selesai").length, color: "#6fcf7f" },
  ]);
}

function onEvent(e: ServerEvent) {
  switch (e.type) {
    case "project": {
      const lama = state.projects.get(e.project.id);
      state.projects.set(e.project.id, e.project);
      if (lama && lama.status !== "menunggu-kamu" && e.project.status === "menunggu-kamu") {
        toast(`Giliranmu: ${STAGES.find((s) => s.id === e.project.tahap)?.nama}`);
      }
      if (lama && lama.status !== "gagal" && e.project.status === "gagal") toast(`Gagal: ${e.project.galat}`, true);
      render();
      break;
    }
    case "hapus":
      state.projects.delete(e.id);
      if (state.view.kind === "project" && state.view.id === e.id) state.view = { kind: "list" };
      render(true);
      break;
    case "settings":
      state.settings = e.settings;
      render();
      break;
    case "aktivitas": {
      const a = e.activity;
      if (a.type === "kerja") office.setWorking(a.memberId, true, a.status);
      else if (a.type === "selesai-kerja") office.setWorking(a.memberId, false);
      else if (a.type === "serah") office.handoff(a.dari, a.ke, a.label);
      else if (a.type === "bicara") office.say(a.memberId, a.teks);
      break;
    }
  }
}

const current = (): Project | undefined => (state.view.kind === "project" ? state.projects.get(state.view.id) : undefined);

async function run<T>(fn: () => Promise<T>, ok?: string) {
  try {
    const r = await fn();
    if (ok) toast(ok);
    return r;
  } catch (e) {
    toast((e as Error).message, true);
  }
}

function collect(root: Element, sel = "[data-f]") {
  const out: Record<string, string> = {};
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(sel).forEach((el) => (out[el.dataset.f!] = el.value));
  return out;
}

panel.addEventListener("click", async (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (!el) return;
  const p = current();
  const act = el.dataset.action;
  if (el.tagName === "BUTTON" && el.closest("summary")) ev.preventDefault();
  switch (act) {
    case "buka":
      return setView({ kind: "project", id: el.dataset.id! });
    case "member":
      return setView({ kind: "member", id: el.dataset.id! });
    case "kembali":
      return setView({ kind: "list" });
    case "hapus":
      if (p && confirm("Hapus proyek ini beserta catatannya?")) await run(() => api.remove(p.id), "Proyek dihapus");
      return;
    case "lanjut":
      if (p) await run(() => api.lanjut(p.id));
      return;
    case "ulang":
      if (p) await run(() => api.ulang(p.id, el.dataset.tahap!), "Diminta ulang");
      return;
    case "salin": {
      const a = p?.adegan?.find((x) => x.no === Number(el.dataset.no));
      const ta = el.closest(".scene")?.querySelector("textarea");
      if (a) await run(() => navigator.clipboard.writeText(ta?.value ?? a.prompt), `Prompt adegan ${a.no} disalin`);
      return;
    }
    case "salin-semua": {
      const teks = [...panel.querySelectorAll<HTMLElement>(".scene")]
        .map((sc) => `Adegan ${sc.dataset.no}\n${sc.querySelector("textarea")?.value ?? ""}`)
        .join("\n\n");
      await run(() => navigator.clipboard.writeText(teks), "Semua prompt disalin");
      return;
    }
    case "simpan-naskah": {
      const box = el.closest("[data-edit]")!;
      if (p) await run(() => api.patch(p.id, { naskah: collect(box) }), "Naskah disimpan");
      return;
    }
    case "simpan-adegan": {
      const adegan = [...panel.querySelectorAll<HTMLElement>(".scene")].map((sc) => ({ no: Number(sc.dataset.no), ...collect(sc) }));
      if (p) await run(() => api.patch(p.id, { adegan }), "Prompt disimpan");
      return;
    }
  }
});

panel.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const form = ev.target as HTMLFormElement;
  const fd = new FormData(form);
  if (form.id === "form-baru") {
    const p = await run(() => api.create(String(fd.get("format")), String(fd.get("ide") ?? "")), "Proyek diserahkan ke tim");
    if (p) {
      state.projects.set(p.id, p);
      setView({ kind: "project", id: p.id });
    }
  } else if (form.id === "form-settings") {
    const num = (k: string) => Number(fd.get(k));
    await run(
      () =>
        api.settings({
          kreditBulanan: num("kreditBulanan"),
          kreditTerpakai: num("kreditTerpakai"),
          biayaFast: num("biayaFast"),
          biayaQuality: num("biayaQuality"),
          durasiKlip: num("durasiKlip"),
          modeRender: fd.get("modeRender") as "fast" | "quality",
          otomatis: fd.get("otomatis") === "on",
        }),
      "Pengaturan disimpan",
    );
  }
});

office.onSelect((id) => {
  if (id && (state.view.kind !== "member" || state.view.id !== id)) setView({ kind: "member", id });
});

async function boot() {
  const s = await api.state();
  state = { projects: new Map(s.projects.map((p) => [p.id, p])), settings: s.settings, ai: s.ai, platform: s.platform, view: { kind: "list" } };
  for (const p of s.projects) {
    if (p.status === "jalan") office.setWorking(memberForStage(p.tahap).id, true, "Lanjut kerja...");
  }
  render(true);
  listen(onEvent, async (on) => {
    const wasOffline = !online;
    online = on;
    renderTopbar();
    if (on && wasOffline && state) {
      // sinkron ulang setelah koneksi pulih
      const fresh = await api.state();
      state.projects = new Map(fresh.projects.map((p) => [p.id, p]));
      state.settings = fresh.settings;
      state.platform = fresh.platform;
      render();
    }
  });
}

boot().catch((e) => {
  panel.innerHTML = `<div class="card"><h2>Server tidak bisa dihubungi</h2><p>${esc(e.message)}</p></div>`;
});
