"use client";

import { useActionState } from "react";
import { createPeriodAction } from "@/lib/actions/admin-periods";

const fieldClass =
  "rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

export function PeriodCreateForm() {
  const [state, formAction, pending] = useActionState(createPeriodAction, {});

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-4">
      <input name="code" placeholder="Kode (mis. DIES-2026)" required className={fieldClass} />
      <input
        name="name"
        placeholder="Nama periode"
        required
        className={`${fieldClass} sm:col-span-2`}
      />
      <input name="timezone" defaultValue="Asia/Jakarta" className={fieldClass} />
      <input name="startsAt" type="date" required className={fieldClass} />
      <input name="endsAt" type="date" required className={fieldClass} />
      <textarea
        name="description"
        placeholder="Deskripsi (opsional)"
        rows={2}
        className={`${fieldClass} sm:col-span-2`}
      />
      <div className="flex items-center gap-2 sm:col-span-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
        >
          {pending ? "Menyimpan…" : "Buat periode"}
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
