"use client";

import { useActionState } from "react";
import { manualAssignEvaluatorAction } from "@/lib/actions/admin-assignments";

const fieldClass =
  "rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

export function ManualAssignForm({
  periodId,
  categoryId,
  categoryObjects,
  users,
}: {
  periodId: string;
  categoryId: string;
  categoryObjects: { id: string; nameSnapshot: string }[];
  users: { id: string; name: string; loginIdentifier: string }[];
}) {
  const [state, formAction, pending] = useActionState(manualAssignEvaluatorAction, {});

  return (
    <form action={formAction} className="grid gap-2 sm:grid-cols-4">
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="categoryId" value={categoryId} />

      <select name="categoryObjectId" required defaultValue="" className={fieldClass}>
        <option value="" disabled>
          Objek…
        </option>
        {categoryObjects.map((co) => (
          <option key={co.id} value={co.id}>
            {co.nameSnapshot}
          </option>
        ))}
      </select>
      <select name="group" required defaultValue="" className={fieldClass}>
        <option value="" disabled>
          Kelompok…
        </option>
        <option value="PIMPINAN">Pimpinan</option>
        <option value="SELAIN_PIMPINAN">Selain Pimpinan</option>
      </select>
      <select name="evaluatorId" required defaultValue="" className={fieldClass}>
        <option value="" disabled>
          Penilai…
        </option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.loginIdentifier})
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
      >
        {pending ? "Menugaskan…" : "Tugaskan manual"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm text-[var(--danger)] sm:col-span-4">
          {state.error}
        </p>
      )}
    </form>
  );
}
