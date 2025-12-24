"use client";

import { useId, useState } from "react";

/**
 * Tombol buka-tutup untuk bidang tambahan sebuah baris daftar.
 *
 * Baris daftar admin membawa lima sampai enam bidang. Di layar lebar semuanya muat dalam satu
 * baris; di layar ponsel semuanya menumpuk dan satu baris jadi setinggi sepertiga layar — jauh
 * dari baris ringkas di halaman Tugas Saya. Di sini baris hanya memperlihatkan nama entri, status,
 * dan aksinya; sisanya dibuka bila diminta.
 *
 * Bidang yang disembunyikan tetap ada di DOM dan tetap terbaca pembaca layar lewat `aria-controls`
 * milik tombol ini — bukan dibuang dari markah — jadi tidak ada data yang hilang di layar kecil.
 * Di layar lebar tombolnya sendiri yang disembunyikan oleh gaya, dan seluruh bidang tampil apa
 * adanya seperti sebelumnya.
 */
export function RowDisclosure({ label = "Detail" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <button
      type="button"
      className="sb__detail-toggle"
      aria-expanded={open}
      aria-controls={id}
      onClick={(e) => {
        setOpen((v) => !v);
        // Keadaan terbuka dipasang pada barisnya, bukan pada tombolnya: yang perlu berubah adalah
        // bidang-bidang saudaranya, dan CSS hanya bisa menurun — tidak bisa naik ke induk.
        const row = e.currentTarget.closest(".sb-course");
        if (row) row.setAttribute("data-detail-open", open ? "false" : "true");
      }}
    >
      {open ? "Tutup" : label}
    </button>
  );
}
