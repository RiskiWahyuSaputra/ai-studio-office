/**
 * Isi cadangan saat GEMINI_API_KEY belum diisi, supaya alur kantor tetap bisa dicoba.
 */
import { GAYA, type Adegan, type Format, type Gaya, type Naskah, type PaketUnggah, type Riset } from "../src/shared/types.ts";

interface Bank {
  topik: string;
  sudut: string;
  fakta: string[];
  kataKunci: string[];
  latar: string;
  tokoh: string;
}

const SEJARAH: Bank[] = [
  {
    topik: "Pelabuhan Sunda Kelapa abad ke-16",
    sudut: "POV: kamu kuli angkut di Sunda Kelapa saat kapal Portugis pertama datang",
    fakta: [
      "Sunda Kelapa adalah pelabuhan utama Kerajaan Sunda (Pajajaran).",
      "Tahun 1522 Portugis menandatangani perjanjian dagang dengan Kerajaan Sunda.",
      "Tahun 1527 Fatahillah merebut pelabuhan ini dan menamainya Jayakarta.",
    ],
    kataKunci: ["sunda kelapa", "sejarah jakarta", "pov sejarah"],
    latar: "pelabuhan kayu yang ramai di Jawa abad ke-16, kapal layar Portugis yang tinggi, perahu pinisi, karung rempah, cahaya pagi tropis",
    tokoh: "kuli angkut Sunda berusia akhir 20-an memakai sarung batik sederhana dan ikat kepala",
  },
  {
    topik: "Kehidupan di Majapahit",
    sudut: "POV: kamu pedagang di pasar Trowulan, ibu kota Majapahit",
    fakta: [
      "Trowulan di Mojokerto diyakini sebagai situs ibu kota Majapahit.",
      "Kitab Negarakertagama ditulis Mpu Prapanca tahun 1365.",
      "Majapahit memakai uang kepeng dari Tiongkok sebagai alat tukar.",
    ],
    kataKunci: ["majapahit", "trowulan", "pov sejarah"],
    latar: "pasar Jawa abad ke-14 dengan gapura bata merah, gerabah terakota, uang kepeng tembaga, pohon beringin yang rimbun",
    tokoh: "pedagang rempah Jawa berusia 30-an memakai kain gelap dan ikat kepala sederhana",
  },
  {
    topik: "Batavia tahun 1920-an",
    sudut: "POV: kamu sopir trem di Batavia tahun 1925",
    fakta: [
      "Trem listrik mulai beroperasi di Batavia tahun 1899.",
      "Jalur trem menghubungkan Kota Tua hingga Meester Cornelis (Jatinegara).",
      "Layanan trem di Jakarta dihentikan tahun 1960.",
    ],
    kataKunci: ["batavia", "trem jakarta", "sejarah jakarta"],
    latar: "jalan Batavia tahun 1920-an, gedung kolonial putih, trem listrik tua, sepeda dan delman, nuansa sepia hangat",
    tokoh: "sopir trem Betawi berusia 30-an memakai seragam khaki dan peci hitam",
  },
];

const HEWAN: Bank[] = [
  {
    topik: "Kucing oren penguasa pasar",
    sudut: "Vlog si Oyen, kucing oren yang merasa jadi pemilik pasar tradisional",
    fakta: [
      "Kucing oren mayoritas berjenis kelamin jantan karena gen warna oren terkait kromosom X.",
      "Pasar tradisional jadi wilayah favorit kucing kampung karena banyak sisa ikan.",
    ],
    kataKunci: ["kucing oren", "oyen", "vlog kucing"],
    latar: "pasar tradisional Indonesia yang ramai di pagi hari, lapak ikan, keranjang plastik warna-warni, para pedagang",
    tokoh: "kucing oren gemuk membawa kamera vlog mungil, wajahnya ekspresif",
  },
  {
    topik: "Komodo yang bosan jadi tontonan",
    sudut: "Vlog Komo, komodo di Pulau Rinca yang curhat soal turis",
    fakta: [
      "Komodo adalah kadal terbesar di dunia, panjangnya bisa sampai 3 meter.",
      "Komodo hanya hidup di beberapa pulau di Nusa Tenggara Timur.",
    ],
    kataKunci: ["komodo", "labuan bajo", "vlog hewan"],
    latar: "bukit sabana kering di Pulau Rinca, laut biru toska di belakang, matahari siang yang terik",
    tokoh: "komodo besar yang bicara ke kamera seperti vlogger yang lelah",
  },
  {
    topik: "Ayam jago reporter subuh",
    sudut: "Laporan langsung Jago, ayam jago yang jadi reporter berita subuh kampung",
    fakta: [
      "Ayam jago berkokok karena jam biologis, bukan hanya karena cahaya matahari.",
      "Ayam pelung dari Cianjur terkenal dengan kokok panjangnya.",
    ],
    kataKunci: ["ayam jago", "berita kampung", "vlog hewan"],
    latar: "desa di Indonesia saat subuh, sawah, gunung berkabut, rumah kayu",
    tokoh: "ayam jago gagah memegang mikrofon mungil seperti reporter TV",
  },
];

const HOROR: Bank[] = [
  {
    topik: "Ketukan jam dua pagi di kos-kosan",
    sudut: "Setiap jam dua pagi, ada yang mengetuk pintu kamar kosku tiga kali",
    fakta: [
      "Cerita ketukan tengah malam adalah legenda urban yang sering muncul di kos-kosan mahasiswa di Indonesia.",
      "Dalam banyak cerita rakyat Jawa, jam satu sampai tiga pagi dianggap waktu paling 'sepi'.",
    ],
    kataKunci: ["cerita horor", "kos angker", "horor indonesia"],
    latar: "lorong kos-kosan tua di malam hari, lampu neon berkedip, pintu-pintu kayu berjajar, lantai tegel, kabut tipis",
    tokoh: "mahasiswa pria berusia 22 tahun berkaus abu-abu dan bercelana pendek, rambut berantakan",
  },
  {
    topik: "Angkot terakhir yang tidak pernah sampai",
    sudut: "Aku naik angkot terakhir malam itu, dan semua penumpangnya diam menatap ke depan",
    fakta: [
      "Kisah kendaraan 'misterius' di jalan sepi adalah legenda urban yang ada di banyak kota di Indonesia.",
      "Cerita ini sering dikaitkan dengan jalan yang melewati kebun atau pemakaman tua.",
    ],
    kataKunci: ["cerita horor", "angkot misterius", "legenda urban"],
    latar: "jalan desa sepi di malam hari diapit kebun bambu, satu lampu jalan redup, kabut tebal, angkot hijau tua",
    tokoh: "pekerja kantoran pria berusia 30 tahun berkemeja biru dan membawa tas punggung",
  },
  {
    topik: "Rumah nenek di ujung desa",
    sudut: "Nenek selalu melarangku membuka pintu belakang setelah magrib",
    fakta: [
      "Larangan keluar rumah saat magrib adalah kepercayaan yang hidup di banyak daerah di Indonesia.",
      "Rumah joglo tua dengan pintu belakang ke kebun sering jadi latar cerita seram di Jawa.",
    ],
    kataKunci: ["cerita horor", "rumah nenek", "pamali"],
    latar: "rumah joglo tua di desa saat senja, lampu minyak, pintu kayu belakang menghadap kebun pisang yang gelap",
    tokoh: "wanita berusia 25 tahun berkerudung cokelat dan berbaju batik sederhana",
  },
];

function pilih(format: Format, ide: string): Bank {
  const bank = format === "pov-sejarah" ? SEJARAH : format === "vlog-hewan" ? HEWAN : HOROR;
  const q = ide.toLowerCase();
  const cocok = bank.find((b) => q && (b.topik.toLowerCase().includes(q) || b.kataKunci.some((k) => q.includes(k))));
  if (cocok) return cocok;
  if (ide.trim()) {
    return {
      ...bank[0],
      topik: ide.trim(),
      sudut:
        format === "pov-sejarah"
          ? `POV: kamu hidup di masa ${ide.trim()}`
          : format === "vlog-hewan"
            ? `Vlog hewan: ${ide.trim()}`
            : `Kisah seram: ${ide.trim()}`,
      fakta: ["(Isi fakta ini setelah riset manual — mode templat tidak bisa mencari data.)"],
      kataKunci: [ide.trim().toLowerCase(), format === "pov-sejarah" ? "pov sejarah" : format === "vlog-hewan" ? "vlog hewan" : "cerita horor"],
      latar:
        format === "pov-sejarah"
          ? `latar Indonesia yang akurat secara sejarah tentang "${ide.trim()}", pakaian dan bangunan sesuai zamannya`
          : format === "vlog-hewan"
            ? `suasana sehari-hari di Indonesia yang berkaitan dengan "${ide.trim()}"`
            : `suasana malam yang sepi dan berkabut di Indonesia, berkaitan dengan "${ide.trim()}"`,
      tokoh:
        format === "pov-sejarah"
          ? "warga biasa dewasa dari masa itu, berusia 30-an"
          : format === "vlog-hewan"
            ? "tokoh hewan yang ekspresif dan lucu"
            : "pria dewasa berusia 28 tahun berjaket gelap",
    };
  }
  return bank[Math.floor(Math.random() * bank.length)];
}

export function risetTemplat(format: Format, ide: string): Riset {
  const b = pilih(format, ide);
  return {
    topik: b.topik,
    sudut: b.sudut,
    alasan:
      format === "pov-sejarah"
        ? "Format POV membuat penonton merasa ikut hadir, cocok untuk retensi Shorts dan TikTok."
        : format === "vlog-hewan"
          ? "Hewan lokal dengan karakter kocak gampang dibagikan dan memancing komentar."
          : "Cerita horor dengan latar yang akrab bikin penonton bertahan sampai akhir dan ramai di komentar.",
    fakta: b.fakta,
    kataKunci: b.kataKunci,
  };
}

export function naskahTemplat(format: Format, r: Riset): Naskah {
  if (format === "cerita-horor") {
    return {
      judulKerja: r.sudut,
      hook: `${r.sudut}. Malam itu, aku akhirnya tahu kenapa.`,
      narasi: [
        "Awalnya aku kira cuma perasaanku saja.",
        "Tapi suara itu datang lagi, tepat di waktu yang sama.",
        "Aku memberanikan diri melihat lewat celah pintu.",
        "Di ujung lorong, ada sosok yang berdiri diam, menghadap ke arahku.",
        "Dan saat lampu berkedip, sosok itu sudah tidak ada di sana.",
      ].join("\n"),
      cta: "Kalian pernah ngalamin yang kayak gini? Ceritain di komentar. Part 2 menyusul.",
    };
  }
  if (format === "pov-sejarah") {
    return {
      judulKerja: r.sudut,
      hook: `${r.sudut}. Dan hari ini, semuanya berubah.`,
      narasi: [
        "Matahari baru naik, tapi kamu sudah bekerja.",
        r.fakta[0] ?? "",
        "Orang-orang dari jauh datang membawa barang yang belum pernah kamu lihat.",
        r.fakta[1] ?? "",
        "Kamu tidak tahu, hari ini akan dicatat dalam sejarah.",
        r.fakta[2] ?? "Dan sejak itu, kotamu tidak pernah sama lagi.",
      ]
        .filter(Boolean)
        .join("\n"),
      cta: "Mau POV zaman apa lagi? Tulis di komentar.",
    };
  }
  return {
    judulKerja: r.sudut,
    hook: "Halo gaes, balik lagi sama aku!",
    narasi: [
      "Hari ini aku mau tunjukin rutinitas pagiku.",
      r.fakta[0] ?? "",
      "Pertama, cek wilayah. Semua aman terkendali.",
      r.fakta[1] ?? "",
      "Terus... ya udah, tidur lagi. Hidup itu harus santai.",
    ]
      .filter(Boolean)
      .join("\n"),
    cta: "Follow biar nggak ketinggalan vlog besok!",
  };
}

export function adeganTemplat(
  format: Format,
  ide: string,
  n: Naskah,
  durasiKlip: number,
  gayaVisual: Gaya = "sinematik",
  narasiTts = false,
): Adegan[] {
  const g = GAYA[gayaVisual];
  const b = pilih(format, ide);
  const baris = [n.hook, ...n.narasi.split("\n"), n.cta].filter((s) => s.trim());
  const gaya =
    format === "pov-sejarah"
      ? `sudut pandang orang pertama (POV), ${g.prompt}`
      : format === "vlog-hewan"
        ? `gaya vlog, hewan bicara ke kamera, waktu komedi yang pas, ${g.prompt}`
        : `suasana horor yang mencekam, cahaya redup, kabut, bayangan panjang, sosok misterius hanya terlihat samar dari kejauhan, tanpa darah atau kekerasan, ${g.prompt}`;
  return baris.slice(0, 7).map((teks, i) => ({
    no: i + 1,
    durasi: durasiKlip,
    visual: i === 0 ? `Pembuka: ${b.sudut}` : `Adegan ${i + 1} di latar ${b.topik}`,
    narasi: teks,
    prompt:
      `${g.kepala}. ${b.latar}. ${i === 0 ? "Adegan pembuka" : "Adegan " + (i + 1)}: ${b.tokoh}` +
      (narasiTts
        ? `${format === "vlog-hewan" ? " bicara ke kamera dengan gerak mulut yang ekspresif" : ""}. ${gaya}. Tanpa dialog, tanpa ucapan, tanpa suara narator, hanya efek suara latar. Tanpa teks, tanpa subtitle, tanpa watermark.`
        : `${format === "vlog-hewan" ? ` berkata: "${teks}"` : `, sementara narator berkata ${format === "cerita-horor" ? "pelan dan mencekam" : "dengan tenang"}: "${teks}"`}. ${gaya}. Tanpa teks, tanpa subtitle, tanpa watermark.`),
  }));
}

export function paketTemplat(n: Naskah, r: Riset): PaketUnggah {
  const tags = [...new Set([...r.kataKunci, "ai video", "veo", "fyp"])];
  const hashtag = tags.map((t) => `#${t.replace(/\s+/g, "")}`).join(" ");
  return {
    youtube: {
      judul: `${n.judulKerja}`.slice(0, 95),
      deskripsi: `${n.hook}\n\n${r.fakta.map((f) => `• ${f}`).join("\n")}\n\n${n.cta}\n\nVideo ini dibuat dengan AI (Google Veo).\n\n${hashtag}`,
      tags,
    },
    tiktok: { caption: `${n.hook} ${hashtag}`.slice(0, 2000) },
    instagram: { caption: `${n.hook}\n\n${n.cta}\n.\n${hashtag}`.slice(0, 2200) },
  };
}
