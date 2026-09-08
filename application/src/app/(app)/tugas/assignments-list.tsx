"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface AssignmentRow {
  id: string;
  objectName: string;
  categoryName: string;
  periodId: string;
  periodName: string;
  group: "PIMPINAN" | "SELAIN_PIMPINAN";
  deadline: string; // ISO string, formatted client-side for a stable server/client render
  displayStatus: "BELUM_MULAI" | "DRAF" | "TERKIRIM" | "DIBUKA_KEMBALI" | "LEWAT_TENGGAT";
}

const groupLabel: Record<AssignmentRow["group"], string> = {
  PIMPINAN: "Pimpinan",
  SELAIN_PIMPINAN: "Selain Pimpinan",
};

const statusLabel: Record<AssignmentRow["displayStatus"], string> = {
  BELUM_MULAI: "Belum mulai",
  DRAF: "Draf",
  TERKIRIM: "Terkirim",
  DIBUKA_KEMBALI: "Dibuka kembali",
  LEWAT_TENGGAT: "Lewat tenggat",
};

const statusClass: Record<AssignmentRow["displayStatus"], string> = {
  BELUM_MULAI: "bg-black/5 text-[var(--muted)]",
  DRAF: "bg-blue-500/10 text-blue-600",
  TERKIRIM: "bg-[var(--success)]/10 text-[var(--success)]",
  DIBUKA_KEMBALI: "bg-amber-500/10 text-amber-600",
  LEWAT_TENGGAT: "bg-[var(--danger)]/10 text-[var(--danger)]",
};

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" });

// Bab 16.1: "Tugas saya" perlu filter periode/status, bukan hanya daftar datar — jumlah tugas
// bertambah seiring periode berjalan bersamaan (mis. periode lama masih dalam jendela koreksi).
export function AssignmentsList({ assignments }: { assignments: AssignmentRow[] }) {
  const [periodId, setPeriodId] = useState("");
  const [status, setStatus] = useState("");

  const periods = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of assignments) seen.set(a.periodId, a.periodName);
    return [...seen.entries()];
  }, [assignments]);

  const visible = assignments.filter(
    (a) => (!periodId || a.periodId === periodId) && (!status || a.displayStatus === status),
  );

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={periodId}
          onChange={(e) => setPeriodId(e.target.value)}
          aria-label="Filter periode"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--foreground)]"
        >
          <option value="">Semua periode</option>
          {periods.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter status"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[14px] text-[var(--foreground)]"
        >
          <option value="">Semua status</option>
          {Object.entries(statusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <p className="text-[15px] text-[var(--muted)]">Tidak ada tugas yang cocok dengan filter ini.</p>
        </div>
      ) : (
        <>
          {/* Mobile (<md): kartu bertumpuk, seluruh kartu adalah target ketuk agar nyaman
              dipakai satu tangan — tidak ada tabel sempit yang perlu digulir menyamping. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {visible.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/tugas/${a.id}`}
                  className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition active:bg-black/[0.02]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[15px] font-medium text-[var(--foreground)]">{a.objectName}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass[a.displayStatus]}`}
                    >
                      {statusLabel[a.displayStatus]}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-[var(--muted)]">
                    {a.periodName} &middot; {groupLabel[a.group]}
                  </p>
                  <p className="mt-2 text-[12px] text-[var(--muted-2)]">
                    Tenggat {dateFmt.format(new Date(a.deadline))}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop (≥md): tabel padat, cocok untuk layar lebar. */}
          <div className="hidden overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm md:block">
            <table className="w-full min-w-[720px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[12px] uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-4 py-3 font-medium">Objek</th>
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium">Kelompok</th>
                  <th className="px-4 py-3 font-medium">Tenggat</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3">
                      <Link href={`/tugas/${a.id}`} className="font-medium text-[var(--accent)] hover:underline">
                        {a.objectName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{a.periodName}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{groupLabel[a.group]}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{dateFmt.format(new Date(a.deadline))}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium ${statusClass[a.displayStatus]}`}
                      >
                        {statusLabel[a.displayStatus]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
