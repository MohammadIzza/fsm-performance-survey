import type { ReactNode } from "react";
import { ThemeMotion } from "@/components/theme-motion";

/**
 * Kepala halaman standar untuk seluruh ruang survei — pita kuning, label kecil, judul rapat, dan
 * satu kalimat penjelas: bentuk yang sama dipakai beranda publik, supaya berpindah dari situs ke
 * aplikasi tidak terasa seperti masuk ke sistem lain.
 *
 * Dua ukuran: bawaan (bertingkat penuh, dengan animasi huruf) untuk halaman utama yang jarang
 * dibuka berulang, dan `compact` untuk layar admin yang isinya tabel padat dan dipakai berkali-kali
 * dalam satu sesi — di sana pita tinggi justru mendorong data ke bawah lipatan.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  compact = false,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={compact ? "survey-hero survey-hero--compact" : "survey-hero"}>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        {/* Judul halaman sekaligus <h1>-nya: sebelumnya pita dan judul berdiri sendiri-sendiri,
            jadi nama halaman muncul dua kali berturut-turut. */}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {!compact && <ThemeMotion />}
    </section>
  );
}
