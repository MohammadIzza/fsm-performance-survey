import { getCurrentAuthContext } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { DataList, DataRow, RowTitle, RowField } from "@/components/theme/data-list";
import { StatusPill } from "@/components/theme/status-pill";

export default async function HasilListPage() {
  const ctx = await getCurrentAuthContext();

  // Bab 4.1: hanya Admin, Dekan, dan Pimpinan Unit yang berwenang melihat rekap/leaderboard.
  if (!ctx || (!ctx.isAdmin && !ctx.isDekan && ctx.leadershipUnitIds.length === 0)) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
        <p className="text-[15px] font-medium text-[var(--foreground)]">Tidak berwenang</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Halaman ini hanya untuk Admin, Dekan, dan Pimpinan Unit.
        </p>
      </div>
    );
  }

  const categories = ctx.isAdmin || ctx.isDekan
    ? await prisma.category.findMany({
        where: { active: true },
        include: { period: true, _count: { select: { categoryObjects: true } } },
        orderBy: [{ period: { createdAt: "desc" } }, { code: "asc" }],
      })
    : await prisma.category.findMany({
        where: {
          active: true,
          categoryObjects: { some: { object: { ownerUnitId: { in: ctx.scopeUnitIds } } } },
        },
        include: { period: true, _count: { select: { categoryObjects: true } } },
        orderBy: [{ period: { createdAt: "desc" } }, { code: "asc" }],
      });

  return (
    <div className="space-y-8">
      <PageIntro
        title="Hasil & Leaderboard"
        intro={
          ctx.isAdmin || ctx.isDekan
            ? "Rekap hasil penilaian seluruh fakultas."
            : "Rekap hasil penilaian pada unit yang Anda pimpin dan subunitnya."
        }
      >
        <SummaryCard tone="kuning" label="Kategori" value={categories.length} note="dalam lingkup Anda" />
        <SummaryCard
          tone="biru"
          label="Masih berjalan"
          value={categories.filter((c) => c.period.status === "AKTIF").length}
          note="nilainya belum final"
        />
        <SummaryCard
          tone="tosca"
          label="Sudah final"
          value={categories.filter((c) => c.period.status === "FINAL").length}
          note="hasil terkunci"
        />
      </PageIntro>

      {categories.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <p className="text-[15px] text-[var(--muted)]">Belum ada kategori dalam lingkup Anda.</p>
        </div>
      ) : (
          <DataList
            columns={[
              ["title", "Kategori"],
              ["location", "Periode"],
              ["duration", "Status periode"],
              ["price", "Peserta"],
            ]}
          >
            {categories.map((c) => (
              <DataRow key={c.id} href={`/hasil/${c.id}`}>
                <RowTitle>{c.name}</RowTitle>
                <RowField kind="location" icon={false}>
                  {c.period.name}
                </RowField>
                <RowField kind="duration" icon={false}>
                  <StatusPill tone={c.period.status === "FINAL" ? "arsip" : "selesai"}>
                    {c.period.status}
                  </StatusPill>
                </RowField>
                <RowField kind="price" icon={false}>
                  {c._count.categoryObjects} peserta
                </RowField>
              </DataRow>
            ))}
          </DataList>
      )}
    </div>
  );
}
