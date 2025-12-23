import type { ReactNode } from "react";

/**
 * Satu bagian halaman, dengan kerangka yang sama dipakai lembar penilaian di halaman Tugas:
 * label kecil berhuruf kapital, judul, lalu isinya — dipisahkan garis, bukan dijadikan kartu.
 *
 * Ini pengganti pembungkus `rounded-2xl border … shadow-sm` yang tersebar di halaman-halaman yang
 * ditulis sebelum kerangka tema dipakai. Tema tidak mengenal kartu bertumpuk maupun bayangan: satu
 * halaman adalah satu dokumen yang dibagi garis, dan kartu putih di atas kertas krem justru
 * membuat tiap bagian terbaca seperti tempelan dari aplikasi lain.
 */
export function Panel({
  eyebrow,
  title,
  intro,
  action,
  plain = false,
  children,
}: {
  eyebrow?: string;
  title?: ReactNode;
  intro?: ReactNode;
  /** Aksi di sisi kanan judul, mis. tombol atau tautan unduh. */
  action?: ReactNode;
  /** Tanpa garis pemisah di atasnya — untuk bagian pertama tepat di bawah kepala halaman. */
  plain?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`app-panel${plain ? " app-panel--plain" : ""}`}>
      {(eyebrow || title) && (
        <header className="app-panel__intro">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            {title && <h2>{title}</h2>}
            {intro && <p className="app-panel__text">{intro}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/**
 * Baris "belum ada isinya". Satu bentuk untuk seluruh ruang survei — sebelumnya tiap halaman
 * menuliskannya sendiri sebagai kotak putih setinggi 8rem dengan ukuran huruf yang berbeda-beda.
 */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="app-empty">{children}</p>;
}
