/**
 * Kode dibuat sistem dari nama.
 *
 * Kode tetap dibutuhkan sebagai pengenal yang tidak ikut berubah bila nama diganti (dan kode periode
 * serta kategori wajib unik, Bab 7.1/8.1), tetapi admin tidak perlu mengarangnya atau melihatnya:
 * formulir hanya meminta nama. "Dies Natalis FSM UNDIP 2026" → "DIES-NATALIS-FSM-UNDIP-2026".
 * Kode yang diberikan eksplisit (seed, uji, impor lama) tetap dipakai apa adanya.
 */

const PANJANG_MAKS = 48;

export function kodeDariNama(nama: string): string {
  const dasar = nama
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (dasar.length <= PANJANG_MAKS) return dasar || "DATA";
  // Dipotong di batas kata supaya tidak berakhir dengan potongan kata.
  const potong = dasar.slice(0, PANJANG_MAKS);
  const batas = potong.lastIndexOf("-");
  return batas > PANJANG_MAKS / 2 ? potong.slice(0, batas) : potong;
}

/**
 * Kode unik dari nama: bila sudah dipakai, diberi akhiran -2, -3, dan seterusnya.
 * `sudahDipakai` memeriksa ke basis data (atau ke kumpulan kode dalam satu berkas impor).
 */
export async function kodeUnikDariNama(
  nama: string,
  sudahDipakai: (kode: string) => Promise<boolean> | boolean
): Promise<string> {
  const dasar = kodeDariNama(nama);
  if (!(await sudahDipakai(dasar))) return dasar;
  for (let i = 2; ; i++) {
    const calon = `${dasar}-${i}`;
    if (!(await sudahDipakai(calon))) return calon;
  }
}

/** Nama dibandingkan tanpa beda huruf besar-kecil, spasi berlebih, dan tanda diakritik. */
export function samakanNama(nama: string): string {
  return nama.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}
