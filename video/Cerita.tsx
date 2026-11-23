import { Audio, Video } from "@remotion/media";
import { loadFont } from "@remotion/google-fonts/Montserrat";
import { AbsoluteFill, Easing, Img, interpolate, random, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { TRANSISI, type AdeganVideo, type Efek, type Kamera, type KataWaktu, type PropsCerita } from "../src/shared/video.ts";

const { fontFamily } = loadFont("normal", { weights: ["700", "800"], subsets: ["latin"] });

const WARNA_AKSEN: Record<PropsCerita["suasana"], string> = {
  horor: "#ff5a5a",
  ceria: "#ffd23f",
  hangat: "#f2b33d",
};

export const Cerita = (props: PropsCerita) => {
  let mulai = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {props.adegan.map((a, i) => {
        const from = mulai;
        mulai += a.durasi;
        const terakhir = i === props.adegan.length - 1;
        return (
          <Sequence key={i} from={from} durationInFrames={a.durasi + (terakhir ? 0 : TRANSISI)} name={`Adegan ${i + 1}`}>
            <Adegan a={a} pertama={i === 0} suasana={props.suasana} />
            {a.narasi ? (
              <Sequence from={Math.round(a.mulaiNarasi * props.fps)} name="Narasi" layout="none">
                <Audio src={a.narasi} />
              </Sequence>
            ) : null}
            {props.subtitle && a.kata.length ? <Subtitle kata={a.kata} aksen={WARNA_AKSEN[props.suasana]} /> : null}
          </Sequence>
        );
      })}
      <Vignette kuat={props.suasana === "horor"} />
      {props.suasana === "horor" ? <Grain /> : null}
      <Watermark />
      {props.label || props.judul ? (
        <Sequence durationInFrames={Math.round(2.2 * props.fps)} name="Kartu judul">
          <KartuJudul judul={props.judul} label={props.label} aksen={WARNA_AKSEN[props.suasana]} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

/** Satu adegan: gambar/klip yang bergerak + efek suasana, dengan transisi masuk. */
const Adegan = ({ a, pertama, suasana }: { a: AdeganVideo; pertama: boolean; suasana: PropsCerita["suasana"] }) => {
  const frame = useCurrentFrame();
  const total = a.durasi + TRANSISI;
  return (
    <AbsoluteFill
      style={{
        opacity: pertama ? 1 : interpolate(frame, [0, TRANSISI], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        overflow: "hidden",
      }}
    >
      <Bergerak kamera={a.gerak.kamera} total={total} getar={a.gerak.efek.includes("getar")}>
        {a.jenis === "video" ? (
          <Video src={a.media} loop volume={a.volumeMedia ?? 0} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Img src={a.media} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </Bergerak>
      {a.gerak.efek.map((e) => (
        <LapisanEfek key={e} efek={e} suasana={suasana} />
      ))}
    </AbsoluteFill>
  );
};

/** Gerak kamera ala "Ken Burns" pada gambar diam. */
const Bergerak = ({ kamera, total, getar, children }: { kamera: Kamera; total: number; getar: boolean; children: React.ReactNode }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, total], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const geser = 70; // px
  const awal: Record<Kamera, [number, number, number]> = {
    "zoom-masuk": [1.05, 0, 0],
    "zoom-keluar": [1.22, 0, 0],
    "geser-kiri": [1.16, geser, 0],
    "geser-kanan": [1.16, -geser, 0],
    "geser-atas": [1.16, 0, geser],
    "geser-bawah": [1.16, 0, -geser],
    diam: [1.06, 0, 0],
  };
  const akhir: Record<Kamera, [number, number, number]> = {
    "zoom-masuk": [1.22, 0, 0],
    "zoom-keluar": [1.05, 0, 0],
    "geser-kiri": [1.16, -geser, 0],
    "geser-kanan": [1.16, geser, 0],
    "geser-atas": [1.16, 0, -geser],
    "geser-bawah": [1.16, 0, geser],
    diam: [1.08, 0, 0],
  };
  const [s0, x0, y0] = awal[kamera];
  const [s1, x1, y1] = akhir[kamera];
  const gx = getar ? (random(`gx${Math.floor(frame / 2)}`) - 0.5) * 14 : 0;
  const gy = getar ? (random(`gy${Math.floor(frame / 2)}`) - 0.5) * 14 : 0;
  return (
    <AbsoluteFill
      style={{
        scale: String(s0 + (s1 - s0) * t),
        translate: `${x0 + (x1 - x0) * t + gx}px ${y0 + (y1 - y0) * t + gy}px`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const LapisanEfek = ({ efek, suasana }: { efek: Efek; suasana: PropsCerita["suasana"] }) => {
  switch (efek) {
    case "kabut":
      return <Kabut />;
    case "kedip":
      return <Kedip />;
    case "hujan":
      return <Hujan />;
    case "debu":
      return <Debu terang={suasana !== "horor"} />;
    case "gelap":
      return <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,20,0.55), rgba(0,0,0,0.25) 45%, rgba(0,0,10,0.65))" }} />;
    default:
      return null;
  }
};

const Kabut = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {[0, 1, 2].map((i) => (
        <AbsoluteFill
          key={i}
          style={{
            background: `radial-gradient(ellipse 60% 25% at ${30 + i * 25}% ${55 + i * 12}%, rgba(210,220,235,${0.28 - i * 0.05}), transparent 70%)`,
            translate: `${interpolate(frame, [0, 300], [-120 + i * 80, 120 - i * 60])}px 0px`,
            filter: "blur(30px)",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/** Lampu berkedip: kegelapan yang tiba-tiba menebal di frame acak. */
const Kedip = () => {
  const frame = useCurrentFrame();
  const blok = Math.floor(frame / 3);
  const r = random(`kedip${blok}`);
  const gelap = r > 0.9 ? 0.75 : r > 0.8 ? 0.4 : 0.05;
  return <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${gelap})` }} />;
};

const Hujan = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 90 }, (_, i) => {
        const x = random(`hx${i}`) * width;
        const kecepatan = 38 + random(`hv${i}`) * 25;
        const y = ((random(`hy${i}`) * height + frame * kecepatan) % (height + 200)) - 100;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 2,
              height: 60 + random(`hl${i}`) * 40,
              background: "linear-gradient(transparent, rgba(200,215,255,0.55))",
              rotate: "12deg",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Debu = ({ terang }: { terang: boolean }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: 45 }, (_, i) => {
        const x = (random(`dx${i}`) * width + Math.sin((frame + i * 20) / 40) * 30) % width;
        const y = (random(`dy${i}`) * height - frame * (0.4 + random(`dv${i}`) * 0.6) + height) % height;
        const s = 3 + random(`ds${i}`) * 5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: s,
              height: s,
              borderRadius: "50%",
              background: terang ? "rgba(255,240,200,0.8)" : "rgba(220,220,230,0.45)",
              filter: "blur(1px)",
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Vignette = ({ kuat }: { kuat: boolean }) => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `radial-gradient(ellipse at center, transparent ${kuat ? 45 : 60}%, rgba(0,0,0,${kuat ? 0.8 : 0.45}) 100%)`,
    }}
  />
);

const Grain = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.13, mixBlendMode: "overlay" }}>
      <svg width="100%" height="100%">
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={Math.floor(frame / 2) % 50} />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

/** Subtitle karaoke: 4 kata per baris, kata yang sedang diucapkan menyala. */
const Subtitle = ({ kata, aksen }: { kata: KataWaktu[]; aksen: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const detik = frame / fps;
  const PER = 4;
  const kelompok: KataWaktu[][] = [];
  for (let i = 0; i < kata.length; i += PER) kelompok.push(kata.slice(i, i + PER));
  const aktif = kelompok.find((g) => detik >= g[0].mulai - 0.05 && detik < g[g.length - 1].akhir + 0.15);
  if (!aktif) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 380, pointerEvents: "none" }}>
      <div
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: 76,
          lineHeight: 1.15,
          textAlign: "center",
          maxWidth: 920,
          color: "#fff",
          WebkitTextStroke: "10px rgba(0,0,0,0.85)",
          paintOrder: "stroke fill",
          textShadow: "0 6px 24px rgba(0,0,0,0.6)",
        }}
      >
        {aktif.map((k, i) => {
          const nyala = detik >= k.mulai && detik < k.akhir;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                margin: "0 16px",
                color: nyala ? aksen : "#fff",
                scale: nyala ? "1.08" : "1",
              }}
            >
              {k.teks}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const Watermark = () => (
  <AbsoluteFill style={{ alignItems: "flex-end", padding: "70px 56px", pointerEvents: "none" }}>
    <div
      style={{
        fontFamily,
        fontWeight: 800,
        fontSize: 40,
        color: "rgba(255,255,255,0.82)",
        letterSpacing: 1,
        textShadow: "0 2px 10px rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ width: 26, height: 26, background: "#f2b33d", boxShadow: "5px 5px 0 #a86f12", display: "inline-block" }} />
      PovQ
    </div>
  </AbsoluteFill>
);

const KartuJudul = ({ judul, label, aksen }: { judul: string; label?: string; aksen: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 0.3 * fps, 1.6 * fps, 2.2 * fps], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity, background: "rgba(0,0,0,0.35)" }}>
      <div style={{ textAlign: "center", fontFamily, color: "#fff", padding: "0 80px" }}>
        {label ? (
          <div
            style={{
              display: "inline-block",
              fontWeight: 800,
              fontSize: 54,
              color: "#111",
              background: aksen,
              padding: "8px 28px",
              marginBottom: 28,
              translate: `0px ${interpolate(frame, [0, 0.4 * fps], [30, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })}px`,
            }}
          >
            {label}
          </div>
        ) : null}
        <div style={{ fontWeight: 800, fontSize: 82, lineHeight: 1.1, WebkitTextStroke: "8px rgba(0,0,0,0.8)", paintOrder: "stroke fill" }}>{judul}</div>
      </div>
    </AbsoluteFill>
  );
};
