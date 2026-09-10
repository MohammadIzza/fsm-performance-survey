"use client";

import { useMemo, useState } from "react";
import { DataList, DataRow, RowTitle, RowField } from "@/components/theme/data-list";
import { StatusPill } from "@/components/theme/status-pill";
import { Select } from "@/components/theme/form-field";

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

const statusTone = {
  BELUM_MULAI: "netral",
  DRAF: "proses",
  TERKIRIM: "selesai",
  DIBUKA_KEMBALI: "perhatian",
  LEWAT_TENGGAT: "gagal",
} as const;

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
      <div className="form" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <Select
          value={periodId}
          onChange={(e) => setPeriodId(e.target.value)}
          aria-label="Filter periode"
          style={{ width: "auto", minWidth: "14rem" }}
        >
          <option value="">Semua periode</option>
          {periods.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter status"
          style={{ width: "auto", minWidth: "12rem" }}
        >
          <option value="">Semua status</option>
          {Object.entries(statusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {visible.length === 0 ? (
        <p className="t-t-md" style={{ color: "var(--color-text)", padding: "2rem 0" }}>
          Tidak ada tugas yang cocok dengan filter ini.
        </p>
      ) : (
        // Satu daftar untuk semua lebar layar: baris tema sendiri yang menyusun ulang bidangnya
        // saat layar menyempit, jadi tidak perlu lagi dua salinan (kartu untuk ponsel, tabel untuk
        // desktop) yang harus dijaga tetap sama isinya.
        <DataList>
          {visible.map((a, i) => (
            <DataRow key={a.id} href={`/tugas/${a.id}`} accent={i % 2 === 0 ? "green" : "pink"}>
              <RowTitle accent={i % 2 === 0 ? "green" : "pink"}>{a.objectName}</RowTitle>
              <RowField kind="dates">{dateFmt.format(new Date(a.deadline))}</RowField>
              <RowField kind="duration" icon={false}>{groupLabel[a.group]}</RowField>
              <RowField kind="location" icon={false}>{a.periodName}</RowField>
              <RowField kind="price">
                <StatusPill tone={statusTone[a.displayStatus]}>
                  {statusLabel[a.displayStatus]}
                </StatusPill>
              </RowField>
            </DataRow>
          ))}
        </DataList>
      )}
    </>
  );
}
