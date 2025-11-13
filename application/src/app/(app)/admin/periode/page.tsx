import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { listPeriods } from "@/lib/services/periods";
import { PeriodCreateForm } from "./period-create-form";
import { AdminActionList, AdminAction } from "@/components/theme/admin-actions";
import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { DataList, DataRow, RowTitle, RowField } from "@/components/theme/data-list";
import { StatusPill } from "@/components/theme/status-pill";
import { DateRange } from "@/components/theme/date-range";

const statusLabel: Record<string, string> = {
  DRAF: "Draf",
  SIAP: "Siap",
  AKTIF: "Aktif",
  DITUTUP: "Ditutup",
  FINAL: "Final",
  REVISI: "Revisi",
};

// Warna lencana per status siklus hidup periode, memakai nada yang sama dipakai daftar tugas.
const statusTone = {
  DRAF: "netral",
  SIAP: "proses",
  AKTIF: "selesai",
  DITUTUP: "perhatian",
  FINAL: "arsip",
  REVISI: "gagal",
} as const;


async function PeriodePage() {
  const periods = await listPeriods();

  return (
    <div className="space-y-8">
      <PageIntro title="Periode" intro="Kelola pelaksanaan survei dan siklus hidupnya.">
        <SummaryCard tone="kuning" label="Periode" value={periods.length} note="terbaru di urutan pertama" />
        <SummaryCard
          tone="tosca"
          label="Sedang berjalan"
          value={periods.filter((p) => p.status === "AKTIF").length}
          note="berstatus Aktif"
        />
        <SummaryCard
          tone="biru"
          label="Kategori"
          value={periods.reduce((n, p) => n + p._count.categories, 0)}
          note="di seluruh periode"
        />
      </PageIntro>

      <AdminActionList>
        <AdminAction
          name="Buat periode baru"
          description="Periode baru dimulai berstatus Draf dan belum terlihat oleh penilai."
        >
          <PeriodCreateForm />
        </AdminAction>
      </AdminActionList>

      {periods.length === 0 ? (
        <p className="t-t-md" style={{ color: "var(--color-text)" }}>
          Belum ada periode.
        </p>
      ) : (
        <DataList
          columns={[
            ["title", "Periode"],
            ["dates", "Rentang waktu"],
            ["duration", "Kategori"],
            ["price", "Status"],
          ]}
        >
          {periods.map((p) => (
            <DataRow
              key={p.id}
              href={`/admin/periode/${p.id}`}
            >
              <RowTitle>
                {p.name}
                <span className="sb__subtitle">{p.code}</span>
              </RowTitle>
              <RowField kind="dates">
                <DateRange from={p.startsAt} to={p.endsAt} />
              </RowField>
              <RowField kind="duration" icon={false}>
                {p._count.categories} kategori
              </RowField>
              <RowField kind="price">
                <StatusPill tone={statusTone[p.status as keyof typeof statusTone]}>
                  {statusLabel[p.status]}
                </StatusPill>
              </RowField>
            </DataRow>
          ))}
        </DataList>
      )}
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof PeriodePage>) { await requirePageAdmin(); return PeriodePage(...args); }
