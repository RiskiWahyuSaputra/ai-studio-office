import { TEAM, type Member } from "../shared/team.ts";
import {
  drawChair,
  drawCoffeeMachine,
  drawDesk,
  drawPerson,
  drawPlant,
  drawServerRack,
  drawSofa,
} from "./sprites.ts";

const W = 384;
const H = 240;
const WALL = 58;
const SPEED = 42;
const LANE_X = 264;
const COFFEE = { x: 313, y: 100 };
const SOFA = { x: 322, y: 204 };

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
  | { kind: "brew"; on: boolean };

interface Actor {
  m: Member;
  desk: Desk;
  pos: Pt;
  facing: 1 | -1;
  sitting: boolean;
  working: boolean;
  carrying: boolean;
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

  const actors: Actor[] = TEAM.map((m, i) => {
    const desk = desks[i];
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
      walkT: 0,
      steps: [],
      waitUntil: 0,
      nextIdle: performance.now() + 8000 + Math.random() * 25000,
      status: "",
      sayText: "",
      sayUntil: 0,
      tag,
      bubble,
    };
  });

  const byId = (id: string) => actors.find((a) => a.m.id === id);

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
      a.steps.push({ kind: "say", text: label, ms: 2400 }, { kind: "wait", ms: 2400 }, { kind: "carry", on: false });
      returnToDesk(a, b.desk.frontY);
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
      Math.random() < 0.65 ? planCoffee(a) : planSofa(a);
      a.nextIdle = now + 30000 + Math.random() * 40000;
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

    // dinding
    ctx.fillStyle = "#3b3756";
    ctx.fillRect(0, 0, W, WALL);
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
  }

  type Drawable = { y: number; draw: () => void };

  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    for (const a of actors) update(a, now, dt);

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
          });
        },
      });
    }
    items.sort((p, q) => p.y - q.y).forEach((it) => it.draw());

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
