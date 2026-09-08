"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
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
    return <p className="text-[13px] text-[var(--muted)]">Belum ada tugas diterbitkan.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
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
      <td className="px-3 py-2 text-[var(--foreground)]">
        <Link href={`/tugas/${assignment.id}`} className="hover:underline">
          {assignment.categoryObject.nameSnapshot}
        </Link>
      </td>
      <td className="px-3 py-2 text-[var(--muted)]">{groupLabel[assignment.group]}</td>
      <td className="px-3 py-2 text-[var(--foreground)]">
        {assignment.evaluator.name}
        <div className="font-mono text-[11px] text-[var(--muted)]">
          {assignment.evaluator.loginIdentifier}
        </div>
      </td>
      <td className="px-3 py-2 text-[var(--muted)]">{assignment.reason ?? "—"}</td>
      <td className="px-3 py-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass[assignment.status]}`}
        >
          {statusLabel[assignment.status]}
        </span>
        {assignment.status === "DIBATALKAN" && assignment.cancelReason && (
          <div className="mt-1 text-[11px] text-[var(--muted)]">{assignment.cancelReason}</div>
        )}
      </td>
      <td className="px-3 py-2">
        {canCancel &&
          (cancelling ? (
            <form action={formAction} className="flex flex-col gap-1.5">
              <input type="hidden" name="assignmentId" value={assignment.id} />
              <input type="hidden" name="periodId" value={periodId} />
              <input type="hidden" name="categoryId" value={categoryId} />
              <input
                name="reason"
                placeholder="Alasan pembatalan"
                required
                className="rounded-lg border border-[var(--border)] bg-transparent px-2 py-1 text-[12px] outline-none focus:border-[var(--accent)]"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="text-[12px] font-medium text-[var(--danger)] hover:underline disabled:opacity-60"
                >
                  {pending ? "Membatalkan…" : "Konfirmasi"}
                </button>
                <button
                  type="button"
                  onClick={() => setCancelling(false)}
                  className="text-[12px] font-medium text-[var(--muted)] hover:underline"
                >
                  Batal
                </button>
              </div>
              {state.error && <p className="text-[11px] text-[var(--danger)]">{state.error}</p>}
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCancelling(true)}
              className="text-[12px] font-medium text-[var(--muted)] hover:text-[var(--danger)] hover:underline"
            >
              Batalkan
            </button>
          ))}
      </td>
    </tr>
  );
}
