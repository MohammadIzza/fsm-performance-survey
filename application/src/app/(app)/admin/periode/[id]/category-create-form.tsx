"use client";

import { useActionState } from "react";
import { createCategoryAction } from "@/lib/actions/admin-categories";

const fieldClass =
  "rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

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
      <input name="code" placeholder="Kode (mis. KINERJA-DOSEN)" required className={fieldClass} />
      <input name="name" placeholder="Nama kategori" required className={`${fieldClass} sm:col-span-2`} />
      <select name="objectTypeId" required defaultValue="" className={fieldClass}>
        <option value="" disabled>
          Jenis objek…
        </option>
        {objectTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <textarea
        name="description"
        placeholder="Deskripsi (opsional)"
        rows={2}
        className={`${fieldClass} sm:col-span-3`}
      />
      <label className="flex items-center gap-2 text-[13px] text-[var(--foreground)]">
        <input type="checkbox" name="excludeContributors" defaultChecked className="h-4 w-4" />
        Kecualikan pembuat karya sebagai penilai
      </label>
      <div className="flex items-center gap-2 sm:col-span-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
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
