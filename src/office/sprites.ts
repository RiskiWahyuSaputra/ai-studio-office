import type { Look } from "../shared/team.ts";

type Ctx = CanvasRenderingContext2D;

const px = (ctx: Ctx, x: number, y: number, w: number, h: number, c: string) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
};

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.max(0, Math.min(255, ((n >> s) & 255) + amt));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

export interface PoseOpts {
  facing: 1 | -1; // 1 = menghadap kanan
  walkFrame: number; // 0..3
  sitting: boolean;
  typing: boolean;
  t: number;
  carrying: boolean;
  /** tangan terangkat (peregangan / sorak) */
  armsUp?: boolean;
  /** memegang penyiram tanaman */
  watering?: boolean;
}

/**
 * Karakter 10x16 px. (x, y) adalah titik kaki tengah.
 */
export function drawPerson(ctx: Ctx, x: number, y: number, look: Look, o: PoseOpts) {
  const left = Math.round(x) - 5;
  const top = Math.round(y) - 16;
  const bob = !o.sitting && (o.walkFrame === 1 || o.walkFrame === 3) ? -1 : 0;
  const T = top + bob;

  // bayangan
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(left + 1, Math.round(y) - 1, 8, 2);

  // kaki
  const pants = look.pants;
  const shoe = "#1a1520";
  if (o.sitting) {
    px(ctx, left + 2, T + 12, 6, 2, pants);
  } else {
    const step = o.walkFrame === 1 ? 1 : o.walkFrame === 3 ? -1 : 0;
    px(ctx, left + 2, T + 12, 2, 3 + Math.max(0, -step), pants);
    px(ctx, left + 6, T + 12, 2, 3 + Math.max(0, step), pants);
    px(ctx, left + 2, T + 15 + Math.max(0, -step), 2, 1, shoe);
    px(ctx, left + 6, T + 15 + Math.max(0, step), 2, 1, shoe);
  }

  // badan
  px(ctx, left + 1, T + 7, 8, 6, look.shirt);
  if (look.shirt2) {
    // hoodie dua warna + ritsleting
    px(ctx, left + 1, T + 7, 8, 2, look.shirt2);
    px(ctx, left + 2, T + 9, 6, 1, look.shirt2);
    px(ctx, left + 5, T + 8, 1, 4, look.streak ?? shade(look.shirt, 40));
  }
  px(ctx, left + 1, T + 12, 8, 1, shade(look.shirt, -40));
  if (!look.shirt2) px(ctx, left + 4, T + 7, 2, 1, shade(look.shirt, 30));

  // tangan
  const armY = o.typing ? T + 8 + (Math.floor(o.t * 8) % 2) : T + 8;
  if (o.carrying) {
    px(ctx, left + (o.facing === 1 ? 8 : -2), T + 8, 4, 3, "#f4f0e2");
    px(ctx, left + (o.facing === 1 ? 9 : -1), T + 9, 2, 1, "#9a93ab");
  }
  if (o.armsUp) {
    px(ctx, left, T + 3, 1, 5, look.shirt);
    px(ctx, left + 9, T + 3, 1, 5, look.shirt);
    px(ctx, left, T + 2, 1, 1, look.skin);
    px(ctx, left + 9, T + 2, 1, 1, look.skin);
  } else {
    px(ctx, left, armY, 1, 4, look.shirt);
    px(ctx, left + 9, armY, 1, 4, look.shirt);
    px(ctx, left, armY + 4, 1, 1, look.skin);
    px(ctx, left + 9, armY + 4, 1, 1, look.skin);
  }
  if (o.watering) {
    const wx = o.facing === 1 ? left + 9 : left - 4;
    px(ctx, wx, T + 10, 4, 3, "#4f8fd6");
    px(ctx, o.facing === 1 ? wx + 4 : wx - 2, T + 9, 2, 1, "#4f8fd6");
  }

  // kepala
  px(ctx, left + 2, T + 1, 6, 6, look.skin);
  px(ctx, left + 4, T + 6, 2, 1, shade(look.skin, -30));

  // rambut
  const h = look.hair;
  switch (look.hairStyle) {
    case "pendek":
      px(ctx, left + 2, T, 6, 2, h);
      px(ctx, left + 2, T + 2, 1, 2, h);
      px(ctx, left + 7, T + 2, 1, 1, h);
      break;
    case "panjang":
      px(ctx, left + 2, T, 6, 2, h);
      px(ctx, left + 1, T + 1, 1, 7, h);
      px(ctx, left + 8, T + 1, 1, 7, h);
      px(ctx, left + 2, T + 2, 1, 1, h);
      break;
    case "keriting":
      px(ctx, left + 1, T - 1, 8, 3, h);
      px(ctx, left + 1, T + 2, 1, 2, h);
      px(ctx, left + 8, T + 2, 1, 2, h);
      px(ctx, left + 3, T - 2, 1, 1, h);
      px(ctx, left + 6, T - 2, 1, 1, h);
      break;
    case "jilbab":
      px(ctx, left + 1, T, 8, 2, h);
      px(ctx, left + 1, T + 2, 1, 6, h);
      px(ctx, left + 8, T + 2, 1, 6, h);
      px(ctx, left + 2, T + 6, 6, 2, h);
      px(ctx, left + 4, T + 6, 2, 1, look.skin);
      break;
    case "acak":
      px(ctx, left + 1, T - 1, 8, 3, h);
      px(ctx, left + 2, T - 2, 2, 1, h);
      px(ctx, left + 6, T - 2, 1, 1, h);
      px(ctx, left + 1, T + 2, 1, 3, h);
      px(ctx, left + 8, T + 2, 1, 2, h);
      px(ctx, left + 2, T + 2, 1, 1, h);
      if (look.streak) {
        px(ctx, left + (o.facing === 1 ? 5 : 3), T, 2, 1, look.streak);
        px(ctx, left + (o.facing === 1 ? 6 : 3), T + 1, 1, 2, look.streak);
      }
      break;
    case "botak":
      px(ctx, left + 2, T + 2, 1, 2, h);
      px(ctx, left + 7, T + 2, 1, 2, h);
      px(ctx, left + 3, T + 1, 2, 1, shade(look.skin, 25));
      break;
  }

  // mata (tidak terlihat saat membelakangi; di sini selalu depan)
  const eyeShift = o.facing === 1 ? 1 : 0;
  px(ctx, left + 3 + eyeShift, T + 3, 1, 1, "#1a1520");
  px(ctx, left + 5 + eyeShift, T + 3, 1, 1, "#1a1520");

  switch (look.accessory) {
    case "kacamata":
      px(ctx, left + 2 + eyeShift, T + 3, 5, 1, "rgba(30,30,40,0.55)");
      px(ctx, left + 3 + eyeShift, T + 3, 1, 1, "#d9f0ff");
      px(ctx, left + 5 + eyeShift, T + 3, 1, 1, "#d9f0ff");
      break;
    case "headset":
      px(ctx, left + 2, T - 1, 6, 1, "#2b2b33");
      px(ctx, left + 1, T + 2, 1, 3, "#2b2b33");
      px(ctx, left + 8, T + 2, 1, 3, "#2b2b33");
      px(ctx, left + 8, T + 5, 2, 1, "#ef6b6b");
      break;
    case "goggles":
      px(ctx, left + 1, T, 8, 1, "#3d4a52");
      px(ctx, left + 2, T - 1, 2, 2, "#7ee8b4");
      px(ctx, left + 6, T - 1, 2, 2, "#7ee8b4");
      px(ctx, left + 2, T - 1, 1, 1, "#d6fff0");
      px(ctx, left + 6, T - 1, 1, 1, "#d6fff0");
      break;
    case "topi":
      px(ctx, left + 1, T - 1, 8, 2, "#c94b4b");
      px(ctx, left + (o.facing === 1 ? 7 : -1), T + 1, 4, 1, "#a33a3a");
      break;
  }
}

export function drawDesk(ctx: Ctx, x: number, y: number, screenOn: boolean, t: number, accent: string) {
  // x,y = sudut kiri atas meja (36x14)
  px(ctx, x, y, 36, 10, "#8a5a3b");
  px(ctx, x, y, 36, 2, "#a8714c");
  px(ctx, x, y + 10, 36, 3, "#6b432b");
  px(ctx, x + 2, y + 13, 2, 6, "#4f3020");
  px(ctx, x + 32, y + 13, 2, 6, "#4f3020");

  // laptop dari belakang (layar menghadap karyawan)
  px(ctx, x + 12, y - 6, 12, 7, "#3c3f4f");
  px(ctx, x + 13, y - 5, 10, 5, "#4c5064");
  px(ctx, x + 17, y - 3, 2, 2, screenOn ? accent : "#5c6078");
  px(ctx, x + 11, y + 1, 14, 2, "#2c2f3b");
  if (screenOn) {
    const glow = 0.1 + 0.06 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(160, 220, 255, ${glow})`;
    ctx.fillRect(x + 12, y - 9, 12, 3);
  }

  // cangkir & kertas
  px(ctx, x + 29, y + 2, 3, 4, "#f1ecdf");
  px(ctx, x + 32, y + 3, 1, 2, "#f1ecdf");
  px(ctx, x + 3, y + 3, 6, 4, "#f4f0e2");
  px(ctx, x + 4, y + 4, 4, 1, "#b9b2c6");
}

export function drawChair(ctx: Ctx, x: number, y: number) {
  px(ctx, x - 6, y - 13, 12, 10, "#2c2540");
  px(ctx, x - 5, y - 12, 10, 8, "#3b3256");
  px(ctx, x - 1, y - 3, 2, 3, "#2a2438");
  px(ctx, x - 5, y, 10, 1, "#2a2438");
}

export function drawPlant(ctx: Ctx, x: number, y: number, t: number) {
  const sway = Math.round(Math.sin(t * 1.3 + x) * 0.6);
  px(ctx, x - 5, y - 8, 10, 8, "#b5643c");
  px(ctx, x - 5, y - 8, 10, 2, "#cf7a4d");
  px(ctx, x - 1 + sway, y - 22, 2, 14, "#3f7d46");
  px(ctx, x - 7 + sway, y - 20, 6, 3, "#5aa35e");
  px(ctx, x + 1 + sway, y - 24, 7, 3, "#5aa35e");
  px(ctx, x - 6 + sway, y - 14, 5, 3, "#4c9152");
  px(ctx, x + 1 + sway, y - 16, 6, 3, "#4c9152");
}

export function drawCoffeeMachine(ctx: Ctx, x: number, y: number, t: number, brewing: boolean) {
  px(ctx, x, y - 26, 26, 6, "#7a5a40");
  px(ctx, x, y - 20, 26, 20, "#6b4b33");
  px(ctx, x + 4, y - 40, 14, 14, "#c9c4d6");
  px(ctx, x + 5, y - 39, 12, 3, "#8b8599");
  px(ctx, x + 7, y - 34, 4, 3, "#2a2438");
  px(ctx, x + 13, y - 34, 2, 2, brewing ? "#6fcf7f" : "#ef6b6b");
  px(ctx, x + 8, y - 30, 4, 4, "#f1ecdf");
  if (brewing) {
    for (let i = 0; i < 3; i++) {
      const sy = ((t * 10 + i * 4) % 10) | 0;
      ctx.fillStyle = `rgba(255,255,255,${0.5 - sy / 22})`;
      ctx.fillRect(x + 9 + (i % 2), y - 32 - sy, 1, 1);
    }
  }
}

export function drawSofa(ctx: Ctx, x: number, y: number) {
  px(ctx, x, y - 16, 44, 8, "#4b6fa8");
  px(ctx, x, y - 8, 44, 8, "#5b80bb");
  px(ctx, x - 3, y - 12, 4, 12, "#3e5d8f");
  px(ctx, x + 43, y - 12, 4, 12, "#3e5d8f");
  px(ctx, x + 2, y, 2, 2, "#2a2438");
  px(ctx, x + 40, y, 2, 2, "#2a2438");
}

export function drawServerRack(ctx: Ctx, x: number, y: number, t: number) {
  px(ctx, x, y - 44, 18, 44, "#262330");
  for (let i = 0; i < 5; i++) {
    px(ctx, x + 2, y - 41 + i * 8, 14, 6, "#34303f");
    const on = Math.sin(t * 5 + i * 1.7) > -0.2;
    px(ctx, x + 12, y - 39 + i * 8, 2, 2, on ? "#6fcf7f" : "#2f5e37");
    px(ctx, x + 4, y - 39 + i * 8, 5, 1, "#4a4558");
  }
}

/** Font piksel 3x5 untuk papan nama. */
const FONT: Record<string, string[]> = {
  K: ["101", "110", "100", "110", "101"],
  I: ["111", "010", "010", "010", "111"],
  Y: ["101", "101", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  O: ["111", "101", "101", "101", "111"],
  W: ["101", "101", "101", "111", "101"],
  N: ["101", "111", "111", "111", "101"],
  E: ["111", "100", "110", "100", "111"],
  R: ["110", "101", "110", "101", "101"],
  P: ["110", "101", "110", "100", "100"],
  V: ["101", "101", "101", "101", "010"],
  Q: ["111", "101", "101", "111", "001"],
};

export function drawText(ctx: Ctx, text: string, x: number, y: number, c: string) {
  ctx.fillStyle = c;
  let cx = Math.round(x);
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch];
    if (g) g.forEach((row, ry) => [...row].forEach((b, rx) => b === "1" && ctx.fillRect(cx + rx, Math.round(y) + ry, 1, 1)));
    cx += 4;
  }
}

/** Meja eksekutif owner (52x16) dengan monitor besar berlogo PovQ. */
export function drawBossDesk(ctx: Ctx, x: number, y: number, t: number, on: boolean) {
  px(ctx, x, y, 52, 11, "#4a2f2a");
  px(ctx, x, y, 52, 2, "#6b4439");
  px(ctx, x, y + 11, 52, 4, "#36211d");
  px(ctx, x + 2, y + 15, 4, 5, "#2a1916");
  px(ctx, x + 46, y + 15, 4, 5, "#2a1916");
  // monitor (dari belakang) dengan cahaya mint
  // monitor rendah supaya wajah Kiyu tetap terlihat
  px(ctx, x + 16, y - 6, 20, 6, "#23212e");
  px(ctx, x + 17, y - 5, 18, 4, "#2f2c3d");
  px(ctx, x + 25, y, 2, 1, "#23212e");
  if (on) {
    ctx.fillStyle = `rgba(126, 232, 180, ${0.12 + 0.06 * Math.sin(t * 2.4)})`;
    ctx.fillRect(x + 15, y - 9, 22, 3);
  }
  // hantu mini (maskot PovQ) & cangkir
  px(ctx, x + 4, y - 4, 5, 5, "#c9f7e2");
  px(ctx, x + 4, y - 4, 5, 1, "#e9fff5");
  px(ctx, x + 5, y - 2, 1, 1, "#2a2236");
  px(ctx, x + 7, y - 2, 1, 1, "#2a2236");
  px(ctx, x + 4, y + 1, 1, 1, "#c9f7e2");
  px(ctx, x + 8, y + 1, 1, 1, "#c9f7e2");
  px(ctx, x + 42, y + 2, 3, 4, "#f1ecdf");
  px(ctx, x + 45, y + 3, 1, 2, "#f1ecdf");
}

export function drawBossChair(ctx: Ctx, x: number, y: number) {
  px(ctx, x - 7, y - 16, 14, 13, "#1f1a2b");
  px(ctx, x - 6, y - 15, 12, 11, "#3a2a55");
  px(ctx, x - 6, y - 15, 12, 2, "#4a3770");
  px(ctx, x - 1, y - 3, 2, 3, "#1f1a2b");
  px(ctx, x - 6, y, 12, 1, "#1f1a2b");
}

export function drawBookshelf(ctx: Ctx, x: number, y: number) {
  // x,y = sudut kiri bawah (24x40)
  px(ctx, x, y - 40, 24, 40, "#4a2f2a");
  const warna = ["#7ee8b4", "#5b3f8f", "#e0a43c", "#4f8fd6", "#d65f8a", "#e8e2cf"];
  for (let r = 0; r < 3; r++) {
    px(ctx, x + 2, y - 38 + r * 13, 20, 11, "#2a1916");
    for (let b = 0; b < 5; b++) px(ctx, x + 3 + b * 4, y - 36 + r * 13 + (b % 2), 3, 9 - (b % 2), warna[(r * 5 + b) % warna.length]);
  }
}

export function drawLamp(ctx: Ctx, x: number, y: number, t: number) {
  px(ctx, x - 1, y - 30, 2, 30, "#3d3a48");
  px(ctx, x - 4, y, 8, 1, "#3d3a48");
  px(ctx, x - 5, y - 36, 10, 6, "#e9d9a8");
  ctx.fillStyle = `rgba(255, 228, 160, ${0.1 + 0.03 * Math.sin(t)})`;
  ctx.fillRect(x - 9, y - 30, 18, 14);
}

/** Kucing kantor 10x7. (x, y) = titik kaki tengah. */
export function drawCat(ctx: Ctx, x: number, y: number, facing: 1 | -1, frame: number, tidur: boolean, t: number) {
  const l = Math.round(x) - 5;
  const b = Math.round(y);
  const bulu = "#e59b4a";
  const gelap = "#b8722e";
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(l + 1, b - 1, 8, 2);
  if (tidur) {
    px(ctx, l + 1, b - 4, 8, 4, bulu);
    px(ctx, l + 2, b - 4, 2, 1, gelap);
    px(ctx, l + 6, b - 4, 2, 1, gelap);
    px(ctx, l + (facing === 1 ? 7 : 0), b - 5, 3, 3, bulu);
    px(ctx, l + (facing === 1 ? 8 : 1), b - 6, 1, 1, bulu);
    px(ctx, l + (facing === 1 ? 0 : 8), b - 2, 2, 1, gelap);
    return;
  }
  const kaki = frame % 2;
  px(ctx, l + 2, b - 5, 6, 3, bulu);
  px(ctx, l + 3, b - 5, 1, 3, gelap);
  px(ctx, l + 5, b - 5, 1, 3, gelap);
  px(ctx, l + 2 + kaki, b - 2, 1, 2, bulu);
  px(ctx, l + 6 - kaki, b - 2, 1, 2, bulu);
  const kx = facing === 1 ? l + 7 : l;
  px(ctx, kx, b - 7, 3, 3, bulu);
  px(ctx, kx, b - 8, 1, 1, bulu);
  px(ctx, kx + 2, b - 8, 1, 1, bulu);
  px(ctx, kx + (facing === 1 ? 2 : 0), b - 6, 1, 1, "#1a1520");
  const ekor = Math.round(Math.sin(t * 4) * 1);
  px(ctx, facing === 1 ? l + 1 : l + 8, b - 7 + ekor, 1, 3, gelap);
}
