"""Buat beberapa varian suara horor untuk dipilih (satu kali muat model)."""
import os, sys, time
import torch
torch.set_default_dtype(torch.bfloat16)
torch.set_num_threads(max(1, (os.cpu_count() or 4) - 2))
import soundfile as sf
from voxcpm import VoxCPM

out = sys.argv[1]
teks = "Malam itu, aku mendengar langkah kaki di loteng. Pelan... lalu berhenti, tepat di atas kamarku."
varian = {
    "A-bisikan-berat": "a deep, raspy adult male voice, whispering slowly and menacingly, eerie horror storyteller",
    "B-kakek-serak": "an old man with a low, gravelly, trembling voice, speaking very slowly in a creepy hushed tone",
    "C-narator-dingin": "a calm, deep, cold male narrator, slow and ominous delivery with long dramatic pauses",
}
model = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False, optimize=False, device="cpu")
sr = model.tts_model.sample_rate
for nama, desk in varian.items():
    t = time.time()
    wav = model.generate(text=f"({desk}) {teks}", cfg_value=2.0, inference_timesteps=10)
    sf.write(os.path.join(out, f"{nama}.wav"), wav, sr)
    print(nama, f"{time.time()-t:.0f} dtk, {len(wav)/sr:.1f} dtk audio", flush=True)
