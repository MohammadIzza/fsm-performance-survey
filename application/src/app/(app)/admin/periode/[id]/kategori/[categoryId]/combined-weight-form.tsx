"use client";

import { useState } from "react";
import { Info } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";
import { useAksi } from "@/components/theme/notifikasi";
import { updateCombinedWeightAction } from "@/lib/actions/admin-instruments";

const fieldClass = "form__control disabled:opacity-60";

/**
 * Bobot nilai gabungan antar-kelompok. Mati = dua peringkat terpisah seperti biasa; hidup = satu
 * peringkat tambahan dari nilai Pimpinan × bobot + nilai Selain Pimpinan × sisanya.
 */
export function CombinedWeightForm({
  periodId,
  categoryId,
  pimpinanWeight,
  editable,
}: {
  periodId: string;
  categoryId: string;
  pimpinanWeight: number | null;
  editable: boolean;
}) {
  const [state, formAction, pending] = useAksi(updateCombinedWeightAction, {}, (_h, fd) =>
    fd.get("gabung") === "on" ? "Bobot nilai gabungan disimpan." : "Nilai gabungan dimatikan."
  );
  const [gabung, setGabung] = useState(pimpinanWeight != null);
  const [bobot, setBobot] = useState(String(pimpinanWeight ?? 60));
  const angka = Number(bobot);
  const sisa = Number.isInteger(angka) && angka >= 1 && angka <= 99 ? 100 - angka : null;

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="categoryId" value={categoryId} />

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

      {editable ? (
        <div className="flex items-center gap-2">
          <button type="submit" disabled={pending} className="app-btn app-btn--primary">
            {pending ? "Menyimpan…" : "Simpan"}
          </button>
          {state.error && (
            <p role="alert" className="aturan-galat">
              {state.error}
            </p>
          )}
        </div>
      ) : (
        <p className="aturan-terkunci">Terkunci — periode sudah ditutup.</p>
      )}
    </form>
  );
}
