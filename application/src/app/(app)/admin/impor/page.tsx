import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { listImportBatches } from "@/lib/services/imports";
import { ImportForm } from "./import-form";
import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { DataList, DataRow, RowTitle, RowField } from "@/components/theme/data-list";
import { StatusPill } from "@/components/theme/status-pill";

const entityLabel: Record<string, string> = { UNIT: "Unit", PENGGUNA: "Pengguna", PIMPINAN: "Pimpinan" };
const statusLabel: Record<string, string> = { PREVIEW: "Pratinjau", DITERAPKAN: "Diterapkan", GAGAL: "Gagal" };
const statusTone = {
  DITERAPKAN: "selesai",
  GAGAL: "gagal",
  PREVIEW: "netral",
} as const;

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

async function ImporPage() {
  const batches = await listImportBatches();

  return (
    <div className="space-y-8">
      <PageIntro
        title="Impor Data Master"
        intro="Unggah Unit, Pengguna, atau Pimpinan dari berkas Excel."
      >
        <SummaryCard tone="kuning" label="Riwayat" value={batches.length} note="berkas pernah diunggah" />
        <SummaryCard
          tone="tosca"
          label="Diterapkan"
          value={batches.filter((b) => b.status === "DITERAPKAN").length}
          note="masuk ke data master"
        />
        <SummaryCard
          tone="merah"
          label="Gagal"
          value={batches.filter((b) => b.status === "GAGAL").length}
          note="berkasnya bermasalah"
        />
      </PageIntro>

      <ImportForm />

      {batches.length === 0 ? (
        <p className="t-t-md" style={{ color: "var(--color-text)" }}>
          Belum ada riwayat impor.
        </p>
      ) : (
        <DataList
          columns={[
            ["title", "Berkas"],
            ["dates", "Waktu"],
            ["duration", "Pelaku"],
            ["location", "Ringkasan"],
            ["price", "Status"],
          ]}
        >
          {batches.map((b) => {
            const summary = b.summary as { totalRows: number; toCreate: number; toUpdate: number } | null;
            const rowErrors = b.rowErrors as { row: number; message: string }[] | null;
            return (
              <DataRow key={b.id}>
                <RowTitle>
                  {entityLabel[b.entity]}
                  <span className="sb__subtitle">{b.fileName}</span>
                </RowTitle>
                <RowField kind="dates" icon={false}>
                  <span className="date-range__part">{dateFmt.format(b.createdAt)}</span>
                </RowField>
                <RowField kind="duration" icon={false}>
                  {b.appliedBy.name}
                </RowField>
                <RowField kind="location" icon={false}>
                  {summary
                    ? `${summary.totalRows} baris (${summary.toCreate} baru, ${summary.toUpdate} diperbarui)`
                    : "—"}
                  {rowErrors && rowErrors.length > 0 && (
                    <span className="sb__subtitle" style={{ color: "var(--color-brand-1)" }}>
                      {rowErrors.length} baris bermasalah
                    </span>
                  )}
                </RowField>
                <RowField kind="price" icon={false}>
                  <StatusPill tone={statusTone[b.status as keyof typeof statusTone]}>
                    {statusLabel[b.status]}
                  </StatusPill>
                </RowField>
              </DataRow>
            );
          })}
        </DataList>
      )}
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof ImporPage>) { await requirePageAdmin(); return ImporPage(...args); }
