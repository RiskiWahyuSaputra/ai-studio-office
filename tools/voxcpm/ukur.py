"""
Ukur waktu tiap kata pada rekaman narasi yang sudah jadi (mis. dari Gemini TTS), dengan faster-whisper.
Masukan: argumen berupa path file audio. Keluaran: baris JSON {selesai: true, kata: {file: [...]}}.
Hasil disimpan di <file>.kata.json, jadi pengukuran ulang untuk file yang sama langsung diambil dari cache.
"""

import json
import sys

from narasi import kirim, ukur_kata

if __name__ == "__main__":
    try:
        kirim(selesai=True, kata=ukur_kata(sys.argv[1:]))
    except Exception as e:  # laporkan ke Node sebagai JSON
        kirim(galat=f"{type(e).__name__}: {e}")
        sys.exit(1)
