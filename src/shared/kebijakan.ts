/**
 * Pemeriksa cepat kata-kata yang sering membuat prompt ditolak Google Flow/Veo.
 * Bukan daftar resmi Google, hanya pola yang sering memicu penolakan.
 */
const POLA: { re: RegExp; alasan: string }[] = [
  {
    re: /\b(teen(ager)?s?|boys?|girls?|child(ren)?|kids?|schoolboy|schoolgirl|minors?|toddler|baby|anak|remaja|belasan tahun|bocah|siswa|pelajar)\b/i,
    alasan: "menyebut anak/remaja (Flow menolak anak di bawah umur di adegan berbahaya)",
  },
  {
    re: /\b(soekarno|sukarno|bung karno|hatta|bung tomo|sutomo|diponegoro|kartini|cut nyak dhien|pattimura|gajah mada|hayam wuruk|suharto|soeharto|jokowi|prabowo|habibie|gus dur|megawati|sudirman|imam bonjol|ki hajar dewantara)\b/i,
    alasan: "menyebut tokoh nyata (Flow menolak membuat sosok/suara tokoh berpengaruh)",
  },
  {
    re: /\b(blood(y)?|gore|corpses?|dead bod(y|ies)|kill(s|ing|ed)?|stab(s|bing|bed)?|shoot(s|ing)? (at|him|her|them)|behead\w*|torture\w*|mayat|tewas|dibunuh|membunuh|menusuk)\b/i,
    alasan: "kekerasan grafis (gambarkan suasana/akibatnya saja)",
  },
];

export function cekKebijakan(teks: string): string[] {
  const hasil: string[] = [];
  for (const p of POLA) {
    const m = teks.match(p.re);
    if (m) hasil.push(`"${m[0]}": ${p.alasan}`);
  }
  return hasil;
}

/** Aturan yang ditempel ke prompt Gemini untuk penulis naskah & sutradara. */
export const ATURAN_AMAN = `ATURAN WAJIB agar tidak ditolak Google Flow/Veo:
- Semua tokoh manusia ADALAH ORANG DEWASA (sebut usianya, mis. "in his late twenties"). Jangan pernah menulis anak, remaja, teenager, boy, girl, "belasan tahun", pelajar, dsb. — termasuk di narasi.
- Jangan menyebut nama tokoh nyata (mis. Soekarno, Hatta, Bung Tomo, Diponegoro, Kartini, Gajah Mada, presiden, artis) di prompt maupun di kalimat yang diucapkan. Pakai sebutan umum: "sang orator", "pemimpin di radio", "sang raja", "seorang jenderal".
- Tidak ada kekerasan grafis: tanpa darah, luka, mayat, atau senjata yang diarahkan/mengenai orang. Untuk perang, tunjukkan suasana: asap, reruntuhan, siluet dari jauh, ekspresi tokoh, benda simbolik.
- Senjata boleh tampak sebagai benda yang dipegang/diam, bukan sedang dipakai menyerang.`;
