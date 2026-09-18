"use client";

import { useMemo, useState } from "react";
import { DataList, DataRow, RowTitle, RowField } from "@/components/theme/data-list";
import { StatusPill } from "@/components/theme/status-pill";
import { Select } from "@/components/theme/form-field";
import { DateValue } from "@/components/theme/date-range";
import { PilihanCari } from "@/components/theme/pilihan-cari";

/**
 * Daftar tugas penilaian, satu baris per KATEGORI — bukan per objek.
 *
 * Sebelumnya satu objek satu baris, sehingga penilai yang kebagian enam objek dalam satu kategori
 * melihat enam baris yang kategori, periode, dan tenggatnya sama persis, lalu membuka enam halaman
 * yang instrumennya juga sama. Sekarang barisnya menyebut kategori beserta kemajuannya, dan
 * pengisiannya terjadi di satu lembar (/tugas/kategori/[categoryId]).
 */

export interface CategoryRow {
  categoryId: string;
  categoryName: string;
  objectTypeName: string;
  group: "PIMPINAN" | "SELAIN_PIMPINAN";
  periodId: string;
  periodName: string;
  deadline: string; // ISO string, diformat di sisi klien agar render server/klien sama
  total: number;
  terkirim: number;
  draf: number;
  belum: number;
  lewat: number;
}

type Keadaan = "SELESAI" | "SEDANG_DIISI" | "BELUM_MULAI" | "LEWAT_TENGGAT";

const statusLabel: Record<Keadaan, string> = {
  SELESAI: "Selesai",
  SEDANG_DIISI: "Sedang diisi",
  BELUM_MULAI: "Belum mulai",
  LEWAT_TENGGAT: "Lewat tenggat",
};

const statusTone = {
  SELESAI: "selesai",
  SEDANG_DIISI: "proses",
  BELUM_MULAI: "netral",
  LEWAT_TENGGAT: "gagal",
} as const;

/** Keadaan satu kategori diringkas dari tugas-tugas di dalamnya. */
function keadaan(k: CategoryRow): Keadaan {
  if (k.terkirim === k.total) return "SELESAI";
  if (k.draf > 0) return "SEDANG_DIISI";
  if (k.lewat > 0 && k.belum === 0) return "LEWAT_TENGGAT";
  return "BELUM_MULAI";
}

export function AssignmentsList({ categories }: { categories: CategoryRow[] }) {
  const [periodId, setPeriodId] = useState("");
  const [status, setStatus] = useState("");

  const periods = useMemo(() => {
    const seen = new Map<string, string>();
    for (const k of categories) seen.set(k.periodId, k.periodName);
    return [...seen.entries()];
  }, [categories]);

  const visible = categories.filter(
    (k) => (!periodId || k.periodId === periodId) && (!status || keadaan(k) === status),
  );

  return (
    <div className="assignments-data-list">
      <DataList
        columnHeaderHidden={false}
        columns={[
          ["title", "Kategori"],
          ["topic", "Kemajuan"],
          ["dates", "Tenggat"],
          ["location", (
            <label className="assignment-head-filter" data-active={periodId ? "true" : undefined} key="period-filter">
              <span>Periode</span>
              <PilihanCari
                aria-label="Filter periode"
                value={periodId}
                onChange={setPeriodId}
                kosong={{ label: "Semua periode", bisaDipilih: true }}
                options={periods.map(([id, name]) => ({ value: id, label: name }))}
              />
            </label>
          )],
          ["price", (
            <label className="assignment-head-filter" data-active={status ? "true" : undefined} key="status-filter">
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
        {/* Pesan kosong berada di dalam daftar, tepat di bawah kepala kolom — bukan di atasnya.
            Penyaringnya menempel pada kepala itu, jadi kepala harus tetap terlihat saat hasilnya
            nol supaya penyaringnya masih bisa diubah. */}
        {visible.length === 0 && (
          <li className="s__course sb-course sb-course--empty">
            <div className="sb__link">Tidak ada tugas yang cocok dengan filter ini.</div>
          </li>
        )}
        {visible.map((k) => (
          <DataRow
            key={`${k.categoryId}-${k.group}`}
            href={`/tugas/kategori/${k.categoryId}?kelompok=${k.group}`}
          >
            <RowTitle>
              {k.categoryName}
              {k.group === "PIMPINAN" && (
                <span className="assignment-row__leadership">Pimpinan</span>
              )}
              <span className="sb__subtitle">
                {k.total} {k.objectTypeName.toLowerCase()} untuk dinilai
              </span>
            </RowTitle>
            <RowField kind="topic" icon={false}>
              {k.terkirim} dari {k.total} terkirim
              {k.draf > 0 && ` · ${k.draf} draf`}
            </RowField>
            <RowField kind="dates"><DateValue value={k.deadline} /></RowField>
            <RowField kind="location" icon={false}>{k.periodName}</RowField>
            <RowField kind="price">
              <StatusPill tone={statusTone[keadaan(k)]}>{statusLabel[keadaan(k)]}</StatusPill>
            </RowField>
          </DataRow>
        ))}
      </DataList>
    </div>
  );
}
