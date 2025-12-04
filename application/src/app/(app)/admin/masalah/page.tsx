import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import Link from "next/link";
import { listAllIssues } from "@/lib/services/assignmentIssues";
import { IssueRow } from "./issue-row";
import { PageHero } from "@/components/page-hero";

const typeLabel: Record<string, string> = {
  OBJEK_KELIRU: "Objek keliru",
  UNIT_KELIRU: "Unit keliru",
  PENGGUNA_NONAKTIF: "Pengguna nonaktif",
  TAUTAN_KARYA_SALAH: "Tautan karya salah",
  LAINNYA: "Lainnya",
};

async function MasalahPage() {
  const issues = await listAllIssues();

  return (
    <div className="space-y-8">
      <PageHero
        compact
        eyebrow="ADMIN · LAPORAN"
        title="Laporan Masalah Penugasan"
        description="Laporan dari penilai tentang tugas yang keliru."
      />

      {issues.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <p className="text-[15px] text-[var(--muted)]">Belum ada laporan masalah.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
          <table className="w-full min-w-[860px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-[12px] uppercase tracking-wide text-[var(--muted)]">
                <th className="px-4 py-3 font-medium">Tugas</th>
                <th className="px-4 py-3 font-medium">Pelapor</th>
                <th className="px-4 py-3 font-medium">Jenis</th>
                <th className="px-4 py-3 font-medium">Keterangan</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} className="border-b border-[var(--border)] align-top last:border-b-0">
                  <td data-label="Tugas" className="px-4 py-3">
                    <Link
                      href={`/tugas/${issue.assignmentId}`}
                      className="font-medium text-[var(--accent)] hover:underline"
                    >
                      {issue.assignment.categoryObject.category.period.name}
                    </Link>
                    <div className="text-[12px] text-[var(--muted)]">
                      Penilai: {issue.assignment.evaluator.name}
                    </div>
                  </td>
                  <td data-label="Pelapor" className="px-4 py-3 text-[var(--muted)]">{issue.reporter.name}</td>
                  <td data-label="Jenis" className="px-4 py-3 text-[var(--muted)]">{typeLabel[issue.type]}</td>
                  <td data-label="Keterangan" className="px-4 py-3 text-[var(--foreground)]">{issue.detail}</td>
                  <td data-label="Penanganan" className="px-4 py-3" colSpan={2}>
                    <IssueRow issue={issue} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof MasalahPage>) { await requirePageAdmin(); return MasalahPage(...args); }
