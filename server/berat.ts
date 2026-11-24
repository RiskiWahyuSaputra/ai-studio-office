/**
 * Antrean pekerjaan berat (VoxCPM ~6,5 GB dan render Remotion/Chrome). Keduanya tidak boleh
 * berjalan bersamaan: RAM laptop habis lalu browser render crash dan server ikut dimatikan.
 */
let antrean: Promise<unknown> = Promise.resolve();

export function antreBerat<T>(kerja: () => Promise<T>): Promise<T> {
  const hasil = antrean.then(kerja);
  antrean = hasil.catch(() => {});
  return hasil;
}
