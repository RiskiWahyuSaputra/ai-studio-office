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
    latar: "a bustling 16th-century wooden harbor in Java, tall Portuguese carracks, pinisi boats, spice sacks, tropical morning light",
    tokoh: "a Sundanese porter in his late twenties wearing a simple batik sarong and headcloth",
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
    latar: "a 14th-century Javanese market with red brick gates, terracotta pottery, Chinese copper coins, lush banyan trees",
    tokoh: "a Javanese spice merchant in his thirties wearing a dark kain and a simple head wrap",
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
    latar: "1920s colonial Batavia street, white colonial buildings, an old electric tram, bicycles and horse carriages, sepia warm tones",
    tokoh: "a Betawi tram driver in his thirties wearing a khaki uniform and black peci",
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
    latar: "a busy Indonesian traditional wet market at morning, fish stalls, colorful plastic baskets, vendors",
    tokoh: "a chubby orange tabby cat with a tiny vlog camera, expressive face",
  },
  {
    topik: "Komodo yang bosan jadi tontonan",
    sudut: "Vlog Komo, komodo di Pulau Rinca yang curhat soal turis",
    fakta: [
      "Komodo adalah kadal terbesar di dunia, panjangnya bisa sampai 3 meter.",
      "Komodo hanya hidup di beberapa pulau di Nusa Tenggara Timur.",
    ],
    kataKunci: ["komodo", "labuan bajo", "vlog hewan"],
    latar: "dry savanna hills of Rinca Island, turquoise sea in the background, bright midday sun",
    tokoh: "a large Komodo dragon talking to the camera like a tired vlogger",
  },
  {
    topik: "Ayam jago reporter subuh",
    sudut: "Laporan langsung Jago, ayam jago yang jadi reporter berita subuh kampung",
    fakta: [
      "Ayam jago berkokok karena jam biologis, bukan hanya karena cahaya matahari.",
      "Ayam pelung dari Cianjur terkenal dengan kokok panjangnya.",
    ],
    kataKunci: ["ayam jago", "berita kampung", "vlog hewan"],
    latar: "an Indonesian village at dawn, rice fields, misty mountains, wooden houses",
    tokoh: "a proud rooster with a tiny microphone acting like a TV reporter",
  },
];

function pilih(format: Format, ide: string): Bank {
  const bank = format === "pov-sejarah" ? SEJARAH : HEWAN;
  const q = ide.toLowerCase();
  const cocok = bank.find((b) => q && (b.topik.toLowerCase().includes(q) || b.kataKunci.some((k) => q.includes(k))));
  if (cocok) return cocok;
  if (ide.trim()) {
    return {
      ...bank[0],
      topik: ide.trim(),
      sudut: format === "pov-sejarah" ? `POV: kamu hidup di masa ${ide.trim()}` : `Vlog hewan: ${ide.trim()}`,
      fakta: ["(Isi fakta ini setelah riset manual — mode templat tidak bisa mencari data.)"],
      kataKunci: [ide.trim().toLowerCase(), format === "pov-sejarah" ? "pov sejarah" : "vlog hewan"],
      latar:
        format === "pov-sejarah"
          ? `a historically accurate Indonesian setting of "${ide.trim()}", period-correct clothing and architecture`
          : `an Indonesian everyday setting related to "${ide.trim()}"`,
      tokoh: format === "pov-sejarah" ? "an ordinary adult local person of that era, in their thirties" : "the animal character, expressive and funny",
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
        : "Hewan lokal dengan karakter kocak gampang dibagikan dan memancing komentar.",
    fakta: b.fakta,
    kataKunci: b.kataKunci,
  };
}

export function naskahTemplat(format: Format, r: Riset): Naskah {
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

export function adeganTemplat(format: Format, ide: string, n: Naskah, durasiKlip: number, gayaVisual: Gaya = "sinematik"): Adegan[] {
  const g = GAYA[gayaVisual];
  const b = pilih(format, ide);
  const baris = [n.hook, ...n.narasi.split("\n"), n.cta].filter((s) => s.trim());
  const gaya =
    format === "pov-sejarah"
      ? `first-person POV, ${g.prompt}`
      : `vlog style, the animal talks to the camera, comedic timing, ${g.prompt}`;
  return baris.slice(0, 7).map((teks, i) => ({
    no: i + 1,
    durasi: durasiKlip,
    visual: i === 0 ? `Pembuka: ${b.sudut}` : `Adegan ${i + 1} di latar ${b.topik}`,
    narasi: teks,
    prompt:
      `${g.kepala}. ${b.latar}. ${i === 0 ? "Opening shot" : "Shot " + (i + 1)}: ${b.tokoh}` +
      `${format === "vlog-hewan" ? ` says in Indonesian: "${teks}"` : `, while a calm Indonesian narrator says: "${teks}"`}. ` +
      `${gaya}. No text, no subtitles, no watermark.`,
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
