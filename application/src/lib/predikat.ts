/**
 * Predikat nilai: label baca untuk nilai akhir, mis. "Sangat baik" atau "Perlu perbaikan".
 *
 * Angka 82,40 tidak memberi tahu apakah itu bagus sampai pembacanya tahu skalanya dan sebaran
 * objek lain. Predikat menjawab itu dalam satu kata, tanpa mengubah apa pun: nilai, peringkat,
 * dan kelayakan dihitung persis seperti sebelumnya — predikat hanya dibubuhkan saat ditampilkan.
 *
 * Ambangnya ditulis dalam PERSEN DARI NILAI MAKSIMUM, bukan angka mutlak, supaya satu susunan
 * ambang tetap berlaku pada kategori berskala 1–5 maupun 0–100. Nilai maksimum sebuah kategori
 * dihitung dari instrumen yang dipakai, bukan diasumsikan 100.
 */

export interface AmbangPredikat {
  label: string;
  /** Batas bawah, persen dari nilai maksimum (0–100). Tingkat terendah selalu 0. */
  min: number;
}

export interface Predikat {
  label: string;
  /** 0 = tingkat tertinggi. Dipakai memilih warna, bukan untuk urutan peringkat. */
  level: number;
  /** Banyaknya tingkat; bersama level menentukan seberapa "bawah" sebuah predikat. */
  total: number;
  /** Persen nilai terhadap maksimum, dibulatkan 1 desimal — dipakai di keterangan. */
  persen: number;
}

/** Susunan bawaan saat admin menyalakan predikat; boleh diubah seluruhnya. */
export const PREDIKAT_BAWAAN: AmbangPredikat[] = [
  { label: "Sangat baik", min: 90 },
  { label: "Baik", min: 75 },
  { label: "Cukup", min: 60 },
  { label: "Perlu perbaikan", min: 0 },
];

export const MAKS_TINGKAT = 6;

/**
 * Membaca ambang dari kolom Json kategori. Data yang tidak berbentuk daftar ambang diperlakukan
 * sebagai "tidak memakai predikat" — tampilan tidak boleh gagal karena isi kolom yang aneh.
 */
export function bacaAmbang(nilai: unknown): AmbangPredikat[] | null {
  if (!Array.isArray(nilai) || nilai.length === 0) return null;
  const hasil: AmbangPredikat[] = [];
  for (const item of nilai) {
    if (!item || typeof item !== "object") return null;
    const { label, min } = item as { label?: unknown; min?: unknown };
    if (typeof label !== "string" || !label.trim()) return null;
    if (typeof min !== "number" || !Number.isFinite(min) || min < 0 || min > 100) return null;
    hasil.push({ label: label.trim(), min });
  }
  return hasil.sort((a, b) => b.min - a.min);
}

/**
 * Memeriksa susunan ambang yang dikirim admin. Mengembalikan pesan galat berbahasa manusia, atau
 * null bila sah. Dipakai service sebelum menyimpan.
 */
export function periksaAmbang(list: AmbangPredikat[]): string | null {
  if (list.length < 2) return "Predikat membutuhkan minimal dua tingkat.";
  if (list.length > MAKS_TINGKAT) return `Predikat paling banyak ${MAKS_TINGKAT} tingkat.`;
  const urut = [...list].sort((a, b) => b.min - a.min);
  for (const b of urut) {
    if (!b.label.trim()) return "Setiap tingkat harus punya nama.";
    if (!Number.isFinite(b.min) || b.min < 0 || b.min > 100) return "Batas bawah harus antara 0 dan 100 persen.";
  }
  for (let i = 1; i < urut.length; i++) {
    if (urut[i].min === urut[i - 1].min) return "Dua tingkat tidak boleh memakai batas bawah yang sama.";
  }
  if (urut[urut.length - 1].min !== 0) return "Tingkat terendah harus berbatas bawah 0 persen agar tidak ada nilai tanpa predikat.";
  const nama = urut.map((b) => b.label.trim().toLowerCase());
  if (new Set(nama).size !== nama.length) return "Nama tingkat tidak boleh sama.";
  return null;
}

/**
 * Nilai tertinggi yang mungkin dicapai instrumen ini pada satu kelompok penilai.
 *
 * Rerata: tiap parameter paling tinggi bernilai skala maksimum — atau 100 untuk parameter bernilai
 * mentah, karena yang tertinggi di antara objek dinormalisasi ke 100 — lalu dijumlahkan menurut
 * bobotnya. Total: agregatnya menjumlah seluruh respons, jadi batas atasnya bergantung pada
 * berapa orang yang menilai; tidak ada maksimum yang bermakna, sehingga predikat tidak dipakai.
 */
export function skorMaksimum(
  parameters: { weight: number; normalized: boolean }[],
  scaleMax: number,
  aggregation: "RATA_RATA" | "TOTAL"
): number | null {
  if (aggregation !== "RATA_RATA") return null;
  if (parameters.length === 0 || !Number.isFinite(scaleMax) || scaleMax <= 0) return null;
  const maks = parameters.reduce((s, p) => s + ((p.normalized ? 100 : scaleMax) * p.weight) / 100, 0);
  return maks > 0 ? maks : null;
}

/** Predikat sebuah nilai, atau null bila tidak dapat/tidak perlu diberi predikat. */
export function predikatUntuk(
  score: number | null,
  maks: number | null,
  ambang: AmbangPredikat[] | null
): Predikat | null {
  if (score === null || maks === null || maks <= 0 || !ambang || ambang.length === 0) return null;
  const urut = [...ambang].sort((a, b) => b.min - a.min);
  const persen = (score / maks) * 100;
  const level = urut.findIndex((b) => persen >= b.min);
  // Susunan yang sah selalu berujung di 0, tapi data lama bisa saja tidak; nilai di bawah semua
  // ambang mengambil tingkat terendah daripada tampil tanpa predikat.
  const dipakai = level === -1 ? urut.length - 1 : level;
  return {
    label: urut[dipakai].label,
    level: dipakai,
    total: urut.length,
    persen: Math.round(persen * 10) / 10,
  };
}
