import type { ReactNode } from "react";
import { SectionHeader } from "./section-header";
import { UspLottie } from "./usp-lottie";

/**
 * Petak kartu memakai komponen `.s-usps` dari halaman panduan ("Yang perlu Anda ketahui").
 *
 * Lebar kartunya bukan angka tetap melainkan hasil sistem kolom tema:
 * `--card-width: calc(5 * var(--grid-column-width) + 4 * var(--grid-gutter-width))`, menyempit ke
 * 6 kolom di 1530px, 6 kolom bergutter lebar di 987px, 10 kolom di 767px, lalu selebar layar di
 * 576px. Karena itu proporsinya otomatis sejajar dengan seksi lain di halaman yang sama — tidak
 * ada lebar yang ditebak sendiri di sini.
 *
 * Tema tidak memakai bayangan maupun latar buram di mana pun (nol `box-shadow`, nol
 * `backdrop-filter` di seluruh lembar gayanya), jadi kartu di sini juga rata tanpa keduanya.
 */
export function UspGrid({
  title,
  intro,
  layout = 2,
  // Judul seksi tema dipas untuk halaman pemasaran selebar layar; di dalam aplikasi lebar kartunya
  // lebih kecil, dan .s-usps .s__title dibatasi 8em sehingga judul panjang terpotong. Skalanya
  // diturunkan — kelasnya tetap kelas skala huruf tema.
  titleSize = "t-h-3xs",
  children,
}: {
  title?: ReactNode;
  intro?: ReactNode;
  titleSize?: "t-h-md" | "t-h-sm" | "t-h-xs" | "t-h-2xs" | "t-h-3xs";
  /** Varian tata letak tema: 1 = kartu berselang-seling, 2 = sejajar rata atas. */
  layout?: 1 | 2;
  children: ReactNode;
}) {
  return (
    <div className={`s-usps s-usps--layout-${layout}`}>
      {title && <SectionHeader title={title} intro={intro} size={titleSize} />}
      <div className="s__usps">{children}</div>
    </div>
  );
}

/**
 * Warna kartu datang dari kelas pengubah `.sb__illus--*` milik tema, bukan dari nilai warna yang
 * ditulis di sini. Tiap nama pengubah sudah dipetakan tema ke satu warna brand:
 *   --python  → --color-brand-2 (kuning)      --sql       → --color-brand-7 (merah muda)
 *   --learning→ --color-brand-5 (biru muda)   --analytics → --color-brand-4 (tosca)
 * Dipakai lewat nama warna supaya pemanggilnya tidak perlu hafal istilah bootcamp aslinya,
 * sementara aturan gaya yang berlaku tetap aturan tema itu sendiri.
 */
const toneClass = {
  kuning: "sb__illus--python",
  merah: "sb__illus--sql",
  biru: "sb__illus--learning",
  tosca: "sb__illus--analytics",
} as const;

export function UspCard({
  title,
  children,
  tone = "kuning",
  lottie,
}: {
  title: ReactNode;
  children: ReactNode;
  tone?: keyof typeof toneClass;
  /** Nama berkas animasi di /assets/lottie/, tanpa ekstensi. Kosongkan untuk kartu polos berwarna. */
  lottie?: string;
}) {
  return (
    <div className="s__usp sb-usp">
      {/* .sb__illus HARUS selalu ada, juga saat tanpa animasi: elemen inilah yang menggambar
          latar berwarna kartu setinggi penuh. Tanpanya kartu kehilangan bidang warnanya dan
          teksnya melayang tanpa alas. */}
      <div className={`sb__illus ${toneClass[tone]}`}>
        {lottie && <UspLottie name={lottie} />}
      </div>
      <div className="sb__content">
        <h3 className="sb__title t-h-4xs" data-lg-reveal="heading">
          {title}
        </h3>
        <div className="sb__text" data-lg-reveal="text">
          {children}
        </div>
      </div>
    </div>
  );
}
