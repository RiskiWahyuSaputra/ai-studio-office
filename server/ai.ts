/**
 * Pemanggil Gemini API. Kunci diambil dari GEMINI_API_KEY (gratis dibuat di
 * https://aistudio.google.com/apikey). Tanpa kunci, karyawan memakai templat lokal.
 */
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

export const aiAktif = () => Boolean(process.env.GEMINI_API_KEY);
export const namaModel = () => (aiAktif() ? MODEL : "templat lokal");

export async function generateJson<T>(prompt: string): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY belum diisi");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.9 },
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Gemini sibuk (${res.status})`);
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      const body = (await res.json()) as GeminiResponse;
      if (!res.ok) throw new Error(body.error?.message ?? `Gemini error ${res.status}`);
      const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text) throw new Error("Gemini tidak mengembalikan teks");
      return JSON.parse(stripFence(text)) as T;
    } catch (e) {
      lastErr = e;
      if (e instanceof SyntaxError && attempt < 2) continue;
      if (!(e instanceof Error && e.message.startsWith("Gemini sibuk"))) break;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function stripFence(s: string) {
  return s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}
