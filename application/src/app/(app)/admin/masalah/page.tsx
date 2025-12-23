import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import Link from "next/link";
import { listAllIssues } from "@/lib/services/assignmentIssues";
import { IssueRow } from "./issue-row";
import { PageIntro, SummaryCard } from "@/components/theme/summary";

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
      <PageIntro
        title="Laporan Masalah"
        intro="Laporan dari penilai tentang tugas yang keliru."
      >
        <SummaryCard tone="kuning" label="Laporan" value={issues.length} note="seluruhnya" />
        <SummaryCard
          tone="merah"
          label="Terbuka"
          value={issues.filter((i) => i.status === "TERBUKA").length}
          note="belum ditangani"
        />
        <SummaryCard
          tone="tosca"
          label="Selesai"
          value={issues.filter((i) => i.status === "SELESAI").length}
          note="sudah ditanggapi"
        />
      </PageIntro>

      {issues.length === 0 ? (
        <p className="app-empty">Belum ada laporan masalah.</p>
      ) : (
        <div className="app-table-wrap">
          <table className="min-w-[860px]">
            <thead>
              <tr>
                <th>Tugas</th>
                <th>Pelapor</th>
                <th>Jenis</th>
                <th>Keterangan</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} className="border-b border-[var(--border)] align-top last:border-b-0">
                  <td data-label="Tugas">
                    <Link
                      href={`/tugas/${issue.assignmentId}`}
                      className="font-medium"
                    >
                      {issue.assignment.categoryObject.category.period.name}
                    </Link>
                    <div className="app-text-xs" style={{ color: "var(--color-text)" }}>
                      Penilai: {issue.assignment.evaluator.name}
                    </div>
                  </td>
                  <td data-label="Pelapor">{issue.reporter.name}</td>
                  <td data-label="Jenis">{typeLabel[issue.type]}</td>
                  <td data-label="Keterangan">{issue.detail}</td>
                  <td data-label="Penanganan" colSpan={2}>
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
