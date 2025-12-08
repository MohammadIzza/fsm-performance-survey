"use client";

import { useMemo, useState } from "react";
import { DataList, DataRow, RowTitle, RowField } from "@/components/theme/data-list";
import { StatusPill } from "@/components/theme/status-pill";
import { Select } from "@/components/theme/form-field";
import { DateValue } from "@/components/theme/date-range";

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
      {visible.length === 0 ? (
        <p className="t-t-md" style={{ color: "var(--color-text)", padding: "2rem 0" }}>
          Tidak ada tugas yang cocok dengan filter ini.
        </p>
      ) : null}

      <div className="assignments-data-list">
        <DataList
          columnHeaderHidden={false}
          columns={[
            ["title", "Objek"],
            ["dates", "Tenggat"],
            ["location", (
              <label className="assignment-head-filter" key="period-filter">
                <span>Periode</span>
                <Select
                  aria-label="Filter periode"
                  value={periodId}
                  onChange={(e) => setPeriodId(e.target.value)}
                >
                  <option value="">Semua periode</option>
                  {periods.map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </Select>
              </label>
            )],
            ["price", (
              <label className="assignment-head-filter" key="status-filter">
                <span>Status</span>
                <Select
                  aria-label="Filter status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">Semua status</option>
                  {Object.entries(statusLabel).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              </label>
            )],
          ]}
        >
          {visible.map((a) => (
            <DataRow key={a.id} href={`/tugas/${a.id}`}>
              <RowTitle>
                {a.objectName}
                {a.group === "PIMPINAN" && (
                  <span className="assignment-row__leadership">Pimpinan</span>
                )}
              </RowTitle>
              <RowField kind="dates"><DateValue value={a.deadline} /></RowField>
              <RowField kind="location" icon={false}>{a.periodName}</RowField>
              <RowField kind="price">
                <StatusPill tone={statusTone[a.displayStatus]}>
                  {statusLabel[a.displayStatus]}
                </StatusPill>
              </RowField>
            </DataRow>
          ))}
        </DataList>
      </div>
    </>
  );
}
