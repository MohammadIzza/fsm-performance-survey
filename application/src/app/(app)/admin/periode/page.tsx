import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { listPeriods } from "@/lib/services/periods";
import { PeriodCreateForm } from "./period-create-form";
import { PageHero } from "@/components/page-hero";
import { DataList, DataRow, RowTitle, RowField } from "@/components/theme/data-list";
import { StatusPill } from "@/components/theme/status-pill";

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

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" });

async function PeriodePage() {
  const periods = await listPeriods();

  return (
    <div className="space-y-8">
      <PageHero
        compact
        eyebrow="ADMIN · PERIODE"
        title="Periode"
        description="Kelola pelaksanaan survei dan siklus hidupnya."
      />

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Buat periode baru
        </h2>
        <PeriodCreateForm />
      </div>

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
          {periods.map((p, i) => (
            <DataRow
              key={p.id}
              href={`/admin/periode/${p.id}`}
            >
              <RowTitle>
                {p.name}
                <span className="sb__subtitle">{p.code}</span>
              </RowTitle>
              <RowField kind="dates">
                {dateFmt.format(new Date(p.startsAt))} – {dateFmt.format(new Date(p.endsAt))}
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
