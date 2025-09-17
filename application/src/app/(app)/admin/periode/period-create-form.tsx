"use client";

import { useActionState } from "react";
import { createPeriodAction } from "@/lib/actions/admin-periods";

const fieldClass =
  "form__control";

export function PeriodCreateForm() {
  const [state, formAction, pending] = useActionState(createPeriodAction, {});

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-4">
      <label className="admin-tools__field sm:col-span-3">
        <span>Nama periode</span>
        <input name="name" placeholder="mis. Dies Natalis FSM UNDIP 2026" required className={fieldClass} />
      </label>
      <label className="admin-tools__field">
        <span>Zona waktu</span>
        <input name="timezone" defaultValue="Asia/Jakarta" className={fieldClass} />
      </label>
      <label className="admin-tools__field">
        <span>Tanggal mulai</span>
        <input name="startsAt" type="date" required className={fieldClass} />
      </label>
      <label className="admin-tools__field">
        <span>Tanggal selesai</span>
        <input name="endsAt" type="date" required className={fieldClass} />
      </label>
      <label className="admin-tools__field sm:col-span-2">
        <span>Catatan periode</span>
        <textarea
          name="description"
          placeholder="Deskripsi (opsional)"
          rows={2}
          className={fieldClass}
        />
      </label>
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
