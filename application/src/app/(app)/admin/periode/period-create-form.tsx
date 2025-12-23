"use client";

import { useActionState } from "react";
import { createPeriodAction } from "@/lib/actions/admin-periods";

const fieldClass =
  "form__control";

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
          className="app-btn app-btn--primary"
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
