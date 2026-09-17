/**
 * Isian alasan untuk penambahan saat periode sudah berjalan (lihat
 * lib/services/penambahan-berjalan.ts). Hanya dirender bila periodenya Aktif; saat Draf tidak ada
 * yang perlu dijelaskan.
 */
export function AlasanBerjalan({ contoh }: { contoh: string }) {
  return (
    <label className="admin-tools__field alasan-berjalan">
      <span>Alasan penambahan (wajib)</span>
      <span className="admin-tools__hint">
        Periode sedang berjalan: yang sudah ada tidak berubah, penambahan ini dicatat di audit.
      </span>
      <input name="reason" required maxLength={300} placeholder={contoh} className="form__control" />
    </label>
  );
}
