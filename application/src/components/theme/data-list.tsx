import Link from "next/link";
import type { ReactNode } from "react";
import { SectionHeader } from "./section-header";

/**
 * Daftar data memakai komponen daftar tema (`.s-courses-list` + baris `.sb-course`) — bentuk yang
 * sama dipakai daftar kategori di beranda. Satu baris adalah satu tautan penuh: bidang-bidang
 * berjajar dengan lebar persen dari tema, garis 3px di atas-bawah, dan latar yang naik dari bawah
 * saat disorot (`.sb__background`).
 *
 * Ini pengganti <table> untuk daftar yang bidangnya sedikit dan tiap barisnya bisa diklik. Tabel
 * admin yang padat (5–7 kolom + beberapa tautan aksi per baris) tetap memakai <table>: baris tema
 * dirancang untuk sekitar lima bidang pendek dalam satu baris, dan memaksakannya justru memotong
 * teks — persis masalah yang sudah pernah muncul di layar sempit.
 */

/** Warna titik penanda di depan judul baris; ketiganya varian bawaan tema. */
type Accent = "green" | "pink" | "blue";

export function DataList({
  title,
  intro,
  headerAction,
  children,
}: {
  title?: ReactNode;
  intro?: ReactNode;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="s-courses-list s-courses-list--light">
      {title && (
        <div className="s__top js-top">
          <SectionHeader title={title} intro={intro} size="t-h-sm">
            {headerAction}
          </SectionHeader>
        </div>
      )}
      <ul className="s__courses js-courses">{children}</ul>
    </div>
  );
}

export function DataRow({
  href,
  accent = "green",
  children,
}: {
  href: string;
  accent?: Accent;
  children: ReactNode;
}) {
  return (
    <li className="s__course sb-course">
      <Link className="sb__link" href={href}>
        {children}
        <img
          className="sb__arrow"
          src="/assets/images/arrow-2-right.svg"
          alt=""
          width="9"
          height="14"
          loading="lazy"
        />
        <span className="sb__background" aria-hidden="true" />
      </Link>
    </li>
  );
}

/** Bidang pertama sebuah baris: bertitik penanda dan paling lebar (25% di layar lebar). */
export function RowTitle({
  children,
  accent = "green",
}: {
  children: ReactNode;
  accent?: Accent;
}) {
  return (
    <span className="sb__title">
      <span
        className={`a-bullet-point a-bullet-point--outline a-bullet-point--${accent}`}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

/**
 * Bidang berikutnya. `kind` memilih kelas bidang tema, dan tiap kelas membawa lebar persennya
 * sendiri beserta titik pindah layarnya — jadi urutannya ikut menentukan tata letak, bukan cuma
 * penamaan. Urutan yang dipakai halaman referensi: title, dates, duration, location, price.
 */
export function RowField({
  kind,
  children,
}: {
  kind: "dates" | "duration" | "location" | "price" | "topic";
  children: ReactNode;
}) {
  return <span className={`sb__${kind}`}>{children}</span>;
}
