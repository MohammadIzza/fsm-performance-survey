"use client";

import { useAksi } from "@/components/theme/notifikasi";
import { AdminActionList, AdminAction } from "@/components/theme/admin-actions";
import { useState } from "react";
import { previewImportAction, applyImportAction } from "@/lib/actions/imports";
import { withBase } from "@/lib/base-path";
import { FORMAT_IMPOR, URUTAN_IMPOR } from "@/lib/impor-format";

const entityOptions = URUTAN_IMPOR.map((value) => ({ value, label: FORMAT_IMPOR[value].label }));

const fieldClass =
  "form__control";

export function ImportForm() {
  const [entity, setEntity] = useState("UNIT");
  const [previewState, previewAction, previewPending] = useAksi(previewImportAction, {}, null);
  const [applyState, applyAction, applyPending] = useAksi(applyImportAction, {}, (h) => (h.summary ? `Impor selesai: ${h.summary.toCreate} baru, ${h.summary.toUpdate} diperbarui.` : "Impor selesai."));

  const format = FORMAT_IMPOR[entity as keyof typeof FORMAT_IMPOR];
  const preview = previewState.preview;
  const canApply = preview && preview.errors.length === 0 && preview.totalRows > 0 && !applyState.success;

  return (
    <AdminActionList>
      <AdminAction
        name="Unggah berkas"
        description="Berkas dibaca sebagai pratinjau dulu; tidak ada yang masuk sebelum diterapkan."
        defaultOpen
      >
      <div className="impor-panduan">
        <a href={withBase(`/admin/impor/template/${entity.toLowerCase()}`)} className="app-btn app-btn--primary">
          Unduh template {format.label} (.xlsx)
        </a>
        <p className="impor-panduan__langkah">
          Unduh template → isi di Excel → unggah di bawah untuk pratinjau → tekan Terapkan. Berkasnya sudah berisi
          judul kolom, petunjuk pengisian, contoh terisi, dan daftar nama unit serta jenis pengguna yang ada
          sekarang.
        </p>
      </div>

      <details className="impor-format">
        <summary>Kolom berkas {format.label}</summary>
        <p className="impor-format__ringkas">{format.ringkas}</p>
        <table className="parameter-table impor-kolom w-full text-left app-text-sm">
          <thead>
            <tr>
              <th>Kolom</th>
              <th>Wajib</th>
              <th>Isi</th>
            </tr>
          </thead>
          <tbody>
            {format.kolom.map((k) => (
              <tr key={k.nama}>
                <td data-label="Kolom">
                  <code>{k.nama}</code>
                </td>
                <td data-label="Wajib">{k.wajib ? "Wajib" : "Opsional"}</td>
                <td data-label="Isi">{k.ket}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="impor-format__catatan">
          {format.catatan.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </details>

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
