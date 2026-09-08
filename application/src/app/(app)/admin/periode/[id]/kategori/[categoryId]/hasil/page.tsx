import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getLatestRun, getGroupDetailBulk, listRunsForCategory } from "@/lib/services/calculations";
import { getRanking } from "@/lib/services/rankings";
import { LeaderboardGroups, type DetailData } from "@/components/leaderboard-table";
import { CalculateButton } from "./calculate-button";

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
  let pimpinanDetail: Map<string, DetailData> | undefined;
  let selainDetail: Map<string, DetailData> | undefined;

  if (latestRun) {
    [pimpinanEntries, selainEntries] = await Promise.all([
      getRanking({ categoryId, group: "PIMPINAN" }),
      getRanking({ categoryId, group: "SELAIN_PIMPINAN" }),
    ]);

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
      <div>
        <Link
          href={`/admin/periode/${periodId}/kategori/${categoryId}`}
          className="text-[13px] text-[var(--muted)] hover:underline"
        >
          ← {category.name}
        </Link>
        <h1 className="mt-1 page-title text-[24px] sm:text-[28px] text-[var(--foreground)]">
          Hasil — {category.name}
        </h1>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {latestRun ? (
              <p className="text-[13px] text-[var(--muted)]">
                Perhitungan terakhir: {dateFmt.format(latestRun.createdAt)}
                {category.period.status === "FINAL" ? " · Final" : " · Sementara"}
              </p>
            ) : (
              <p className="text-[13px] text-[var(--muted)]">Belum pernah dihitung.</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {latestRun && (
              <a
                href={`/admin/periode/${periodId}/kategori/${categoryId}/hasil/export`}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-[14px] font-medium text-[var(--foreground)] transition hover:bg-black/[0.03]"
              >
                Unduh Excel
              </a>
            )}
            <CalculateButton categoryId={categoryId} periodId={periodId} />
          </div>
        </div>
        {runs.some((r) => r.status === "GAGAL") && (
          <p className="mt-2 text-[12px] text-[var(--danger)]">
            Ada perhitungan yang pernah gagal. Hasil terakhir yang berhasil tetap dipakai di
            bawah ini (Bab 21.4).
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
        />
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <p className="text-[15px] text-[var(--muted)]">
            Jalankan perhitungan untuk melihat hasil.
          </p>
        </div>
      )}
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof HasilPage>) { await requirePageAdmin(); return HasilPage(...args); }
