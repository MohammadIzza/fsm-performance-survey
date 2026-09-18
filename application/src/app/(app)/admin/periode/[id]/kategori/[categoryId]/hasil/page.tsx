import { InfoLabel } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";
import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import Link from "next/link";
import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLatestRun, getGroupDetailBulk, listRunsForCategory } from "@/lib/services/calculations";
import { getCombinedRanking, getRanking } from "@/lib/services/rankings";
import { LeaderboardGroups, type DetailData } from "@/components/leaderboard-table";
import { CalculateButton } from "./calculate-button";
import { withBase } from "@/lib/base-path";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

async function HasilPage({
  params,
}: {
  params: Promise<{ id: string; categoryId: string }>;
}) {
  const { id: periodId, categoryId } = await params;
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { period: true, groupRules: true },
  });
  if (!category || category.periodId !== periodId) notFound();

  const [latestRun, runs] = await Promise.all([
    getLatestRun(categoryId),
    listRunsForCategory(categoryId),
  ]);

  const pimpinanRule = category.groupRules.find((r) => r.group === "PIMPINAN");
  const selainRule = category.groupRules.find((r) => r.group === "SELAIN_PIMPINAN");

  let pimpinanEntries: Awaited<ReturnType<typeof getRanking>> = [];
  let selainEntries: Awaited<ReturnType<typeof getRanking>> = [];
  let gabungan: Awaited<ReturnType<typeof getCombinedRanking>> = null;
  let pimpinanDetail: Map<string, DetailData> | undefined;
  let selainDetail: Map<string, DetailData> | undefined;

  if (latestRun) {
    [pimpinanEntries, selainEntries] = await Promise.all([
      getRanking({ categoryId, group: "PIMPINAN" }),
      getRanking({ categoryId, group: "SELAIN_PIMPINAN" }),
    ]);

    gabungan = await getCombinedRanking({ categoryId });

    const [pimpinanBulk, selainBulk] = await Promise.all([
      getGroupDetailBulk(categoryId, "PIMPINAN"),
      getGroupDetailBulk(categoryId, "SELAIN_PIMPINAN"),
    ]);

    function toDetailMap(bulk: Awaited<ReturnType<typeof getGroupDetailBulk>>) {
      if (!bulk) return undefined;
      const map = new Map<string, DetailData>();
      for (const [objId, data] of bulk.byObject) {
        map.set(objId, {
          parameterResults: data.result.parameterResults.map((pr) => ({
            parameterName: pr.parameter.name,
            aggregate: pr.aggregate,
            contribution: pr.contribution,
            weight: pr.parameter.weight,
            rawAggregate: pr.rawAggregate,
          })),
          respondents: data.respondents.map((r) => ({
            ...r,
            submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
          })),
        });
      }
      return map;
    }
    pimpinanDetail = toDetailMap(pimpinanBulk);
    selainDetail = toDetailMap(selainBulk);
  }

  return (
    <div className="space-y-8">
      <Link
        href={`/admin/periode/${periodId}/kategori/${categoryId}`}
        className="app-back"
      >
        ← {category.name}
      </Link>
      <PageIntro title={`Hasil — ${category.name}`} intro={category.period.name}>
        <SummaryCard
          tone={latestRun ? "tosca" : "kuning"}
          label={<InfoLabel ket={KET.sementara}>Perhitungan</InfoLabel>}
          value={latestRun ? dateFmt.format(latestRun.createdAt) : "Belum pernah"}
          note={latestRun ? (category.period.status === "FINAL" ? "Final" : "Sementara") : "belum dijalankan"}
        />
        <SummaryCard
          tone="biru"
          label="Peringkat"
          value={pimpinanEntries.length + selainEntries.length}
          note="di kedua kelompok"
        />
        <SummaryCard
          tone={runs.some((r) => r.status === "GAGAL") ? "merah" : "kuning"}
          label="Riwayat"
          value={runs.length}
          note={runs.some((r) => r.status === "GAGAL") ? "ada yang gagal" : "perhitungan"}
        />
      </PageIntro>

      <div className="app-panel app-panel--ruled">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="app-panel__label app-panel__label--tight">Perhitungan</p>
          </div>
          <div className="flex items-center gap-2">
            {latestRun && (
              <a
                href={withBase(`/admin/periode/${periodId}/kategori/${categoryId}/hasil/export`)}
                className="app-btn"
              >
                Unduh Excel
              </a>
            )}
            <CalculateButton categoryId={categoryId} periodId={periodId} />
          </div>
        </div>
        {runs.some((r) => r.status === "GAGAL") && (
          <p className="app-note app-note--gagal mt-2">
            Ada perhitungan yang pernah gagal. Hasil terakhir yang berhasil tetap dipakai di
            bawah ini.
          </p>
        )}
      </div>

      {latestRun ? (
        <LeaderboardGroups
          pimpinanEntries={pimpinanEntries}
          pimpinanMinimum={pimpinanRule?.minimum ?? 0}
          pimpinanDetail={pimpinanDetail}
          selainEntries={selainEntries}
          selainMinimum={selainRule?.minimum ?? 0}
          selainDetail={selainDetail}
          gabungan={gabungan}
        />
      ) : (
        <p className="app-empty">Jalankan perhitungan untuk melihat hasil.</p>
      )}
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof HasilPage>) { await requirePageAdmin(); return HasilPage(...args); }
