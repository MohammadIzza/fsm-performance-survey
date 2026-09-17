"use client";

import { useRouter } from "next/navigation";
import { PilihanCari } from "@/components/theme/pilihan-cari";

/** Pemilih periode; berpindah halaman begitu dipilih, tanpa tombol Terapkan. */
export function PilihPeriode({
  periodeId,
  pilihan,
}: {
  periodeId: string;
  pilihan: { value: string; label: string }[];
}) {
  const router = useRouter();
  return (
    <PilihanCari
      id="pantau-periode"
      aria-label="Pilih periode"
      value={periodeId}
      onChange={(id) => id && router.push(`/admin/pemantauan?periode=${id}`)}
      options={pilihan}
    />
  );
}
