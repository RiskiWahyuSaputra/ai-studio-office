import { TEAM, memberById, memberForStage } from "../shared/team.ts";
import { cekKebijakan } from "../shared/kebijakan.ts";
import { FORMATS, STAGES, type Platform, type Project, type Settings } from "../shared/types.ts";

export type View = { kind: "list" } | { kind: "project"; id: string } | { kind: "member"; id: string };

export interface UiState {
  projects: Map<string, Project>;
  settings: Settings;
  ai: string;
  platform: Record<string, { siap: boolean; akun?: string; catatan?: string; perluLogin: boolean }>;
  view: View;
}

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const STATUS_LABEL: Record<Project["status"], string> = {
  antre: "Antre",
  jalan: "Dikerjakan",
  "menunggu-kamu": "Menunggu kamu",
  selesai: "Selesai",
  gagal: "Gagal",
};

const waktu = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const judulProyek = (p: Project) => p.naskah?.judulKerja ?? p.riset?.sudut ?? (p.ide || "Ide baru");

export function renderPanel(s: UiState): string {
  switch (s.view.kind) {
    case "project": {
      const p = s.projects.get(s.view.id);
      return p ? renderProject(p, s) : renderList(s);
    }
    case "member":
      return renderMember(s.view.id, s);
    default:
      return renderList(s);
  }
}

function badge(p: Project) {
  return `<span class="badge badge-${p.status}">${STATUS_LABEL[p.status]}</span>`;
}

function renderList(s: UiState): string {
  const list = [...s.projects.values()].sort((a, b) => b.dibuat.localeCompare(a.dibuat));
  const formats = Object.entries(FORMATS)
    .map(
      ([id, f], i) => `
      <label class="format-opt">
        <input type="radio" name="format" value="${id}" ${i === 0 ? "checked" : ""} />
        <span><strong>${esc(f.nama)}</strong><small>${esc(f.ringkas)}</small></span>
      </label>`,
    )
    .join("");
  return `
  <section class="card">
    <h2>Proyek baru</h2>
    <form id="form-baru" class="stack">
      <div class="format-list">${formats}</div>
      <label class="field">
        <span>Ide (opsional)</span>
        <input name="ide" maxlength="200" placeholder="mis. Batavia 1740, kucing oren di pasar" />
      </label>
      <button class="btn btn-primary" type="submit">Serahkan ke tim</button>
      <p class="hint">Kosongkan ide supaya Dimas memilih topik sendiri.</p>
    </form>
  </section>

  <section class="card">
    <h2>Proyek <span class="count">${list.length}</span></h2>
    ${
      list.length
        ? `<ul class="project-list">${list
            .map(
              (p) => `
          <li>
            <button class="project-row" data-action="buka" data-id="${p.id}">
              <span class="project-title">${esc(judulProyek(p))}</span>
              <span class="project-meta">${esc(FORMATS[p.format].nama)} · ${esc(STAGES.find((x) => x.id === p.tahap)?.nama)}</span>
              ${badge(p)}
            </button>
          </li>`,
            )
            .join("")}</ul>`
        : `<p class="empty">Belum ada proyek. Buat satu di atas, lalu lihat timnya bekerja.</p>`
    }
  </section>

  ${renderSettings(s)}
  ${renderTeam()}`;
}

function renderSettings(s: UiState): string {
  const st = s.settings;
  return `
  <details class="card">
    <summary><h2>Pengaturan</h2></summary>
    <form id="form-settings" class="stack">
      <div class="grid-2">
        <label class="field"><span>Kredit Flow / bulan</span><input type="number" min="0" name="kreditBulanan" value="${st.kreditBulanan}" /></label>
        <label class="field"><span>Terpakai bulan ini</span><input type="number" min="0" name="kreditTerpakai" value="${st.kreditTerpakai}" /></label>
        <label class="field"><span>Biaya klip Fast</span><input type="number" min="0" name="biayaFast" value="${st.biayaFast}" /></label>
        <label class="field"><span>Biaya klip Quality</span><input type="number" min="0" name="biayaQuality" value="${st.biayaQuality}" /></label>
        <label class="field"><span>Mode render</span>
          <select name="modeRender">
            <option value="fast" ${st.modeRender === "fast" ? "selected" : ""}>Fast (hemat)</option>
            <option value="quality" ${st.modeRender === "quality" ? "selected" : ""}>Quality</option>
          </select>
        </label>
        <label class="field"><span>Durasi per klip (detik)</span><input type="number" min="1" name="durasiKlip" value="${st.durasiKlip}" /></label>
      </div>
      <label class="check"><input type="checkbox" name="otomatis" ${st.otomatis ? "checked" : ""} /> Lanjut otomatis antar tahap AI</label>
      <label class="check"><input type="checkbox" name="subtitle" ${st.subtitle ? "checked" : ""} /> Tempel subtitle ke video</label>
      <p class="hint">Cek angka biaya di Google Flow karena bisa berubah. Kalau "lanjut otomatis" mati, tiap tahap menunggu persetujuanmu.</p>
      <button class="btn" type="submit">Simpan pengaturan</button>
    </form>
  </details>`;
}

function renderTeam(): string {
  return `
  <section class="card">
    <h2>Tim</h2>
    <ul class="team-list">
      ${TEAM.map(
        (m) => `
        <li><button class="team-row" data-action="member" data-id="${m.id}">
          <span class="swatch" style="background:${m.look.shirt}"></span>
          <span><strong>${esc(m.nama)}</strong> · ${esc(m.role)}</span>
        </button></li>`,
      ).join("")}
    </ul>
  </section>`;
}

function renderMember(id: string, s: UiState): string {
  const m = memberById(id);
  if (!m) return renderList(s);
  const kerjaan = [...s.projects.values()].filter((p) => m.stages.includes(p.tahap) && p.status !== "selesai");
  const log = [...s.projects.values()]
    .flatMap((p) => p.log.filter((l) => l.oleh === m.nama).map((l) => ({ ...l, p })))
    .sort((a, b) => b.waktu.localeCompare(a.waktu))
    .slice(0, 12);
  return `
  <div class="crumbs"><button class="link" data-action="kembali">← Semua proyek</button></div>
  <section class="card">
    <div class="member-head">
      <span class="swatch swatch-lg" style="background:${m.look.shirt}"></span>
      <div><h2>${esc(m.nama)}</h2><p class="role">${esc(m.role)}</p></div>
    </div>
    <p>${esc(m.tugas)}</p>
  </section>
  <section class="card">
    <h3>Sedang dipegang</h3>
    ${
      kerjaan.length
        ? `<ul class="project-list">${kerjaan
            .map((p) => `<li><button class="project-row" data-action="buka" data-id="${p.id}"><span class="project-title">${esc(judulProyek(p))}</span>${badge(p)}</button></li>`)
            .join("")}</ul>`
        : `<p class="empty">${m.id === "produser" ? "Ratna mengawasi semua proyek." : "Tidak ada kerjaan. Waktunya ngopi."}</p>`
    }
  </section>
  <section class="card">
    <h3>Catatan kerja</h3>
    ${log.length ? `<ul class="log">${log.map((l) => `<li><time>${waktu(l.waktu)}</time> ${esc(l.pesan)}</li>`).join("")}</ul>` : `<p class="empty">Belum ada catatan.</p>`}
  </section>`;
}

function stepper(p: Project): string {
  const idx = STAGES.findIndex((x) => x.id === p.tahap);
  return `<ol class="stepper">${STAGES.map((st, i) => {
    const cls = i < idx || p.status === "selesai" ? "done" : i === idx ? `now now-${p.status}` : "";
    return `<li class="${cls}" title="${esc(st.nama)} — ${esc(memberForStage(st.id).nama)}"><span>${i + 1}</span><em>${esc(st.pendek)}</em></li>`;
  }).join("")}</ol>`;
}

function aksi(p: Project, s: UiState): string {
  const m = memberForStage(p.tahap);
  const tahapNama = STAGES.find((x) => x.id === p.tahap)?.nama;
  if (p.status === "jalan") return `<div class="callout">${esc(m.nama)} sedang mengerjakan <strong>${esc(tahapNama)}</strong>…</div>`;
  if (p.status === "antre") return `<div class="callout">Menunggu ${esc(m.nama)} (${esc(tahapNama)}).</div>`;
  if (p.status === "gagal")
    return `<div class="callout callout-bad"><strong>${esc(tahapNama)} gagal:</strong> ${esc(p.galat)}
      <div class="row"><button class="btn" data-action="ulang" data-tahap="${p.tahap}">Coba lagi</button></div></div>`;
  if (p.status === "selesai")
    return `<div class="callout callout-ok">Proyek selesai. Lihat saran Yoga di bawah untuk video berikutnya.</div>`;
  const petunjuk = PETUNJUK[p.tahap]?.(p, s) ?? `Cek hasil ${esc(tahapNama)}, sunting bila perlu, lalu lanjutkan.`;
  return `<div class="callout callout-you">
    <strong>Giliranmu:</strong> ${petunjuk}
    <div class="row"><button class="btn btn-primary" data-action="lanjut">Setujui & lanjut</button></div>
  </div>`;
}

export const PETUNJUK: Partial<Record<Project["tahap"], (p: Project, s: UiState) => string>> = {
  paket: () => "Cek judul, caption, dan hashtag dari Putri di bawah. Sunting bila perlu, simpan, lalu setujui.",
  unggah: () => "Hubungkan akun lalu unggah ke platform pilihanmu di bagian Unggah. Setelah minimal satu tayang, lanjutkan ke Analisis.",
  render: (p, s) => {
    const sisa = s.settings.kreditBulanan - s.settings.kreditTerpakai;
    return `Buka <a href="https://labs.google/fx/tools/flow" target="_blank" rel="noopener">Google Flow</a>, salin prompt tiap adegan, render (mode ${p.kredit?.mode === "quality" ? "Quality" : "Fast"}), lalu unggah klipnya di bawah. Estimasi <strong>${p.kredit?.total ?? 0}</strong> kredit, sisa ${sisa}.
      <span class="sub">Sudah edit sendiri? <label class="link file-link">Unggah video final<input type="file" accept="video/*" data-upload="video" /></label> dan lewati Nanda.</span>`;
  },
};

function sectionRiset(p: Project) {
  const r = p.riset;
  if (!r) return "";
  return `<details class="card" open><summary><h3>Riset · Dimas</h3>${ulangBtn("riset")}</summary>
    <p><strong>${esc(r.sudut)}</strong></p>
    <p class="muted">${esc(r.alasan)}</p>
    <ul class="bullets">${r.fakta.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
    <p class="tags">${r.kataKunci.map((k) => `<span>${esc(k)}</span>`).join("")}</p>
  </details>`;
}

function sectionNaskah(p: Project) {
  const n = p.naskah;
  if (!n) return "";
  return `<details class="card" open><summary><h3>Naskah · Sari</h3>${ulangBtn("naskah")}</summary>
    <div class="stack" data-edit="naskah">
      <label class="field"><span>Judul kerja</span><input data-f="judulKerja" value="${esc(n.judulKerja)}" /></label>
      <label class="field"><span>Hook</span><textarea data-f="hook" rows="2">${esc(n.hook)}</textarea></label>
      <label class="field"><span>Narasi</span><textarea data-f="narasi" rows="6">${esc(n.narasi)}</textarea></label>
      <label class="field"><span>Ajakan (CTA)</span><input data-f="cta" value="${esc(n.cta)}" /></label>
      <div class="row"><button class="btn btn-sm" data-action="simpan-naskah">Simpan naskah</button></div>
    </div>
  </details>`;
}

const urutan = (t: Project["tahap"]) => STAGES.findIndex((x) => x.id === t);
const bolehUnggahKlip = (p: Project) => urutan(p.tahap) >= urutan("render") && urutan(p.tahap) <= urutan("edit") && p.status !== "jalan";

function sectionVideo(p: Project) {
  const v = p.video;
  if (!v) return "";
  const src = `/media/${p.id}/${encodeURIComponent(v.file)}?v=${encodeURIComponent(v.dibuat)}`;
  return `<section class="card"><h3>Video final · Nanda</h3>
    <video class="preview" controls preload="metadata" src="${src}"></video>
    <p class="muted">${Math.round(v.durasi)} detik · 1080×1920</p>
    <div class="row">
      <a class="btn btn-sm" href="${src}" download>Unduh video</a>
      ${v.subtitle ? `<a class="btn btn-sm" href="/media/${p.id}/${v.subtitle}" download>Unduh subtitle (.srt)</a>` : ""}
      ${p.adegan?.every((a) => a.klip) ? ulangBtn("edit").replace("Ulangi", "Render ulang") : ""}
    </div>
  </section>`;
}

const NAMA_PLATFORM: Record<Platform, string> = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram" };

function sectionPaket(p: Project) {
  const k = p.paket;
  if (!k) return "";
  return `<details class="card" open><summary><h3>Judul & caption · Putri</h3>${ulangBtn("paket")}</summary>
    <div class="stack" data-edit="paket">
      <p class="eyebrow">YouTube Shorts</p>
      <label class="field"><span>Judul <em class="counter" data-max="100"></em></span><input data-f="youtube.judul" maxlength="100" value="${esc(k.youtube.judul)}" /></label>
      <label class="field"><span>Deskripsi</span><textarea data-f="youtube.deskripsi" rows="6">${esc(k.youtube.deskripsi)}</textarea></label>
      <label class="field"><span>Tag (pisah koma)</span><input data-f="youtube.tags" value="${esc(k.youtube.tags.join(", "))}" /></label>
      <p class="eyebrow">TikTok</p>
      <label class="field"><span>Caption <em class="counter" data-max="2200"></em></span><textarea data-f="tiktok.caption" rows="3">${esc(k.tiktok.caption)}</textarea></label>
      <p class="eyebrow">Instagram Reels</p>
      <label class="field"><span>Caption <em class="counter" data-max="2200"></em></span><textarea data-f="instagram.caption" rows="5">${esc(k.instagram.caption)}</textarea></label>
      <div class="row">
        <button class="btn btn-sm" data-action="simpan-paket">Simpan caption</button>
        <button class="btn btn-sm btn-ghost" data-action="salin-caption" data-p="tiktok">Salin caption TikTok</button>
        <button class="btn btn-sm btn-ghost" data-action="salin-caption" data-p="instagram">Salin caption IG</button>
      </div>
    </div>
  </details>`;
}

function sectionUnggah(p: Project, s: UiState) {
  if (!p.paket || !p.video || urutan(p.tahap) < urutan("unggah")) return "";
  const kartu = (Object.keys(NAMA_PLATFORM) as Platform[])
    .filter((k) => s.platform[k])
    .map((k) => {
      const st = s.platform[k];
      const riwayat = p.unggahan.filter((u) => u.platform === k);
      const proses = riwayat.some((u) => u.status === "proses");
      const status = st.siap
        ? `<span class="ok">Terhubung${st.akun ? `: ${esc(st.akun)}` : ""}</span>`
        : st.catatan
          ? `<span class="muted">${esc(st.catatan)}</span>`
          : `<span class="muted">Belum terhubung</span>`;
      const tombolAkun = st.perluLogin && !st.catatan
        ? st.siap
          ? `<button class="btn btn-sm btn-ghost" data-action="putus" data-p="${k}">Putuskan</button>`
          : `<a class="btn btn-sm" href="/api/oauth/${k}">Hubungkan ${NAMA_PLATFORM[k]}</a>`
        : "";
      const opsi = k === "youtube"
        ? `<select data-opsi="privasi" aria-label="Privasi YouTube">
             <option value="private">Privat</option><option value="unlisted">Tidak publik</option><option value="public">Publik</option>
           </select>`
        : k === "tiktok"
          ? `<select data-opsi="privasi" aria-label="Privasi TikTok">
               <option value="SELF_ONLY">Hanya saya</option><option value="PUBLIC_TO_EVERYONE">Publik</option><option value="MUTUAL_FOLLOW_FRIENDS">Teman</option>
             </select>`
          : "";
      return `<div class="platform" data-platform="${k}">
        <div class="platform-head"><strong>${NAMA_PLATFORM[k]}</strong>${status}</div>
        <div class="row">${tombolAkun}
          ${st.siap ? `${opsi}<button class="btn btn-sm btn-primary" data-action="unggah" data-p="${k}" ${proses ? "disabled" : ""}>${proses ? "Mengunggah..." : `Unggah ke ${NAMA_PLATFORM[k]}`}</button>` : ""}
        </div>
        ${riwayat.length ? `<ul class="log">${riwayat
          .map((u) => `<li><time>${waktu(u.waktu)}</time> <span class="st-${u.status}">${u.status}</span> ${u.url ? `<a href="${esc(u.url)}" target="_blank" rel="noopener">${esc(u.url)}</a>` : ""} ${u.pesan ? esc(u.pesan) : ""}</li>`)
          .join("")}</ul>` : ""}
      </div>`;
    })
    .join("");
  return `<section class="card"><h3>Unggah · Putri</h3>
    <p class="hint">Video ditandai sebagai konten AI. Mulai dari privat dulu, cek di aplikasinya, baru publikasikan.</p>
    <div class="stack">${kartu}</div>
  </section>`;
}

const angka = (n: number) => n.toLocaleString("id-ID");

function sectionAnalisis(p: Project) {
  if (urutan(p.tahap) < urutan("analisis")) return "";
  const a = p.analisis;
  const st = p.statistik;
  const tot = st.reduce((acc, x) => ({ v: acc.v + x.views, l: acc.l + x.likes, k: acc.k + x.komentar }), { v: 0, l: 0, k: 0 });
  return `<section class="card"><h3>Analisis · Yoga</h3>
    ${
      st.length
        ? `<table class="stats"><thead><tr><th>Platform</th><th>Views</th><th>Like</th><th>Komentar</th></tr></thead><tbody>
          ${st.map((x) => `<tr><td>${NAMA_PLATFORM[x.platform]}</td><td>${angka(x.views)}</td><td>${angka(x.likes)}</td><td>${angka(x.komentar)}</td></tr>`).join("")}
          <tr class="total"><td>Total</td><td>${angka(tot.v)}</td><td>${angka(tot.l)}</td><td>${angka(tot.k)}</td></tr>
        </tbody></table>
        <p class="hint">Diambil ${waktu(st[0].diambil)}</p>`
        : `<p class="empty">Belum ada statistik.</p>`
    }
    ${a ? `<p>${esc(a.ringkasan)}</p><p class="eyebrow">Saran</p><ul class="bullets">${a.saran.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    <div class="row">${p.status !== "jalan" ? ulangBtn("analisis").replace("Ulangi", "Tarik ulang & analisis") : ""}</div>
    <details class="manual"><summary>Isi angka manual</summary>
      <form id="form-statistik" class="manual-form">
        <select name="platform" aria-label="Platform">
          <option value="youtube">YouTube</option><option value="tiktok">TikTok</option><option value="instagram">Instagram</option>
        </select>
        <input name="views" type="number" min="0" placeholder="Views" aria-label="Views" />
        <input name="likes" type="number" min="0" placeholder="Like" aria-label="Like" />
        <input name="komentar" type="number" min="0" placeholder="Komentar" aria-label="Komentar" />
        <button class="btn btn-sm" type="submit">Simpan</button>
      </form>
    </details>
  </section>`;
}

function peringatan(prompt: string) {
  const w = cekKebijakan(prompt);
  return w.length
    ? `<div class="warn" role="note"><strong>Berisiko ditolak Flow:</strong><ul>${w.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>Sunting prompt ini dulu sebelum render.</div>`
    : "";
}

function sectionAdegan(p: Project) {
  if (!p.adegan?.length) return "";
  return `<details class="card" open><summary><h3>Adegan & prompt Veo · Bayu</h3>${ulangBtn("storyboard")}</summary>
    <ol class="scenes">${p.adegan
      .map(
        (a) => `
      <li class="scene" data-no="${a.no}">
        <div class="scene-head"><strong>Adegan ${a.no}</strong><span class="muted">${a.durasi} dtk</span>${a.klip ? `<span class="badge badge-selesai">Klip ada</span>` : ""}</div>
        <p class="muted">${esc(a.visual)}</p>
        <p class="narasi">“${esc(a.narasi)}”</p>
        ${peringatan(a.prompt)}
        <label class="field"><span>Prompt</span><textarea data-f="prompt" rows="4">${esc(a.prompt)}</textarea></label>
        <div class="row">
          <button class="btn btn-sm" data-action="salin" data-no="${a.no}">Salin prompt</button>
          ${
            bolehUnggahKlip(p)
              ? `<label class="btn btn-sm file-btn">${a.klip ? "Ganti klip" : "Unggah klip"}<input type="file" accept="video/*" data-upload="klip" data-no="${a.no}" /></label>`
              : ""
          }
          ${a.klip ? `<a class="link" href="/media/${p.id}/${encodeURIComponent(a.klip)}" target="_blank" rel="noopener">Lihat</a>` : ""}
        </div>
      </li>`,
      )
      .join("")}</ol>
    <div class="row"><button class="btn btn-sm" data-action="salin-semua">Salin semua prompt</button><button class="btn btn-sm" data-action="simpan-adegan">Simpan prompt</button></div>
  </details>`;
}

function sectionKredit(p: Project, s: UiState) {
  const k = p.kredit;
  if (!k) return "";
  const sisa = s.settings.kreditBulanan - s.settings.kreditTerpakai;
  return `<section class="card"><h3>Kredit Flow · Hadi</h3>
    <dl class="kv">
      <dt>Mode</dt><dd>${k.mode === "fast" ? "Fast" : "Quality"}</dd>
      <dt>Klip</dt><dd>${k.jumlahKlip} × ${k.perKlip}</dd>
      <dt>Total</dt><dd><strong>${k.total}</strong> kredit ${k.dicatat ? "(sudah dicatat)" : ""}</dd>
      <dt>Sisa bulan ini</dt><dd class="${sisa < k.total && !k.dicatat ? "bad" : ""}">${sisa}</dd>
    </dl></section>`;
}

function sectionLog(p: Project) {
  return `<details class="card"><summary><h3>Riwayat</h3></summary>
    <ul class="log">${[...p.log]
      .reverse()
      .map((l) => `<li><time>${waktu(l.waktu)}</time> <strong>${esc(l.oleh)}</strong> ${esc(l.pesan)}</li>`)
      .join("")}</ul></details>`;
}

const ulangBtn = (tahap: string) =>
  `<button class="btn btn-ghost btn-sm" data-action="ulang" data-tahap="${tahap}" title="Minta karyawan mengerjakan ulang">Ulangi</button>`;

function renderProject(p: Project, s: UiState): string {
  return `
  <div class="crumbs"><button class="link" data-action="kembali">← Semua proyek</button>
    <button class="link link-bad" data-action="hapus">Hapus</button></div>
  <section class="card">
    <p class="eyebrow">${esc(FORMATS[p.format].nama)}</p>
    <h2>${esc(judulProyek(p))}</h2>
    <p class="muted">Dibuat ${waktu(p.dibuat)} ${badge(p)}</p>
    ${stepper(p)}
    ${aksi(p, s)}
  </section>
  ${sectionAnalisis(p)}
  ${sectionUnggah(p, s)}
  ${sectionPaket(p)}
  ${sectionVideo(p)}
  ${sectionKredit(p, s)}
  ${sectionAdegan(p)}
  ${sectionNaskah(p)}
  ${sectionRiset(p)}
  ${sectionLog(p)}`;
}
