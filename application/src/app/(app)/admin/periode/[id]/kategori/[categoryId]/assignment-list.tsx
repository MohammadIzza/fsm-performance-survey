"use client";

import { useAksi } from "@/components/theme/notifikasi";
import Link from "next/link";
import { useState } from "react";
import { StatusPill } from "@/components/theme/status-pill";
import { cancelAssignmentAction } from "@/lib/actions/admin-assignments";
import { openLateAssignmentsAction } from "@/lib/actions/responses";
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
  periodStatus,
}: {
  assignments: Assignment[];
  periodId: string;
  categoryId: string;
  periodStatus: string;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lateState, lateAction, latePending] = useAksi(
    openLateAssignmentsAction,
    {},
    "Pengisian terlambat dibuka."
  );
  const canOpenLate = periodStatus === "REVISI";
  const eligibleIds = assignments
    .filter((assignment) => assignment.status === "BELUM_MULAI" || assignment.status === "DRAF")
    .map((assignment) => assignment.id);
  const selectedCount = selectedIds.filter((id) => eligibleIds.includes(id)).length;

  function toggleSelection(assignmentId: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, assignmentId])] : current.filter((id) => id !== assignmentId)
    );
  }

  if (assignments.length === 0) {
    return (
      <p className="assignment-list__empty">
        Belum ada tugas. Mulai dari <strong>Pratinjau pengacakan</strong> di atas, atau tambahkan
        satu tugas secara manual di bawah.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {canOpenLate && eligibleIds.length > 0 && (
        <form action={lateAction} className="app-note app-note--perhatian space-y-3">
          <input type="hidden" name="periodId" value={periodId} />
          <input type="hidden" name="categoryId" value={categoryId} />
          {selectedIds.map((assignmentId) => (
            <input key={assignmentId} type="hidden" name="assignmentId" value={assignmentId} />
          ))}
          <div>
            <strong>Buka pengisian terlambat sekaligus</strong>
            <p className="app-text-sm">Pilih tugas Belum mulai atau Draf pada tabel, lalu tetapkan satu tenggat untuk semuanya.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="admin-tools__field">
              <span>Tenggat pengisian (WIB)</span>
              <input type="datetime-local" name="correctionEndsAt" required className="form__control" />
            </label>
            <label className="admin-tools__field admin-tools__field--grow">
              <span>Alasan</span>
              <input name="reason" placeholder="Alasan memberi kesempatan terlambat" required className="form__control" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={latePending || selectedCount === 0} className="app-btn app-btn--primary">
              {latePending ? "Memproses…" : `Buka pengisian (${selectedCount})`}
            </button>
            <button
              type="button"
              className="app-btn app-btn--polos"
              onClick={() => setSelectedIds(selectedCount === eligibleIds.length ? [] : eligibleIds)}
            >
              {selectedCount === eligibleIds.length ? "Kosongkan pilihan" : "Pilih semua yang belum mengisi"}
            </button>
          </div>
          {lateState.error && <p role="alert" className="aturan-galat">{lateState.error}</p>}
        </form>
      )}
      <div className="app-table-wrap">
      <table className="tugas-tabel">
        <thead>
          <tr>
            {canOpenLate && <th aria-label="Pilih tugas" />}
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
            <AssignmentRow
              key={a.id}
              assignment={a}
              periodId={periodId}
              categoryId={categoryId}
              showSelectionColumn={canOpenLate}
              selectable={canOpenLate && eligibleIds.includes(a.id)}
              selected={selectedIds.includes(a.id)}
              onSelect={toggleSelection}
            />
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function AssignmentRow({
  assignment,
  periodId,
  categoryId,
  showSelectionColumn,
  selectable,
  selected,
  onSelect,
}: {
  assignment: Assignment;
  periodId: string;
  categoryId: string;
  showSelectionColumn: boolean;
  selectable: boolean;
  selected: boolean;
  onSelect: (assignmentId: string, checked: boolean) => void;
}) {
  const [cancelling, setCancelling] = useState(false);
  const [state, formAction, pending] = useAksi(cancelAssignmentAction, {}, "Penugasan dibatalkan.");

  const canCancel = assignment.status === "BELUM_MULAI" || assignment.status === "DIBUKA_KEMBALI";

  return (
    <tr>
      {showSelectionColumn && (
        <td data-label="Pilih">
          {selectable ? (
            <input
              type="checkbox"
              aria-label={`Pilih tugas ${assignment.categoryObject.nameSnapshot} untuk ${assignment.evaluator.name}`}
              checked={selected}
              onChange={(event) => onSelect(assignment.id, event.target.checked)}
            />
          ) : "—"}
        </td>
      )}
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
