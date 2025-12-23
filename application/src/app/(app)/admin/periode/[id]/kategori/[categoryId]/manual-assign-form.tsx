"use client";

import { useActionState } from "react";
import { manualAssignEvaluatorAction } from "@/lib/actions/admin-assignments";

const fieldClass =
  "form__control";

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
        className="app-btn app-btn--primary"
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
