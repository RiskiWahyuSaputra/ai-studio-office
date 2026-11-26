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
    re: /\b(young|youth|pemuda|pemudi|muda belia|anak muda)\b/i,
    alasan: "kata 'young/pemuda' bisa dibaca sebagai remaja; tulis usia jelas, mis. 'pria berusia 30 tahun berkumis tipis'",
  },
  {
    re: /\b(weapons?|spears?|rifles?|guns?|pistols?|swords?|keris|bambu runcing|bamboo spear|sharpened bamboo|senjata|senapan|tombak|pedang|bayonets?|bayonet|granat|grenades?)\b/i,
    alasan: "senjata (dalam konteks perang sering ditolak; ganti dengan benda simbolik seperti bendera)",
  },
  {
    re: /\b(blood(y)?|gore|corpses?|dead bod(y|ies)|kill(s|ing|ed)?|stab(s|bing|bed)?|shoot(s|ing)? (at|him|her|them)|behead\w*|torture\w*|mayat|tewas|dibunuh|membunuh|menusuk)\b/i,
    alasan: "kekerasan grafis (gambarkan suasana/akibatnya saja)",
  },
  {
    re: /\b(sobek|robek|compang[- ]camping|terkoyak|torn|ripped|tattered)\b/i,
    alasan: "pakaian sobek sering dibaca sebagai kekerasan/konten seksual; tulis 'gaun putih panjang kusam' saja",
  },
  {
    re: /\b(sangat pucat|pucat pasi|kurus kering|basah kuyup|rambut (yang )?(tampak )?basah|kuku panjang|pale skin|wet hair)\b/i,
    alasan: "ciri mirip mayat/korban; gambarkan hantu sebagai sosok kartun tembus pandang yang berpendar",
  },
  {
    re: /\b((ke|di) telinga|berbisik di|mencengkeram|mencekik|menyentuh|memeluk|menindih|diikat|terikat|disekap|dikurung|ditawan|grab(s|bing)?|choke\w*|tied up)\b/i,
    alasan: "kontak fisik/penyekapan antara sosok seram dan manusia sering ditolak; tunjukkan dari jarak (bayangan, siluet di belakang)",
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
- Semua tokoh manusia ADALAH ORANG DEWASA dengan ciri dewasa yang jelas, mis. "pria berusia 30 tahun berkumis tipis". Jangan pakai kata young, youth, teen, boy, girl, pemuda, "belasan tahun", pelajar, anak — termasuk di narasi.
- Jangan menyebut nama tokoh nyata (mis. Soekarno, Hatta, Bung Tomo, Diponegoro, Kartini, Gajah Mada, presiden, artis) di prompt maupun di kalimat yang diucapkan. Pakai sebutan umum: "sang orator", "pemimpin di radio", "sang raja", "seorang jenderal".
- Tidak ada kekerasan grafis: tanpa darah, luka, mayat, ledakan yang mengenai bangunan/orang, atau adegan bertempur.
- Hantu/makhluk gaib digambarkan sebagai sosok kartun tembus pandang yang berpendar lembut (bukan manusia pucat seperti mayat). Jangan pakai ciri: kulit sangat pucat, kurus kering, rambut basah, kuku panjang, atau pakaian sobek/compang-camping.
- Tidak ada kontak fisik antara sosok seram dan manusia (berbisik di telinga, menyentuh, mencengkeram, mencekik, memeluk) dan tidak ada orang yang disekap, diikat, atau dikurung. Bangun ketegangan dari jarak: sosok samar di ujung lorong, bayangan di dinding, pantulan di cermin, ekspresi takut tokoh.
- Jangan tampilkan atau sebut senjata apa pun (termasuk bambu runcing, keris, senapan, tank yang menembak). Untuk tema perang, tunjukkan suasana dari jauh (asap di cakrawala, pesawat kecil jauh di langit), ekspresi tokoh, dan benda simbolik (bendera merah putih, radio tua, surat).`;
