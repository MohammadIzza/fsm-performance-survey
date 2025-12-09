import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/authz";
import { listMyAssignments, computeDisplayStatus } from "@/lib/services/responses";
import { AssignmentsList, type AssignmentRow } from "./assignments-list";
import { PageIntro, SummaryCard } from "@/components/theme/summary";

export default async function TugasSayaPage() {
  const ctx = await getCurrentAuthContext();
  if (!ctx) redirect("/login");

  const assignments = await listMyAssignments(ctx.userId);
  const pending = assignments.filter((a) => {
    const status = computeDisplayStatus(
      a.status,
      a.categoryObject.category.period.status,
      a.categoryObject.category.period.endsAt
    );
    return status === "BELUM_MULAI" || status === "DRAF" || status === "DIBUKA_KEMBALI";
  });
  const rows: AssignmentRow[] = assignments.map((a) => {
    const period = a.categoryObject.category.period;
    return {
      id: a.id,
      objectName: a.categoryObject.nameSnapshot,
      categoryName: a.categoryObject.category.name,
      periodId: period.id,
      periodName: period.name,
      group: a.group,
      deadline: period.endsAt.toISOString(),
      // listMyAssignments() sudah menyaring status DIBATALKAN di query, jadi nilai baliknya
      // di sini tidak pernah "DIBATALKAN" walau tipe fungsinya lebih luas.
      displayStatus: computeDisplayStatus(a.status, period.status, period.endsAt) as AssignmentRow["displayStatus"],
    };
  });

  return (
    <div className="space-y-8">
      <PageIntro
        title="Tugas Saya"
        intro="Daftar penilaian yang perlu Anda isi, disaring per periode dan status."
      >
        {pending.length > 0 && (
          <SummaryCard tone="kuning" label="Menanti diisi" value={pending.length} note="belum selesai" />
        )}
        <SummaryCard tone="biru" label="Penilaian" value={assignments.length} note="tanggung jawab Anda" />
        <SummaryCard
          tone="tosca"
          label="Sudah terkirim"
          value={assignments.length - pending.length}
          note="terkunci dan dihitung"
        />
      </PageIntro>

      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <p className="text-[15px] text-[var(--muted)]">Belum ada tugas penilaian untuk Anda.</p>
        </div>
      ) : (
        <AssignmentsList assignments={rows} />
      )}
    </div>
  );
}
