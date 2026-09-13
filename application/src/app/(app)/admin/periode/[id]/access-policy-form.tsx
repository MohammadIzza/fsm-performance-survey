"use client";

import { useAksi } from "@/components/theme/notifikasi";
import { useState } from "react";
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
  const [state, formAction, pending] = useAksi(setAccessPolicyAction, {}, "Waktu akses hasil disimpan.");
  const [mode, setMode] = useState<AccessMode>(accessPolicy?.mode ?? "SETELAH_FINAL");

  if (!accessPolicy) {
    return <p className="text-[var(--muted)]">Kebijakan akses belum tersedia.</p>;
  }

  return (
    <form action={formAction} className="access-policy-form admin-inline-form">
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="expectedVersion" value={accessPolicy.version} />

      <div
        className="access-policy-form__row"
        data-has-time={mode === "WAKTU_TERTENTU" ? "true" : "false"}
      >
        <label className="admin-tools__field access-policy-form__policy">
          <span>Kebijakan</span>
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
        </label>

        {mode === "WAKTU_TERTENTU" && (
          <label className="admin-tools__field access-policy-form__time">
            <span>Mulai dapat dibaca</span>
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
          </label>
        )}

        <button
          type="submit"
          disabled={pending}
          className="app-btn app-btn--primary access-policy-form__submit"
        >
          {pending ? "Menyimpan…" : "Simpan kebijakan"}
        </button>
      </div>

      <div className="access-policy-form__meta">
        {state.error && (
          <p role="alert" className="app-text-sm" style={{ color: "var(--color-brand-1)" }}>
            {state.error}
          </p>
        )}
        <p className="app-text-xs" style={{ color: "var(--color-text)" }}>
          Terakhir diubah oleh {accessPolicy.changedBy.name}.
        </p>
      </div>
    </form>
  );
}
