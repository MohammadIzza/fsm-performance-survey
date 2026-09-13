"use client";

import { useAksi } from "@/components/theme/notifikasi";
import { useState } from "react";
import { createCategoryAction } from "@/lib/actions/admin-categories";

const fieldClass =
  "form__control";

export function CategoryCreateForm({
  periodId,
  objectTypes,
}: {
  periodId: string;
  objectTypes: { id: string; code: string; name: string }[];
}) {
  const [state, formAction, pending] = useAksi(createCategoryAction, {}, "Kategori ditambahkan.");
  const [typeId, setTypeId] = useState("");
  // Pembuat karya hanya ada pada objek jenis Karya, jadi pilihannya hanya ditampilkan di sana.
  const isKarya = objectTypes.find((t) => t.id === typeId)?.code === "KARYA";

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-4">
      <input type="hidden" name="periodId" value={periodId} />
      <label className="admin-tools__field sm:col-span-3">
        <span>Nama kategori</span>
        <input name="name" placeholder="mis. Dosen Favorit se-FSM" required className={fieldClass} />
      </label>
      <label className="admin-tools__field">
        <span>Yang akan dinilai</span>
        <select
          name="objectTypeId"
          required
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
          className={fieldClass}
        >
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
      {isKarya ? (
        <label className="flex items-center gap-2 app-text-sm text-[var(--foreground)]">
          <input type="checkbox" name="excludeContributors" defaultChecked className="h-4 w-4" />
          Kecualikan pembuat karya sebagai penilai
        </label>
      ) : (
        // Jenis lain tetap menyimpan bawaan yang aman (dikecualikan), tanpa menampilkan pilihannya.
        <input type="hidden" name="excludeContributors" value="on" />
      )}
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
