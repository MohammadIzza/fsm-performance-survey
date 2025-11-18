"use client";

import { useActionState, useId, useState } from "react";
import {
  addParameterAction,
  updateParameterAction,
  deleteParameterAction,
} from "@/lib/actions/admin-instruments";
import type { getCategoryDetail } from "@/lib/services/categories";

type Parameter = NonNullable<Awaited<ReturnType<typeof getCategoryDetail>>>["instrumentVersions"][number]["parameters"][number];

const fieldClass =
  "form__control";

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
  const addFormId = useId();
  const totalWeight = parameters.reduce((total, parameter) => total + parameter.weight, 0);
  const remainingWeight = Math.max(0, Math.round((100 - totalWeight) * 100) / 100);

  return (
    <div className="space-y-4">
      {(parameters.length > 0 || editable) && (
        <div className="app-table-wrap">
          <table className="parameter-table w-full text-left app-text-sm">
            <thead>
              <tr>
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
                    totalWeight={totalWeight}
                  />
                ))}
              {editable && (
                <tr className="parameter-row parameter-add-row">
                  <td data-label="Nama" className="px-3 py-2">
                    <input
                      form={addFormId}
                      name="name"
                      placeholder="Nama parameter"
                      required
                      className={fieldClass}
                    />
                  </td>
                  <td data-label="Indikator" className="px-3 py-2">
                    <input
                      form={addFormId}
                      name="indicator"
                      placeholder="Indikator (opsional)"
                      className={fieldClass}
                    />
                  </td>
                  <td data-label="Bobot" className="px-3 py-2">
                    <input
                      form={addFormId}
                      name="weight"
                      type="number"
                      step="any"
                      min={0}
                      max={remainingWeight}
                      placeholder={`Maks. ${remainingWeight}%`}
                      required
                      className={fieldClass}
                    />
                  </td>
                  <td data-label="Aksi" className="parameter-add-row__action px-3 py-2">
                    <form id={addFormId} action={addFormAction}>
                      <input type="hidden" name="instrumentVersionId" value={instrumentVersionId} />
                      <input type="hidden" name="periodId" value={periodId} />
                      <input type="hidden" name="categoryId" value={categoryId} />
                      <button type="submit" disabled={addPending} className="app-btn app-btn--primary">
                        {addPending ? "Menyimpan…" : "Tambah"}
                      </button>
                    </form>
                    <span>Sisa {remainingWeight}%</span>
                    {addState.error && <p role="alert">{addState.error}</p>}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!editable && parameters.length === 0 && (
        <p className="app-text-sm text-[var(--muted)]">Belum ada parameter.</p>
      )}
    </div>
  );
}

function ParameterRow({
  parameter,
  periodId,
  categoryId,
  editable,
  totalWeight,
}: {
  parameter: Parameter;
  periodId: string;
  categoryId: string;
  editable: boolean;
  totalWeight: number;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateParameterAction, {});
  const editFormId = `edit-parameter-${parameter.id}`;

  if (editing) {
    return (
      <tr className="parameter-row parameter-row--editing">
        <td data-label="Nama" className="px-3 py-2">
          <input
            form={editFormId}
            name="name"
            defaultValue={parameter.name}
            required
            className={fieldClass}
          />
        </td>
        <td data-label="Indikator" className="px-3 py-2">
          <input
            form={editFormId}
            name="indicator"
            defaultValue={parameter.indicator ?? ""}
            className={fieldClass}
          />
        </td>
        <td data-label="Bobot" className="px-3 py-2">
          <input
            form={editFormId}
            name="weight"
            type="number"
            step="any"
            min={0}
            max={Math.max(0, 100 - (totalWeight - parameter.weight))}
            defaultValue={parameter.weight}
            required
            className={fieldClass}
          />
        </td>
        <td data-label="Aksi" className="parameter-row__actions px-3 py-2">
          <form id={editFormId} action={formAction} className="parameter-row__actions-inner">
            <input type="hidden" name="parameterId" value={parameter.id} />
            <input type="hidden" name="periodId" value={periodId} />
            <input type="hidden" name="categoryId" value={categoryId} />
            <button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              Batal
            </button>
          </form>
          {state.error && <p role="alert" className="parameter-row__error">{state.error}</p>}
        </td>
      </tr>
    );
  }

  return (
    <tr className="parameter-row">
      <td data-label="Nama" className="px-3 py-2 font-medium text-[var(--foreground)]">{parameter.name}</td>
      <td data-label="Indikator" className="px-3 py-2 text-[var(--muted)]">{parameter.indicator || "—"}</td>
      <td data-label="Bobot" className="px-3 py-2 text-[var(--foreground)]">{parameter.weight}%</td>
      {editable && (
        <td data-label="Aksi" className="parameter-row__actions px-3 py-2">
          <div className="parameter-row__actions-inner">
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label="Edit parameter"
              title="Edit"
            >
              <span className="parameter-action__label">Edit</span>
              <svg className="parameter-action__icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20h4l11-11-4-4L4 16v4Zm10-14 4 4m-9 9H5v-4L15 5l4 4L9 19Z" />
              </svg>
            </button>
            <form action={deleteParameterAction}>
              <input type="hidden" name="parameterId" value={parameter.id} />
              <input type="hidden" name="periodId" value={periodId} />
              <input type="hidden" name="categoryId" value={categoryId} />
              <button type="submit" aria-label="Hapus parameter" title="Hapus">
                <span className="parameter-action__label">Hapus</span>
                <svg className="parameter-action__icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 7h14M9 7V4h6v3m2 0-1 13H8L7 7m3 4v5m4-5v5" />
                </svg>
              </button>
            </form>
          </div>
        </td>
      )}
    </tr>
  );
}
