"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "./form-field";

/**
 * Penyaring di kepala kolom daftar admin. Bentuknya sama dengan penyaring di daftar Tugas Saya
 * (`assignment-head-filter`): yang terlihat nama kolomnya, <select> ditumpuk di atasnya, dan kolom
 * yang sedang disaring ditandai biru.
 *
 * Nilainya disimpan di alamat (?nama=nilai), bukan di state komponen, karena daftarnya dipotong
 * per halaman di server — penyaring harus sampai ke server supaya menjangkau seluruh data. Setiap
 * perubahan kembali ke halaman 1.
 */
export function FilterKepala({
  nama,
  label,
  pilihan,
  semua,
}: {
  /** Nama parameter di alamat, mis. "jenis". */
  nama: string;
  /** Nama kolom yang tampil di kepala tabel. */
  label: string;
  pilihan: { value: string; label: string }[];
  /** Label pilihan kosong, mis. "Semua jenis". */
  semua: string;
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const nilai = sp.get(nama) ?? "";

  const ubah = (v: string) => {
    const q = new URLSearchParams(sp.toString());
    if (v) q.set(nama, v);
    else q.delete(nama);
    q.delete("halaman");
    const s = q.toString();
    router.push(s ? `${path}?${s}` : path, { scroll: false });
  };

  return (
    <label className="assignment-head-filter" data-active={nilai ? "true" : undefined}>
      <span>{label}</span>
      {/* Selalu <select> bawaan: di kepala kolom yang terlihat hanya nama kolom, dan <select> yang
          ditumpuk transparan di atasnya tetap memberi pemilih bawaan ponsel serta papan ketik. */}
      <Select aria-label={`Filter ${label.toLowerCase()}`} value={nilai} onChange={(e) => ubah(e.target.value)}>
        <option value="">{semua}</option>
        {pilihan.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
