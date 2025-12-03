"use client";

import { useMemo, useState } from "react";
import { DataList, DataRow, RowTitle, RowField } from "@/components/theme/data-list";
import { StatusPill } from "@/components/theme/status-pill";
import { Select } from "@/components/theme/form-field";
import { FilterBar, FilterField } from "@/components/theme/filter-bar";
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
  const activePeriodLabel = periods.find(([id]) => id === periodId)?.[1] ?? "Semua periode";
  const activeStatusLabel = status
    ? statusLabel[status as AssignmentRow["displayStatus"]]
    : "Semua status";

  return (
    <>
      <div className="assignment-filter-desktop">
        <FilterBar>
          <FilterField label="Periode" htmlFor="filter-periode">
            <Select
              id="filter-periode"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
            >
              <option value="">Semua periode</option>
              {periods.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Status" htmlFor="filter-status">
            <Select id="filter-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Semua status</option>
              {Object.entries(statusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FilterField>
        </FilterBar>
      </div>

      <details className="assignment-filter-mobile">
        <summary>
          <span className="assignment-filter-mobile__title">Filter</span>
          <span className="assignment-filter-mobile__value">
            {activePeriodLabel} · {activeStatusLabel}
          </span>
          <span className="assignment-filter-mobile__chevron" aria-hidden="true">⌄</span>
        </summary>
        <FilterBar>
          <FilterField label="Periode" htmlFor="filter-periode-mobile">
            <Select
              id="filter-periode-mobile"
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
            >
              <option value="">Semua periode</option>
              {periods.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Status" htmlFor="filter-status-mobile">
            <Select
              id="filter-status-mobile"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Semua status</option>
              {Object.entries(statusLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FilterField>
        </FilterBar>
      </details>

      {visible.length === 0 ? (
        <p className="t-t-md" style={{ color: "var(--color-text)", padding: "2rem 0" }}>
          Tidak ada tugas yang cocok dengan filter ini.
        </p>
      ) : (
        // Satu daftar untuk semua lebar layar: baris tema sendiri yang menyusun ulang bidangnya
        // saat layar menyempit, jadi tidak perlu lagi dua salinan (kartu untuk ponsel, tabel untuk
        // desktop) yang harus dijaga tetap sama isinya.
        <div className="assignments-data-list">
          <DataList
            columns={[
              ["title", "Objek"],
              ["dates", "Tenggat"],
              ["location", "Periode"],
              ["price", "Status"],
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
      )}
    </>
  );
}
