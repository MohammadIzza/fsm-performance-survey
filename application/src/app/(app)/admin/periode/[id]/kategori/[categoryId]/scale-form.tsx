"use client";

import { useActionState } from "react";
import { updateInstrumentScaleAction } from "@/lib/actions/admin-instruments";
import type { getCategoryDetail } from "@/lib/services/categories";

type Instrument = NonNullable<Awaited<ReturnType<typeof getCategoryDetail>>>["instrumentVersions"][number];

const fieldClass =
  "rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:opacity-60";

export function ScaleForm({
  instrument,
  periodId,
  categoryId,
  editable,
}: {
  instrument: Instrument;
  periodId: string;
  categoryId: string;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateInstrumentScaleAction, {});

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="instrumentVersionId" value={instrument.id} />
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="categoryId" value={categoryId} />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-[var(--muted)]">Minimum</label>
          <input
            name="scaleMin"
            type="number"
            step="any"
            defaultValue={instrument.scaleMin}
            disabled={!editable}
            required
            className={fieldClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-[var(--muted)]">Maksimum</label>
          <input
            name="scaleMax"
            type="number"
            step="any"
            defaultValue={instrument.scaleMax}
            disabled={!editable}
            required
            className={fieldClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-[var(--muted)]">Langkah</label>
          <input
            name="scaleStep"
            type="number"
            step="any"
            defaultValue={instrument.scaleStep}
            disabled={!editable}
            required
            className={fieldClass}
          />
        </div>
      </div>
      <textarea
        name="guide"
        placeholder="Panduan pengisian (opsional)"
        defaultValue={instrument.guide ?? ""}
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
            {pending ? "Menyimpan…" : "Simpan skala"}
          </button>
          {state.error && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {state.error}
            </p>
          )}
        </div>
      ) : (
        <p className="text-[13px] text-[var(--muted)]">Terkunci di luar status Draf.</p>
      )}
    </form>
  );
}
