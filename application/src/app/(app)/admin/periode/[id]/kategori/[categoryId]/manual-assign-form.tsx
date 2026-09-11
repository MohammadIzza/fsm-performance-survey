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
    <form action={formAction} className="manual-assignment-form">
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="categoryId" value={categoryId} />

      <label className="admin-tools__field">
        <span>Objek yang dinilai</span>
        <select name="categoryObjectId" required defaultValue="" className={fieldClass}>
          <option value="" disabled>Pilih objek…</option>
          {categoryObjects.map((co) => (
            <option key={co.id} value={co.id}>{co.nameSnapshot}</option>
          ))}
        </select>
      </label>
      <label className="admin-tools__field">
        <span>Kelompok penilai</span>
        <select name="group" required defaultValue="" className={fieldClass}>
          <option value="" disabled>Pilih kelompok…</option>
          <option value="PIMPINAN">Pimpinan</option>
          <option value="SELAIN_PIMPINAN">Selain Pimpinan</option>
        </select>
      </label>
      <label className="admin-tools__field">
        <span>Orang yang menilai</span>
        <select name="evaluatorId" required defaultValue="" className={fieldClass}>
          <option value="" disabled>Pilih penilai…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name} ({u.loginIdentifier})</option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="app-btn app-btn--primary"
      >
        {pending ? "Menugaskan…" : "Tugaskan manual"}
      </button>
      {state.error && (
        <p role="alert" className="manual-assignment-form__error text-[var(--danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
