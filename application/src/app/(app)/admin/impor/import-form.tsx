"use client";

import { AdminActionList, AdminAction } from "@/components/theme/admin-actions";
import { useActionState, useState } from "react";
import { previewImportAction, applyImportAction } from "@/lib/actions/imports";

const entityOptions = [
  { value: "UNIT", label: "Unit" },
  { value: "PENGGUNA", label: "Pengguna" },
  { value: "PIMPINAN", label: "Pimpinan" },
];

const fieldClass =
  "form__control";

export function ImportForm() {
  const [entity, setEntity] = useState("UNIT");
  const [previewState, previewAction, previewPending] = useActionState(previewImportAction, {});
  const [applyState, applyAction, applyPending] = useActionState(applyImportAction, {});

  const preview = previewState.preview;
  const canApply = preview && preview.errors.length === 0 && preview.totalRows > 0 && !applyState.success;

  return (
    <AdminActionList>
      <AdminAction
        name="Unggah berkas"
        description="Berkas dibaca sebagai pratinjau dulu; tidak ada yang masuk sebelum diterapkan."
        defaultOpen
      >
      <p className="mb-3">
        <a href={`/admin/impor/template/${entity.toLowerCase()}`} className="app-text-sm">
          Unduh template {entityOptions.find((e) => e.value === entity)?.label}
        </a>
      </p>

      <form action={previewAction} className="grid gap-3 sm:grid-cols-3">
        <label className="admin-tools__field">
          <span>Data yang diimpor</span>
          <select
            name="entity"
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            className={fieldClass}
          >
            {entityOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-tools__field sm:col-span-2">
          <span>Berkas Excel (.xlsx)</span>
          <input
            name="file"
            type="file"
            accept=".xlsx"
            required
            className={fieldClass}
          />
        </label>
        <div className="flex items-center gap-2 sm:col-span-3">
          <button
            type="submit"
            disabled={previewPending}
            className="app-btn"
          >
            {previewPending ? "Memeriksa…" : "Pratinjau"}
          </button>
          {canApply && (
            <button
              type="submit"
              formAction={applyAction}
              disabled={applyPending}
              className="app-btn app-btn--primary"
            >
              {applyPending ? "Menerapkan…" : "Terapkan"}
            </button>
          )}
          {previewState.error && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {previewState.error}
            </p>
          )}
        </div>
      </form>

      {applyState.success && applyState.summary && (
        <p className="app-note app-note--selesai mt-4">
          Berhasil diterapkan: {applyState.summary.totalRows} baris ({applyState.summary.toCreate}{" "}
          baru, {applyState.summary.toUpdate} diperbarui).
        </p>
      )}
      {applyState.error && (
        <p role="alert" className="app-note app-note--gagal mt-4 whitespace-pre-line">
          {applyState.error}
        </p>
      )}

      {preview && !applyState.success && (
        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
          <p className="app-text-sm text-[var(--muted)]">
            {preview.totalRows} baris terbaca · {preview.toCreate} akan dibuat baru ·{" "}
            {preview.toUpdate} akan diperbarui
            {preview.errors.length > 0 && (
              <span className="text-[var(--danger)]"> · {preview.errors.length} baris bermasalah</span>
            )}
          </p>
          {preview.errors.length > 0 ? (
            <ul className="app-note app-note--gagal max-h-64 space-y-1 overflow-y-auto">
              {preview.errors.map((e, i) => (
                <li key={i} className="text-[var(--danger)]">
                  Baris {e.row}: {e.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="app-text-sm text-[var(--success)]">
              Semua baris valid — siap diterapkan.
            </p>
          )}
        </div>
      )}
      </AdminAction>
    </AdminActionList>
  );
}
