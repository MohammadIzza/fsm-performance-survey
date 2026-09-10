import type { ComponentProps, ReactNode } from "react";
import { ThemeButton } from "@/components/theme-button";

/**
 * Baris penyaring di atas sebuah daftar.
 *
 * Sebelumnya tiap halaman menanganinya sendiri-sendiri: Audit memakai kotak putih berisi petak
 * empat kolom, Pengguna dan Objek memakai satu kolom cari selebar halaman tanpa keterangan, dan
 * Tugas Saya memakai dua pil yang mengambang tanpa label. Ketiganya kini satu bentuk.
 *
 * Tidak dibungkus kartu. Tema tidak memakai bayangan maupun kotak bertumpuk, dan kotak putih di
 * atas daftar justru bersaing dengan daftarnya sendiri; yang dibutuhkan cuma deretan kontrol yang
 * rata kiri dengan kolom pertama daftar di bawahnya.
 */
export function FilterBar({
  children,
  submitLabel,
  ...props
}: ComponentProps<"form"> & {
  children: ReactNode;
  /** Diisi hanya bila penyaringnya dikirim sebagai formulir (mis. Audit, yang menyaring di server).
   *  Penyaring yang bekerja seketika di peramban tidak perlu tombol. */
  submitLabel?: string;
}) {
  const content = (
    <>
      {children}
      {submitLabel && (
        <div className="filter-bar__action">
          <ThemeButton type="submit" size="sm">
            {submitLabel}
          </ThemeButton>
        </div>
      )}
    </>
  );

  // Kelas `form` bukan hiasan: aturan tema untuk kontrol isian ditulis sebagai
  // `.form select.form__control` dan `.form textarea.form__control`, jadi tanpa pembungkus
  // ber-kelas `form` gambar panah select bawaan tema tidak pernah terpasang.
  if (!submitLabel) return <div className="form filter-bar">{content}</div>;
  return (
    <form {...props} className="form filter-bar">
      {content}
    </form>
  );
}

/**
 * Satu kontrol penyaring beserta namanya. Labelnya memakai bentuk yang sama dengan nama kolom
 * daftar di bawahnya — huruf kecil kapital — supaya keduanya terbaca sebagai satu kesatuan.
 */
export function FilterField({
  label,
  htmlFor,
  wide = false,
  children,
}: {
  label: string;
  htmlFor: string;
  /** Untuk kolom cari, yang isinya kalimat dan butuh ruang lebih. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`filter-bar__field${wide ? " filter-bar__field--wide" : ""}`}>
      <label className="filter-bar__label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}
