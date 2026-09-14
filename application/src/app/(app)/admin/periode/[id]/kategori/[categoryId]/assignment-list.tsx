"use client";

import { useAksi } from "@/components/theme/notifikasi";
import Link from "next/link";
import { useState } from "react";
import { StatusPill } from "@/components/theme/status-pill";
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

const statusTone: Record<string, "netral" | "proses" | "selesai" | "perhatian" | "gagal"> = {
  BELUM_MULAI: "netral",
  DRAF: "proses",
  TERKIRIM: "selesai",
  DIBUKA_KEMBALI: "perhatian",
  DIBATALKAN: "gagal",
  LEWAT_TENGGAT: "gagal",
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
      <table className="tugas-tabel">
        <thead>
          <tr>
            <th>Objek</th>
            <th>Kelompok</th>
            <th>Penilai</th>
            <th>Asal</th>
            <th>Status</th>
            <th className="tugas-tabel__aksi">Aksi</th>
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
  const [state, formAction, pending] = useAksi(cancelAssignmentAction, {}, "Penugasan dibatalkan.");

  const canCancel = assignment.status === "BELUM_MULAI" || assignment.status === "DIBUKA_KEMBALI";

  return (
    <tr>
      <td data-label="Objek">
        <Link href={`/tugas/${assignment.id}`} className="tugas-tabel__objek">
          {assignment.categoryObject.nameSnapshot}
        </Link>
      </td>
      <td data-label="Kelompok">{groupLabel[assignment.group]}</td>
      <td data-label="Penilai">
        <span>
          {assignment.evaluator.name}
          <small>{assignment.evaluator.loginIdentifier}</small>
        </span>
      </td>
      <td data-label="Asal">{assignment.reason ?? "—"}</td>
      <td data-label="Status">
        <span>
          <StatusPill tone={statusTone[assignment.status]}>{statusLabel[assignment.status]}</StatusPill>
          {assignment.status === "DIBATALKAN" && assignment.cancelReason && <small>{assignment.cancelReason}</small>}
        </span>
      </td>
      <td data-label="Aksi" className="tugas-tabel__aksi">
        {canCancel ? (
          cancelling ? (
            <form action={formAction} className="tugas-batal">
              <input type="hidden" name="assignmentId" value={assignment.id} />
              <input type="hidden" name="periodId" value={periodId} />
              <input type="hidden" name="categoryId" value={categoryId} />
              <input name="reason" placeholder="Alasan pembatalan" required autoFocus className="form__control" />
              <span className="tugas-batal__tombol">
                <button type="submit" disabled={pending} className="app-btn app-btn--danger">
                  {pending ? "Membatalkan…" : "Batalkan tugas"}
                </button>
                <button type="button" onClick={() => setCancelling(false)} className="app-btn app-btn--polos">
                  Tidak jadi
                </button>
              </span>
              {state.error && <p className="aturan-galat">{state.error}</p>}
            </form>
          ) : (
            <button type="button" onClick={() => setCancelling(true)} className="app-btn app-btn--polos app-btn--danger">
              Batalkan
            </button>
          )
        ) : (
          <span className="tugas-tabel__kosong">—</span>
        )}
      </td>
    </tr>
  );
}
