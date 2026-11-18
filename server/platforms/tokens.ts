import fs from "node:fs/promises";
import path from "node:path";
import { ROOT } from "../paths.ts";
import type { Platform } from "../../src/shared/types.ts";

export interface Token {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  akun?: string;
  extra?: Record<string, string>;
}

const FILE = path.join(ROOT, "data", "tokens.json");
let cache: Partial<Record<Platform, Token>> | null = null;

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    cache = {};
  }
  return cache!;
}

export async function getToken(p: Platform) {
  return (await load())[p];
}

export async function setToken(p: Platform, t: Token | undefined) {
  const all = await load();
  if (t) all[p] = t;
  else delete all[p];
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2), { mode: 0o600 });
}

export const baseUrl = () => (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT ?? 8787}`).replace(/\/$/, "");
