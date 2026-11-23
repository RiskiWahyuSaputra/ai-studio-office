"""Uji cepat VoxCPM2 di CPU: muat model, buat satu kalimat, ukur waktu & RAM."""
import os, time, resource, sys
import soundfile as sf
import torch
from voxcpm import VoxCPM

# bangun model langsung dalam bf16 (bawaan pustaka: fp32 dulu ~8 GB, baru dikecilkan)
torch.set_default_dtype(torch.bfloat16)
torch.set_num_threads(max(1, (os.cpu_count() or 4) - 2))

t0 = time.time()
model = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False, optimize=False, device="cpu")
print(f"muat model: {time.time()-t0:.1f} dtk", flush=True)

teks = "(suara pria dewasa, pelan, berbisik, mencekam, seperti pendongeng cerita horor) Setiap jam dua pagi, ada yang mengetuk pintu kamarku tiga kali."
t1 = time.time()
wav = model.generate(text=teks, cfg_value=2.0, inference_timesteps=10)
sr = model.tts_model.sample_rate
durasi = len(wav) / sr
lama = time.time() - t1
sf.write("out/uji-horor.wav", wav, sr)
print(f"generate: {lama:.1f} dtk untuk audio {durasi:.1f} dtk (RTF {lama/durasi:.2f})", flush=True)
print(f"RAM puncak: {resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024/1024:.1f} GB", flush=True)
