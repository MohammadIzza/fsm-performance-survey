"use client";

import { useActionState, useState } from "react";
import {
  addParameterAction,
  updateParameterAction,
  deleteParameterAction,
} from "@/lib/actions/admin-instruments";
import type { getCategoryDetail } from "@/lib/services/categories";

type Parameter = NonNullable<Awaited<ReturnType<typeof getCategoryDetail>>>["instrumentVersions"][number]["parameters"][number];

const fieldClass =
  "rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

export function ParameterManager({
  instrumentVersionId,
  parameters,
  periodId,
  categoryId,
  editable,
}: {
  instrumentVersionId: string;
  parameters: Parameter[];
  periodId: string;
  categoryId: string;
  editable: boolean;
}) {
  const [addState, addFormAction, addPending] = useActionState(addParameterAction, {});

  return (
    <div className="space-y-4">
      {parameters.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[600px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
                <th className="px-3 py-2 font-medium">Urutan</th>
                <th className="px-3 py-2 font-medium">Nama</th>
                <th className="px-3 py-2 font-medium">Indikator</th>
                <th className="px-3 py-2 font-medium">Bobot</th>
                {editable && <th className="px-3 py-2 font-medium">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {parameters
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((p) => (
                  <ParameterRow
                    key={p.id}
                    parameter={p}
                    periodId={periodId}
                    categoryId={categoryId}
                    editable={editable}
                  />
                ))}
            </tbody>
          </table>
        </div>
      )}

      {editable && (
        <form action={addFormAction} className="grid gap-2 sm:grid-cols-5">
          <input type="hidden" name="instrumentVersionId" value={instrumentVersionId} />
          <input type="hidden" name="periodId" value={periodId} />
          <input type="hidden" name="categoryId" value={categoryId} />
          <input
            name="order"
            type="number"
            defaultValue={parameters.length + 1}
            placeholder="Urutan"
            required
            className={fieldClass}
          />
          <input name="name" placeholder="Nama parameter" required className={`${fieldClass} sm:col-span-2`} />
          <input name="indicator" placeholder="Indikator (opsional)" className={fieldClass} />
          <input
            name="weight"
            type="number"
            step="any"
            min={0}
            max={100}
            placeholder="Bobot %"
            required
            className={fieldClass}
          />
          <div className="sm:col-span-5">
            <button
              type="submit"
              disabled={addPending}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
            >
              {addPending ? "Menyimpan…" : "Tambah parameter"}
            </button>
            {addState.error && (
              <p role="alert" className="mt-2 text-sm text-[var(--danger)]">
                {addState.error}
              </p>
            )}
          </div>
        </form>
      )}

      {!editable && parameters.length === 0 && (
        <p className="text-[13px] text-[var(--muted)]">Belum ada parameter.</p>
      )}
    </div>
  );
}

function ParameterRow({
  parameter,
  periodId,
  categoryId,
  editable,
}: {
  parameter: Parameter;
  periodId: string;
  categoryId: string;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateParameterAction, {});

  if (editing) {
    return (
      <tr className="border-b border-[var(--border)] bg-black/[0.015] last:border-b-0">
        <td colSpan={5} className="px-3 py-3">
          <form action={formAction} className="grid gap-2 sm:grid-cols-5">
            <input type="hidden" name="parameterId" value={parameter.id} />
            <input type="hidden" name="periodId" value={periodId} />
            <input type="hidden" name="categoryId" value={categoryId} />
            <input
              name="order"
              type="number"
              defaultValue={parameter.order}
              required
              className={fieldClass}
            />
            <input
              name="name"
              defaultValue={parameter.name}
              required
              className={`${fieldClass} sm:col-span-2`}
            />
            <input name="indicator" defaultValue={parameter.indicator ?? ""} className={fieldClass} />
            <input
              name="weight"
              type="number"
              step="any"
              min={0}
              max={100}
              defaultValue={parameter.weight}
              required
              className={fieldClass}
            />
            <div className="flex items-center gap-2 sm:col-span-5">
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {pending ? "Menyimpan…" : "Simpan"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[13px] font-medium text-[var(--foreground)] hover:bg-black/[0.03]"
              >
                Batal
              </button>
              {state.error && (
                <p role="alert" className="text-sm text-[var(--danger)]">
                  {state.error}
                </p>
              )}
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-[var(--border)] last:border-b-0">
      <td data-label="Urutan" className="px-3 py-2 text-[var(--muted)]">{parameter.order}</td>
      <td data-label="Nama" className="px-3 py-2 font-medium text-[var(--foreground)]">{parameter.name}</td>
      <td data-label="Indikator" className="px-3 py-2 text-[var(--muted)]">{parameter.indicator || "—"}</td>
      <td data-label="Bobot" className="px-3 py-2 text-[var(--foreground)]">{parameter.weight}%</td>
      {editable && (
        <td data-label="Aksi" className="px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[12px] font-medium text-[var(--accent)] hover:underline"
            >
              Edit
            </button>
            <form action={deleteParameterAction}>
              <input type="hidden" name="parameterId" value={parameter.id} />
              <input type="hidden" name="periodId" value={periodId} />
              <input type="hidden" name="categoryId" value={categoryId} />
              <button
                type="submit"
                className="text-[12px] font-medium text-[var(--muted)] hover:text-[var(--danger)] hover:underline"
              >
                Hapus
              </button>
            </form>
          </div>
        </td>
      )}
    </tr>
  );
}
