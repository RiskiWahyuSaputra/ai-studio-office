import { OWNER, SEKRETARIS, TEAM, type Member } from "../shared/team.ts";
import {
  drawBookshelf,
  drawBossChair,
  drawBossDesk,
  drawCat,
  drawChair,
  drawLamp,
  drawText,
  drawCoffeeMachine,
  drawDesk,
  drawPerson,
  drawPlant,
  drawServerRack,
  drawSofa,
} from "./sprites.ts";

const W = 480;
const H = 240;
const WALL = 58;
const SPEED = 42;
const LANE_X = 264;
const COFFEE = { x: 313, y: 100 };
const SOFA = { x: 322, y: 204 };
// ruang owner (Kiyu) di sisi kanan, dipisah dinding dengan pintu
const ROOM_X = 390;
const DOOR = { y1: 150, y2: 186 };
const OWNER_DESK: Desk = { x: 414, y: 120, seat: { x: 440, y: 118 }, frontY: 168 };
const LAIZA_DESK: Desk = { x: 424, y: 206, seat: { x: 442, y: 204 }, frontY: 168 };
const BOARD = { x: 202, y: 66 };
const OBROLAN_PACARAN = [
  ["Sayang, udah makan belum?", "Belum, abis approve ini", "Makan dulu, nanti aku bawain ya", "Siap, bu sekretaris 😄"],
  ["Jadwal kamu hari ini padat lho", "Ada kamu, jadi semangat", "Gombal ih 😳"],
  ["Video horornya serem banget", "Takut? Sini aku temenin", "Hmm, modus 😆"],
  ["Laporan tim udah aku rangkum", "Kamu memang paling bisa diandalkan", "Traktir es krim ya 🍦", "Deal ❤️"],
  ["Jangan begadang lagi ya", "Iya, janji", "Awas kalau bohong 😤", "Hehe, iya sayang"],
];
// ?demo di URL: kegiatan santai muncul jauh lebih sering (untuk melihat semua animasi)
const DEMO = typeof location !== "undefined" && new URLSearchParams(location.search).has("demo");
const JEDA = DEMO ? 0.08 : 1;

interface Pt { x: number; y: number }

interface Desk {
  x: number;
  y: number;
  seat: Pt;
  frontY: number;
}

type Step =
  | { kind: "walk"; to: Pt }
  | { kind: "wait"; ms: number }
  | { kind: "sit" }
  | { kind: "say"; text: string; ms: number }
  | { kind: "carry"; on: boolean }
  | { kind: "brew"; on: boolean }
  /** menunggu lawan bicara (diatur oleh percakapan) */
  | { kind: "hold" }
  | { kind: "face"; dir: 1 | -1 }
  | { kind: "pose"; armsUp?: boolean; watering?: boolean }
  | { kind: "fx"; jenis: Partikel["jenis"]; dx?: number; dy?: number };

interface Partikel {
  jenis: "spark" | "heart" | "drop" | "confetti" | "z";
  x: number;
  y: number;
  vx: number;
  vy: number;
  hidup: number;
  umur: number;
  warna: string;
}

interface Obrolan {
  a: Actor;
  b: Actor;
  baris: string[];
  i: number;
  next: number;
  mulai: number;
  /** obrolan pasangan: muncul hati kecil */
  hati?: boolean;
}

const OBROLAN = [
  ["Udah lihat views video kemarin?", "Naik terus! Hook-nya kena", "Gas, bikin yang lebih serem"],
  ["Kopi atau teh?", "Kopi dong, lagi dikejar deadline", "Sama, hehe"],
  ["Aku punya ide horor baru", "Apa tuh?", "Hantu penunggu kantor ini 👻", "Hiii, jangan dong!"],
  ["Render-nya lama ya", "Sabar, lagi antre", "Ya udah, ngopi dulu"],
  ["Semalam nonton apa?", "Film horor, gak bisa tidur", "Bisa jadi konten tuh!"],
  ["Caption-nya pakai emoji?", "Boleh, biar rame", "Siap 👍"],
  ["Kucingnya tidur di sofa lagi", "Biarin, dia maskot kita", "Haha, iya"],
  ["Kiyu lagi cek proyek", "Semoga di-approve", "Pasti, naskahnya bagus"],
];
const TITIK_OBROL: Pt[] = [{ x: 300, y: 132 }, { x: 240, y: 148 }, { x: 130, y: 148 }, { x: 330, y: 228 }];
const TITIK_KUCING: Pt[] = [{ x: 240, y: 148 }, { x: 300, y: 132 }, { x: 150, y: 222 }, { x: 60, y: 148 }, { x: 330, y: 228 }, { x: 200, y: 222 }];
const SOFA_KUCING = { x: 312, y: 196 };
const TANAMAN: { berdiri: Pt; arah: 1 | -1 }[] = [
  { berdiri: { x: 356, y: 96 }, arah: 1 },
  { berdiri: { x: 262, y: 232 }, arah: 1 },
  { berdiri: { x: 22, y: 96 }, arah: -1 },
];

interface Actor {
  m: Member;
  desk: Desk;
  pos: Pt;
  facing: 1 | -1;
  sitting: boolean;
  working: boolean;
  carrying: boolean;
  armsUp: boolean;
  watering: boolean;
  walkT: number;
  steps: Step[];
  waitUntil: number;
  nextIdle: number;
  status: string;
  sayText: string;
  sayUntil: number;
  tag: HTMLElement;
  bubble: HTMLElement;
}

export interface Office {
  setWorking(id: string, working: boolean, status?: string): void;
  say(id: string, text: string, ms?: number): void;
  handoff(fromId: string, toId: string, label: string): void;
  /** semua yang senggang bersorak + konfeti */
  rayakan(teks?: string): void;
  /** anggota tim berjalan ke ruang Kiyu dan melapor */
  lapor(fromId: string, text: string): void;
  select(id: string | null): void;
  onSelect(cb: (id: string | null) => void): void;
  setBoard(columns: { label: string; count: number; color: string }[]): void;
}

function buildDesks(): Desk[] {
  const xs = [28, 92, 156, 220];
  const rows = [{ y: 92, frontY: 130 }, { y: 168, frontY: 206 }];
  const desks: Desk[] = [];
  for (const r of rows) {
    for (const x of xs) {
      desks.push({ x, y: r.y, seat: { x: x + 18, y: r.y - 2 }, frontY: r.frontY });
    }
  }
  return desks;
}

function pathBetween(from: Pt, fromFrontY: number, to: Pt, toFrontY: number): Pt[] {
  const pts: Pt[] = [{ x: from.x, y: fromFrontY }];
  if (fromFrontY !== toFrontY) {
    pts.push({ x: LANE_X, y: fromFrontY }, { x: LANE_X, y: toFrontY });
  }
  pts.push({ x: to.x, y: toFrontY }, { x: to.x, y: to.y });
  return pts;
}

export function createOffice(canvas: HTMLCanvasElement): Office {
  const ctx = canvas.getContext("2d")!;
  canvas.width = W;
  canvas.height = H;
  const host = canvas.parentElement!;
  const overlay = document.createElement("div");
  overlay.className = "office-overlay";
  host.appendChild(overlay);

  const desks = buildDesks();
  let board: { label: string; count: number; color: string }[] = [];
  let selected: string | null = null;
  let hovered: string | null = null;
  let selectCb: (id: string | null) => void = () => {};
  let brewing = 0;

  const actors: Actor[] = [...TEAM, OWNER, SEKRETARIS].map((m, i) => {
    const desk = m.id === OWNER.id ? OWNER_DESK : m.id === SEKRETARIS.id ? LAIZA_DESK : desks[i];
    const tag = document.createElement("button");
    tag.className = "name-tag";
    tag.type = "button";
    tag.innerHTML = `<strong>${m.nama}</strong><span>${m.role}</span>`;
    tag.addEventListener("click", () => api.select(m.id));
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    overlay.append(tag, bubble);
    return {
      m,
      desk,
      pos: { ...desk.seat },
      facing: 1,
      sitting: true,
      working: false,
      carrying: false,
      armsUp: false,
      watering: false,
      walkT: 0,
      steps: [],
      waitUntil: 0,
      nextIdle: performance.now() + (8000 + Math.random() * 25000) * JEDA,
      status: "",
      sayText: "",
      sayUntil: 0,
      tag,
      bubble,
    };
  });

  const byId = (id: string) => actors.find((a) => a.m.id === id);

  // --- partikel ---
  const partikel: Partikel[] = [];
  function semburkan(jenis: Partikel["jenis"], x: number, y: number, n = 6) {
    const warnaKonfeti = ["#7ee8b4", "#f2b33d", "#ef6b6b", "#6ab8f0", "#c58bf2", "#f4f0e2"];
    for (let i = 0; i < n; i++) {
      const p: Partikel = { jenis, x, y, vx: 0, vy: 0, hidup: 0, umur: 1.2, warna: "#fff" };
      if (jenis === "spark") Object.assign(p, { vx: (Math.random() - 0.5) * 50, vy: -20 - Math.random() * 30, umur: 0.7, warna: Math.random() < 0.5 ? "#f7d774" : "#fff7c2" });
      if (jenis === "heart") Object.assign(p, { x: x + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 6, vy: -14 - Math.random() * 6, umur: 1.6, warna: "#ef6b8f" });
      if (jenis === "drop") Object.assign(p, { x: x + Math.random() * 4, vx: 6 + Math.random() * 6, vy: 4, umur: 0.6, warna: "#8fd0f5" });
      if (jenis === "z") Object.assign(p, { vx: 4, vy: -8, umur: 2.2, warna: "#c8bfe0" });
      if (jenis === "confetti") Object.assign(p, { x: Math.random() * W, y: -4 - Math.random() * 30, vx: (Math.random() - 0.5) * 20, vy: 20 + Math.random() * 30, umur: 4, warna: warnaKonfeti[i % warnaKonfeti.length] });
      partikel.push(p);
    }
  }

  // --- kucing kantor ---
  const kucing = { pos: { x: 312, y: 196 }, tujuan: [] as Pt[], facing: 1 as 1 | -1, walkT: 0, tidur: true, diamSampai: performance.now() + 15000, zBerikut: 0 };
  function kucingJalanKe(t: Pt) {
    const diRuangOwner = (p: Pt) => p.x > ROOM_X;
    const pintu = { x: ROOM_X - 2, y: (DOOR.y1 + DOOR.y2) / 2 };
    kucing.tujuan = diRuangOwner(t) !== diRuangOwner(kucing.pos) ? [pintu, t] : [t];
    kucing.tidur = false;
  }
  function updateKucing(now: number, dt: number) {
    const t = kucing.tujuan[0];
    if (t) {
      const dx = t.x - kucing.pos.x;
      const dy = t.y - kucing.pos.y;
      const d = Math.hypot(dx, dy);
      const langkah = 18 * dt;
      if (d <= langkah) {
        kucing.pos = { ...t };
        kucing.tujuan.shift();
        if (!kucing.tujuan.length) {
          const diSofa = Math.abs(kucing.pos.x - SOFA_KUCING.x) < 2 && Math.abs(kucing.pos.y - SOFA_KUCING.y) < 2;
          kucing.tidur = diSofa;
          kucing.diamSampai = now + (diSofa ? 25000 : 6000) + Math.random() * 8000;
        }
      } else {
        kucing.pos.x += (dx / d) * langkah;
        kucing.pos.y += (dy / d) * langkah;
        if (Math.abs(dx) > 0.3) kucing.facing = dx > 0 ? 1 : -1;
        kucing.walkT += dt;
      }
      return;
    }
    if (kucing.tidur && now > kucing.zBerikut) {
      semburkan("z", kucing.pos.x + 3, kucing.pos.y - 8, 1);
      kucing.zBerikut = now + 1400;
    }
    if (now > kucing.diamSampai) {
      const r = Math.random();
      kucingJalanKe(r < 0.3 ? SOFA_KUCING : r < 0.4 ? { x: 430, y: 196 } : pick(TITIK_KUCING));
    }
  }

  // --- percakapan dua karyawan ---
  const obrolan: Obrolan[] = [];
  const senggang = (a: Actor) => !a.working && !a.steps.length && a.sitting && a.m.id !== OWNER.id;
  function planObrol(a: Actor): boolean {
    const calon = actors.filter((x) => x !== a && senggang(x));
    if (!calon.length) return false;
    const b = pick(calon);
    const titik = pick(TITIK_OBROL);
    a.steps = [];
    b.steps = [];
    goTo(a, { x: titik.x - 7, y: titik.y }, titik.y);
    goTo(b, { x: titik.x + 7, y: titik.y }, titik.y);
    a.steps.push({ kind: "face", dir: 1 }, { kind: "hold" });
    b.steps.push({ kind: "face", dir: -1 }, { kind: "hold" });
    returnToDesk(a, titik.y);
    returnToDesk(b, titik.y);
    obrolan.push({ a, b, baris: pick(OBROLAN), i: 0, next: 0, mulai: performance.now() });
    return true;
  }
  function updateObrolan(now: number) {
    for (let k = obrolan.length - 1; k >= 0; k--) {
      const o = obrolan[k];
      const lepas = () => {
        for (const x of [o.a, o.b]) if (x.steps[0]?.kind === "hold") x.steps.shift();
        obrolan.splice(k, 1);
      };
      // salah satu dipanggil kerja (langkahnya diganti) atau terlalu lama: bubarkan
      const batal = [o.a, o.b].some((x) => !x.steps.some((s) => s.kind === "hold")) || now - o.mulai > 40000;
      if (batal) {
        for (const x of [o.a, o.b]) {
          const i = x.steps.findIndex((s) => s.kind === "hold");
          if (i >= 0) x.steps.splice(i, 1);
        }
        obrolan.splice(k, 1);
        continue;
      }
      if (o.a.steps[0]?.kind !== "hold" || o.b.steps[0]?.kind !== "hold") continue;
      if (now < o.next) continue;
      if (o.i < o.baris.length) {
        const bicara = o.i % 2 === 0 ? o.a : o.b;
        bicara.sayText = o.baris[o.i];
        bicara.sayUntil = now + 2600;
        if (o.hati && o.i === o.baris.length - 1) semburkan("heart", (o.a.pos.x + o.b.pos.x) / 2, Math.min(o.a.pos.y, o.b.pos.y) - 20, 3);
        o.i++;
        o.next = now + 2800;
      } else {
        lepas();
      }
    }
  }

  /** Laiza: bawakan kopi untuk Kiyu, ngobrol berdua, atau catat papan kanban. */
  function planLaiza(a: Actor) {
    const kiyu = byId(OWNER.id)!;
    const dekatKiyu = { x: OWNER_DESK.seat.x + 16, y: OWNER_DESK.seat.y + 2 };
    const r = Math.random();
    a.steps = [];
    const kiyuDiMeja = kiyu.sitting && !kiyu.steps.length;
    if (r < 0.35 && kiyuDiMeja) {
      goTo(a, COFFEE, COFFEE.y);
      a.steps.push({ kind: "brew", on: true }, { kind: "wait", ms: 2400 }, { kind: "brew", on: false }, { kind: "carry", on: true });
      goTo(a, dekatKiyu, OWNER_DESK.frontY);
      a.steps.push({ kind: "face", dir: -1 }, { kind: "carry", on: false }, { kind: "say", text: "Kopi buat kamu ☕", ms: 2400 });
      a.steps.push({ kind: "fx", jenis: "heart", dx: -12, dy: -18 }, { kind: "wait", ms: 2600 });
      a.steps.push({ kind: "fx", jenis: "heart", dx: -8, dy: -20 });
      returnToDesk(a, OWNER_DESK.frontY);
      const jalan = (Math.abs(a.pos.x - COFFEE.x) * 2 + 200) / SPEED;
      setTimeout(() => {
        if (kiyu.sitting) api.say(OWNER.id, pick(["Makasih sayang ❤️", "Kamu terbaik 🥰", "Pas banget, ngantuk"]), 2600);
        else api.say(SEKRETARIS.id, "Kopinya aku taruh di meja ya 💌", 2600);
      }, (jalan + 6) * 1000);
    } else if (r < 0.7 && kiyuDiMeja) {
      goTo(a, dekatKiyu, OWNER_DESK.frontY);
      a.steps.push({ kind: "face", dir: -1 }, { kind: "hold" });
      returnToDesk(a, OWNER_DESK.frontY);
      kiyu.steps = [{ kind: "hold" }, { kind: "sit" }];
      obrolan.push({ a, b: kiyu, baris: pick(OBROLAN_PACARAN), i: 0, next: 0, mulai: performance.now(), hati: true });
    } else if (r < 0.85) {
      goTo(a, BOARD, BOARD.y);
      a.steps.push({ kind: "say", text: pick(["Aku catat ya 📝", "Agenda Kiyu aman", "Hmm, ini perlu dicek"]), ms: 2400 }, { kind: "wait", ms: 2600 });
      returnToDesk(a, BOARD.y);
    } else {
      planSiram(a);
    }
  }

  function planStretch(a: Actor) {
    a.steps = [];
    a.steps.push({ kind: "pose", armsUp: true }, { kind: "say", text: pick(["Hoaaam 🥱", "Pegel...", "Stretching dulu"]), ms: 2200 }, { kind: "wait", ms: 2200 }, { kind: "pose", armsUp: false }, { kind: "sit" });
  }

  function planSiram(a: Actor) {
    const tn = pick(TANAMAN);
    a.steps = [];
    goTo(a, tn.berdiri, tn.berdiri.y);
    a.steps.push({ kind: "face", dir: tn.arah }, { kind: "pose", watering: true });
    for (let i = 0; i < 4; i++) a.steps.push({ kind: "fx", jenis: "drop", dx: tn.arah * 9, dy: -6 }, { kind: "wait", ms: 600 });
    a.steps.push({ kind: "pose", watering: false }, { kind: "say", text: pick(["Segar 🌱", "Biar subur", "Minum dulu ya"]), ms: 2000 });
    returnToDesk(a, tn.berdiri.y);
  }

  function planElusKucing(a: Actor) {
    if (kucing.tujuan.length) return false;
    a.steps = [];
    const p = { x: Math.round(kucing.pos.x) + (kucing.pos.x > 200 ? -10 : 10), y: Math.round(kucing.pos.y) };
    kucing.diamSampai = Math.max(kucing.diamSampai, performance.now() + 30000);
    goTo(a, p, p.y);
    a.steps.push({ kind: "face", dir: kucing.pos.x > p.x ? 1 : -1 }, { kind: "say", text: pick(["Pus pus~", "Gemes banget", "Meong!"]), ms: 2400 });
    for (let i = 0; i < 3; i++) a.steps.push({ kind: "fx", jenis: "heart", dx: kucing.pos.x > p.x ? 10 : -10, dy: -8 }, { kind: "wait", ms: 700 });
    returnToDesk(a, p.y);
    return true;
  }

  function goTo(a: Actor, target: Pt, targetFrontY: number) {
    const fromFrontY = a.sitting ? a.desk.frontY : a.pos.y;
    for (const p of pathBetween(a.pos, fromFrontY, target, targetFrontY)) a.steps.push({ kind: "walk", to: p });
  }

  function planCoffee(a: Actor) {
    a.steps = [];
    goTo(a, COFFEE, COFFEE.y);
    a.steps.push({ kind: "brew", on: true }, { kind: "wait", ms: 2600 }, { kind: "brew", on: false });
    a.steps.push({ kind: "say", text: pick(["Kopi dulu ☕", "Isi tenaga", "Ngopi bentar"]), ms: 2200 });
    returnToDesk(a, COFFEE.y);
  }

  function planSofa(a: Actor) {
    a.steps = [];
    goTo(a, SOFA, SOFA.y);
    a.steps.push({ kind: "wait", ms: 5000 });
    returnToDesk(a, SOFA.y);
  }

  /** Kiyu keliling: cek papan kanban, menyapa satu anggota tim, atau ngopi. */
  function planOwner(a: Actor) {
    a.steps = [];
    const r = Math.random();
    if (r < 0.4) {
      goTo(a, BOARD, BOARD.y);
      a.steps.push({ kind: "say", text: pick(["Cek progres dulu 👀", "Antrean aman?", "Mantap, jalan terus"]), ms: 2600 }, { kind: "wait", ms: 3000 });
      returnToDesk(a, BOARD.y);
    } else if (r < 0.8) {
      const b = actors[Math.floor(Math.random() * TEAM.length)];
      const stand = { x: b.desk.seat.x + 14, y: b.desk.frontY - 8 };
      goTo(a, stand, b.desk.frontY);
      a.steps.push({ kind: "say", text: pick([`Gimana, ${b.m.nama}?`, "Kerja bagus!", "Semangat ya", "Yang ini serem, mantap"]), ms: 2600 }, { kind: "wait", ms: 2800 });
      returnToDesk(a, b.desk.frontY);
    } else {
      planCoffee(a);
    }
  }

  function returnToDesk(a: Actor, fromFrontY: number) {
    a.steps.push({ kind: "walk", to: { x: LANE_X, y: fromFrontY } });
    a.steps.push({ kind: "walk", to: { x: LANE_X, y: a.desk.frontY } });
    a.steps.push({ kind: "walk", to: { x: a.desk.seat.x, y: a.desk.frontY } });
    a.steps.push({ kind: "walk", to: { ...a.desk.seat } });
    a.steps.push({ kind: "sit" });
  }

  const api: Office = {
    setWorking(id, working, status) {
      const a = byId(id);
      if (!a) return;
      a.working = working;
      a.status = status ?? "";
      if (working && !a.sitting && a.steps.every((s) => s.kind !== "carry")) {
        a.steps = [];
        returnToDesk(a, a.pos.y);
      }
    },
    say(id, text, ms = 3500) {
      const a = byId(id);
      if (!a) return;
      a.sayText = text;
      a.sayUntil = performance.now() + ms;
    },
    handoff(fromId, toId, label) {
      const a = byId(fromId);
      const b = byId(toId);
      if (!a || !b || a === b) return;
      a.steps = [];
      const stand = { x: b.desk.seat.x + (b.desk.seat.x > a.desk.seat.x ? -14 : 14), y: b.desk.frontY - 8 };
      a.steps.push({ kind: "carry", on: true });
      goTo(a, stand, b.desk.frontY);
      a.steps.push({ kind: "say", text: label, ms: 2400 }, { kind: "fx", jenis: "spark", dx: a.desk.seat.x < b.desk.seat.x ? 7 : -7, dy: -10 }, { kind: "wait", ms: 2400 }, { kind: "carry", on: false });
      // tos dari penerima
      setTimeout(() => api.say(toId, pick(["Siap, tos! ✋", "Makasih!", "Oke, lanjut aku"]), 2000), 1500 + (Math.abs(a.pos.x - stand.x) + Math.abs(a.pos.y - stand.y)) / SPEED * 1000);
      returnToDesk(a, b.desk.frontY);
    },
    lapor(fromId, text) {
      const a = byId(fromId);
      const kiyu = byId(OWNER.id);
      if (!a || !kiyu || a === kiyu) return;
      // sedang melapor/mengantar: cukup tampilkan gelembung
      if (a.steps.some((s) => s.kind === "carry" || s.kind === "say")) return api.say(fromId, text);
      a.steps = [];
      const stand = { x: OWNER_DESK.seat.x - 10, y: OWNER_DESK.frontY - 6 };
      goTo(a, stand, OWNER_DESK.frontY);
      a.steps.push({ kind: "say", text: `Bos, ${text}`, ms: 3200 }, { kind: "wait", ms: 3300 });
      returnToDesk(a, OWNER_DESK.frontY);
      // Kiyu menjawab saat pelapor kira-kira sudah sampai
      const jarak = Math.abs(a.pos.x - stand.x) + Math.abs(a.pos.y - stand.y);
      setTimeout(() => api.say(OWNER.id, pick(["Oke, makasih!", "Siap, aku cek", "Mantap 👍", "Noted!"]), 2600), (jarak / SPEED) * 1000 + 3400);
    },
    rayakan(teks) {
      semburkan("confetti", 0, 0, 90);
      for (const a of actors) {
        if (a.working) continue;
        a.sayText = teks && a.m.id === OWNER.id ? teks : pick(["Yeay! 🎉", "Mantap!", "Gas terus!", "Keren!"]);
        a.sayUntil = performance.now() + 3000;
        if (!a.steps.length) a.steps.push({ kind: "pose", armsUp: true }, { kind: "wait", ms: 1800 }, { kind: "pose", armsUp: false });
      }
    },
    select(id) {
      selected = id;
      selectCb(id);
    },
    onSelect(cb) {
      selectCb = cb;
    },
    setBoard(columns) {
      board = columns;
    },
  };

  // --- input ---
  function toLogical(ev: MouseEvent): Pt {
    const r = canvas.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
  }
  function hit(p: Pt): Actor | undefined {
    return actors.find((a) => Math.abs(p.x - a.pos.x) < 9 && p.y > a.pos.y - 20 && p.y < a.pos.y + 4);
  }
  canvas.addEventListener("mousemove", (ev) => {
    const a = hit(toLogical(ev));
    hovered = a?.m.id ?? null;
    canvas.style.cursor = a ? "pointer" : "default";
  });
  canvas.addEventListener("mouseleave", () => (hovered = null));
  canvas.addEventListener("click", (ev) => {
    const a = hit(toLogical(ev));
    api.select(a ? a.m.id : null);
  });

  // --- skala ---
  let scale = 1;
  function resize() {
    const r = host.getBoundingClientRect();
    const s = Math.min(r.width / W, r.height / H);
    scale = s >= 1 ? Math.max(1, Math.floor(s * 2) / 2) : s;
    canvas.style.width = `${W * scale}px`;
    canvas.style.height = `${H * scale}px`;
    overlay.style.width = canvas.style.width;
    overlay.style.height = canvas.style.height;
  }
  new ResizeObserver(resize).observe(host);
  resize();

  // --- update ---
  function update(a: Actor, now: number, dt: number) {
    if (!a.working && !a.steps.length && a.sitting && now > a.nextIdle) {
      if (a.m.id === OWNER.id) planOwner(a);
      else if (a.m.id === SEKRETARIS.id) planLaiza(a);
      else {
        const r = Math.random();
        if (r < 0.3) {
          if (!planObrol(a)) planCoffee(a);
        } else if (r < 0.5) planCoffee(a);
        else if (r < 0.62) planSofa(a);
        else if (r < 0.77) planStretch(a);
        else if (r < 0.88) planSiram(a);
        else if (!planElusKucing(a)) planStretch(a);
      }
      a.nextIdle = now + ((a.m.id === OWNER.id ? 45000 : 30000) + Math.random() * 40000) * JEDA;
    }
    const s = a.steps[0];
    if (!s) return;
    switch (s.kind) {
      case "walk": {
        a.sitting = false;
        const dx = s.to.x - a.pos.x;
        const dy = s.to.y - a.pos.y;
        const d = Math.hypot(dx, dy);
        const stepLen = SPEED * dt;
        if (d <= stepLen) {
          a.pos = { ...s.to };
          a.steps.shift();
        } else {
          a.pos.x += (dx / d) * stepLen;
          a.pos.y += (dy / d) * stepLen;
          if (Math.abs(dx) > 0.5) a.facing = dx > 0 ? 1 : -1;
        }
        a.walkT += dt;
        break;
      }
      case "wait":
        if (!a.waitUntil) a.waitUntil = now + s.ms;
        if (now >= a.waitUntil) {
          a.waitUntil = 0;
          a.steps.shift();
        }
        break;
      case "sit":
        a.sitting = true;
        a.facing = 1;
        a.steps.shift();
        break;
      case "say":
        a.sayText = s.text;
        a.sayUntil = now + s.ms;
        a.steps.shift();
        break;
      case "carry":
        a.carrying = s.on;
        a.steps.shift();
        break;
      case "brew":
        brewing += s.on ? 1 : -1;
        a.steps.shift();
        break;
      case "hold":
        break;
      case "face":
        a.facing = s.dir;
        a.steps.shift();
        break;
      case "pose":
        if (s.armsUp !== undefined) a.armsUp = s.armsUp;
        if (s.watering !== undefined) a.watering = s.watering;
        a.steps.shift();
        break;
      case "fx":
        semburkan(s.jenis, a.pos.x + (s.dx ?? 0), a.pos.y + (s.dy ?? -12), s.jenis === "drop" ? 3 : s.jenis === "spark" ? 8 : 1);
        a.steps.shift();
        break;
    }
  }

  // --- gambar ---
  function drawRoom(t: number) {
    // lantai papan
    for (let y = WALL; y < H; y += 8) {
      for (let x = 0; x < W + 32; x += 32) {
        const off = ((y / 8) % 2) * 16;
        ctx.fillStyle = (Math.floor((x + off) / 32) + y / 8) % 2 ? "#6e5140" : "#664a3a";
        ctx.fillRect(x - off, y, 32, 8);
        ctx.fillStyle = "#57402f";
        ctx.fillRect(x - off, y + 7, 32, 1);
        ctx.fillRect(x - off + 31, y, 1, 7);
      }
    }
    // karpet area santai
    ctx.fillStyle = "#3f5a4e";
    ctx.fillRect(286, 150, 92, 66);
    ctx.fillStyle = "#4b6b5c";
    ctx.fillRect(290, 154, 84, 58);

    // lantai ruang owner: karpet ungu tua dengan pinggiran mint
    ctx.fillStyle = "#2b2340";
    ctx.fillRect(ROOM_X, WALL, W - ROOM_X, H - WALL);
    ctx.fillStyle = "#33294d";
    for (let y = WALL; y < H; y += 6) ctx.fillRect(ROOM_X, y, W - ROOM_X, 1);
    ctx.fillStyle = "#5b3f8f";
    ctx.fillRect(402, 112, 72, 72);
    ctx.fillStyle = "#3e2d63";
    ctx.fillRect(404, 114, 68, 68);
    ctx.fillStyle = "#7ee8b4";
    ctx.fillRect(404, 114, 68, 1);
    ctx.fillRect(404, 181, 68, 1);

    // dinding
    ctx.fillStyle = "#3b3756";
    ctx.fillRect(0, 0, W, WALL);
    ctx.fillStyle = "#2f2a48";
    ctx.fillRect(ROOM_X, 0, W - ROOM_X, WALL);
    ctx.fillStyle = "#33304b";
    for (let x = 0; x < W; x += 12) ctx.fillRect(x, 0, 1, WALL);
    ctx.fillStyle = "#2a2740";
    ctx.fillRect(0, WALL - 4, W, 4);

    // jendela dengan langit sesuai jam
    const hour = new Date().getHours() + new Date().getMinutes() / 60;
    const sky = hour >= 6 && hour < 17 ? ["#8fd0f5", "#c7ebff"] : hour >= 17 && hour < 19 ? ["#f39a6b", "#fbd18c"] : ["#1d2547", "#2e3a66"];
    for (const wx of [18, 82]) {
      ctx.fillStyle = "#24213a";
      ctx.fillRect(wx - 2, 8, 48, 34);
      ctx.fillStyle = sky[0];
      ctx.fillRect(wx, 10, 44, 30);
      ctx.fillStyle = sky[1];
      ctx.fillRect(wx, 28, 44, 12);
      // gedung
      ctx.fillStyle = hour >= 19 || hour < 6 ? "#141a33" : "#6d86a8";
      ctx.fillRect(wx + 4, 24, 8, 16);
      ctx.fillRect(wx + 16, 18, 10, 22);
      ctx.fillRect(wx + 30, 26, 9, 14);
      if (hour >= 19 || hour < 6) {
        ctx.fillStyle = "#f7d774";
        for (let i = 0; i < 6; i++) ctx.fillRect(wx + 18 + (i % 2) * 4, 21 + Math.floor(i / 2) * 5, 2, 2);
      }
      ctx.fillStyle = "#24213a";
      ctx.fillRect(wx + 21, 10, 2, 30);
      ctx.fillRect(wx, 24, 44, 2);
    }

    // papan kanban
    ctx.fillStyle = "#e8e4d4";
    ctx.fillRect(150, 8, 104, 40);
    ctx.fillStyle = "#c4bfae";
    ctx.fillRect(150, 46, 104, 2);
    const cols = board.length || 1;
    const cw = Math.floor(100 / cols);
    board.forEach((c, i) => {
      const cx = 152 + i * cw;
      ctx.fillStyle = "#cfcabb";
      if (i) ctx.fillRect(cx - 1, 10, 1, 34);
      for (let n = 0; n < Math.min(c.count, 4); n++) {
        ctx.fillStyle = c.color;
        ctx.fillRect(cx + 2 + (n % 2) * Math.max(4, cw / 2 - 2), 14 + Math.floor(n / 2) * 8, Math.max(3, cw / 2 - 4), 6);
      }
      ctx.fillStyle = "#8b8599";
      ctx.fillRect(cx + 2, 11, Math.max(2, cw - 5), 1);
    });

    // jam dinding
    ctx.fillStyle = "#24213a";
    ctx.fillRect(272, 12, 20, 20);
    ctx.fillStyle = "#f1ecdf";
    ctx.fillRect(274, 14, 16, 16);
    const now = new Date();
    const ang = ((now.getHours() % 12) / 12) * Math.PI * 2;
    const angM = (now.getMinutes() / 60) * Math.PI * 2;
    ctx.fillStyle = "#24213a";
    for (let r = 0; r < 5; r++) ctx.fillRect(282 + Math.round(Math.sin(ang) * r), 22 - Math.round(Math.cos(ang) * r), 1, 1);
    ctx.fillStyle = "#b8433f";
    for (let r = 0; r < 7; r++) ctx.fillRect(282 + Math.round(Math.sin(angM) * r), 22 - Math.round(Math.cos(angM) * r), 1, 1);

    // lampu "ON AIR"
    const on = Math.sin(t * 2) > -0.3;
    ctx.fillStyle = "#24213a";
    ctx.fillRect(308, 14, 40, 14);
    ctx.fillStyle = on ? "#ef6b6b" : "#6b2c33";
    ctx.fillRect(310, 16, 36, 10);
    ctx.fillStyle = on ? "#ffe2e2" : "#a25a62";
    // huruf "REC" sederhana
    const rec = [
      [0, 0, 3, 1], [0, 0, 1, 6], [2, 0, 1, 3], [0, 3, 3, 1], [1, 4, 1, 1], [2, 5, 1, 1],
      [5, 0, 1, 6], [5, 0, 3, 1], [5, 3, 2, 1], [5, 5, 3, 1],
      [10, 0, 1, 6], [10, 0, 3, 1], [10, 5, 3, 1],
    ];
    for (const [rx, ry, rw, rh] of rec) ctx.fillRect(321 + rx, 18 + ry, rw, rh);
    ctx.fillRect(314, 19, 3, 3);

    drawOwnerWall(t);
  }

  function drawOwnerWall(t: number) {
    // papan nama
    ctx.fillStyle = "#1b1726";
    ctx.fillRect(408, 8, 56, 22);
    ctx.fillStyle = "#3a2f55";
    ctx.fillRect(409, 9, 54, 20);
    const nyala = 0.75 + 0.25 * Math.sin(t * 1.8);
    drawText(ctx, "KIYU", 421, 12, `rgba(126, 232, 180, ${nyala})`);
    drawText(ctx, "OWNER", 418, 21, "#c8bfe0");
    // plakat tombol putar perak
    ctx.fillStyle = "#1b1726";
    ctx.fillRect(470, 12, 8, 12);
    ctx.fillStyle = "#cfd3dc";
    ctx.fillRect(471, 13, 6, 10);
    ctx.fillStyle = "#ef6b6b";
    ctx.fillRect(472, 16, 4, 4);
    ctx.fillStyle = "#fff";
    ctx.fillRect(473, 17, 1, 2);
    ctx.fillRect(474, 18, 1, 1);
    // jendela kecil
    ctx.fillStyle = "#1b1726";
    ctx.fillRect(394, 34, 12, 18);
    ctx.fillStyle = new Date().getHours() >= 6 && new Date().getHours() < 18 ? "#8fd0f5" : "#1d2547";
    ctx.fillRect(395, 35, 10, 16);

    // dinding pemisah dengan pintu
    ctx.fillStyle = "#24213a";
    ctx.fillRect(ROOM_X - 4, 0, 4, DOOR.y1);
    ctx.fillRect(ROOM_X - 4, DOOR.y2, 4, H - DOOR.y2);
    ctx.fillStyle = "#4a4568";
    ctx.fillRect(ROOM_X - 3, WALL, 1, DOOR.y1 - WALL);
    ctx.fillRect(ROOM_X - 3, DOOR.y2, 1, H - DOOR.y2);
    // kusen pintu
    ctx.fillStyle = "#7ee8b4";
    ctx.fillRect(ROOM_X - 5, DOOR.y1 - 2, 6, 2);
    ctx.fillRect(ROOM_X - 5, DOOR.y2, 6, 2);
  }

  type Drawable = { y: number; draw: () => void };

  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    for (const a of actors) update(a, now, dt);
    updateObrolan(now);
    updateKucing(now, dt);

    ctx.clearRect(0, 0, W, H);
    drawRoom(t);

    const items: Drawable[] = [];
    desks.forEach((d, i) => {
      const owner = actors[i];
      const on = owner.working || (owner.sitting && Math.sin(t * 0.7 + i) > 0);
      items.push({ y: d.y - 2, draw: () => drawChair(ctx, d.seat.x, d.seat.y) });
      items.push({ y: d.y + 13, draw: () => drawDesk(ctx, d.x, d.y, on, t + i, owner.working ? "#6fcf7f" : "#6ab8f0") });
    });
    items.push({ y: 84, draw: () => drawCoffeeMachine(ctx, 300, 84, t, brewing > 0) });
    items.push({ y: 82, draw: () => drawPlant(ctx, 8, 82, t) });
    items.push({ y: 82, draw: () => drawPlant(ctx, 370, 82, t) });
    items.push({ y: SOFA.y - 4, draw: () => drawSofa(ctx, 300, SOFA.y - 4) });
    items.push({ y: 236, draw: () => drawServerRack(ctx, 2, 236, t) });
    items.push({ y: 236, draw: () => drawPlant(ctx, 276, 236, t) });
    // ruang owner
    const kiyu = actors.find((a) => a.m.id === OWNER.id)!;
    items.push({ y: OWNER_DESK.y - 2, draw: () => drawBossChair(ctx, OWNER_DESK.seat.x, OWNER_DESK.seat.y) });
    items.push({ y: OWNER_DESK.y + 15, draw: () => drawBossDesk(ctx, OWNER_DESK.x, OWNER_DESK.y, t, kiyu.sitting || kiyu.working) });
    const laiza = actors.find((a) => a.m.id === SEKRETARIS.id)!;
    items.push({ y: LAIZA_DESK.y - 2, draw: () => drawChair(ctx, LAIZA_DESK.seat.x, LAIZA_DESK.seat.y) });
    items.push({ y: LAIZA_DESK.y + 13, draw: () => drawDesk(ctx, LAIZA_DESK.x, LAIZA_DESK.y, laiza.sitting, t + 9, "#ef6b8f") });
    items.push({ y: 98, draw: () => drawBookshelf(ctx, 444, 98) });
    items.push({ y: 100, draw: () => drawLamp(ctx, 474, 100, t) });
    items.push({ y: 236, draw: () => drawPlant(ctx, 470, 236, t) });
    items.push({ y: 236, draw: () => drawPlant(ctx, 402, 236, t) });

    for (const a of actors) {
      items.push({
        y: a.pos.y,
        draw: () => {
          if (a.m.id === selected || a.m.id === hovered) {
            ctx.fillStyle = a.m.id === selected ? "rgba(242,179,61,0.55)" : "rgba(255,255,255,0.25)";
            ctx.fillRect(Math.round(a.pos.x) - 7, Math.round(a.pos.y) - 1, 14, 3);
          }
          drawPerson(ctx, a.pos.x, a.pos.y, a.m.look, {
            facing: a.facing,
            walkFrame: a.sitting || !a.steps.length || a.steps[0].kind !== "walk" ? 0 : Math.floor(a.walkT * 8) % 4,
            sitting: a.sitting,
            typing: a.sitting && a.working,
            t: t + a.desk.x,
            carrying: a.carrying,
            armsUp: a.armsUp,
            watering: a.watering,
          });
        },
      });
    }
    // kucing yang tidur di sofa digambar di atas bantalnya
    items.push({ y: kucing.tidur && Math.abs(kucing.pos.x - SOFA_KUCING.x) < 3 ? SOFA.y + 1 : kucing.pos.y, draw: () => drawCat(ctx, kucing.pos.x, kucing.pos.y, kucing.facing, Math.floor(kucing.walkT * 6), kucing.tidur, t) });
    items.sort((p, q) => p.y - q.y).forEach((it) => it.draw());

    // partikel di atas semua benda
    for (let i = partikel.length - 1; i >= 0; i--) {
      const p = partikel[i];
      p.hidup += dt;
      if (p.hidup >= p.umur) {
        partikel.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.jenis === "spark" || p.jenis === "drop") p.vy += 90 * dt;
      if (p.jenis === "confetti") p.vx += Math.sin(t * 3 + i) * 10 * dt;
      ctx.globalAlpha = Math.min(1, (p.umur - p.hidup) * 2);
      ctx.fillStyle = p.warna;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (p.jenis === "heart") {
        ctx.fillRect(x - 1, y, 1, 1);
        ctx.fillRect(x + 1, y, 1, 1);
        ctx.fillRect(x - 1, y + 1, 3, 1);
        ctx.fillRect(x, y + 2, 1, 1);
      } else if (p.jenis === "z") {
        ctx.fillRect(x, y, 3, 1);
        ctx.fillRect(x + 1, y + 1, 1, 1);
        ctx.fillRect(x, y + 2, 3, 1);
      } else if (p.jenis === "confetti") {
        ctx.fillRect(x, y, 2, Math.sin(t * 8 + i) > 0 ? 2 : 1);
      } else {
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.globalAlpha = 1;
    }

    // overlay HTML
    for (const a of actors) {
      const x = a.pos.x * scale;
      const y = (a.pos.y - 20) * scale;
      const show = a.m.id === selected || a.m.id === hovered;
      a.tag.style.transform = `translate(${x}px, ${(a.pos.y + 3) * scale}px) translateX(-50%)`;
      a.tag.classList.toggle("is-visible", show);
      const text = now < a.sayUntil ? a.sayText : a.working ? a.status : "";
      if (a.bubble.textContent !== text) a.bubble.textContent = text;
      a.bubble.classList.toggle("is-visible", !!text);
      a.bubble.classList.toggle("is-working", a.working && now >= a.sayUntil);
      a.bubble.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return api;
}

function pick<T>(xs: T[]): T {
  return xs[Math.floor(Math.random() * xs.length)];
}
