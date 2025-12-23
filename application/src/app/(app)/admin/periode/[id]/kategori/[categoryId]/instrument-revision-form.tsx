"use client";
import { useActionState } from "react";
import { beginInstrumentRevisionAction } from "@/lib/actions/admin-instruments";
import { ThemeButton } from "@/components/theme-button";

const fieldClass =
  "form__control mt-1.5 block w-full";
const labelClass = "block app-text-sm font-medium text-[var(--foreground)]";

export function InstrumentRevisionForm({
  categoryId,
  periodId,
}: {
  categoryId: string;
  periodId: string;
}) {
  const [state, action, pending] = useActionState(beginInstrumentRevisionAction, {});

  return (
    <form action={action} className="app-panel app-panel--ruled space-y-4">
      <div>
        <h2 className="app-panel__label app-panel__label--tight">
          Revisi instrumen &amp; pengisian ulang
        </h2>
        <p className="mt-1.5 app-text-sm text-[var(--warm)]">
          Membuat versi baru yang dapat diedit dan membuka seluruh tugas aktif untuk diisi ulang.
          Jawaban serta hasil final lama tetap tersimpan. Hasil baru menunggu jawaban lengkap pada
          versi yang sama.
        </p>
      </div>

      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="periodId" value={periodId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Alasan perubahan
          <input name="reason" required className={fieldClass} />
        </label>
        <label className={labelClass}>
          Tenggat pengisian ulang (WIB)
          <input type="datetime-local" name="correctionEndsAt" required className={fieldClass} />
        </label>
      </div>

      <label className="flex items-start gap-2 app-text-sm text-[var(--foreground)]">
        <input type="checkbox" required className="mt-0.5 accent-[var(--accent)]" />
        <span>Saya memahami seluruh penilai perlu mengisi ulang.</span>
      </label>

      <ThemeButton type="submit" disabled={pending} size="sm">
        {pending ? "Memproses…" : "Buat versi instrumen baru"}
      </ThemeButton>

      {state.error && (
        <p role="alert" className="app-text-sm text-[var(--danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
