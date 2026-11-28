/**
 * Waktu tiap kata pada rekaman narasi yang sudah jadi, diukur dengan faster-whisper (tools/voxcpm/ukur.py).
 * Hasil disimpan di <file>.kata.json, jadi file yang sama tidak diukur dua kali.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./paths.ts";
import type { KataWaktu } from "../src/shared/video.ts";

const DIR = path.join(ROOT, "tools", "voxcpm");
const PYTHON = path.join(DIR, ".venv", "bin", "python");
const SKRIP = path.join(DIR, "ukur.py");

export function ukurKata(files: string[]): Promise<Record<string, KataWaktu[]>> {
  if (!fs.existsSync(PYTHON) || !fs.existsSync(SKRIP)) return Promise.reject(new Error("tools/voxcpm belum terpasang"));
  return new Promise((resolve, reject) => {
    const ps = spawn(PYTHON, [SKRIP, ...files], { cwd: DIR, env: { ...process.env, PYTHONUNBUFFERED: "1" } });
    let out = "";
    ps.stdout.on("data", (d) => (out += d));
    ps.on("error", reject);
    ps.on("close", () => {
      for (const b of out.trim().split("\n").reverse()) {
        try {
          const j = JSON.parse(b);
          if (j.selesai) return resolve(j.kata);
          if (j.galat) return reject(new Error(j.galat));
        } catch {
          /* bukan JSON */
        }
      }
      reject(new Error("ukur kata tidak mengembalikan hasil"));
    });
  });
}
