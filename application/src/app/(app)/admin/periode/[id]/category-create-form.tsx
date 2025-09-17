"use client";

import { useActionState } from "react";
import { createCategoryAction } from "@/lib/actions/admin-categories";

const fieldClass =
  "form__control";

export function CategoryCreateForm({
  periodId,
  objectTypes,
}: {
  periodId: string;
  objectTypes: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createCategoryAction, {});

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="periodId" value={periodId} />
      <label className="admin-tools__field sm:col-span-3">
        <span>Nama kategori</span>
        <input name="name" placeholder="mis. Dosen Favorit se-FSM" required className={fieldClass} />
      </label>
      <label className="admin-tools__field">
        <span>Yang akan dinilai</span>
        <select name="objectTypeId" required defaultValue="" className={fieldClass}>
          <option value="" disabled>
            Pilih jenis objek…
          </option>
          {objectTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-tools__field sm:col-span-3">
        <span>Tujuan penilaian</span>
        <textarea
          name="description"
          placeholder="Deskripsi (opsional)"
          rows={2}
          className={fieldClass}
        />
      </label>
      <label className="flex items-center gap-2 app-text-sm text-[var(--foreground)]">
        <input type="checkbox" name="excludeContributors" defaultChecked className="h-4 w-4" />
        Kecualikan pembuat karya sebagai penilai
      </label>
      <div className="flex items-center gap-2 sm:col-span-4">
        <button
          type="submit"
          disabled={pending}
          className="app-btn app-btn--primary"
        >
          {pending ? "Menyimpan…" : "Tambah kategori"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
