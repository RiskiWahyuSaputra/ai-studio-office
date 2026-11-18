import "./style.css";
import { createOffice } from "./office/office.ts";
import { TEAM } from "./shared/team.ts";

const office = createOffice(document.querySelector<HTMLCanvasElement>("#office")!);
const panel = document.querySelector<HTMLElement>("#panel")!;

office.setBoard([
  { label: "Ide", count: 2, color: "#f2b33d" },
  { label: "Produksi", count: 1, color: "#6ab8f0" },
  { label: "Tayang", count: 3, color: "#6fcf7f" },
]);

office.onSelect((id) => {
  const m = TEAM.find((x) => x.id === id);
  panel.innerHTML = m
    ? `<div style="padding:16px"><h2>${m.nama}</h2><p>${m.role}</p><p>${m.tugas}</p></div>`
    : `<div style="padding:16px">Klik karyawan untuk melihat tugasnya.</div>`;
});
office.select(null);

// demo kecil: Dimas menyerahkan riset ke Sari
setTimeout(() => {
  office.setWorking("peneliti", true, "Riset topik...");
}, 800);
setTimeout(() => {
  office.setWorking("peneliti", false);
  office.handoff("peneliti", "penulis", "Riset selesai!");
}, 4000);
