import { TEAM, memberById, memberForStage } from "../shared/team.ts";
import { cekKebijakan } from "../shared/kebijakan.ts";
import { promptGambar } from "../shared/karakter.ts";
import { FORMATS, GAYA, STAGES, type Platform, type Project, type Settings } from "../shared/types.ts";

export type View = { kind: "list" } | { kind: "project"; id: string } | { kind: "member"; id: string };

export interface UiState {
  projects: Map<string, Project>;
  settings: Settings;
  ai: string;
  platform: Record<string, { siap: boolean; akun?: string; catatan?: string; perluLogin: boolean }>;
  suara: { id: string; ket: string }[];
  suaraLokal: { id: string; ket: string }[];
  voxcpm: boolean;
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
      <fieldset class="gaya-pilih">
        <legend>Gaya visual</legend>
        ${Object.entries(GAYA)
          .map(
            ([id, g], i) => `<label class="gaya-opt" title="${esc(g.ringkas)}">
              <input type="radio" name="gaya" value="${id}" ${i === 0 ? "checked" : ""} /><span>${esc(g.nama)}</span></label>`,
          )
          .join("")}
      </fieldset>
      <fieldset class="gaya-pilih">
        <legend>Sumber visual</legend>
        <label class="gaya-opt" title="Satu gambar diam per adegan dari aplikasi Gemini, digerakkan oleh React (Remotion). Tanpa kredit Flow.">
          <input type="radio" name="sumberVisual" value="ilustrasi" checked /><span>Ilustrasi + gerak</span></label>
        <label class="gaya-opt" title="Klip video dari Google Flow (Veo). Memakai kredit Flow.">
          <input type="radio" name="sumberVisual" value="flow" /><span>Klip Google Flow</span></label>
      </fieldset>
      <label class="field">
        <span>Jumlah part (cerita utuh, nanti dipecah jadi beberapa video)</span>
        <select name="rencanaPart">
          <option value="1">1 video</option>
          <option value="2">2 part</option>
          <option value="3">3 part</option>
          <option value="4">4 part</option>
          <option value="5">5 part</option>
        </select>
      </label>
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
      <label class="check"><input type="checkbox" name="narasiTts" ${st.narasiTts ? "checked" : ""} /> Narasi suara dari Gemini TTS (suara konsisten, prompt Veo tanpa dialog)</label>
      <label class="field"><span>Gambar adegan (mode Ilustrasi)</span>
        <select name="mesinGambar">
          <option value="otomatis" ${st.mesinGambar === "otomatis" ? "selected" : ""}>Otomatis (Flux via Pollinations, gratis)</option>
          <option value="manual" ${st.mesinGambar === "manual" ? "selected" : ""}>Manual di aplikasi Gemini (kualitas terbaik)</option>
        </select>
      </label>
      <label class="check"><input type="checkbox" name="efekSuara" ${st.efekSuara ? "checked" : ""} /> Efek suara per format (horor: suara lebih berat & bergema + dengung latar mencekam)</label>
      <label class="field"><span>Mesin suara narasi</span>
        <select name="mesinSuara">
          <option value="voxcpm" ${st.mesinSuara === "voxcpm" ? "selected" : ""}>Gratis tanpa kuota (Edge TTS cepat / VoxCPM lokal)${s.voxcpm ? "" : " — belum terpasang"}</option>
          <option value="gemini" ${st.mesinSuara === "gemini" ? "selected" : ""}>Gemini TTS (cepat, kuota harian)</option>
        </select>
      </label>
      <label class="field"><span>Volume suara asli klip saat ada narasi (%)</span><input type="number" min="0" max="100" name="volumeKlip" value="${Math.round(st.volumeKlip * 100)}" /></label>
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
  if (p.status === "selesai" && p.dipecahMenjadi?.length)
    return `<div class="callout callout-ok">Video sudah dipecah menjadi ${p.dipecahMenjadi.length} part. Lanjutkan caption & unggah di proyek tiap part:
      <div class="row">${p.dipecahMenjadi
        .map((id, i) => (s.projects.has(id) ? `<button class="btn btn-sm" data-action="buka" data-id="${id}">Buka Part ${i + 1}</button>` : ""))
        .join("")}</div></div>`;
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
    if (p.sumberVisual === "ilustrasi" && s.settings.mesinGambar === "otomatis") {
      const ada = p.adegan?.filter((a) => a.klip).length ?? 0;
      return `Bayu sedang menggambar otomatis (${ada}/${p.adegan?.length ?? 0} selesai). Setelah semua jadi, video dirakit sendiri. Kalau ada gambar yang kurang pas, klik <strong>Gambar ulang</strong> atau seret gambarmu sendiri ke adegan itu.
        <div class="row"><button class="btn btn-sm" data-action="gambar-semua">Lanjutkan menggambar</button></div>`;
    }
    if (p.sumberVisual === "ilustrasi") {
      return `Buka <a href="https://gemini.google.com/app" target="_blank" rel="noopener">aplikasi Gemini</a>, salin prompt gambar tiap adegan (tombol <strong>Salin prompt</strong>), unduh gambarnya berurutan, lalu seret semua gambar ke kotak di bagian Adegan. Tidak memakai kredit Flow.`;
    }
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
  if (n.part?.length) {
    return `<details class="card" open><summary><h3>Naskah utuh · Sari</h3>${ulangBtn("naskah")}</summary>
    <div class="stack" data-edit="naskah-part">
      <label class="field"><span>Judul cerita</span><input data-f="judulKerja" value="${esc(n.judulKerja)}" /></label>
      ${n.part
        .map(
          (b, i) => `<fieldset class="part-box" data-part="${i}">
          <legend>Part ${i + 1}${i === n.part!.length - 1 ? " (tamat)" : ""}</legend>
          <label class="field"><span>Hook</span><textarea data-p="hook" rows="2">${esc(b.hook)}</textarea></label>
          <label class="field"><span>Narasi</span><textarea data-p="narasi" rows="5">${esc(b.narasi)}</textarea></label>
          <label class="field"><span>Ajakan (CTA)</span><input data-p="cta" value="${esc(b.cta)}" /></label>
        </fieldset>`,
        )
        .join("")}
      <div class="row"><button class="btn btn-sm" data-action="simpan-naskah-part">Simpan naskah</button></div>
    </div>
  </details>`;
  }
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
               <option value="DRAFT">Kirim ke draft TikTok (posting dari aplikasi)</option><option value="SELF_ONLY">Langsung, hanya saya</option><option value="PUBLIC_TO_EVERYONE">Langsung, publik</option><option value="MUTUAL_FOLLOW_FRIENDS">Langsung, teman</option>
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

const SUARA_BAWAAN = (p: Project) => p.suara ?? FORMATS[p.format].suara;

function sectionSuara(p: Project, s: UiState) {
  if (!s.settings.narasiTts || !p.adegan?.length) return "";
  const lokal = s.settings.mesinSuara === "voxcpm" && s.voxcpm;
  const bawaanLokal: Record<Project["format"], string> = { "cerita-horor": "edge-ardi", "pov-sejarah": "edge-ardi", "vlog-hewan": "edge-ardi" };
  const now = lokal ? (p.suaraLokal ?? bawaanLokal[p.format]) : SUARA_BAWAAN(p);
  const daftar = lokal ? s.suaraLokal : s.suara;
  return `<section class="card"><h3>Suara narasi · Nanda</h3>
    ${
      lokal
        ? `<p class="hint">Tanpa kuota. Suara "cepat" (Ardi/Gadis, Edge TTS) jadi dalam beberapa detik per kalimat dan butuh internet. Suara "VoxCPM" dibuat di laptopmu, sekitar 1–2 menit per kalimat.</p>
           <p class="hint">Satu suara dipakai untuk semua adegan dan part supaya konsisten.</p>`
        : `<p class="hint">Satu suara dipakai untuk semua adegan. Nanda membacakan seluruh narasi sekaligus dengan Gemini TTS saat mengedit, lalu memotongnya per adegan.</p>
           <p class="hint">Kuota gratis Gemini TTS sekitar 10 permintaan/hari per model. Satu video memakai 1 permintaan, "Dengar contoh" juga 1.</p>`
    }
    <div class="row">
      <label class="gaya-ganti">Suara
        <select data-action-change="ganti-suara" data-lokal="${lokal ? "1" : ""}" aria-label="Pilih suara narasi">
          ${daftar.map((v) => `<option value="${v.id}" ${v.id === now ? "selected" : ""}>${lokal ? esc(v.ket) : `${esc(v.id)} · ${esc(v.ket)}`}</option>`).join("")}
        </select>
      </label>
      <button class="btn btn-sm" data-action="contoh-suara">Dengar contoh</button>
    </div>
    <audio class="contoh-suara" controls hidden></audio>
    ${p.video ? `<p class="hint">Sudah ganti suara? Klik "Render ulang" di bagian Video final.</p>` : ""}
  </section>`;
}

function sectionAdegan(p: Project) {
  if (!p.adegan?.length) return "";
  const gayaNow = p.gaya ?? "sinematik";
  const gantiGaya = p.status === "jalan"
    ? ""
    : `<label class="gaya-ganti">Gaya visual
        <select data-action-change="ganti-gaya" aria-label="Ganti gaya visual">
          ${Object.entries(GAYA).map(([id, g]) => `<option value="${id}" ${id === gayaNow ? "selected" : ""}>${esc(g.nama)}</option>`).join("")}
        </select></label>`;
  const zonaSemua = bolehUnggahKlip(p)
    ? `<div class="dropzone" data-drop="semua" tabindex="0">
        <strong>${p.sumberVisual === "ilustrasi" ? "Seret semua gambar (atau ZIP-nya) ke sini" : 'Seret ZIP "download proyek" Flow atau semua klip ke sini'}</strong>
        <span>Tiap file dipasangkan ke adegan lewat angka di nama file, kemiripan nama dengan prompt, lalu urutan waktu dibuat/diunduh. Hasilnya bisa dicek dan ditukar di bawah.</span>
        <label class="btn btn-sm file-btn">atau pilih file<input type="file" accept="video/*,image/*,.zip,application/zip" multiple data-upload="semua" /></label>
      </div>
      <div data-pencocokan></div>`
    : "";
  return `<details class="card" open><summary><h3>Adegan & prompt Veo · Bayu</h3>${ulangBtn("storyboard")}</summary>
    ${gantiGaya}
    ${zonaSemua}
    <ol class="scenes">${p.adegan
      .map(
        (a) => `
      ${a.part && a.part !== p.adegan![p.adegan!.indexOf(a) - 1]?.part ? `<li class="part-judul">Part ${a.part}</li>` : ""}
      <li class="scene${bolehUnggahKlip(p) ? " droppable" : ""}" data-no="${a.no}" ${bolehUnggahKlip(p) ? `data-drop="klip"` : ""}>
        <div class="scene-head"><strong>Adegan ${a.no}</strong><span class="muted">${a.durasi} dtk</span>${a.klip ? `<span class="badge badge-selesai">Klip ada</span>` : ""}</div>
        <p class="muted">${esc(a.visual)}</p>
        <p class="narasi">“${esc(a.narasi)}”</p>
        ${a.gerak ? `<p class="tags"><span>🎥 ${esc(a.gerak.kamera)}</span>${a.gerak.efek.map((e) => `<span>✨ ${esc(e)}</span>`).join("")}</p>` : ""}
        ${peringatan(a.prompt)}
        <label class="field"><span>Prompt</span><textarea data-f="prompt" rows="4">${esc(a.prompt)}</textarea></label>
        <div class="row">
          <button class="btn btn-sm" data-action="salin" data-no="${a.no}">Salin prompt</button>
          ${p.sumberVisual === "ilustrasi" && bolehUnggahKlip(p) ? `<button class="btn btn-sm" data-action="gambar-ulang" data-no="${a.no}">${a.klip ? "Gambar ulang" : "Gambar otomatis"}</button>` : ""}
          ${
            bolehUnggahKlip(p)
              ? `<label class="btn btn-sm file-btn">${a.klip ? "Ganti" : p.sumberVisual === "ilustrasi" ? "Unggah gambar" : "Unggah klip"}<input type="file" accept="video/*,image/*" data-upload="klip" data-no="${a.no}" /></label><span class="hint">atau seret file ke kartu ini</span>`
              : ""
          }
        </div>
        ${
          a.klip
            ? `<div class="klip-mini">
                ${
                  /\.(png|jpe?g|webp)$/i.test(a.klip)
                    ? `<img src="/media/${p.id}/${encodeURIComponent(a.klip)}" alt="Gambar adegan ${a.no}" loading="lazy" />`
                    : `<video src="/media/${p.id}/${encodeURIComponent(a.klip)}#t=1" muted playsinline preload="metadata" controls></video>`
                }
                ${
                  bolehUnggahKlip(p) && p.adegan!.length > 1
                    ? `<div class="tukar">
                        <select data-tukar aria-label="Tukar klip dengan adegan">
                          <option value="">Tukar dengan…</option>
                          ${p.adegan!.filter((b) => b.no !== a.no).map((b) => `<option value="${b.no}">Adegan ${b.no}</option>`).join("")}
                        </select>
                        <button class="btn btn-sm" data-action="tukar-klip" data-no="${a.no}">Tukar</button>
                      </div>`
                    : ""
                }
              </div>`
            : ""
        }
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

function sectionKarakter(p: Project) {
  if (!p.adegan?.length && !p.karakter?.length) return "";
  const daftar = p.karakter ?? [];
  if (!daftar.length) {
    return `<section class="card"><h3>Karakter · Bayu</h3>
      <p class="muted">Proyek ini belum punya lembar karakter, jadi wajah tokoh bisa berubah-ubah antar klip.</p>
      <div class="row"><button class="btn btn-sm btn-primary" data-action="ekstrak-karakter">Buat lembar karakter dari prompt</button></div>
      <p class="hint">Bayu menyusun deskripsi tokoh yang lengkap dari prompt yang ada. Part berikutnya akan mewarisinya.</p>
    </section>`;
  }
  return `<details class="card" open><summary><h3>Karakter · Bayu</h3></summary>
    <p class="hint">Deskripsi ini ditempel persis sama ke setiap prompt dan diwariskan ke part berikutnya.</p>
    <ol class="karakter-list">${daftar
      .map(
        (k, i) => `<li class="karakter" data-i="${i}">
        <label class="field"><span>Nama</span><input data-k="nama" value="${esc(k.nama)}" maxlength="40" /></label>
        <label class="field"><span>Deskripsi tetap</span><textarea data-k="deskripsi" rows="4">${esc(k.deskripsi)}</textarea></label>
        ${peringatan(k.deskripsi)}
        <div class="row"><button class="btn btn-sm" data-action="salin-gambar-karakter" data-i="${i}" data-prompt="${esc(promptGambar(k, p.gaya))}">Salin prompt gambar referensi</button></div>
      </li>`,
      )
      .join("")}</ol>
    <div class="row"><button class="btn btn-sm" data-action="simpan-karakter">Simpan karakter</button></div>
    <details class="manual"><summary>Supaya wajahnya benar-benar sama di Flow</summary>
      <ol class="langkah">
        <li>Klik <strong>Salin prompt gambar referensi</strong>, lalu buat gambarnya di Flow (menu <strong>Karakter</strong>) atau di aplikasi Gemini.</li>
        <li>Simpan gambar itu sebagai <strong>Karakter</strong> di Flow dengan nama yang sama.</li>
        <li>Saat merender tiap adegan, pilih karakter itu sebagai referensi (bahan/ingredient) sebelum menempel prompt.</li>
        <li>Pakai karakter Flow yang sama untuk semua part cerita ini.</li>
      </ol>
    </details>
  </details>`;
}

function sectionSeri(p: Project, s: UiState) {
  if (!p.naskah || p.dipecahMenjadi?.length || p.naskah.part?.length) return "";
  const idSeri = p.seri?.id ?? p.id;
  const anggota = [...s.projects.values()]
    .filter((x) => (x.id === idSeri && !x.dipecahMenjadi?.length) || x.seri?.id === idSeri)
    .sort((a, b) => (a.seri?.part ?? 1) - (b.seri?.part ?? 1));
  const part = p.seri?.part ?? 1;
  const total = p.seri?.totalPart;
  const berikut = anggota.find((x) => x.seri?.sebelumnya.at(-1) === p.id);
  const tamat = total !== undefined && part >= total;

  const daftar =
    anggota.length > 1
      ? `<ol class="seri-list">${anggota
          .map(
            (x) => `<li>${
              x.id === p.id
                ? `<strong>Part ${x.seri?.part ?? 1}</strong> (sedang dibuka)`
                : `<button class="link" data-action="buka" data-id="${x.id}">Part ${x.seri?.part ?? 1}</button>`
            } ${badge(x)}</li>`,
          )
          .join("")}</ol>`
      : "";

  let aksiSeri: string;
  if (berikut) {
    aksiSeri = `<button class="btn btn-sm" data-action="buka" data-id="${berikut.id}">Buka Part ${part + 1}</button>`;
  } else if (tamat) {
    aksiSeri = `<p class="hint">Ini part terakhir. Ceritanya tamat di sini.</p>`;
  } else {
    const pilihan = Array.from({ length: 10 - part }, (_, i) => part + 1 + i)
      .map((n) => `<option value="${n}" ${n === (total ?? part + 1) ? "selected" : ""}>${n} part</option>`)
      .join("");
    aksiSeri = `<div class="row">
        ${total ? "" : `<label class="gaya-ganti">Cerita tamat di<select data-seri="total" aria-label="Jumlah part sampai tamat">${pilihan}</select></label>`}
        <button class="btn btn-sm btn-primary" data-action="buat-lanjutan">Buat Part ${part + 1}${total ? ` dari ${total}` : ""}</button>
      </div>
      <p class="hint">Sari melanjutkan dari akhir part ini. Tokoh, latar, gaya visual, dan suara narasi sama persis. Part terakhir ditulis sebagai penutup cerita.</p>`;
  }

  return `<section class="card"><h3>Cerita bersambung</h3>
    <p class="muted">${p.seri || anggota.length > 1 ? `Part ${part}${total ? ` dari ${total}` : ""}` : "Belum bersambung. Lanjutkan cerita ini ke part berikutnya?"}</p>
    ${daftar}
    ${aksiSeri}
  </section>`;
}

function renderProject(p: Project, s: UiState): string {
  return `
  <div class="crumbs"><button class="link" data-action="kembali">← Semua proyek</button>
    <span class="hapus-box"><button class="link link-bad" data-action="hapus">Hapus proyek</button></span></div>
  <section class="card">
    <p class="eyebrow">${esc(FORMATS[p.format].nama)} · ${esc(GAYA[p.gaya ?? "sinematik"].nama)}${p.seri ? ` · Part ${p.seri.part} dari ${p.seri.totalPart}` : ""}${p.sumberVisual === "ilustrasi" ? " · Ilustrasi" : ""}${p.naskah?.part?.length ? ` · Cerita utuh ${p.naskah.part.length} part` : p.rencanaPart ? ` · Rencana ${p.rencanaPart} part` : ""}</p>
    <h2>${esc(judulProyek(p))}</h2>
    <p class="muted">Dibuat ${waktu(p.dibuat)} ${badge(p)}</p>
    ${stepper(p)}
    ${aksi(p, s)}
  </section>
  ${sectionAnalisis(p)}
  ${sectionUnggah(p, s)}
  ${sectionSeri(p, s)}
  ${sectionPaket(p)}
  ${sectionVideo(p)}
  ${sectionSuara(p, s)}
  ${sectionKarakter(p)}
  ${sectionKredit(p, s)}
  ${sectionAdegan(p)}
  ${sectionNaskah(p)}
  ${sectionRiset(p)}
  ${sectionLog(p)}`;
}
