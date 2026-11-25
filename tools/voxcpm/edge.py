"""
Narasi cepat dengan Edge TTS (suara neural Microsoft, gratis tanpa kunci, butuh internet).
Masukan: file JSON tugas {kalimat: [{teks, out}], suara, rate, pitch}.
Keluaran: baris JSON seperti narasi.py ({tahap: ...}, lalu {selesai: true, kata: {out: [...]}}).
Waktu tiap kata diambil langsung dari Edge (WordBoundary), jadi tanpa Whisper.
"""

import asyncio
import json
import os
import sys

import edge_tts


def kirim(**data):
    print(json.dumps(data, ensure_ascii=False), flush=True)


async def satu(teks, out, suara, rate, pitch):
    kata = []
    sementara = out + ".part"
    c = edge_tts.Communicate(teks, suara, rate=rate, pitch=pitch, boundary="WordBoundary")
    with open(sementara, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                mulai = ch["offset"] / 1e7
                kata.append({"teks": ch["text"], "mulai": round(mulai, 3), "akhir": round(mulai + ch["duration"] / 1e7, 3)})
    os.replace(sementara, out)
    with open(out + ".kata.json", "w", encoding="utf-8") as f:
        json.dump(kata, f, ensure_ascii=False)
    return kata


async def main():
    tugas = json.load(open(sys.argv[1], encoding="utf-8"))
    semua = tugas["kalimat"]
    hasil = {}
    for i, k in enumerate(semua, 1):
        cache = k["out"] + ".kata.json"
        if os.path.exists(k["out"]) and os.path.exists(cache):
            hasil[k["out"]] = json.load(open(cache, encoding="utf-8"))
            continue
        kirim(tahap="kalimat", ke=i, dari=len(semua))
        for coba in range(3):
            try:
                hasil[k["out"]] = await satu(k["teks"], k["out"], tugas["suara"], tugas["rate"], tugas["pitch"])
                break
            except Exception:
                if coba == 2:
                    raise
                await asyncio.sleep(2 + coba * 3)
    kirim(selesai=True, kata=hasil)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        kirim(galat=f"{type(e).__name__}: {e}")
        sys.exit(1)
