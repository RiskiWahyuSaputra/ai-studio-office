/**
 * Pemanggil Gemini API. Kunci diambil dari GEMINI_API_KEY (gratis dibuat di
 * https://aistudio.google.com/apikey). Tanpa kunci, karyawan memakai templat lokal.
 *
 * GEMINI_MODEL boleh berisi beberapa model dipisah koma. Kalau model pertama sibuk
 * (503/429) atau terlalu lama, karyawan pindah ke model berikutnya.
 */
const DEFAULT_MODELS = "gemini-flash-latest,gemini-3.5-flash-lite,gemini-flash-lite-latest";
const TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 60_000;

const models = () =>
  (process.env.GEMINI_MODEL || DEFAULT_MODELS)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

export const aiAktif = () => Boolean(process.env.GEMINI_API_KEY);
export const namaModel = () => (aiAktif() ? models()[0] : "templat lokal");

class Sibuk extends Error {}

async function panggil<T>(model: string, key: string, prompt: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.9 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const n = (e as Error).name;
    if (n === "TimeoutError" || n === "AbortError") throw new Sibuk(`${model} tidak menjawab dalam ${TIMEOUT_MS / 1000} detik`);
    throw new Sibuk(`${model}: koneksi gagal (${(e as Error).message})`);
  }
  const body = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (res.status === 429 || res.status >= 500) throw new Sibuk(`${model} sedang sibuk (${res.status})`);
  if (res.status === 404) throw new Sibuk(`${model} tidak tersedia untuk akunmu`);
  if (!res.ok) throw new Error(body.error?.message ?? `Gemini error ${res.status}`);
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Sibuk(`${model} tidak mengembalikan teks`);
  try {
    return JSON.parse(stripFence(text)) as T;
  } catch {
    throw new Sibuk(`${model} membalas dengan format yang rusak`);
  }
}

export async function generateJson<T>(prompt: string): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY belum diisi");
  const daftar = models();
  const alasan: string[] = [];
  // dua putaran: semua model dicoba, jeda sebentar, lalu dicoba sekali lagi
  for (let putaran = 0; putaran < 2; putaran++) {
    for (const model of daftar) {
      try {
        return await panggil<T>(model, key, prompt);
      } catch (e) {
        if (!(e instanceof Sibuk)) throw e;
        alasan.push(e.message);
        console.warn(`[gemini] ${e.message}, coba model lain`);
      }
    }
    if (putaran === 0) await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`Semua model Gemini sedang sibuk. Coba lagi beberapa menit lagi. (${alasan.slice(-daftar.length).join("; ")})`);
}

function stripFence(s: string) {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}
