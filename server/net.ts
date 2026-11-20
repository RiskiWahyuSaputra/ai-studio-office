/**
 * fetch dengan coba ulang untuk gangguan jaringan sesaat (DNS lambat, koneksi putus).
 * Hanya mengulang kalau permintaan gagal di level jaringan, bukan kalau server membalas error.
 */
const KODE_ULANG = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"]);

function kodeGalat(e: unknown): string {
  const c = (e as { cause?: { code?: string; message?: string } })?.cause;
  return c?.code ?? c?.message ?? (e as Error)?.message ?? String(e);
}

export async function fetchUlang(url: string, init?: RequestInit, percobaan = 4): Promise<Response> {
  let terakhir: unknown;
  for (let i = 0; i < percobaan; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      terakhir = e;
      const kode = kodeGalat(e);
      const bisaUlang = KODE_ULANG.has(kode) || /fetch failed|network|socket/i.test(String((e as Error)?.message));
      if (!bisaUlang || i === percobaan - 1) break;
      console.warn(`[net] ${new URL(url).host}: ${kode}, coba lagi (${i + 2}/${percobaan})`);
      await new Promise((r) => setTimeout(r, [2000, 5000, 10000][i] ?? 10000));
    }
  }
  const host = new URL(url).host;
  const kode = kodeGalat(terakhir);
  const sebab =
    kode === "ENOTFOUND" || kode === "EAI_AGAIN"
      ? "DNS tidak bisa menemukan alamatnya (cek koneksi internet atau DNS router)"
      : kode;
  throw new Error(`Tidak bisa terhubung ke ${host}: ${sebab}`);
}
