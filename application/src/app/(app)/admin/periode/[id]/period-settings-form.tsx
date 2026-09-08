"use client";

import { useActionState } from "react";
import { updatePeriodSettingsAction } from "@/lib/actions/admin-periods";
import type { getPeriodDetail } from "@/lib/services/periods";

type Period = NonNullable<Awaited<ReturnType<typeof getPeriodDetail>>>;

const fieldClass =
  "rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:opacity-60";

function toDateInput(d: Date | string) {
  return new Date(d).toISOString().slice(0, 10);
}

export function PeriodSettingsForm({ period }: { period: Period }) {
  const [state, formAction, pending] = useActionState(updatePeriodSettingsAction, {});
  const editable = period.status === "DRAF";

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="periodId" value={period.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="code"
          defaultValue={period.code}
          disabled={!editable}
          required
          className={fieldClass}
        />
        <input
          name="name"
          defaultValue={period.name}
          disabled={!editable}
          required
          className={fieldClass}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="startsAt"
          type="date"
          defaultValue={toDateInput(period.startsAt)}
          disabled={!editable}
          required
          className={fieldClass}
        />
        <input
          name="endsAt"
          type="date"
          defaultValue={toDateInput(period.endsAt)}
          disabled={!editable}
          required
          className={fieldClass}
        />
      </div>
      <input
        name="timezone"
        defaultValue={period.timezone}
        disabled={!editable}
        className={fieldClass}
      />
      <textarea
        name="description"
        defaultValue={period.description ?? ""}
        disabled={!editable}
        rows={2}
        className={fieldClass}
      />
      {editable ? (
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
          >
            {pending ? "Menyimpan…" : "Simpan"}
          </button>
          {state.error && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {state.error}
            </p>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-[var(--muted)]">
          Pengaturan dasar terkunci di luar status Draf.
        </p>
      )}
    </form>
  );
}
