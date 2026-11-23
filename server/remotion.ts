/**
 * Render video dengan Remotion (komposisi React di folder video/).
 * Bundle dibuat sekali per proses server lalu dipakai ulang.
 */
import path from "node:path";
import os from "node:os";
import { ROOT } from "./paths.ts";
import type { PropsCerita } from "../src/shared/video.ts";

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

export async function renderCerita(
  props: PropsCerita,
  keluaran: string,
  onProgress?: (persen: number) => void,
): Promise<void> {
  const { renderMedia, selectComposition } = await import("@remotion/renderer");
  const url = await serveUrl();
  const composition = await selectComposition({ serveUrl: url, id: "PovQCerita", inputProps: props });
  let terakhir = -1;
  await renderMedia({
    composition,
    serveUrl: url,
    codec: "h264",
    outputLocation: keluaran,
    inputProps: props,
    // hemat RAM: laptop dengan memori terbatas
    concurrency: Math.max(1, Math.min(4, Math.floor(os.cpus().length / 3))),
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 100);
      if (p !== terakhir && p % 10 === 0) {
        terakhir = p;
        onProgress?.(p);
      }
    },
  });
}
