"""
Narasi lokal dengan VoxCPM2 untuk Kantor PovQ.

Dipanggil server Node:  python narasi.py tugas.json
Isi tugas.json:
{
  "kalimat": [{"teks": "...", "out": "/abs/suara-1.wav"}, ...],
  "deskripsi": "pria dewasa, suara berat, pelan, mencekam",   # dipakai kalau belum ada acuan
  "acuan": {"wav": "/abs/acuan.wav", "teks": "..."} | null,      # suara acuan untuk kloning
  "acuan_out": "/abs/acuan.wav",                                 # tempat menyimpan acuan baru
  "timesteps": 10,
  "kata": true                                                   # ukur waktu tiap kata dengan Whisper
}
Setiap baris keluaran stdout adalah JSON: {"tahap": ...} untuk progres, terakhir {"selesai": true, ...}.
"""
import json
import os
import sys
import time

import numpy as np
import soundfile as sf


def kirim(**data):
    print(json.dumps(data, ensure_ascii=False), flush=True)


def main():
    tugas = json.load(open(sys.argv[1], encoding="utf-8"))
    kalimat = [k for k in tugas["kalimat"] if not os.path.exists(k["out"])]
    acuan = tugas.get("acuan")
    hasil_kata = {}

    if kalimat or (not acuan and tugas.get("acuan_out")):
        import torch

        # bangun model langsung dalam bf16 (bawaan pustaka: fp32 dulu, ~8 GB)
        torch.set_default_dtype(torch.bfloat16)
        torch.set_num_threads(max(1, (os.cpu_count() or 4) - 2))
        from voxcpm import VoxCPM

        kirim(tahap="muat-model")
        t0 = time.time()
        model = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False, optimize=False, device="cpu")
        sr = model.tts_model.sample_rate
        kirim(tahap="model-siap", detik=round(time.time() - t0, 1))
        langkah = int(tugas.get("timesteps", 10))

        # suara acuan: dibuat sekali dari deskripsi, lalu semua kalimat mengkloningnya
        if not acuan:
            contoh = tugas["kalimat"][0]["teks"]
            wav = model.generate(text=f"({tugas['deskripsi']}) {contoh}", cfg_value=2.0, inference_timesteps=langkah)
            sf.write(tugas["acuan_out"], wav, sr)
            acuan = {"wav": tugas["acuan_out"], "teks": contoh}
            kirim(tahap="acuan-dibuat", wav=acuan["wav"])

        for i, k in enumerate(kalimat, 1):
            kirim(tahap="kalimat", ke=i, dari=len(kalimat))
            t = time.time()
            if k["teks"].strip() == acuan["teks"].strip() and os.path.exists(acuan["wav"]):
                wav, _ = sf.read(acuan["wav"], dtype="float32")
            else:
                wav = model.generate(
                    text=k["teks"],
                    prompt_wav_path=acuan["wav"],
                    prompt_text=acuan["teks"],
                    reference_wav_path=acuan["wav"],
                    cfg_value=2.0,
                    inference_timesteps=langkah,
                )
            sf.write(k["out"], wav, sr)
            kirim(tahap="kalimat-selesai", ke=i, detik=round(time.time() - t, 1), durasi=round(len(wav) / sr, 2))
        del model

    if tugas.get("kata"):
        hasil_kata = ukur_kata([k["out"] for k in tugas["kalimat"]])

    kirim(selesai=True, acuan=acuan, kata=hasil_kata)


def ukur_kata(files):
    """Waktu tiap kata (detik) per file, dengan faster-whisper di CPU."""
    from faster_whisper import WhisperModel
    from scipy.signal import resample_poly

    kirim(tahap="ukur-kata")
    m = WhisperModel("small", device="cpu", compute_type="int8")
    hasil = {}
    for f in files:
        if not os.path.exists(f):
            continue
        wav, sr = sf.read(f, dtype="float32")
        if wav.ndim > 1:
            wav = wav.mean(axis=1)
        wav = resample_poly(wav, 16000, sr).astype("float32")
        segs, _ = m.transcribe(wav, language="id", word_timestamps=True)
        hasil[f] = [
            {"teks": w.word.strip(), "mulai": round(float(w.start), 3), "akhir": round(float(w.end), 3)}
            for s in segs
            for w in (s.words or [])
            if w.word.strip()
        ]
    return hasil


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # laporkan ke Node sebagai JSON
        kirim(galat=f"{type(e).__name__}: {e}")
        sys.exit(1)
