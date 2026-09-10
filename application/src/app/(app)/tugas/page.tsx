import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/authz";
import { listMyAssignments, computeDisplayStatus } from "@/lib/services/responses";
import { AssignmentsList, type AssignmentRow } from "./assignments-list";
import { PageHero } from "@/components/page-hero";

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
  // Pengguna biasa (bukan Admin/Dekan/Pimpinan Unit) diarahkan ke sini dari beranda selama masih
  // punya tugas belum selesai — lihat gerbang di (app)/page.tsx. Pesan ini menjelaskan alasannya
  // agar tidak terasa seperti "nyasar" tanpa konteks.
  const isPlainUser = !ctx.isAdmin && !ctx.isDekan && ctx.leadershipUnitIds.length === 0;

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
      <PageHero
        eyebrow={`TUGAS SAYA · ${assignments.length} penilaian`}
        title={
          pending.length > 0 ? (
            <>
              {pending.length} tugas menanti
              <br />
              penilaian Anda.
            </>
          ) : (
            <>
              Semua tugas
              <br />
              sudah terkirim.
            </>
          )
        }
        description="Daftar penilaian yang perlu Anda isi, disaring per periode dan status."
      />

      {pending.length > 0 && isPlainUser && (
        <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-tint)] p-4 text-[13px] text-[var(--foreground)]">
          Anda memiliki <span className="font-semibold">{pending.length}</span> dari{" "}
          {assignments.length} tugas penilaian yang belum selesai. Selesaikan seluruh tugas di
          bawah ini terlebih dahulu sebelum mengakses menu lain.
        </div>
      )}

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
