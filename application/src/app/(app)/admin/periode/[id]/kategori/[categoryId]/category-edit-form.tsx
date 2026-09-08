"use client";

import { useActionState } from "react";
import { updateCategoryAction } from "@/lib/actions/admin-categories";
import type { getCategoryDetail } from "@/lib/services/categories";

type CategoryDetail = NonNullable<Awaited<ReturnType<typeof getCategoryDetail>>>;

const fieldClass =
  "rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:opacity-60";

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
        <input name="code" defaultValue={category.code} disabled={!editable} required className={fieldClass} />
        <input name="name" defaultValue={category.name} disabled={!editable} required className={fieldClass} />
      </div>
      <textarea
        name="description"
        defaultValue={category.description ?? ""}
        disabled={!editable}
        rows={2}
        className={fieldClass}
      />
      <label className="flex items-center gap-2 text-[13px] text-[var(--foreground)]">
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
        <p className="text-[13px] text-[var(--muted)]">Terkunci di luar status Draf.</p>
      )}
    </form>
  );
}
