"use client";

import { useState } from "react";

/**
 * Tombol buka-tutup untuk bidang tambahan sebuah baris daftar.
 *
 * Di desktop tombol ini menempati kolom Aksi. Di ponsel tombol tetap berada di ujung kanan baris,
 * sementara ringkasan hanya menampilkan nama entri. Panel di bawah baris memuat seluruh detail
 * dan tindakan CRUD, lalu dibuka dan ditutup oleh tombol yang sama.
 */
export function RowDisclosure({ label = "detail" }: { label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="sb__price sb__actions sb__disclosure">
      <button
        type="button"
        className="sb__detail-toggle"
        aria-expanded={open}
        aria-label={`${open ? "Tutup" : "Buka"} ${label}`}
        onClick={(e) => {
          setOpen((v) => !v);
          // Keadaan terbuka dipasang pada barisnya, bukan pada tombolnya: yang perlu berubah adalah
          // panel saudaranya, dan CSS hanya bisa menurun — tidak bisa naik ke induk.
          const row = e.currentTarget.closest(".sb-course");
          if (row) row.setAttribute("data-detail-open", open ? "false" : "true");
        }}
      >
        <span className="period-stepper__arrow sb__detail-arrow" aria-hidden="true" />
      </button>
    </span>
  );
}
