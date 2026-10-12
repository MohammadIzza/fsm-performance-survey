import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext, getPeriodScope } from "@/lib/authz";
import { isResultAccessOpenForNonAdmin } from "@/lib/services/resultAccess";
import { getRanking, getCombinedRanking } from "@/lib/services/rankings";
import { getGroupDetailBulk } from "@/lib/services/calculations";
import { LeaderboardGroups, type DetailData } from "@/components/leaderboard-table";
import Link from "next/link";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function NoticeCard({ title, body }: { title: string; body?: string }) {
  return (
    <div className="app-empty-box">
      <p><strong>{title}</strong></p>
      {body && <p className="app-text-sm">{body}</p>}
    </div>
  );
}

export default async function Archive({
  params,
}: {
  params: Promise<{ finalizationId: string }>;
}) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || (!ctx.isAdmin && !ctx.isDekan && !ctx.leadershipUnitIds.length)) {
    return <NoticeCard title="Tidak berwenang" />;
  }

  const { finalizationId } = await params;
  const f = await prisma.finalization.findUnique({
    where: { id: finalizationId },
    include: {
      period: { include: { accessPolicy: true } },
      calculationRuns: { include: { category: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!f) notFound();

  const policy = f.period.accessPolicy;
  const accessOpen =
    ctx.isAdmin ||
    (policy &&
      isResultAccessOpenForNonAdmin({
        mode: policy.mode,
        availableAt: policy.availableAt,
        periodStatus: f.period.status,
      }));
  if (!accessOpen) {
    return <NoticeCard title="Hasil belum dapat diakses" />;
  }

  const scope = await getPeriodScope(ctx, f.periodId);

  // Leaderboard arsip memakai komponen yang sama dengan halaman Hasil, tetapi dari hitungan yang
  // dipatri ke versi final ini (runId), bukan hitungan terbaru — jadi yang tampil persis seperti
  // saat difinalkan, termasuk peringkat gabungan dan rincian penilainya.
  const bagian = await Promise.all(
    f.calculationRuns.map(async (run) => {
      const lingkup = scope ?? undefined;
      const [pimpinan, selain, gabungan, pimpinanBulk, selainBulk] = await Promise.all([
        getRanking({ categoryId: run.categoryId, group: "PIMPINAN", unitIds: lingkup, runId: run.id }),
        getRanking({ categoryId: run.categoryId, group: "SELAIN_PIMPINAN", unitIds: lingkup, runId: run.id }),
        getCombinedRanking({ categoryId: run.categoryId, unitIds: lingkup, runId: run.id }),
        getGroupDetailBulk(run.categoryId, "PIMPINAN", run.id),
        getGroupDetailBulk(run.categoryId, "SELAIN_PIMPINAN", run.id),
      ]);
      const terlihat = new Set([...pimpinan, ...selain].map((e) => e.categoryObjectId));
      const keDetail = (bulk: Awaited<ReturnType<typeof getGroupDetailBulk>>) => {
        if (!bulk) return undefined;
        const peta = new Map<string, DetailData>();
        for (const [objId, data] of bulk.byObject) {
          if (!terlihat.has(objId)) continue; // jangan bocorkan detail objek di luar lingkup
          peta.set(objId, {
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
        return peta;
      };
      const aturan = (run.groupRuleSnapshot ?? {}) as Record<string, { minimum?: number } | undefined>;
      return {
        run,
        pimpinan,
        selain,
        gabungan,
        pimpinanDetail: keDetail(pimpinanBulk),
        selainDetail: keDetail(selainBulk),
        minPimpinan: aturan.PIMPINAN?.minimum ?? 0,
        minSelain: aturan.SELAIN_PIMPINAN?.minimum ?? 0,
      };
    })
  );

  // `admin-area`: lingkup gaya daftar data aplikasi (lihat halaman Hasil), bukan penanda hak akses.
  return (
    <div className="admin-area space-y-8">
      <Link href={ctx.isAdmin ? `/admin/periode/${f.periodId}` : "/hasil"} className="app-back">
        {ctx.isAdmin ? "← Kembali ke periode" : "← Hasil & Leaderboard"}
      </Link>
      <PageIntro title={f.period.name} intro={f.note ? `Catatan: ${f.note}` : undefined}>
        <SummaryCard tone="biru" label="Arsip hasil" value={`Versi ${f.revision}`} note="hasil final yang dipatri" />
        <SummaryCard
          tone="tosca"
          label="Difinalkan"
          value={dateFmt.format(f.finalizedAt)}
          note="WIB"
        />
        <SummaryCard
          tone="kuning"
          label="Kategori"
          value={f.calculationRuns.length}
          note="ikut difinalkan"
        />
      </PageIntro>

      {bagian.map((b) => (
        <section key={b.run.id} className="space-y-4">
          <h2 className="app-panel__label">{b.run.category.name}</h2>
          <LeaderboardGroups
            pimpinanEntries={b.pimpinan}
            pimpinanMinimum={b.minPimpinan}
            pimpinanDetail={b.pimpinanDetail}
            selainEntries={b.selain}
            selainMinimum={b.minSelain}
            selainDetail={b.selainDetail}
            gabungan={b.gabungan}
          />
        </section>
      ))}
    </div>
  );
}
