"use client";

import { useActionState, useState } from "react";
import { setAccessPolicyAction } from "@/lib/actions/admin-periods";
import type { getPeriodDetail } from "@/lib/services/periods";
import type { AccessMode } from "@/generated/prisma/enums";

type AccessPolicy = NonNullable<Awaited<ReturnType<typeof getPeriodDetail>>>["accessPolicy"];

const fieldClass =
  "form__control";

const modeLabel: Record<string, string> = {
  SELAMA_AKTIF: "Selama aktif",
  SETELAH_DITUTUP: "Setelah ditutup",
  SETELAH_FINAL: "Setelah final",
  WAKTU_TERTENTU: "Waktu tertentu",
};

export function AccessPolicyForm({
  periodId,
  accessPolicy,
}: {
  periodId: string;
  accessPolicy: AccessPolicy;
}) {
  const [state, formAction, pending] = useActionState(setAccessPolicyAction, {});
  const [mode, setMode] = useState<AccessMode>(accessPolicy?.mode ?? "SETELAH_FINAL");

  if (!accessPolicy) {
    return <p className="text-[var(--muted)]">Kebijakan akses belum tersedia.</p>;
  }

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="expectedVersion" value={accessPolicy.version} />

      <select
        name="mode"
        value={mode}
        onChange={(e) => setMode(e.target.value as AccessMode)}
        className={fieldClass}
      >
        {Object.entries(modeLabel).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      {mode === "WAKTU_TERTENTU" && (
        <input
          name="availableAt"
          type="datetime-local"
          defaultValue={
            accessPolicy.availableAt
              ? new Date(accessPolicy.availableAt).toISOString().slice(0, 16)
              : ""
          }
          required
          className={fieldClass}
        />
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="app-btn app-btn--primary"
        >
          {pending ? "Menyimpan…" : "Simpan kebijakan"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {state.error}
          </p>
        )}
      </div>
      <p className="app-text-xs text-[var(--muted)]">
        Terakhir diubah oleh {accessPolicy.changedBy.name}.
      </p>
    </form>
  );
}
