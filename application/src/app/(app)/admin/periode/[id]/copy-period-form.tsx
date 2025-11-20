"use client";

import { useActionState } from "react";
import { copyPeriodAction } from "@/lib/actions/admin-periods";

const fieldClass =
  "form__control";

// UC-10: menyalin konfigurasi kategori/instrumen/aturan/peserta aktif periode ini ke periode draf
// baru dengan jadwal baru (titik awal yang bisa ditinjau/diubah admin). Penugasan dan jawaban
// SENGAJA tidak ikut disalin — selalu dievaluasi ulang dari nol (lihat komentar copyPeriod di
// services/periods.ts) — tidak ada jawaban lama yang ikut dihitung di periode hasil salinan.
export function CopyPeriodForm({ sourcePeriodId }: { sourcePeriodId: string }) {
  const [state, formAction, pending] = useActionState(copyPeriodAction, {});

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="sourcePeriodId" value={sourcePeriodId} />
      <label className="admin-tools__field">
        <span>Kode periode baru</span>
        <input name="code" placeholder="mis. DIES-2027" required className={fieldClass} />
      </label>
      <label className="admin-tools__field sm:col-span-2">
      <span>Nama periode baru</span>
      <input
        name="name"
        placeholder="Nama periode baru"
        required
        className={fieldClass}
      />
      </label>
      <div />
      <label className="admin-tools__field">
        <span>Mulai</span>
        <input name="startsAt" type="date" required className={fieldClass} />
      </label>
      <label className="admin-tools__field">
        <span>Berakhir</span>
        <input name="endsAt" type="date" required className={fieldClass} />
      </label>
      <div className="flex items-center gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="app-btn"
        >
          {pending ? "Menyalin…" : "Gunakan kembali periode ini"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
