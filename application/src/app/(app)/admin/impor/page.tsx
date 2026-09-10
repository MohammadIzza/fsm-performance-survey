import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { listImportBatches } from "@/lib/services/imports";
import { ImportForm } from "./import-form";
import { PageHero } from "@/components/page-hero";

const entityLabel: Record<string, string> = { UNIT: "Unit", PENGGUNA: "Pengguna", PIMPINAN: "Pimpinan" };
const statusLabel: Record<string, string> = { PREVIEW: "Pratinjau", DITERAPKAN: "Diterapkan", GAGAL: "Gagal" };
const statusClass: Record<string, string> = {
  DITERAPKAN: "bg-[var(--success)]/10 text-[var(--success)]",
  GAGAL: "bg-[var(--danger)]/10 text-[var(--danger)]",
  PREVIEW: "bg-black/5 text-[var(--muted)]",
};

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

async function ImporPage() {
  const batches = await listImportBatches();

  return (
    <div className="space-y-8">
      <PageHero
        compact
        eyebrow="ADMIN · IMPOR"
        title="Impor Data Master"
        description="Unggah Unit, Pengguna, atau Pimpinan dari berkas Excel."
      />

      <ImportForm />

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Waktu</th>
              <th className="px-4 py-3 font-medium">Jenis</th>
              <th className="px-4 py-3 font-medium">Berkas</th>
              <th className="px-4 py-3 font-medium">Pelaku</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Ringkasan</th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--muted)]">
                  Belum ada riwayat impor.
                </td>
              </tr>
            )}
            {batches.map((b) => {
              const summary = b.summary as { totalRows: number; toCreate: number; toUpdate: number } | null;
              const rowErrors = b.rowErrors as { row: number; message: string }[] | null;
              return (
                <tr key={b.id} className="border-b border-[var(--border)] last:border-b-0 align-top">
                  <td className="px-4 py-3 text-[var(--muted)]">{dateFmt.format(b.createdAt)}</td>
                  <td className="px-4 py-3 text-[var(--foreground)]">{entityLabel[b.entity]}</td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[var(--muted)]">{b.fileName}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{b.appliedBy.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass[b.status]}`}>
                      {statusLabel[b.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {summary && `${summary.totalRows} baris (${summary.toCreate} baru, ${summary.toUpdate} diperbarui)`}
                    {rowErrors && rowErrors.length > 0 && (
                      <div className="mt-1 text-[11px] text-[var(--danger)]">
                        {rowErrors.length} baris bermasalah
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof ImporPage>) { await requirePageAdmin(); return ImporPage(...args); }
