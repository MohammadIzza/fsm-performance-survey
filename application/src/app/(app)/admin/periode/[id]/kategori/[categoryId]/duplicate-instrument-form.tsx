"use client";

import { useActionState, useRef } from "react";
import { duplicateInstrumentAction } from "@/lib/actions/admin-instruments";
import { useKonfirmasi } from "@/components/theme/confirm-dialog";

export function DuplicateInstrumentForm({
  instrumentVersionId,
  periodId,
  categoryId,
  sources,
}: {
  instrumentVersionId: string;
  periodId: string;
  categoryId: string;
  sources: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(duplicateInstrumentAction, {});
  const [konfirmasi, dialogKonfirmasi] = useKonfirmasi();
  // Tanda sekali pakai: kiriman ulang setelah dialog disetujui tidak ditanyakan lagi.
  const sudahDisetujui = useRef(false);

  if (sources.length === 0) return null;

  return (
    // Isian memakai bentuk berlabel yang sama dengan form admin lain (.admin-tools__field +
    // .form__control). Sebelumnya kotak ini ditulis dengan kelas utilitas sendiri, sehingga di
    // tengah halaman yang isiannya bergaris bawah muncul satu kotak bergaris penuh berhuruf lebih
    // besar — satu-satunya di halaman itu.
    <form
      action={formAction}
      onSubmit={async (e) => {
        if (sudahDisetujui.current) {
          sudahDisetujui.current = false;
          return;
        }
        e.preventDefault();
        const form = e.currentTarget;
        const sumber = sources.find((x) => x.id === new FormData(form).get("sourceCategoryId"));
        const ya = await konfirmasi({
          label: "Salin instrumen",
          judul: sumber ? `Salin dari ${sumber.label}?` : "Salin instrumen ini?",
          pesan: (
            <p>
              Skala dan seluruh parameter yang sudah ada di kategori ini akan diganti dengan milik
              kategori sumber.
            </p>
          ),
          tombolYa: "Salin instrumen",
        });
        if (ya) {
          sudahDisetujui.current = true;
          form.requestSubmit();
        }
      }}
      className="admin-inline-form duplicate-instrument-form"
    >
      <input type="hidden" name="instrumentVersionId" value={instrumentVersionId} />
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <label className="admin-tools__field admin-tools__field--grow">
        <span>Salin instrumen dari</span>
        <select name="sourceCategoryId" required defaultValue="" className="form__control">
          <option value="" disabled>
            Pilih kategori sumber…
          </option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending} className="app-btn">
        {pending ? "Menyalin…" : "Salin"}
      </button>
      {state.error && (
        <p role="alert" className="duplicate-instrument-form__error">
          {state.error}
        </p>
      )}
      {dialogKonfirmasi}
    </form>
  );
}
