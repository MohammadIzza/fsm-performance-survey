import type { ReactNode } from "react";

/**
 * Judul seksi, memakai susunan `.s__header` yang sama dipakai halaman panduan dan beranda:
 * judul memakai kelas skala huruf tema (`.t-h-*`), pengantar memakai `.s__intro`.
 *
 * `data-lg-reveal` dipertahankan apa adanya — RevealOnScroll yang memasang `.is-in`-nya.
 */
export function SectionHeader({
  title,
  intro,
  size = "t-h-xs",
  children,
}: {
  title: ReactNode;
  intro?: ReactNode;
  /** Kelas skala huruf tema. Halaman referensi memakai t-h-md untuk judul besar
   *  (Kategori Individu) dan t-h-xs untuk judul seksi biasa (Yang perlu Anda ketahui). */
  size?: "t-h-md" | "t-h-sm" | "t-h-xs" | "t-h-2xs" | "t-h-3xs";
  /** Aksi di sisi kanan judul, mis. tombol atau tautan unduh. */
  children?: ReactNode;
}) {
  return (
    <div className="s__header js-header" data-lg-reveal>
      <div className="s__header-content">
        <h2 className={`s__title ${size}`}>{title}</h2>
        {intro && <p className="s__intro">{intro}</p>}
      </div>
      {children}
    </div>
  );
}
