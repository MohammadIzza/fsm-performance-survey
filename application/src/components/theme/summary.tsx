import type { ReactNode } from "react";

/**
 * Kepala halaman: judul, satu kalimat penjelas, lalu deretan angka ringkasan.
 *
 * Sempat memakai petak kartu tema (`.s-usps`) apa adanya. Bentuk itu dirancang untuk halaman
 * pemasaran — kartunya setinggi 0,88 × lebarnya dengan judul sebesar judul seksi — sehingga di
 * layar kerja kotaknya jauh lebih besar daripada isinya dan mendorong daftar datanya ke bawah
 * lipatan. Yang dipertahankan dari sana adalah palet dan skala hurufnya; ukurannya diperkecil ke
 * ukuran aplikasi, dan yang ditonjolkan angkanya, bukan labelnya.
 */
export function PageIntro({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  /** Kartu ringkasan. Berapa pun jumlahnya, petaknya menyesuaikan sendiri. */
  children?: ReactNode;
}) {
  return (
    <header className="page-intro">
      <h1 className="page-intro__title">{title}</h1>
      {intro && <p className="page-intro__text">{intro}</p>}
      {children && <div className="summary">{children}</div>}
    </header>
  );
}

/** Warna dari palet brand tema, sama dengan yang dipakai kartu di halaman panduan. */
const toneVar = {
  kuning: "var(--color-brand-2)",
  biru: "var(--color-brand-5)",
  tosca: "var(--color-brand-4)",
  merah: "var(--color-brand-7)",
} as const;

export function SummaryCard({
  label,
  value,
  note,
  tone = "kuning",
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: keyof typeof toneVar;
}) {
  return (
    <div className="summary__card" style={{ backgroundColor: toneVar[tone] }}>
      <span className="summary__label">{label}</span>
      <span className="summary__value">{value}</span>
      {note && <span className="summary__note">{note}</span>}
    </div>
  );
}
