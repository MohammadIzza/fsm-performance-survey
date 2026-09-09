"use client";

import { useActionState } from "react";
import { copyPeriodAction } from "@/lib/actions/admin-periods";

const fieldClass =
  "rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

// UC-10: menyalin konfigurasi kategori/instrumen/aturan/peserta aktif periode ini ke periode draf
// baru dengan jadwal baru (titik awal yang bisa ditinjau/diubah admin). Penugasan dan jawaban
// SENGAJA tidak ikut disalin — selalu dievaluasi ulang dari nol (lihat komentar copyPeriod di
// services/periods.ts) — tidak ada jawaban lama yang ikut dihitung di periode hasil salinan.
export function CopyPeriodForm({ sourcePeriodId }: { sourcePeriodId: string }) {
  const [state, formAction, pending] = useActionState(copyPeriodAction, {});

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="sourcePeriodId" value={sourcePeriodId} />
      <input name="code" placeholder="Kode periode baru (mis. DIES-2027)" required className={fieldClass} />
      <input
        name="name"
        placeholder="Nama periode baru"
        required
        className={`${fieldClass} sm:col-span-2`}
      />
      <div />
      <input name="startsAt" type="date" required className={fieldClass} />
      <input name="endsAt" type="date" required className={fieldClass} />
      <div className="flex items-center gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-[14px] font-medium text-[var(--foreground)] transition hover:bg-black/5 disabled:opacity-60"
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
