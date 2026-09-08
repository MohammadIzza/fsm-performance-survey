"use client";

import { useActionState, useState } from "react";
import { previewImportAction, applyImportAction } from "@/lib/actions/imports";

const entityOptions = [
  { value: "UNIT", label: "Unit" },
  { value: "PENGGUNA", label: "Pengguna" },
  { value: "PIMPINAN", label: "Pimpinan" },
];

const fieldClass =
  "rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

export function ImportForm() {
  const [entity, setEntity] = useState("UNIT");
  const [previewState, previewAction, previewPending] = useActionState(previewImportAction, {});
  const [applyState, applyAction, applyPending] = useActionState(applyImportAction, {});

  const preview = previewState.preview;
  const canApply = preview && preview.errors.length === 0 && preview.totalRows > 0 && !applyState.success;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Unggah berkas
        </h2>
        <a
          href={`/admin/impor/template/${entity.toLowerCase()}`}
          className="text-[13px] font-medium text-[var(--accent)] hover:underline"
        >
          Unduh template {entityOptions.find((e) => e.value === entity)?.label}
        </a>
      </div>

      <form action={previewAction} className="grid gap-3 sm:grid-cols-3">
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
        <input
          name="file"
          type="file"
          accept=".xlsx"
          required
          className={`${fieldClass} sm:col-span-2`}
        />
        <div className="flex items-center gap-2 sm:col-span-3">
          <button
            type="submit"
            disabled={previewPending}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-[14px] font-medium text-[var(--foreground)] transition hover:bg-black/[0.03] disabled:opacity-60"
          >
            {previewPending ? "Memeriksa…" : "Pratinjau"}
          </button>
          {canApply && (
            <button
              type="submit"
              formAction={applyAction}
              disabled={applyPending}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
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
        <p className="mt-4 rounded-xl bg-[var(--success)]/10 p-3 text-[13px] text-[var(--success)]">
          Berhasil diterapkan: {applyState.summary.totalRows} baris ({applyState.summary.toCreate}{" "}
          baru, {applyState.summary.toUpdate} diperbarui).
        </p>
      )}
      {applyState.error && (
        <p role="alert" className="mt-4 whitespace-pre-line rounded-xl bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
          {applyState.error}
        </p>
      )}

      {preview && !applyState.success && (
        <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
          <p className="text-[13px] text-[var(--muted)]">
            {preview.totalRows} baris terbaca · {preview.toCreate} akan dibuat baru ·{" "}
            {preview.toUpdate} akan diperbarui
            {preview.errors.length > 0 && (
              <span className="text-[var(--danger)]"> · {preview.errors.length} baris bermasalah</span>
            )}
          </p>
          {preview.errors.length > 0 ? (
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl bg-[var(--danger)]/5 p-3 text-[12px]">
              {preview.errors.map((e, i) => (
                <li key={i} className="text-[var(--danger)]">
                  Baris {e.row}: {e.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-[var(--success)]">
              Semua baris valid — siap diterapkan.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
