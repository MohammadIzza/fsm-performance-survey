import { ServiceError } from "@/lib/services/units";

/**
 * Aturan menambah objek dan penilai pada periode yang sedang berjalan.
 *
 * Saat Draf semuanya bebas diubah. Saat Aktif hanya PENAMBAHAN yang diizinkan — objek baru ke
 * kategori, penilai manual, dan pembagian otomatis untuk slot yang belum terisi. Mengeluarkan objek,
 * mengubah aturan, pertanyaan, atau bobot tetap terkunci, sehingga penilaian yang sudah masuk tidak
 * berubah dasarnya. Karena ini menyimpang dari rencana awal periode, alasannya wajib dan disimpan
 * di audit.
 *
 * Mengembalikan alasan yang sudah dirapikan (null saat Draf).
 */
export function periksaPenambahan(
  period: { status: string; endsAt: Date },
  alasan: string | null | undefined,
  apa: string
): string | null {
  if (period.status === "DRAF") return null;
  if (period.status !== "AKTIF") {
    throw new ServiceError(`${apa} hanya dapat dilakukan selama periode berstatus Draf atau Aktif.`);
  }
  if (new Date() >= period.endsAt) {
    throw new ServiceError(`Tenggat periode sudah lewat, jadi ${apa.toLowerCase()} tidak dapat dilakukan lagi.`);
  }
  const rapi = alasan?.trim();
  if (!rapi) throw new ServiceError("Periode sedang berjalan — alasan penambahan wajib diisi.");
  return rapi;
}
