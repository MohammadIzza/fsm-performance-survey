import type { ReactNode } from "react";

/**
 * Daftar tindakan admin — bentuk yang sama dipakai "Alat admin" di halaman penugasan: tiap
 * tindakan satu baris tertutup yang menyebut namanya dan satu kalimat akibatnya, lalu terbuka
 * memperlihatkan isian dan tombolnya.
 *
 * Form tambah/ubah di tiap menu admin sebelumnya berdiri terbuka permanen setinggi setengah
 * layar di atas daftarnya sendiri — padahal yang dicari orang saat membuka halaman itu biasanya
 * datanya, bukan formulirnya. Di sini formulirnya menunggu diminta, dan daftarnya naik ke atas.
 */
export function AdminActionList({ children }: { children: ReactNode }) {
  return (
    <div className="admin-tools form">
      <div className="admin-actions">{children}</div>
    </div>
  );
}

export function AdminAction({
  name,
  description,
  defaultOpen = false,
  children,
}: {
  name: string;
  description: ReactNode;
  /** Dibuka sejak awal — hanya untuk halaman yang memang tidak punya daftar di bawahnya. */
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="admin-actions__row" open={defaultOpen}>
      <summary className="admin-actions__summary">
        <span className="admin-actions__name">
          <strong>{name}</strong>
          <span>{description}</span>
        </span>
      </summary>
      <div className="admin-actions__body admin-actions__body--full">{children}</div>
    </details>
  );
}
