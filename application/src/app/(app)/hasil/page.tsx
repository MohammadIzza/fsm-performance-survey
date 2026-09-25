import { getCurrentAuthContext } from "@/lib/authz";
import { isResultAccessOpenForNonAdmin } from "@/lib/services/resultAccess";
import { prisma } from "@/lib/prisma";
import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { DataList, DataRow, RowTitle, RowField } from "@/components/theme/data-list";
import { StatusPill } from "@/components/theme/status-pill";

export default async function HasilListPage() {
  const ctx = await getCurrentAuthContext();

  if (!ctx) {
    return (
      <div className="app-empty-box">
        <p className="font-medium text-[var(--foreground)]">Tidak berwenang</p>
      </div>
    );
  }

  // Bab 4.1 mengatur siapa yang boleh membaca rekap berjalan: Admin, Dekan, dan Pimpinan Unit.
  // Pengguna biasa tidak termasuk di situ, tetapi hasil yang SUDAH DITETAPKAN memang untuk
  // diumumkan — mereka boleh melihat papan peringkat akhirnya, tanpa rincian per penilai.
  const berwenang = ctx.isAdmin || ctx.isDekan || ctx.leadershipUnitIds.length > 0;

  if (!berwenang) {
    const final = await prisma.category.findMany({
      where: { active: true, period: { status: "FINAL" } },
      include: {
        period: { include: { accessPolicy: true } },
        _count: { select: { categoryObjects: true } },
      },
      orderBy: [{ period: { createdAt: "desc" } }, { code: "asc" }],
    });
    // Jadwal akses tetap berlaku: periode final yang jendelanya belum dibuka tidak ikut terdaftar.
    const terbuka = final.filter(
      (c) =>
        c.period.accessPolicy &&
        isResultAccessOpenForNonAdmin({
          mode: c.period.accessPolicy.mode,
          availableAt: c.period.accessPolicy.availableAt,
          periodStatus: c.period.status,
        })
    );
    return <DaftarHasil kategori={terbuka} warga />;
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

  return <DaftarHasil kategori={categories} warga={false} />;
}

/** Daftar kategori beserta ringkasannya. `warga` = pemirsa biasa: hanya hasil final, tanpa rekap
 *  periode yang masih berjalan. */
function DaftarHasil({
  kategori,
  warga,
}: {
  kategori: {
    id: string;
    name: string;
    period: { name: string; status: string };
    _count: { categoryObjects: number };
  }[];
  warga: boolean;
}) {
  return (
    <div className="space-y-8">
      <PageIntro
        title="Hasil & Leaderboard"
        intro={
          warga
            ? "Papan peringkat dari penilaian yang hasilnya sudah ditetapkan."
            : "Rekap hasil penilaian."
        }
      >
        {warga ? (
          <SummaryCard tone="tosca" label="Kategori" value={kategori.length} note="hasil sudah final" />
        ) : (
          <>
            <SummaryCard tone="kuning" label="Kategori" value={kategori.length} note="dalam lingkup Anda" />
            <SummaryCard
              tone="biru"
              label="Masih berjalan"
              value={kategori.filter((c) => c.period.status === "AKTIF").length}
              note="nilainya belum final"
            />
            <SummaryCard
              tone="tosca"
              label="Sudah final"
              value={kategori.filter((c) => c.period.status === "FINAL").length}
              note="hasil terkunci"
            />
          </>
        )}
      </PageIntro>

      {kategori.length === 0 ? (
        <div className="app-empty-box">
          <p className="text-[var(--muted)]">
            {warga ? "Belum ada hasil yang diumumkan." : "Belum ada kategori dalam lingkup Anda."}
          </p>
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
          {kategori.map((c) => (
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
