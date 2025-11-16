"use client";

import { useActionState } from "react";
import { updatePeriodSettingsAction } from "@/lib/actions/admin-periods";
import type { getPeriodDetail } from "@/lib/services/periods";

type Period = NonNullable<Awaited<ReturnType<typeof getPeriodDetail>>>;

const fieldClass =
  "form__control disabled:opacity-60";

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
        <label className="admin-tools__field">
          <span>Kode periode</span>
          <input name="code" defaultValue={period.code} disabled={!editable} required className={fieldClass} />
        </label>
        <label className="admin-tools__field">
          <span>Nama periode</span>
          <input name="name" defaultValue={period.name} disabled={!editable} required className={fieldClass} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="admin-tools__field">
          <span>Tanggal mulai</span>
          <input name="startsAt" type="date" defaultValue={toDateInput(period.startsAt)} disabled={!editable} required className={fieldClass} />
        </label>
        <label className="admin-tools__field">
          <span>Tanggal selesai</span>
          <input name="endsAt" type="date" defaultValue={toDateInput(period.endsAt)} disabled={!editable} required className={fieldClass} />
        </label>
      </div>
      <label className="admin-tools__field">
        <span>Zona waktu</span>
        <input name="timezone" defaultValue={period.timezone} disabled={!editable} className={fieldClass} />
      </label>
      <label className="admin-tools__field">
        <span>Catatan periode</span>
        <textarea name="description" defaultValue={period.description ?? ""} disabled={!editable} rows={2} className={fieldClass} />
      </label>
      {editable ? (
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="app-btn app-btn--primary"
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
        <p className="app-text-sm text-[var(--muted)]">
          Pengaturan dasar terkunci di luar status Draf.
        </p>
      )}
    </form>
  );
}
