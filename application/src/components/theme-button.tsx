import type { ComponentProps, ReactNode } from "react";

/**
 * Tombol utama bawaan tema (.btn-plain) — bentuk pil dengan panah yang meluncur masuk saat
 * disorot, sama seperti tombol di halaman publik.
 *
 * Latarnya digambar sebagai <svg> berisi dua jalur, bukan background CSS: di halaman publik runtime
 * GSAP menulis ulang jalur itu jadi bentuk melengkung saat disorot. Tanpa runtime kedua jalurnya
 * tetap terisi warna dari lembar gaya, jadi yang hilang hanya gerak morf-nya — panah dan geser teks
 * murni transisi CSS dan tetap hidup.
 *
 * Dua penyesuaian terhadap markah aslinya, keduanya karena runtime itu tidak ada di sini:
 *  - `viewBox` ditambahkan. Di tema, GSAP menulis ulang jalur ke ukuran piksel tombol yang
 *    sebenarnya; tanpa itu koordinat 0–10 tergambar apa adanya dan menyisakan bujur sangkar kecil
 *    di pojok kiri atas.
 *  - <svg> dipindah ke dalam .btn-plain__inner. Di luar sana ia tidak terkena `overflow: hidden`
 *    milik inner, sehingga sudut-sudut persegi latarnya menyembul di balik bentuk pil.
 */
export function ThemeButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & {
  children: ReactNode;
  variant?: "primary" | "secondary" | "alternate";
  size?: "sm" | "md" | "lg";
}) {
  const classes = [
    "btn-plain",
    `btn-plain--${variant}`,
    size === "md" ? "" : `btn-plain--${size}`,
    props.disabled ? "btn-plain--disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button {...props} className={classes}>
      <span className="btn-plain__inner">
        <svg
          viewBox="0 0 10 10"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="btn-plain__background"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M 0 0 L 10 0 L 10 10 L 0 10" className="btn-plain__path" />
          <path d="M 0 0 L 10 0 L 10 10 L 0 10" className="btn-plain__path" />
        </svg>
        <span className="btn-plain__text">{children}</span>
        <span className="btn-plain__arrow" />
      </span>
    </button>
  );
}
