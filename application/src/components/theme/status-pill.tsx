import type { ReactNode } from "react";

/**
 * Lencana status. Tema tidak punya komponen untuk ini — situs publik memang tidak menampilkan
 * status apa pun — jadi bentuknya dibangun di sini, tapi seluruh warna dan hurufnya diambil dari
 * token tema, bukan nilai baru: bulat penuh seperti tombol tema, huruf teks kecil tema, dan warna
 * dari palet brand yang sama.
 *
 * Warna dipilih supaya terbaca sekilas tanpa membaca teksnya: kuning untuk yang menuntut
 * tindakan, tosca untuk yang sudah beres, merah untuk yang terlambat, abu untuk yang netral.
 */
const toneVar = {
  netral: "var(--color-grey-2)",
  proses: "var(--color-brand-5)",
  perhatian: "var(--color-brand-2)",
  selesai: "var(--color-brand-4)",
  gagal: "var(--color-brand-9)",
} as const;

export function StatusPill({
  tone = "netral",
  children,
}: {
  tone?: keyof typeof toneVar;
  children: ReactNode;
}) {
  return (
    <span
      className="status-pill"
      style={{ backgroundColor: toneVar[tone] }}
    >
      {children}
    </span>
  );
}
