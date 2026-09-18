import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/authz";
import { listMyCategories } from "@/lib/services/responses";
import { AssignmentsList, type CategoryRow } from "./assignments-list";
import { PageIntro, SummaryCard } from "@/components/theme/summary";

export default async function TugasSayaPage() {
  const ctx = await getCurrentAuthContext();
  if (!ctx) redirect("/login");

  const kategori = await listMyCategories(ctx.userId);
  const totalTugas = kategori.reduce((n, k) => n + k.total, 0);
  const totalTerkirim = kategori.reduce((n, k) => n + k.terkirim, 0);
  const kategoriBelumSelesai = kategori.filter((k) => k.terkirim < k.total).length;
  const rows: CategoryRow[] = kategori.map((k) => ({
    categoryId: k.categoryId,
    categoryName: k.categoryName,
    objectTypeName: k.objectTypeName,
    group: k.group,
    periodId: k.periodId,
    periodName: k.periodName,
    deadline: k.deadline.toISOString(),
    total: k.total,
    terkirim: k.terkirim,
    draf: k.draf,
    belum: k.belum,
    lewat: k.lewat,
  }));

  return (
    <div className="space-y-8">
      <PageIntro
        title="Tugas Saya"
        intro="Penilaian Anda dikelompokkan per kategori — buka satu kategori untuk menilai seluruh objeknya."
      >
        {kategoriBelumSelesai > 0 && (
          <SummaryCard
            tone="kuning"
            label="Kategori menanti"
            value={kategoriBelumSelesai}
            note="belum selesai seluruhnya"
          />
        )}
        <SummaryCard tone="biru" label="Objek dinilai" value={totalTugas} note="tanggung jawab Anda" />
        <SummaryCard
          tone="tosca"
          label="Sudah terkirim"
          value={totalTerkirim}
          note="terkunci dan dihitung"
        />
      </PageIntro>

      {kategori.length === 0 ? (
        <div className="app-empty-box">
          <p className="text-[var(--muted)]">Belum ada tugas penilaian untuk Anda.</p>
        </div>
      ) : (
        <AssignmentsList categories={rows} />
      )}
    </div>
  );
}
