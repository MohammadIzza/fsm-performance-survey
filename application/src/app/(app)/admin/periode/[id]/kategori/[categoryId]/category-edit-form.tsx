"use client";

import { useActionState } from "react";
import { updateCategoryAction } from "@/lib/actions/admin-categories";
import type { getCategoryDetail } from "@/lib/services/categories";

type CategoryDetail = NonNullable<Awaited<ReturnType<typeof getCategoryDetail>>>;

const fieldClass =
  "form__control disabled:opacity-60";

export function CategoryEditForm({
  category,
  periodId,
  editable,
}: {
  category: CategoryDetail;
  periodId: string;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateCategoryAction, {});

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="categoryId" value={category.id} />
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="objectTypeId" value={category.objectTypeId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="admin-tools__field">
          <span>Kode kategori</span>
          <input name="code" defaultValue={category.code} disabled={!editable} required className={fieldClass} />
        </label>
        <label className="admin-tools__field">
          <span>Nama kategori</span>
          <input name="name" defaultValue={category.name} disabled={!editable} required className={fieldClass} />
        </label>
      </div>
      <label className="admin-tools__field">
        <span>Tujuan penilaian</span>
        <textarea
          name="description"
          defaultValue={category.description ?? ""}
          disabled={!editable}
          rows={2}
          className={fieldClass}
        />
      </label>
      <label className="flex items-center gap-2 app-text-sm text-[var(--foreground)]">
        <input
          type="checkbox"
          name="excludeContributors"
          defaultChecked={category.excludeContributors}
          disabled={!editable}
          className="h-4 w-4"
        />
        Kecualikan pembuat karya sebagai penilai
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
        <p className="app-text-sm text-[var(--muted)]">Terkunci di luar status Draf.</p>
      )}
    </form>
  );
}
