"use client";

import { useState } from "react";
import { Info } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";
import { useAksi } from "@/components/theme/notifikasi";
import { updateGradeBandsAction } from "@/lib/actions/admin-categories";
import { MAKS_TINGKAT, PREDIKAT_BAWAAN, type AmbangPredikat } from "@/lib/predikat";

const fieldClass = "form__control disabled:opacity-60";

/**
 * Ambang predikat kategori: label yang mendampingi nilai akhir di papan peringkat.
 *
 * Batasnya ditulis dalam persen dari nilai maksimum, bukan angka nilai, supaya susunan yang sama
 * berlaku baik pada kategori berskala 1–5 maupun 0–100 — dan supaya admin tidak perlu menghitung
 * sendiri berapa nilai tertinggi yang mungkin dari bobot parameternya.
 */
export function PredikatForm({
  periodId,
  categoryId,
  bands,
  skorMaksimum,
  editable,
}: {
  periodId: string;
  categoryId: string;
  bands: AmbangPredikat[] | null;
  /** Nilai tertinggi yang mungkin pada kategori ini; null bila metodenya Total (tak berbatas). */
  skorMaksimum: number | null;
  editable: boolean;
}) {
  const [state, formAction, pending] = useAksi(updateGradeBandsAction, {}, (_h, fd) =>
    fd.get("pakai") === "on" ? "Ambang predikat disimpan." : "Predikat dimatikan."
  );
  const [pakai, setPakai] = useState(bands != null);
  const [daftar, setDaftar] = useState<AmbangPredikat[]>(bands ?? PREDIKAT_BAWAAN);

  const ubah = (i: number, patch: Partial<AmbangPredikat>) =>
    setDaftar((d) => d.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="categoryId" value={categoryId} />

      <label className="flex items-center gap-2 app-text-sm text-[var(--foreground)]">
        <input
          type="checkbox"
          name="pakai"
          checked={pakai}
          disabled={!editable}
          onChange={(e) => setPakai(e.target.checked)}
          className="h-4 w-4"
        />
        Beri predikat pada nilai akhir
        <Info>{KET.predikat}</Info>
      </label>

      {pakai && (
        <>
          <div>
            {daftar.map((b, i) => (
              <div key={i} className="predikat-baris">
                <label className="admin-tools__field">
                  <span>{i === 0 ? "Nama tingkat" : <span className="sr-only">Nama tingkat</span>}</span>
                  <input
                    name="bandLabel"
                    value={b.label}
                    onChange={(e) => ubah(i, { label: e.target.value })}
                    disabled={!editable}
                    required
                    className={fieldClass}
                  />
                </label>
                <label className="admin-tools__field">
                  <span>{i === 0 ? "Mulai (%)" : <span className="sr-only">Mulai (%)</span>}</span>
                  <input
                    name="bandMin"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={b.min}
                    onChange={(e) => ubah(i, { min: Number(e.target.value) })}
                    disabled={!editable}
                    required
                    className={fieldClass}
                  />
                </label>
                <button
                  type="button"
                  className="app-btn app-btn--polos"
                  disabled={!editable || daftar.length <= 2}
                  onClick={() => setDaftar((d) => d.filter((_, idx) => idx !== i))}
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>

          {editable && daftar.length < MAKS_TINGKAT && (
            <div>
              <button
                type="button"
                className="app-btn app-btn--polos"
                onClick={() => setDaftar((d) => [...d, { label: "", min: 0 }])}
              >
                + Tambah tingkat
              </button>
            </div>
          )}

          <p className="predikat-contoh">
            {skorMaksimum === null ? (
              <>
                Kategori ini memakai metode Total, yang tidak punya nilai tertinggi tetap — nilainya
                ikut bertambah seiring jumlah penilai. Predikat tidak akan tampil sampai metodenya
                diubah menjadi Rerata.
              </>
            ) : (
              <>
                Nilai tertinggi yang mungkin di kategori ini <strong>{skorMaksimum.toFixed(2)}</strong>.
                Contoh: batas {daftar[0]?.min ?? 0}% berarti mulai nilai{" "}
                <strong>{(((daftar[0]?.min ?? 0) / 100) * skorMaksimum).toFixed(2)}</strong>.
              </>
            )}
          </p>
        </>
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
        <p className="aturan-terkunci">Terkunci — periode sudah difinalkan.</p>
      )}
    </form>
  );
}
