"use client";

import { useState } from "react";
import { Info } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";

const fieldClass = "form__control disabled:opacity-60";

/**
 * Bobot nilai gabungan antar-kelompok. Mati = dua peringkat terpisah seperti biasa; hidup = satu
 * peringkat tambahan dari nilai Pimpinan × bobot + nilai Selain Pimpinan × sisanya.
 */
export function CombinedWeightFields({
  pimpinanWeight,
  editable,
}: {
  pimpinanWeight: number | null;
  editable: boolean;
}) {
  const [gabung, setGabung] = useState(pimpinanWeight != null);
  const [bobot, setBobot] = useState(String(pimpinanWeight ?? 60));
  const angka = Number(bobot);
  const sisa = Number.isInteger(angka) && angka >= 1 && angka <= 99 ? 100 - angka : null;

  return (
    <div className="grid gap-3">
      {/* Penanda bahwa bagian ini ikut dikirim. Kotak centang yang tidak dicentang tidak muncul di
          FormData sama sekali, jadi tanpa penanda ini "matikan nilai gabungan" tidak bisa dibedakan
          dari "bagian ini memang tidak ditampilkan". */}
      <input type="hidden" name="adaGabungan" value="1" />

      <label className="flex items-center gap-2 app-text-sm text-[var(--foreground)]">
        <input
          type="checkbox"
          name="gabung"
          checked={gabung}
          disabled={!editable}
          onChange={(e) => setGabung(e.target.checked)}
          className="h-4 w-4"
        />
        Gabungkan kedua kelompok menjadi satu nilai
        <Info>{KET.nilaiGabungan}</Info>
      </label>

      {gabung && (
        <div className="grid grid-cols-2 gap-3">
          <label className="admin-tools__field">
            <span>Bobot Pimpinan (%)</span>
            <input
              name="pimpinanWeight"
              type="number"
              min={1}
              max={99}
              step={1}
              value={bobot}
              onChange={(e) => setBobot(e.target.value)}
              disabled={!editable}
              required
              className={fieldClass}
            />
          </label>
          <div className="admin-tools__field">
            <span>Bobot Selain Pimpinan</span>
            <p className="gabungan-sisa">{sisa === null ? "—" : `${sisa}%`}</p>
          </div>
        </div>
      )}

      {!editable && <p className="aturan-terkunci">Terkunci — periode sudah ditutup.</p>}
    </div>
  );
}
