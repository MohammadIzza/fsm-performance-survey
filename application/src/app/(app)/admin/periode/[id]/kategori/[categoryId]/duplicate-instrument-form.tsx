"use client";

import { useActionState } from "react";
import { duplicateInstrumentAction } from "@/lib/actions/admin-instruments";

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

  if (sources.length === 0) return null;

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !confirm(
            "Salin instrumen ini? Skala dan seluruh parameter yang sudah ada di kategori ini akan diganti dengan milik kategori sumber."
          )
        ) {
          e.preventDefault();
        }
      }}
      className="app-note mb-4 flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <input type="hidden" name="instrumentVersionId" value={instrumentVersionId} />
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <label className="shrink-0 app-text-sm text-[var(--muted)]">Salin instrumen dari</label>
      <select
        name="sourceCategoryId"
        required
        defaultValue=""
        className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-1.5 app-text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
      >
        <option value="" disabled>
          Pilih kategori sumber…
        </option>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 app-text-sm font-medium text-[var(--foreground)] transition hover:bg-black/[0.03] disabled:opacity-60"
      >
        {pending ? "Menyalin…" : "Salin"}
      </button>
      {state.error && (
        <p role="alert" className="w-full app-text-xs text-[var(--danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
