"use client";

import { useAksi } from "@/components/theme/notifikasi";
import { manualAssignEvaluatorAction } from "@/lib/actions/admin-assignments";
import { PilihanCari } from "@/components/theme/pilihan-cari";
import { AlasanBerjalan } from "@/components/theme/alasan-berjalan";

const fieldClass =
  "form__control";

export function ManualAssignForm({
  periodId,
  categoryId,
  categoryObjects,
  users,
  berjalan = false,
}: {
  periodId: string;
  categoryId: string;
  categoryObjects: { id: string; nameSnapshot: string }[];
  users: { id: string; name: string; loginIdentifier: string }[];
  berjalan?: boolean;
}) {
  const [state, formAction, pending] = useAksi(manualAssignEvaluatorAction, {}, "Penilai ditugaskan.");

  return (
    <form action={formAction} className="manual-assignment-form">
      <input type="hidden" name="periodId" value={periodId} />
      <input type="hidden" name="categoryId" value={categoryId} />

      <label className="admin-tools__field">
        <span>Objek yang dinilai</span>
        <PilihanCari
          name="categoryObjectId"
          required
          kosong={{ label: "Pilih objek…", bisaDipilih: false }}
          options={categoryObjects.map((co) => ({ value: co.id, label: co.nameSnapshot }))}
        />
      </label>
      <label className="admin-tools__field">
        <span>Kelompok penilai</span>
        <select name="group" required defaultValue="" className={fieldClass}>
          <option value="" disabled>Pilih kelompok…</option>
          <option value="PIMPINAN">Pimpinan</option>
          <option value="SELAIN_PIMPINAN">Selain Pimpinan</option>
        </select>
      </label>
      <label className="admin-tools__field">
        <span>Orang yang menilai</span>
        <PilihanCari
          name="evaluatorId"
          required
          kosong={{ label: "Pilih penilai…", bisaDipilih: false }}
          options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.loginIdentifier})` }))}
        />
      </label>
      {berjalan && <AlasanBerjalan contoh="Mis. penilai semula berhalangan" />}
      <button
        type="submit"
        disabled={pending}
        className="app-btn app-btn--primary"
      >
        {pending ? "Menugaskan…" : "Tugaskan manual"}
      </button>
      {state.error && (
        <p role="alert" className="manual-assignment-form__error text-[var(--danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
