"""
Uji cepat OmniVoice untuk narasi bahasa Indonesia: kualitas logat dan kecepatan di laptop ini.
Jalankan: .venv/bin/python uji.py
"""

import inspect
import os
import time

import soundfile as sf
import torch
from omnivoice import OmniVoice

DIR = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(DIR, "out")
TEKS = "Cuma pakai satu ember, kamu bisa panen lele dan kangkung sekaligus! Gampang banget, murah, dan bisa kamu coba sendiri di rumah."
ACUAN = os.path.join(OUT, "acuan-ardi.wav")
ACUAN_TEKS = "Halo semuanya! Hari ini aku mau berbagi ide sederhana yang bisa langsung kamu coba di rumah."

t0 = time.time()
model = OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map="cuda:0", dtype=torch.float16)
print(f"model dimuat {time.time() - t0:.1f} dtk, VRAM {torch.cuda.memory_allocated() / 1e9:.2f} GB", flush=True)
print("parameter generate:", list(inspect.signature(model.generate).parameters), flush=True)


def buat(nama, **kw):
    t = time.time()
    audio = model.generate(text=TEKS, **kw)
    durasi = len(audio[0]) / 24000
    sf.write(os.path.join(OUT, f"{nama}.wav"), audio[0], 24000)
    print(f"{nama}: {durasi:.1f} dtk audio dalam {time.time() - t:.1f} dtk", flush=True)


# 1. kloning dari rekaman acuan berbahasa Indonesia
# buat("1-kloning-ardi", ref_audio=ACUAN, ref_text=ACUAN_TEKS)

# 2. desain suara dari deskripsi (dilatih untuk Mandarin/Inggris, jadi dicoba saja)
params = inspect.signature(model.generate).parameters
if "instruct" in params:
    kw = {"instruct": "male, young adult, moderate pitch"}
    if "language_id" in params:
        kw["language_id"] = "id"
    elif "language" in params:
        kw["language"] = "id"
    buat("2-desain-pria-muda", **kw)
