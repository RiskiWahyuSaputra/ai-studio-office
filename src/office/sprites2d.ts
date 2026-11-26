/**
 * Mode tampilan 2D: gaya kartun halus (garis tepi gelap, bentuk membulat, cel-shading lembut),
 * dengan tanda tangan fungsi yang sama seperti sprites.ts. Koordinat tetap koordinat dunia kantor
 * (canvas di-skala oleh office.ts), jadi semua ukuran di sini dalam satuan "piksel dunia".
 */
import type { Look } from "../shared/team.ts";
import type { PoseOpts } from "./sprites.ts";

type Ctx = CanvasRenderingContext2D;

const GARIS = "#1d1830";
const TEBAL = 0.45;

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke = true) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = TEBAL;
    ctx.strokeStyle = GARIS;
    ctx.stroke();
  }
}

function lingkaran(ctx: Ctx, x: number, y: number, r: number, fill: string, stroke = true) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = TEBAL;
    ctx.strokeStyle = GARIS;
    ctx.stroke();
  }
}

function elips(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke = false, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = TEBAL;
    ctx.strokeStyle = GARIS;
    ctx.stroke();
  }
}

function garis(ctx: Ctx, pts: [number, number][], warna: string, tebal: number) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) ctx.lineTo(x, y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = tebal + TEBAL * 2;
  ctx.strokeStyle = GARIS;
  ctx.stroke();
  ctx.lineWidth = tebal;
  ctx.strokeStyle = warna;
  ctx.stroke();
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.max(0, Math.min(255, ((n >> s) & 255) + amt));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

function vertikal(ctx: Ctx, y1: number, y2: number, a: string, b: string) {
  const g = ctx.createLinearGradient(0, y1, 0, y2);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}

export function drawPerson(ctx: Ctx, x: number, y: number, look: Look, o: PoseOpts) {
  const bob = !o.sitting && (o.walkFrame === 1 || o.walkFrame === 3) ? -0.6 : 0;
  const Y = y + bob;
  const arah = o.facing;

  elips(ctx, x, y, 4.6, 1.3, "rgba(0,0,0,0.22)");

  // kaki
  if (o.sitting) {
    rr(ctx, x - 3.4, Y - 4.4, 6.8, 2.6, 1.2, look.pants);
  } else {
    const step = o.walkFrame === 1 ? 1 : o.walkFrame === 3 ? -1 : 0;
    rr(ctx, x - 3, Y - 4.6, 2.4, 4 + Math.max(0, -step) * 0.6, 1, look.pants);
    rr(ctx, x + 0.6, Y - 4.6, 2.4, 4 + Math.max(0, step) * 0.6, 1, look.pants);
    elips(ctx, x - 1.8 - step * 0.4, Y - 0.4 + Math.max(0, -step) * 0.6, 1.7, 0.9, "#2a2236", true);
    elips(ctx, x + 1.8 + step * 0.4, Y - 0.4 + Math.max(0, step) * 0.6, 1.7, 0.9, "#2a2236", true);
  }

  // badan
  rr(ctx, x - 4, Y - 10, 8, 6.4, 2.4, look.shirt);
  if (look.shirt2) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x - 4, Y - 10, 8, 6.4, 2.4);
    ctx.clip();
    ctx.fillStyle = look.shirt2;
    ctx.fillRect(x - 4, Y - 10, 8, 2.6);
    ctx.restore();
    garis(ctx, [[x, Y - 9.6], [x, Y - 4]], look.streak ?? "#c8bfe0", 0.35);
  } else {
    elips(ctx, x, Y - 9.4, 1.6, 0.7, shade(look.shirt, 30));
  }

  // lengan & tangan
  const kulit = look.skin;
  if (o.armsUp) {
    garis(ctx, [[x - 3.6, Y - 9], [x - 5.2, Y - 14]], look.shirt, 1.6);
    garis(ctx, [[x + 3.6, Y - 9], [x + 5.2, Y - 14]], look.shirt, 1.6);
    lingkaran(ctx, x - 5.3, Y - 14.6, 0.9, kulit);
    lingkaran(ctx, x + 5.3, Y - 14.6, 0.9, kulit);
  } else if (o.typing) {
    const k = Math.floor(o.t * 8) % 2 ? 0.5 : 0;
    garis(ctx, [[x - 3.6, Y - 8.8], [x - 3.2, Y - 6 - k]], look.shirt, 1.6);
    garis(ctx, [[x + 3.6, Y - 8.8], [x + 3.2, Y - 6 + k - 0.5]], look.shirt, 1.6);
    lingkaran(ctx, x - 3, Y - 5.4 - k, 0.85, kulit);
    lingkaran(ctx, x + 3, Y - 5.8 + k, 0.85, kulit);
  } else {
    garis(ctx, [[x - 3.7, Y - 8.8], [x - 4.3, Y - 5.4]], look.shirt, 1.6);
    garis(ctx, [[x + 3.7, Y - 8.8], [x + 4.3, Y - 5.4]], look.shirt, 1.6);
    lingkaran(ctx, x - 4.4, Y - 4.8, 0.85, kulit);
    lingkaran(ctx, x + 4.4, Y - 4.8, 0.85, kulit);
  }
  if (o.carrying) {
    const px = x + arah * 5;
    rr(ctx, px - 1.8, Y - 8.4, 3.6, 4.2, 0.5, "#f4f0e2");
    garis(ctx, [[px - 1, Y - 7], [px + 1, Y - 7]], "#9a93ab", 0.3);
  }
  if (o.watering) {
    const px = x + arah * 5.6;
    rr(ctx, px - 1.8, Y - 7.6, 3.6, 2.8, 0.8, "#4f8fd6");
    garis(ctx, [[px + arah * 1.6, Y - 6.6], [px + arah * 3.2, Y - 8]], "#4f8fd6", 0.6);
  }

  // kepala
  const hx = x;
  const hy = Y - 13.6;
  const R = 4.3;
  const rambut = look.hair;
  // rambut belakang (panjang)
  if (look.hairStyle === "panjang") rr(ctx, hx - R - 0.4, hy - 2, R * 2 + 0.8, 7.4, 2.6, rambut);
  if (look.hairStyle === "jilbab") lingkaran(ctx, hx, hy + 0.4, R + 1, rambut);
  lingkaran(ctx, hx, hy, R, kulit, look.hairStyle !== "jilbab");
  if (look.hairStyle === "jilbab") {
    elips(ctx, hx, hy + 0.6, R - 0.6, R - 0.4, kulit);
  }

  // rambut depan
  ctx.save();
  ctx.beginPath();
  switch (look.hairStyle) {
    case "pendek":
    case "panjang":
      ctx.arc(hx, hy, R + 0.2, Math.PI * 1.02, Math.PI * 1.98);
      ctx.quadraticCurveTo(hx + R * 0.2, hy - 1, hx - R * 0.1, hy - 1.4);
      ctx.quadraticCurveTo(hx - R * 0.6, hy - 0.6, hx - R - 0.2, hy + 0.4);
      break;
    case "keriting":
      for (let i = 0; i < 6; i++) {
        const a = Math.PI + (i / 5) * Math.PI;
        ctx.moveTo(hx + Math.cos(a) * R + 1.4, hy + Math.sin(a) * R);
        ctx.arc(hx + Math.cos(a) * R, hy + Math.sin(a) * R * 0.9, 1.4, 0, Math.PI * 2);
      }
      break;
    case "acak":
      ctx.moveTo(hx - R - 0.4, hy + 0.8);
      ctx.lineTo(hx - R - 1, hy - 2);
      ctx.lineTo(hx - R + 0.6, hy - 2.6);
      ctx.lineTo(hx - 2.6, hy - R - 1.6);
      ctx.lineTo(hx - 1, hy - R - 0.4);
      ctx.lineTo(hx + 0.6, hy - R - 1.8);
      ctx.lineTo(hx + 2, hy - R - 0.2);
      ctx.lineTo(hx + R + 0.8, hy - 2.4);
      ctx.lineTo(hx + R + 0.4, hy + 0.6);
      ctx.quadraticCurveTo(hx + 1, hy - 1.8, hx - 1.4, hy - 0.8);
      ctx.quadraticCurveTo(hx - 3, hy - 0.4, hx - R - 0.4, hy + 0.8);
      break;
    case "botak":
      ctx.ellipse(hx - R + 0.4, hy + 0.4, 0.9, 1.6, 0, 0, Math.PI * 2);
      ctx.moveTo(hx + R + 0.5, hy + 0.4);
      ctx.ellipse(hx + R - 0.4, hy + 0.4, 0.9, 1.6, 0, 0, Math.PI * 2);
      break;
  }
  if (look.hairStyle !== "jilbab") {
    ctx.fillStyle = rambut;
    ctx.fill();
    ctx.lineWidth = TEBAL;
    ctx.strokeStyle = GARIS;
    ctx.stroke();
  }
  ctx.restore();
  if (look.streak && look.hairStyle === "acak") {
    garis(ctx, [[hx + arah * 0.6, hy - R - 0.8], [hx + arah * 1.8, hy - 1.4]], look.streak, 0.9);
  }
  if (look.hairStyle === "botak") elips(ctx, hx - 1.2, hy - 2.6, 1.2, 0.6, shade(kulit, 30));

  // wajah
  const geser = arah * 0.7;
  for (const dx of [-1.5, 1.5]) {
    elips(ctx, hx + dx + geser, hy + 0.4, 0.62, 0.85, "#1a1520");
    lingkaran(ctx, hx + dx + geser + 0.2, hy + 0.05, 0.22, "#ffffff", false);
  }
  elips(ctx, hx - 2.7 + geser, hy + 1.8, 0.9, 0.5, "rgba(239,107,143,0.45)");
  elips(ctx, hx + 2.7 + geser, hy + 1.8, 0.9, 0.5, "rgba(239,107,143,0.45)");
  ctx.beginPath();
  ctx.arc(hx + geser, hy + 2.1, 0.8, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.lineWidth = 0.35;
  ctx.strokeStyle = GARIS;
  ctx.stroke();

  switch (look.accessory) {
    case "kacamata":
      ctx.lineWidth = 0.4;
      ctx.strokeStyle = GARIS;
      for (const dx of [-1.5, 1.5]) {
        ctx.beginPath();
        ctx.arc(hx + dx + geser, hy + 0.4, 1.2, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case "headset":
      ctx.beginPath();
      ctx.arc(hx, hy, R + 0.8, Math.PI * 1.05, Math.PI * 1.95);
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = "#2b2b33";
      ctx.stroke();
      rr(ctx, hx - R - 1.2, hy - 0.6, 1.6, 2.6, 0.7, "#2b2b33");
      rr(ctx, hx + R - 0.4, hy - 0.6, 1.6, 2.6, 0.7, "#2b2b33");
      lingkaran(ctx, hx + R + 0.4, hy + 3, 0.5, "#ef6b6b", false);
      break;
    case "topi":
      rr(ctx, hx - R, hy - R - 0.6, R * 2, 2.8, 1.4, "#c94b4b");
      rr(ctx, hx + (arah === 1 ? 1 : -R - 2), hy - 2.2, R + 1, 1.1, 0.5, "#a33a3a");
      break;
    case "goggles":
      rr(ctx, hx - R, hy - 3.4, R * 2, 1, 0.5, "#3d4a52");
      lingkaran(ctx, hx - 1.6, hy - 3.8, 1.25, "#7ee8b4");
      lingkaran(ctx, hx + 1.6, hy - 3.8, 1.25, "#7ee8b4");
      lingkaran(ctx, hx - 2, hy - 4.2, 0.35, "#e9fff5", false);
      lingkaran(ctx, hx + 1.2, hy - 4.2, 0.35, "#e9fff5", false);
      break;
    case "pita": {
      const bx = hx + (arah === 1 ? -2.6 : 2.6);
      const by = hy - R + 0.4;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - 2, by - 1.2);
      ctx.lineTo(bx - 2, by + 1.2);
      ctx.closePath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + 2, by - 1.2);
      ctx.lineTo(bx + 2, by + 1.2);
      ctx.closePath();
      ctx.fillStyle = "#ef6b8f";
      ctx.fill();
      ctx.lineWidth = TEBAL;
      ctx.strokeStyle = GARIS;
      ctx.stroke();
      lingkaran(ctx, bx, by, 0.6, "#ffd1df");
      break;
    }
  }
}

export function drawDesk(ctx: Ctx, x: number, y: number, screenOn: boolean, t: number, accent: string) {
  rr(ctx, x + 2, y + 9, 2.4, 9.5, 0.8, "#5a3824");
  rr(ctx, x + 31.6, y + 9, 2.4, 9.5, 0.8, "#5a3824");
  rr(ctx, x, y + 1, 36, 11, 2, vertikal(ctx, y, y + 12, "#b07a52", "#7f5034"));
  rr(ctx, x - 0.5, y, 37, 3, 1.5, "#c48d62");
  // laptop dari belakang
  rr(ctx, x + 11.5, y - 7, 13, 8, 1.4, "#3c3f4f");
  lingkaran(ctx, x + 18, y - 3, 1.1, screenOn ? accent : "#5c6078", false);
  rr(ctx, x + 10.5, y + 0.6, 15, 1.6, 0.8, "#2c2f3b");
  if (screenOn) {
    const g = ctx.createRadialGradient(x + 18, y - 9, 0, x + 18, y - 9, 9);
    g.addColorStop(0, `rgba(160,220,255,${0.22 + 0.08 * Math.sin(t * 3)})`);
    g.addColorStop(1, "rgba(160,220,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x + 8, y - 18, 20, 14);
  }
  // cangkir & kertas
  rr(ctx, x + 28.5, y + 2.4, 3.4, 4, 0.8, "#f1ecdf");
  ctx.beginPath();
  ctx.arc(x + 32.2, y + 4.4, 1, -Math.PI / 2, Math.PI / 2);
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = GARIS;
  ctx.stroke();
  rr(ctx, x + 3, y + 3, 6.5, 4.4, 0.5, "#f4f0e2");
  garis(ctx, [[x + 4.2, y + 4.6], [x + 8.2, y + 4.6]], "#b9b2c6", 0.25);
}

export function drawChair(ctx: Ctx, x: number, y: number) {
  rr(ctx, x - 0.8, y - 4, 1.6, 4, 0.6, "#2a2438");
  rr(ctx, x - 5, y - 0.8, 10, 1.4, 0.7, "#2a2438");
  rr(ctx, x - 6, y - 14, 12, 11, 3.5, vertikal(ctx, y - 14, y - 3, "#4a3d6b", "#2f2746"));
}

export function drawPlant(ctx: Ctx, x: number, y: number, t: number) {
  const sway = Math.sin(t * 1.3 + x) * 0.9;
  ctx.save();
  ctx.translate(x, y - 8);
  ctx.rotate(sway * 0.03);
  for (const [dx, dy, rx, rot, c] of [
    [-3.4, -8, 3.4, -0.7, "#4c9152"],
    [3.2, -10, 3.6, 0.7, "#5aa35e"],
    [-2.6, -13, 3, -0.4, "#5aa35e"],
    [2.4, -15, 3, 0.5, "#6cbf6f"],
    [0, -17, 2.6, 0, "#6cbf6f"],
  ] as [number, number, number, number, string][]) {
    elips(ctx, dx, dy, rx, 1.6, c, true, rot);
  }
  garis(ctx, [[0, 0], [0, -14]], "#3f7d46", 0.6);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 8);
  ctx.lineTo(x + 5, y - 8);
  ctx.lineTo(x + 4, y);
  ctx.lineTo(x - 4, y);
  ctx.closePath();
  ctx.fillStyle = "#c46e44";
  ctx.fill();
  ctx.lineWidth = TEBAL;
  ctx.strokeStyle = GARIS;
  ctx.stroke();
  rr(ctx, x - 5.6, y - 9, 11.2, 2.2, 1, "#d9845a");
}

export function drawCoffeeMachine(ctx: Ctx, x: number, y: number, t: number, brewing: boolean) {
  rr(ctx, x, y - 26, 26, 26, 2, vertikal(ctx, y - 26, y, "#8a6548", "#5e412c"));
  rr(ctx, x + 4, y - 41, 15, 15, 3, vertikal(ctx, y - 41, y - 26, "#dcd7e6", "#a9a3b8"));
  rr(ctx, x + 6, y - 39, 11, 3.6, 1.2, "#6b6580");
  lingkaran(ctx, x + 15.6, y - 33, 1, brewing ? "#6fcf7f" : "#ef6b6b");
  rr(ctx, x + 7.5, y - 30.5, 5, 4.6, 1, "#f1ecdf");
  if (brewing) {
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 2; i++) {
      const fase = (t * 1.5 + i * 0.5) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.7 - fase * 0.7})`;
      ctx.beginPath();
      ctx.moveTo(x + 9 + i * 2, y - 31 - fase * 6);
      ctx.quadraticCurveTo(x + 10.5 + i * 2, y - 33 - fase * 6, x + 9 + i * 2, y - 35 - fase * 6);
      ctx.stroke();
    }
  }
}

export function drawSofa(ctx: Ctx, x: number, y: number) {
  rr(ctx, x - 1, y - 18, 46, 10, 4, vertikal(ctx, y - 18, y - 8, "#5a83c4", "#44679f"));
  rr(ctx, x, y - 9.5, 44, 8.5, 3, "#6a91cf");
  rr(ctx, x - 4, y - 13, 6, 12.5, 3, "#3e5d8f");
  rr(ctx, x + 42, y - 13, 6, 12.5, 3, "#3e5d8f");
  garis(ctx, [[x + 22, y - 9], [x + 22, y - 2]], "#5a83c4", 0.3);
  rr(ctx, x + 2, y - 0.6, 2.2, 2, 0.8, "#2a2438");
  rr(ctx, x + 40, y - 0.6, 2.2, 2, 0.8, "#2a2438");
}

export function drawServerRack(ctx: Ctx, x: number, y: number, t: number) {
  rr(ctx, x, y - 44, 18, 44, 2, vertikal(ctx, y - 44, y, "#2f2b3b", "#1e1b27"));
  for (let i = 0; i < 5; i++) {
    rr(ctx, x + 2, y - 41 + i * 8, 14, 6, 1.2, "#3a3549");
    const on = Math.sin(t * 5 + i * 1.7) > -0.2;
    lingkaran(ctx, x + 13, y - 38 + i * 8, 0.9, on ? "#6fcf7f" : "#2f5e37", false);
    if (on) {
      ctx.fillStyle = "rgba(111,207,127,0.25)";
      ctx.beginPath();
      ctx.arc(x + 13, y - 38 + i * 8, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    garis(ctx, [[x + 4, y - 38 + i * 8], [x + 9, y - 38 + i * 8]], "#57506a", 0.4);
  }
}

export function drawBossDesk(ctx: Ctx, x: number, y: number, t: number, on: boolean) {
  rr(ctx, x + 2, y + 10, 4, 10, 1, "#2a1916");
  rr(ctx, x + 46, y + 10, 4, 10, 1, "#2a1916");
  rr(ctx, x, y + 1, 52, 14, 2.5, vertikal(ctx, y, y + 15, "#6b4439", "#3e2620"));
  rr(ctx, x - 0.5, y, 53, 3, 1.5, "#7d5244");
  // monitor rendah
  rr(ctx, x + 16, y - 6.5, 20, 7, 1.6, "#23212e");
  rr(ctx, x + 24.5, y - 0.2, 3, 1, 0.4, "#23212e");
  if (on) {
    const g = ctx.createRadialGradient(x + 26, y - 7, 0, x + 26, y - 7, 12);
    g.addColorStop(0, `rgba(126,232,180,${0.25 + 0.08 * Math.sin(t * 2.4)})`);
    g.addColorStop(1, "rgba(126,232,180,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x + 12, y - 18, 28, 14);
  }
  // hantu mini & cangkir
  ctx.beginPath();
  ctx.moveTo(x + 3.6, y + 1.6);
  ctx.lineTo(x + 3.6, y - 2.4);
  ctx.arc(x + 6.4, y - 2.4, 2.8, Math.PI, 0);
  ctx.lineTo(x + 9.2, y + 1.6);
  ctx.lineTo(x + 8, y + 0.8);
  ctx.lineTo(x + 6.4, y + 1.6);
  ctx.lineTo(x + 4.8, y + 0.8);
  ctx.closePath();
  ctx.fillStyle = "#c9f7e2";
  ctx.fill();
  ctx.lineWidth = TEBAL;
  ctx.strokeStyle = GARIS;
  ctx.stroke();
  lingkaran(ctx, x + 5.4, y - 2.2, 0.45, "#2a2236", false);
  lingkaran(ctx, x + 7.4, y - 2.2, 0.45, "#2a2236", false);
  rr(ctx, x + 42, y + 2.4, 3.4, 4, 0.8, "#f1ecdf");
}

export function drawBossChair(ctx: Ctx, x: number, y: number) {
  rr(ctx, x - 0.8, y - 4, 1.6, 4, 0.6, "#1f1a2b");
  rr(ctx, x - 6, y - 0.8, 12, 1.4, 0.7, "#1f1a2b");
  rr(ctx, x - 7, y - 17, 14, 14, 4, vertikal(ctx, y - 17, y - 3, "#5b4290", "#33264f"));
  rr(ctx, x - 5, y - 15, 10, 2, 1, "#6b52a3", false);
}

export function drawBookshelf(ctx: Ctx, x: number, y: number) {
  rr(ctx, x, y - 40, 24, 40, 2, vertikal(ctx, y - 40, y, "#5a3a33", "#3e2620"));
  const warna = ["#7ee8b4", "#7d5fc0", "#e0a43c", "#4f8fd6", "#d65f8a", "#e8e2cf"];
  for (let r = 0; r < 3; r++) {
    rr(ctx, x + 2, y - 38 + r * 13, 20, 11, 1, "#2a1916");
    for (let b = 0; b < 5; b++) {
      const tinggi = 9 - (b % 2) * 1.2;
      rr(ctx, x + 3 + b * 3.8, y - 36.5 + r * 13 + (9 - tinggi), 3.2, tinggi, 0.6, warna[(r * 5 + b) % warna.length]);
    }
  }
}

export function drawLamp(ctx: Ctx, x: number, y: number, t: number) {
  const g = ctx.createRadialGradient(x, y - 30, 0, x, y - 30, 16);
  g.addColorStop(0, `rgba(255,228,160,${0.32 + 0.05 * Math.sin(t)})`);
  g.addColorStop(1, "rgba(255,228,160,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - 16, y - 46, 32, 32);
  garis(ctx, [[x, y], [x, y - 30]], "#3d3a48", 0.8);
  elips(ctx, x, y, 4, 1, "#3d3a48", true);
  ctx.beginPath();
  ctx.moveTo(x - 3, y - 37);
  ctx.lineTo(x + 3, y - 37);
  ctx.lineTo(x + 5.4, y - 30);
  ctx.lineTo(x - 5.4, y - 30);
  ctx.closePath();
  ctx.fillStyle = "#f0e1b4";
  ctx.fill();
  ctx.lineWidth = TEBAL;
  ctx.strokeStyle = GARIS;
  ctx.stroke();
}

export function drawCat(
  ctx: Ctx,
  x: number,
  y: number,
  facing: 1 | -1,
  frame: number,
  tidur: boolean,
  t: number,
  warna: { bulu: string; gelap: string; mata: string } = { bulu: "#e59b4a", gelap: "#b8722e", mata: "#1a1520" },
) {
  const { bulu, gelap } = warna;
  elips(ctx, x, y, 4.4, 1.1, "rgba(0,0,0,0.22)");
  if (tidur) {
    // melingkar
    elips(ctx, x, y - 2.4, 4.6, 2.6, bulu, true);
    ctx.beginPath();
    ctx.arc(x - facing * 1, y - 1.4, 3.6, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = gelap;
    ctx.stroke();
    const kx = x + facing * 3;
    lingkaran(ctx, kx, y - 3, 2.2, bulu);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(kx + s * 0.6, y - 4.8);
      ctx.lineTo(kx + s * 1.8, y - 6.2);
      ctx.lineTo(kx + s * 2, y - 4);
      ctx.closePath();
      ctx.fillStyle = bulu;
      ctx.fill();
      ctx.lineWidth = TEBAL;
      ctx.strokeStyle = GARIS;
      ctx.stroke();
    }
    garis(ctx, [[kx - 1.2, y - 2.8], [kx - 0.4, y - 2.8]], GARIS, 0.15);
    garis(ctx, [[kx + 0.4, y - 2.8], [kx + 1.2, y - 2.8]], GARIS, 0.15);
    return;
  }
  const kaki = frame % 2 ? 0.7 : -0.7;
  for (const [dx, d] of [[-2.4, kaki], [-1, -kaki], [1.6, kaki], [3, -kaki]] as [number, number][]) {
    rr(ctx, x + dx * facing - 0.5, y - 2.6, 1.1, 2.6 + d * 0.3, 0.5, bulu);
  }
  // ekor
  const ekor = Math.sin(t * 4) * 1.2;
  ctx.beginPath();
  ctx.moveTo(x - facing * 3.6, y - 3.6);
  ctx.quadraticCurveTo(x - facing * 6, y - 5, x - facing * 5.2, y - 8 + ekor);
  ctx.lineCap = "round";
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = GARIS;
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = gelap;
  ctx.stroke();
  elips(ctx, x, y - 3.6, 4, 1.9, bulu, true);
  const kx = x + facing * 3.8;
  const ky = y - 5.6;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(kx + s * 0.6, ky - 1.8);
    ctx.lineTo(kx + s * 1.7, ky - 3.4);
    ctx.lineTo(kx + s * 2, ky - 1);
    ctx.closePath();
    ctx.fillStyle = bulu;
    ctx.fill();
    ctx.lineWidth = TEBAL;
    ctx.strokeStyle = GARIS;
    ctx.stroke();
  }
  lingkaran(ctx, kx, ky, 2.2, bulu);
  elips(ctx, kx + facing * 0.8, ky - 0.2, 0.4, 0.6, warna.mata);
  elips(ctx, kx - facing * 0.6, ky - 0.2, 0.4, 0.6, warna.mata);
  lingkaran(ctx, kx + facing * 1.4, ky + 0.8, 0.3, "#ef8fa8", false);
}

export interface OpsiRuang {
  t: number;
  W: number;
  H: number;
  WALL: number;
  ROOM_X: number;
  DOOR: { y1: number; y2: number };
  board: { label: string; count: number; color: string }[];
}

/** Ruangan (lantai, dinding, jendela, papan, jam, lampu REC, dan dinding ruang owner). */
export function drawRuang(ctx: Ctx, o: OpsiRuang) {
  const { t, W, H, WALL, ROOM_X, DOOR } = o;
  // lantai kayu
  ctx.fillStyle = vertikal(ctx, WALL, H, "#7a5b46", "#5f4433");
  ctx.fillRect(0, WALL, ROOM_X, H - WALL);
  ctx.lineWidth = 0.35;
  ctx.strokeStyle = "rgba(40,26,18,0.35)";
  for (let y = WALL + 10; y < H; y += 10) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(ROOM_X, y);
    ctx.stroke();
    const off = ((y / 10) % 2) * 24;
    for (let x = off; x < ROOM_X; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }
  // karpet santai
  rr(ctx, 286, 150, 92, 66, 8, "#3f5a4e", false);
  rr(ctx, 290, 154, 84, 58, 6, "#4f7363", false);
  ctx.setLineDash([1.5, 1.5]);
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.roundRect(293, 157, 78, 52, 5);
  ctx.stroke();
  ctx.setLineDash([]);

  // ruang owner: karpet
  ctx.fillStyle = vertikal(ctx, WALL, H, "#30264a", "#231c37");
  ctx.fillRect(ROOM_X, WALL, W - ROOM_X, H - WALL);
  rr(ctx, 402, 112, 72, 72, 8, "#5b3f8f", false);
  rr(ctx, 405, 115, 66, 66, 6, "#3e2d63", false);
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = "#7ee8b4";
  ctx.beginPath();
  ctx.roundRect(407, 117, 62, 62, 5);
  ctx.stroke();

  // dinding
  ctx.fillStyle = vertikal(ctx, 0, WALL, "#4a4470", "#37325a");
  ctx.fillRect(0, 0, ROOM_X, WALL);
  ctx.fillStyle = vertikal(ctx, 0, WALL, "#3d3460", "#2c2548");
  ctx.fillRect(ROOM_X, 0, W - ROOM_X, WALL);
  ctx.fillStyle = "#28233f";
  ctx.fillRect(0, WALL - 3, W, 3);

  // jendela
  const jam = new Date().getHours() + new Date().getMinutes() / 60;
  const malam = jam >= 19 || jam < 6;
  const langit = jam >= 6 && jam < 17 ? ["#8fd0f5", "#d7f0ff"] : jam >= 17 && jam < 19 ? ["#f39a6b", "#fbd18c"] : ["#151c3d", "#2e3a66"];
  for (const wx of [18, 82]) {
    rr(ctx, wx - 2.5, 7.5, 49, 35, 3, "#2b2640");
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(wx, 10, 44, 30, 2);
    ctx.clip();
    ctx.fillStyle = vertikal(ctx, 10, 40, langit[0], langit[1]);
    ctx.fillRect(wx, 10, 44, 30);
    if (malam) {
      lingkaran(ctx, wx + 34, 16, 2.6, "#f5f0d8", false);
      lingkaran(ctx, wx + 35.2, 15.2, 2.2, langit[0], false);
    } else {
      elips(ctx, wx + 12, 16, 5, 1.8, "rgba(255,255,255,0.8)");
      elips(ctx, wx + 15, 15, 3.4, 2, "rgba(255,255,255,0.8)");
    }
    ctx.fillStyle = malam ? "#141a33" : "#7590b5";
    for (const [bx, bw, bh] of [[3, 8, 16], [13, 11, 22], [27, 9, 14], [37, 8, 19]]) {
      ctx.beginPath();
      ctx.roundRect(wx + bx, 40 - bh, bw, bh, [1.2, 1.2, 0, 0]);
      ctx.fill();
    }
    if (malam) {
      ctx.fillStyle = "#f7d774";
      for (let i = 0; i < 8; i++) ctx.fillRect(wx + 15 + (i % 3) * 3, 21 + Math.floor(i / 3) * 5, 1.2, 1.2);
    }
    ctx.restore();
    rr(ctx, wx + 21, 10, 2, 30, 0.5, "#2b2640", false);
    rr(ctx, wx, 24, 44, 1.6, 0.5, "#2b2640", false);
  }

  // papan kanban
  rr(ctx, 150, 7, 104, 41, 3, "#efeadb");
  const cols = o.board.length || 1;
  const cw = 100 / cols;
  o.board.forEach((c, i) => {
    const cx = 152 + i * cw;
    if (i) garis(ctx, [[cx - 0.5, 10], [cx - 0.5, 44]], "#d4cebd", 0.3);
    garis(ctx, [[cx + 2, 11.5], [cx + cw - 3, 11.5]], "#8b8599", 0.4);
    for (let n = 0; n < Math.min(c.count, 4); n++) {
      const w = Math.max(3, cw / 2 - 3);
      ctx.save();
      ctx.translate(cx + 2 + (n % 2) * (w + 1) + w / 2, 18 + Math.floor(n / 2) * 9);
      ctx.rotate(((n * 37) % 7 - 3) * 0.02);
      rr(ctx, -w / 2, -3, w, 6.4, 0.6, c.color, false);
      ctx.restore();
    }
  });

  // jam dinding bundar
  const cx = 282;
  const cy = 22;
  lingkaran(ctx, cx, cy, 9.5, "#f4efe2");
  lingkaran(ctx, cx, cy, 0.8, GARIS, false);
  const now = new Date();
  const aJam = ((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2;
  const aMen = (now.getMinutes() / 60) * Math.PI * 2;
  garis(ctx, [[cx, cy], [cx + Math.sin(aJam) * 4.6, cy - Math.cos(aJam) * 4.6]], GARIS, 0.7);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.sin(aMen) * 7, cy - Math.cos(aMen) * 7);
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = "#b8433f";
  ctx.stroke();

  // lampu REC
  const on = Math.sin(t * 2) > -0.3;
  rr(ctx, 307, 13, 42, 16, 4, "#24213a");
  if (on) {
    const g = ctx.createRadialGradient(328, 21, 0, 328, 21, 24);
    g.addColorStop(0, "rgba(239,107,107,0.35)");
    g.addColorStop(1, "rgba(239,107,107,0)");
    ctx.fillStyle = g;
    ctx.fillRect(304, 0, 48, 44);
  }
  rr(ctx, 309.5, 15.5, 37, 11, 3, on ? "#ef6b6b" : "#6b2c33", false);
  lingkaran(ctx, 316, 21, 1.6, on ? "#fff" : "#a25a62", false);
  ctx.fillStyle = on ? "#ffecec" : "#a25a62";
  ctx.font = "700 7px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("REC", 320, 21.5);

  // ---- dinding ruang owner ----
  rr(ctx, 407, 7, 58, 24, 4, "#1b1726");
  rr(ctx, 409, 9, 54, 20, 3, "#3a2f55", false);
  const nyala = 0.75 + 0.25 * Math.sin(t * 1.8);
  ctx.save();
  ctx.shadowColor = "#7ee8b4";
  ctx.shadowBlur = 4;
  ctx.fillStyle = `rgba(126,232,180,${nyala})`;
  ctx.font = "800 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("KIYU", 436, 16);
  ctx.restore();
  ctx.fillStyle = "#c8bfe0";
  ctx.font = "600 5px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("OWNER", 436, 25);
  ctx.textAlign = "start";
  // plakat tombol putar
  rr(ctx, 469.5, 11.5, 9, 13, 1.5, "#d9dde6");
  rr(ctx, 471.5, 15, 5, 5, 1.5, "#ef6b6b", false);
  ctx.beginPath();
  ctx.moveTo(473.4, 16.4);
  ctx.lineTo(475.2, 17.5);
  ctx.lineTo(473.4, 18.6);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();
  // jendela kecil
  rr(ctx, 393.5, 33.5, 13, 19, 2, "#1b1726");
  rr(ctx, 395, 35, 10, 16, 1.4, jam >= 6 && jam < 18 ? "#8fd0f5" : "#1d2547", false);

  // dinding pemisah (kaca) dengan pintu
  ctx.fillStyle = "rgba(170,200,255,0.12)";
  ctx.fillRect(ROOM_X - 4, WALL, 4, DOOR.y1 - WALL);
  ctx.fillRect(ROOM_X - 4, DOOR.y2, 4, H - DOOR.y2);
  rr(ctx, ROOM_X - 4.5, 0, 5, WALL, 1, "#24213a", false);
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = "#4a4568";
  ctx.beginPath();
  ctx.moveTo(ROOM_X - 4, WALL);
  ctx.lineTo(ROOM_X - 4, DOOR.y1);
  ctx.moveTo(ROOM_X, WALL);
  ctx.lineTo(ROOM_X, DOOR.y1);
  ctx.moveTo(ROOM_X - 4, DOOR.y2);
  ctx.lineTo(ROOM_X - 4, H);
  ctx.moveTo(ROOM_X, DOOR.y2);
  ctx.lineTo(ROOM_X, H);
  ctx.stroke();
  rr(ctx, ROOM_X - 6, DOOR.y1 - 2.5, 8, 2.5, 1, "#7ee8b4", false);
  rr(ctx, ROOM_X - 6, DOOR.y2, 8, 2.5, 1, "#7ee8b4", false);
}

/** Partikel bergaya halus (lingkaran, hati, z). */
export function drawPartikel(ctx: Ctx, jenis: string, x: number, y: number, warna: string, t: number, i: number) {
  ctx.fillStyle = warna;
  switch (jenis) {
    case "heart":
      ctx.beginPath();
      ctx.moveTo(x, y + 1.6);
      ctx.bezierCurveTo(x - 2.4, y, x - 1.4, y - 1.6, x, y - 0.5);
      ctx.bezierCurveTo(x + 1.4, y - 1.6, x + 2.4, y, x, y + 1.6);
      ctx.fill();
      break;
    case "z":
      ctx.font = "700 4px system-ui, sans-serif";
      ctx.fillText("z", x, y);
      break;
    case "confetti":
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(t * 4 + i);
      ctx.fillRect(-1, -0.6, 2, 1.2);
      ctx.restore();
      break;
    case "drop":
      elips(ctx, x, y, 0.6, 0.9, warna);
      break;
    default:
      ctx.beginPath();
      ctx.arc(x, y, 0.7, 0, Math.PI * 2);
      ctx.fill();
  }
}
