"use client";

import { DataRow, RowTitle, RowField } from "@/components/theme/data-list";
import { StatusPill } from "@/components/theme/status-pill";
import { AccessPolicyForm } from "../admin/periode/[id]/access-policy-form";

const modeLabel: Record<string, string> = {
  SELAMA_AKTIF: "Selama aktif",
  SETELAH_DITUTUP: "Setelah ditutup",
  SETELAH_FINAL: "Setelah final",
  WAKTU_TERTENTU: "Waktu tertentu",
};

const statusLabel: Record<string, string> = {
  DRAF: "Draf",
  SIAP: "Siap",
  AKTIF: "Aktif",
  DITUTUP: "Ditutup",
  FINAL: "Final",
  REVISI: "Revisi",
};

const statusTone = {
  DRAF: "netral",
  SIAP: "proses",
  AKTIF: "selesai",
  DITUTUP: "perhatian",
  FINAL: "arsip",
  REVISI: "gagal",
} as const;

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Satu periode pada halaman Waktu akses hasil.
 *
 * Sebelumnya tiap periode adalah panel tanya-jawab (.sb-question), bentuk yang dipakai halaman
 * panduan. Bentuk itu menyembunyikan kebijakan yang sedang berlaku di balik klik, padahal justru
 * itu yang ingin dilihat sekilas — dan berbeda sendiri dari semua daftar lain di ruang survei.
 * Sekarang barisnya sama seperti daftar lain, dengan formulir terbuka sebagai panel di bawahnya.
 */
export function AccessPolicyRow({
  period,
}: {
  period: {
    id: string;
    name: string;
    code: string;
    status: string;
    createdByName: string;
    accessPolicy: React.ComponentProps<typeof AccessPolicyForm>["accessPolicy"];
  };
}) {
  const policy = period.accessPolicy;

  return (
    <DataRow
      collapsible
      panel={
        <div className="admin-row-panel">
          <section className="admin-row-section">
            <h3 className="app-panel__label app-panel__label--tight">Kapan hasil boleh dibaca</h3>
            <AccessPolicyForm periodId={period.id} accessPolicy={policy} />
          </section>
        </div>
      }
    >
      <RowTitle>
        {period.name}
      </RowTitle>
      <RowField kind="duration" icon={false}>
        {policy ? modeLabel[policy.mode] ?? policy.mode : "Belum ditetapkan"}
      </RowField>
      <RowField kind="location" icon={false}>
        {/* Nama pengubah tidak diulang di sini: formulir yang terbuka di bawah baris sudah
            menyebutkannya, dan sebagai baris kedua di tiap baris ia hanya jadi pengulangan. */}
        {policy?.availableAt ? (
          <span className="date-range__part">{dateFmt.format(new Date(policy.availableAt))}</span>
        ) : (
          "\u2014"
        )}
      </RowField>
      <RowField kind="dates" icon={false}>
        <StatusPill tone={statusTone[period.status as keyof typeof statusTone] ?? "netral"}>
          {statusLabel[period.status] ?? period.status}
        </StatusPill>
      </RowField>
    </DataRow>
  );
}
