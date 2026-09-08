"use client";

import { useActionState, useState } from "react";
import { setAccessPolicyAction } from "@/lib/actions/admin-periods";
import type { getPeriodDetail } from "@/lib/services/periods";
import type { AccessMode } from "@/generated/prisma/enums";

type AccessPolicy = NonNullable<Awaited<ReturnType<typeof getPeriodDetail>>>["accessPolicy"];

const fieldClass =
  "rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

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
    return <p className="text-[14px] text-[var(--muted)]">Kebijakan akses belum tersedia.</p>;
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
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
        >
          {pending ? "Menyimpan…" : "Simpan kebijakan"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {state.error}
          </p>
        )}
      </div>
      <p className="text-[12px] text-[var(--muted)]">
        Terakhir diubah oleh {accessPolicy.changedBy.name}.
      </p>
    </form>
  );
}
