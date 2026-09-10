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

/** Bidang baris tema, berurutan seperti dipakai halaman referensi. */
export type RowKind = "title" | "topic" | "dates" | "duration" | "location" | "price";

export function DataList({
  title,
  intro,
  headerAction,
  columns,
  // Halaman referensi memakai t-h-md karena judulnya memang judul seksi halaman pemasaran setinggi
  // layar. Di dalam aplikasi judul daftar berdiri di bawah judul halaman, jadi skalanya diturunkan
  // supaya hierarkinya tetap terbaca — kelasnya tetap kelas skala huruf tema.
  titleSize = "t-h-3xs",
  children,
}: {
  title?: ReactNode;
  intro?: ReactNode;
  headerAction?: ReactNode;
  /**
   * Nama kolom, berpasangan dengan bidang yang dipakai barisnya dan dalam urutan yang sama.
   * Dirender memakai kelas bidang yang sama persis, jadi lebarnya dijamin sejajar dengan isi di
   * bawahnya tanpa perlu menyetel lebar dua kali.
   *
   * Ditandai aria-hidden: ini daftar tautan, bukan <table>, sehingga pembaca layar tidak bisa
   * mengaitkan sel dengan kepalanya. Nama tiap baris sudah lengkap pada tautannya sendiri, jadi
   * membacakan deretan label ini hanya menambah bising.
   */
  columns?: [RowKind, string][];
  titleSize?: "t-h-md" | "t-h-sm" | "t-h-xs" | "t-h-2xs" | "t-h-3xs";
  children: ReactNode;
}) {
  return (
    <div className="s-courses-list s-courses-list--light">
      {title && (
        <div className="s__top js-top">
          <SectionHeader title={title} intro={intro} size={titleSize}>
            {headerAction}
          </SectionHeader>
        </div>
      )}
      <ul className="s__courses js-courses">
        {columns && (
          <li className="sb-course sb-course--head" aria-hidden="true">
            <span className="sb__link">
              {columns.map(([kind, label]) => (
                <span key={kind} className={`sb__${kind} sb__field--no-icon`}>
                  {label}
                </span>
              ))}
            </span>
          </li>
        )}
        {children}
      </ul>
    </div>
  );
}

/**
 * Satu baris data.
 *
 * Dengan `href`, seluruh barisnya adalah satu tautan — bentuk aslinya di tema, dan yang paling
 * enak dipakai kalau tiap baris cuma punya satu tujuan.
 *
 * Tanpa `href`, barisnya bukan tautan: kerangka dan lebar kolomnya sama persis, tapi isinya boleh
 * memuat beberapa tautan sendiri. Ini yang dipakai daftar admin, karena tiap barisnya punya
 * beberapa aksi (Edit, Peran, Nonaktifkan) dan tautan tidak boleh disarangkan di dalam tautan —
 * markah seperti itu tidak sah dan aksinya tidak akan bisa dicapai lewat papan ketik.
 */
export function DataRow({
  href,
  children,
}: {
  href?: string;
  children: ReactNode;
}) {
  if (!href) {
    return (
      <li className="s__course sb-course sb-course--static">
        <div className="sb__link">{children}</div>
      </li>
    );
  }

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

/**
 * Kolom aksi, selalu di ujung kanan baris. Memakai slot bidang terakhir tema (`sb__price`) supaya
 * lebarnya sejajar dengan kepala kolomnya, dan menyusun aksinya mendatar tanpa membungkus.
 */
export function RowActions({ children }: { children: ReactNode }) {
  return <span className="sb__price sb__actions">{children}</span>;
}

/**
 * Bidang pertama sebuah baris, dan yang paling lebar.
 *
 * Tanpa titik penanda, berbeda dari baris di beranda. Di sana titik itu menandai satu kategori
 * dalam daftar pilihan yang pendek; di sini barisnya adalah baris data dalam tabel yang bisa
 * berisi puluhan entri, dan titik berwarna di tiap baris hanya jadi bising tanpa menyampaikan
 * apa pun. Beranda tetap memakainya — komponen ini hanya dipakai di ruang survei.
 */
export function RowTitle({ children }: { children: ReactNode }) {
  return <span className="sb__title">{children}</span>;
}

/**
 * Bidang berikutnya. `kind` memilih kelas bidang tema, dan tiap kelas membawa lebar persennya
 * sendiri beserta titik pindah layarnya — jadi urutannya ikut menentukan tata letak, bukan cuma
 * penamaan. Urutan yang dipakai halaman referensi: title, dates, duration, location, price.
 */
export function RowField({
  kind,
  icon = true,
  children,
}: {
  kind: "dates" | "duration" | "location" | "price" | "topic";
  /**
   * Tiap bidang tema membawa ikonnya sendiri: kalender untuk dates, jam untuk duration, peta untuk
   * location. Di situs publik ikon itu selalu cocok karena isinya memang tanggal/durasi/kota. Isi
   * di ruang survei tidak selalu begitu — nama kelompok penilai bukan durasi, nama periode bukan
   * tempat — dan ikon yang salah lebih mengganggu daripada tidak ada ikon. Matikan di kasus itu.
   */
  icon?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`sb__${kind}${icon ? "" : " sb__field--no-icon"}`}>{children}</span>
  );
}
