"use client";

import { useActionState } from "react";
import { calculateResultsAction } from "@/lib/actions/calculations";

export function CalculateButton({ categoryId, periodId }: { categoryId: string; periodId: string }) {
  const [state, formAction, pending] = useActionState(calculateResultsAction, {});

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="periodId" value={periodId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
      >
        {pending ? "Menghitung…" : "Jalankan perhitungan"}
      </button>
      {state.error && <p className="text-sm text-[var(--danger)]">{state.error}</p>}
    </form>
  );
}
