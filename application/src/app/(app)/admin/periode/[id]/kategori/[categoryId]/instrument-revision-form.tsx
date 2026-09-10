"use client";
import { useActionState } from "react";
import { beginInstrumentRevisionAction } from "@/lib/actions/admin-instruments";
import { ThemeButton } from "@/components/theme-button";

const fieldClass =
  "mt-1.5 block w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[15px] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";
const labelClass = "block text-[13px] font-medium text-[var(--foreground)]";

export function InstrumentRevisionForm({
  categoryId,
  periodId,
}: {
  categoryId: string;
  periodId: string;
}) {
  const [state, action, pending] = useActionState(beginInstrumentRevisionAction, {});

  return (
    <form action={action} className="space-y-4 rounded-2xl bg-[var(--warm-tint)] p-6">
      <div>
        <h2 className="text-[17px] font-semibold text-[var(--foreground)]">
          Revisi instrumen &amp; pengisian ulang
        </h2>
        <p className="mt-1.5 text-[13px] text-[var(--warm)]">
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

      <label className="flex items-start gap-2 text-[13px] text-[var(--foreground)]">
        <input type="checkbox" required className="mt-0.5 accent-[var(--accent)]" />
        <span>Saya memahami seluruh penilai perlu mengisi ulang.</span>
      </label>

      <ThemeButton type="submit" disabled={pending} size="sm">
        {pending ? "Memproses…" : "Buat versi instrumen baru"}
      </ThemeButton>

      {state.error && (
        <p role="alert" className="text-[13px] text-[var(--danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
