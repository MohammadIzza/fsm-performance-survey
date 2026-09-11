"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { RowActionMenu } from "@/components/theme/data-list";
import { cancelAssignmentAction } from "@/lib/actions/admin-assignments";
import type { listAssignmentsForCategory } from "@/lib/services/assignments";

type Assignment = Awaited<ReturnType<typeof listAssignmentsForCategory>>[number];

const groupLabel: Record<string, string> = {
  PIMPINAN: "Pimpinan",
  SELAIN_PIMPINAN: "Selain Pimpinan",
};

const statusLabel: Record<string, string> = {
  BELUM_MULAI: "Belum mulai",
  DRAF: "Draf",
  TERKIRIM: "Terkirim",
  DIBUKA_KEMBALI: "Dibuka kembali",
  DIBATALKAN: "Dibatalkan",
  LEWAT_TENGGAT: "Lewat tenggat",
};

const statusClass: Record<string, string> = {
  BELUM_MULAI: "bg-black/5 text-[var(--muted)]",
  DRAF: "bg-blue-500/10 text-blue-600",
  TERKIRIM: "bg-[var(--success)]/10 text-[var(--success)]",
  DIBUKA_KEMBALI: "bg-amber-500/10 text-amber-600",
  DIBATALKAN: "bg-[var(--danger)]/10 text-[var(--danger)]",
  LEWAT_TENGGAT: "bg-amber-500/10 text-amber-600",
};

export function AssignmentList({
  assignments,
  periodId,
  categoryId,
}: {
  assignments: Assignment[];
  periodId: string;
  categoryId: string;
}) {
  if (assignments.length === 0) {
    return (
      <p className="assignment-list__empty">
        Belum ada tugas. Mulai dari <strong>Pratinjau pengacakan</strong> di atas, atau tambahkan
        satu tugas secara manual di bawah.
      </p>
    );
  }

  return (
    <div className="app-table-wrap">
      <table className="w-full min-w-[720px] text-left app-text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 font-medium">Objek</th>
            <th className="px-3 py-2 font-medium">Kelompok</th>
            <th className="px-3 py-2 font-medium">Penilai</th>
            <th className="px-3 py-2 font-medium">Asal</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((a) => (
            <AssignmentRow key={a.id} assignment={a} periodId={periodId} categoryId={categoryId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssignmentRow({
  assignment,
  periodId,
  categoryId,
}: {
  assignment: Assignment;
  periodId: string;
  categoryId: string;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [state, formAction, pending] = useActionState(cancelAssignmentAction, {});

  const canCancel = assignment.status === "BELUM_MULAI" || assignment.status === "DIBUKA_KEMBALI";

  return (
    <tr className="border-b border-[var(--border)] last:border-b-0 align-top">
      <td data-label="Objek" className="px-3 py-2 text-[var(--foreground)]">
        <Link href={`/tugas/${assignment.id}`} className="hover:underline">
          {assignment.categoryObject.nameSnapshot}
        </Link>
      </td>
      <td data-label="Kelompok" className="px-3 py-2 text-[var(--muted)]">{groupLabel[assignment.group]}</td>
      <td data-label="Penilai" className="px-3 py-2 text-[var(--foreground)]">
        {assignment.evaluator.name}
        <div className="font-mono app-text-xs text-[var(--muted)]">
          {assignment.evaluator.loginIdentifier}
        </div>
      </td>
      <td data-label="Asal" className="px-3 py-2 text-[var(--muted)]">{assignment.reason ?? "—"}</td>
      <td data-label="Status" className="px-3 py-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 app-text-xs font-medium ${statusClass[assignment.status]}`}
        >
          {statusLabel[assignment.status]}
        </span>
        {assignment.status === "DIBATALKAN" && assignment.cancelReason && (
          <div className="mt-1 app-text-xs text-[var(--muted)]">{assignment.cancelReason}</div>
        )}
      </td>
      <td data-label="Aksi" className="px-3 py-2">
        {canCancel &&
          (cancelling ? (
            <form action={formAction} className="admin-inline-form flex flex-col gap-1.5">
              <input type="hidden" name="assignmentId" value={assignment.id} />
              <input type="hidden" name="periodId" value={periodId} />
              <input type="hidden" name="categoryId" value={categoryId} />
              <input
                name="reason"
                placeholder="Alasan pembatalan"
                required
                className="form__control app-text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="app-text-xs font-medium text-[var(--danger)] hover:underline disabled:opacity-60"
                >
                  {pending ? "Membatalkan…" : "Konfirmasi"}
                </button>
                <button
                  type="button"
                  onClick={() => setCancelling(false)}
                  className="app-text-xs font-medium text-[var(--muted)] hover:underline"
                >
                  Batal
                </button>
              </div>
              {state.error && <p className="app-text-xs text-[var(--danger)]">{state.error}</p>}
            </form>
          ) : (
            <RowActionMenu>
              <button type="button" onClick={() => setCancelling(true)}>
                Batalkan
              </button>
            </RowActionMenu>
          ))}
      </td>
    </tr>
  );
}
