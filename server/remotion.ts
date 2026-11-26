/**
 * Render video dengan Remotion (komposisi React di folder video/).
 * Bundle dibuat sekali per proses server lalu dipakai ulang.
 */
import path from "node:path";
import os from "node:os";
import { antreBerat } from "./berat.ts";
import { ROOT } from "./paths.ts";
import type { PropsCerita } from "../src/shared/video.ts";

/**
 * Port server internal Remotion. Bawaannya 3000, padahal port itu sering "dibersihkan" aplikasi lain
 * (mis. jembatan WhatsApp Hermes membunuh proses di :3000 tiap restart) sehingga server ikut mati.
 */
const PORT_REMOTION = Number(process.env.REMOTION_PORT) || 3797;

let bundleSiap: Promise<string> | null = null;

async function serveUrl(): Promise<string> {
  if (!bundleSiap) {
    bundleSiap = (async () => {
      const { bundle } = await import("@remotion/bundler");
      return bundle({ entryPoint: path.join(ROOT, "video", "index.ts") });
    })();
    bundleSiap.catch(() => (bundleSiap = null));
  }
  return bundleSiap;
}

/** 1 tab Chrome per ~2,5 GB RAM yang masih bebas, maksimal 2. */
const tabRender = () => Math.max(1, Math.min(2, Math.floor(os.freemem() / 2.5e9)));

export function renderCerita(
  props: PropsCerita,
  keluaran: string,
  onProgress?: (persen: number) => void,
): Promise<void> {
  return renderDenganCadangan(() => serveUrl(), "PovQCerita", props, keluaran, onProgress);
}

/**
 * Render proyek Remotion lain (mis. kode yang ditulis Antigravity) dari folder `dir`
 * dengan entry src/index.ts dan aset di public/. Bundle dibuat baru setiap kali karena kodenya bisa berubah.
 */
export function renderFolder(dir: string, compositionId: string, keluaran: string, onProgress?: (persen: number) => void): Promise<void> {
  const url = async () => {
    const { bundle } = await import("@remotion/bundler");
    return bundle({ entryPoint: path.join(dir, "src", "index.ts"), publicDir: path.join(dir, "public"), rootDir: dir });
  };
  return renderDenganCadangan(url, compositionId, {}, keluaran, onProgress);
}

function renderDenganCadangan(
  url: () => Promise<string>,
  id: string,
  props: Record<string, unknown>,
  keluaran: string,
  onProgress?: (persen: number) => void,
): Promise<void> {
  return antreBerat(async () => {
    const serve = await url();
    try {
      await render(serve, id, props, keluaran, tabRender(), onProgress);
    } catch (e) {
      // browser crash karena memori: coba sekali lagi dengan satu tab saja
      if (!/crash|target.?closed|Target closed/i.test(String((e as Error).message))) throw e;
      console.warn("[remotion] browser crash, ulang dengan 1 tab");
      await render(serve, id, props, keluaran, 1, onProgress);
    }
  });
}

async function render(
  url: string,
  id: string,
  props: Record<string, unknown>,
  keluaran: string,
  concurrency: number,
  onProgress?: (persen: number) => void,
): Promise<void> {
  const { renderMedia, selectComposition } = await import("@remotion/renderer");
  const composition = await selectComposition({ serveUrl: url, id, inputProps: props, port: PORT_REMOTION });
  let terakhir = -1;
  await renderMedia({
    composition,
    serveUrl: url,
    codec: "h264",
    outputLocation: keluaran,
    inputProps: props,
    concurrency,
    port: PORT_REMOTION,
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 100);
      if (p !== terakhir && p % 10 === 0) {
        terakhir = p;
        onProgress?.(p);
      }
    },
  });
}
