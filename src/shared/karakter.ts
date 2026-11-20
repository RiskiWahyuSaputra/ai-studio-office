/**
 * Lembar karakter: deskripsi tokoh yang ditempel PERSIS SAMA ke setiap prompt,
 * supaya Veo tidak mengarang wajah/pakaian baru di tiap klip.
 * Prompt mentah memakai penanda {{Nama}}; penanda diganti dengan deskripsi tokoh.
 */
import { GAYA, type Adegan, type Gaya, type Karakter } from "./types.ts";

const PENANDA = /\{\{\s*([^}]+?)\s*\}\}/g;

export function kembangkan(promptMentah: string, karakter: Karakter[]): string {
  return promptMentah.replace(PENANDA, (_, nama: string) => {
    const k = karakter.find((x) => x.nama.toLowerCase() === nama.toLowerCase());
    return k ? k.deskripsi : nama;
  });
}

export function terapkanKarakter(adegan: Adegan[], karakter: Karakter[]): Adegan[] {
  return adegan.map((a) => (a.promptMentah ? { ...a, prompt: kembangkan(a.promptMentah, karakter) } : a));
}

/** Prompt untuk membuat gambar referensi karakter di Flow / aplikasi Gemini. */
export function promptGambar(k: Karakter, gaya: Gaya = "sinematik"): string {
  const g = GAYA[gaya];
  return (
    `Lembar referensi karakter, ${g.prompt}. ${k.deskripsi}. ` +
    `Tampilkan karakter yang sama dari depan, samping, dan belakang, seluruh badan terlihat, ekspresi netral, ` +
    `latar putih polos, pencahayaan rata. Tanpa teks, tanpa tulisan, tanpa watermark.`
  );
}
