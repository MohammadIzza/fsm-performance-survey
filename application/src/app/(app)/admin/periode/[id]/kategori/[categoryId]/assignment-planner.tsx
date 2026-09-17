"use client";

import { useAksi } from "@/components/theme/notifikasi";
import {
  previewAssignmentPlanAction,
  commitAssignmentPlanAction,
} from "@/lib/actions/admin-assignments";
import { AlasanBerjalan } from "@/components/theme/alasan-berjalan";

const groupLabel: Record<string, string> = {
  PIMPINAN: "Pimpinan",
  SELAIN_PIMPINAN: "Selain Pimpinan",
};

export function AssignmentPlanner({
  periodId,
  categoryId,
  editable,
  berjalan = false,
}: {
  periodId: string;
  categoryId: string;
  /** Boleh menerbitkan tugas baru — saat Draf, dan saat Aktif sebelum tenggat. */
  editable: boolean;
  berjalan?: boolean;
}) {
  const [previewState, previewAction, previewPending] = useAksi(previewAssignmentPlanAction, {}, null);
  const [commitState, commitAction, commitPending] = useAksi(commitAssignmentPlanAction, {}, "Tugas penilaian dibagikan.");

  if (!editable) {
    return (
      <p className="app-text-sm text-[var(--muted)]">
        Pembagian tugas hanya dapat dijalankan selama periode berstatus Draf, atau Aktif sebelum
        tenggatnya lewat.
      </p>
    );
  }

  const plan = previewState.plan;

  return (
    <div className="assignment-planner space-y-4">
      {/* Pratinjau tidak mengubah apa pun — ia hanya menghitung usulan. Bentuknya tautan sebaris,
          bukan tombol bertepi seperti "Terapkan penugasan" di bawah, supaya keduanya tidak
          terbaca sebagai dua tindakan yang sama beratnya. */}
      <form action={previewAction} className="assignment-planner__preview">
        <input type="hidden" name="categoryId" value={categoryId} />
        <button
          type="submit"
          disabled={previewPending}
          className="app-btn app-btn--polos assignment-planner__preview-button"
        >
          {previewPending ? "Menghitung…" : "Pratinjau pengacakan →"}
        </button>
      </form>

      {previewState.error && (
        <p role="alert" className="assignment-planner__message text-[var(--danger)]">
          {previewState.error}
        </p>
      )}

      {plan && (
        <div className="assignment-planner__result space-y-3">
          <div className="app-table-wrap assignment-planner__table-wrap">
            <table className="assignment-planner__table w-full min-w-[640px] text-left">
              <thead>
                <tr>
                  <th className="px-3 py-2 font-medium">Objek</th>
                  <th className="px-3 py-2 font-medium">Kelompok</th>
                  <th className="px-3 py-2 font-medium">Calon sah</th>
                  <th className="px-3 py-2 font-medium">Sudah ada</th>
                  <th className="px-3 py-2 font-medium">Akan ditambah</th>
                  <th className="px-3 py-2 font-medium">Kekurangan</th>
                </tr>
              </thead>
              <tbody>
                {plan.entries.map((e, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-b-0">
                    <td data-label="Objek" className="px-3 py-2 text-[var(--foreground)]">{e.objectName}</td>
                    <td data-label="Kelompok" className="px-3 py-2 text-[var(--muted)]">{groupLabel[e.group]}</td>
                    <td data-label="Calon sah" className="px-3 py-2 text-[var(--muted)]">{e.eligibleCount}</td>
                    <td data-label="Sudah ada" className="px-3 py-2 text-[var(--muted)]">{e.alreadyAssigned.length}</td>
                    <td data-label="Ditambahkan" className="px-3 py-2 text-[var(--foreground)]">
                      {e.picked.length > 0 ? e.picked.map((p) => p.name).join(", ") : "—"}
                    </td>
                    <td data-label="Kekurangan" className="px-3 py-2">
                      {e.shortage > 0 ? (
                        <span className="text-[var(--danger)]">{e.shortage}</span>
                      ) : (
                        <span className="text-[var(--success)]">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="assignment-planner__footer">
            {plan.totalNewAssignments > 0 ? (
              <form action={commitAction} className="assignment-planner__apply">
                <input type="hidden" name="categoryId" value={categoryId} />
                <input type="hidden" name="periodId" value={periodId} />
                <input type="hidden" name="seed" value={plan.seed} /><input type="hidden" name="fingerprint" value={plan.fingerprint??""} />
                {plan.entries.some(e=>e.shortage>0) && (
                  <label className="assignment-planner__acceptance">
                    <input type="checkbox" required />
                    <span>
                      Saya menerima kekurangan calon yang ditampilkan. Minimum respons tetap berlaku.
                    </span>
                  </label>
                )}
                {berjalan && (
                  <AlasanBerjalan contoh="Mis. objek baru ditambahkan setelah periode dibuka" />
                )}
                <div className="assignment-planner__apply-row">
                  <p className="assignment-planner__summary text-[var(--muted)]">
                    {plan.totalNewAssignments} tugas baru akan diterbitkan.
                  </p>
                  <button
                    type="submit"
                    disabled={commitPending}
                    className="app-btn app-btn--primary"
                  >
                    {commitPending ? "Menerapkan…" : "Terapkan penugasan"}
                  </button>
                </div>
              </form>
            ) : (
              <p className="assignment-planner__summary text-[var(--muted)]">
                Tidak ada tugas baru yang perlu diterbitkan.
              </p>
            )}
          </div>
          {commitState.error && (
            <p role="alert" className="assignment-planner__message text-[var(--danger)]">
              {commitState.error}
            </p>
          )}
          {commitState.committed && (
            <p className="assignment-planner__message text-[var(--success)]">
              Penugasan diterapkan. Lihat daftar tugas di bawah untuk hasilnya.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
