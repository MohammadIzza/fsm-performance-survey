"use client";

import { useActionState } from "react";
import {
  previewAssignmentPlanAction,
  commitAssignmentPlanAction,
} from "@/lib/actions/admin-assignments";

const groupLabel: Record<string, string> = {
  PIMPINAN: "Pimpinan",
  SELAIN_PIMPINAN: "Selain Pimpinan",
};

export function AssignmentPlanner({
  periodId,
  categoryId,
  editable,
}: {
  periodId: string;
  categoryId: string;
  editable: boolean;
}) {
  const [previewState, previewAction, previewPending] = useActionState(
    previewAssignmentPlanAction,
    {}
  );
  const [commitState, commitAction, commitPending] = useActionState(
    commitAssignmentPlanAction,
    {}
  );

  if (!editable) {
    return (
      <p className="text-[13px] text-[var(--muted)]">
        Pengacakan penugasan hanya dapat dijalankan selama periode berstatus Draf.
      </p>
    );
  }

  const plan = previewState.plan;

  return (
    <div className="space-y-4">
      <form action={previewAction}>
        <input type="hidden" name="categoryId" value={categoryId} />
        <button
          type="submit"
          disabled={previewPending}
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-[14px] font-medium text-[var(--foreground)] transition hover:bg-black/[0.03] disabled:opacity-60"
        >
          {previewPending ? "Menghitung…" : "Pratinjau pengacakan"}
        </button>
      </form>

      {previewState.error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {previewState.error}
        </p>
      )}

      {plan && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
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
                    <td className="px-3 py-2 text-[var(--foreground)]">{e.objectName}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">{groupLabel[e.group]}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">{e.eligibleCount}</td>
                    <td className="px-3 py-2 text-[var(--muted)]">{e.alreadyAssigned.length}</td>
                    <td className="px-3 py-2 text-[var(--foreground)]">
                      {e.picked.length > 0 ? e.picked.map((p) => p.name).join(", ") : "—"}
                    </td>
                    <td className="px-3 py-2">
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

          <div className="flex items-center gap-3">
            <p className="text-[13px] text-[var(--muted)]">
              {plan.totalNewAssignments} tugas baru akan diterbitkan.
            </p>
            {plan.totalNewAssignments > 0 && (
              <form action={commitAction}>
                <input type="hidden" name="categoryId" value={categoryId} />
                <input type="hidden" name="periodId" value={periodId} />
                <input type="hidden" name="seed" value={plan.seed} /><input type="hidden" name="fingerprint" value={plan.fingerprint??""} />
                {plan.entries.some(e=>e.shortage>0) && <label className="mb-3 block text-sm"><input type="checkbox" required /> Saya menerima kekurangan calon yang ditampilkan. Minimum respons tetap berlaku.</label>}
                <button
                  type="submit"
                  disabled={commitPending}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
                >
                  {commitPending ? "Menerapkan…" : "Terapkan penugasan"}
                </button>
              </form>
            )}
          </div>
          {commitState.error && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {commitState.error}
            </p>
          )}
          {commitState.committed && (
            <p className="text-sm text-[var(--success)]">
              Penugasan diterapkan. Lihat daftar tugas di bawah untuk hasilnya.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
