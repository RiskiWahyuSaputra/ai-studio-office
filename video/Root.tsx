import { Composition, type CalculateMetadataFunction } from "remotion";
import { Cerita } from "./Cerita.tsx";
import { totalFrame, type PropsCerita } from "../src/shared/video.ts";

const contoh: PropsCerita = {
  fps: 30,
  judul: "Ketukan Jam Dua Pagi",
  label: "Part 1",
  suasana: "horor",
  subtitle: true,
  adegan: [
    {
      media: "https://picsum.photos/id/1043/1080/1920",
      jenis: "gambar",
      mulaiNarasi: 0.3,
      durasi: 150,
      gerak: { kamera: "zoom-masuk", efek: ["kabut", "kedip", "debu"] },
      kata: "Setiap jam dua pagi ada yang mengetuk pintu kamarku".split(" ").map((t, i) => ({ teks: t, mulai: 0.3 + i * 0.42, akhir: 0.3 + (i + 1) * 0.42 })),
    },
    {
      media: "https://picsum.photos/id/1041/1080/1920",
      jenis: "gambar",
      mulaiNarasi: 0.3,
      durasi: 150,
      gerak: { kamera: "geser-kiri", efek: ["hujan", "getar", "gelap"] },
      kata: "Tiga kali, pelan, lalu sunyi".split(" ").map((t, i) => ({ teks: t, mulai: 0.3 + i * 0.5, akhir: 0.3 + (i + 1) * 0.5 })),
    },
  ],
};

const metadata: CalculateMetadataFunction<PropsCerita> = ({ props }) => ({
  durationInFrames: totalFrame(props),
  fps: props.fps,
});

export const Root = () => (
  <Composition
    id="PovQCerita"
    component={Cerita}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={300}
    defaultProps={contoh}
    calculateMetadata={metadata}
  />
);
