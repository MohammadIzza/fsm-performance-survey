import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext, getPeriodScope } from "@/lib/authz";
import { isResultAccessOpenForNonAdmin } from "@/lib/services/resultAccess";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const eligibilityLabel: Record<string, string> = {
  BELUM_ADA_PENILAIAN: "Belum ada penilaian",
  BELUM_MEMENUHI_MINIMUM: "Belum memenuhi minimum",
  MEMENUHI_SYARAT: "Memenuhi syarat",
};

const groupLabel: Record<string, string> = {
  PIMPINAN: "Pimpinan",
  SELAIN_PIMPINAN: "Selain pimpinan",
};

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
      calculationRuns: {
        include: {
          category: true,
          objectGroupResults: {
            include: {
              categoryObject: { include: { object: true } },
              parameterResults: { include: { parameter: true } },
            },
          },
        },
      },
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

  return (
    <div className="space-y-8">
      <PageIntro title={f.period.name} intro={f.note ? `Catatan: ${f.note}` : undefined}>
        <SummaryCard tone="biru" label="Arsip final" value={`Revisi ${f.revision}`} />
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

      {f.calculationRuns.map((run) => (
        <div key={run.id} className="app-panel app-panel--ruled">
          <h2 className="app-panel__label">{run.category.name}</h2>
          <div className="grid gap-6">
            {(["PIMPINAN", "SELAIN_PIMPINAN"] as const).map((group) => {
              const results = run.objectGroupResults
                .filter(
                  (r) =>
                    r.group === group &&
                    (!scope ||
                      scope.includes(r.categoryObject.ownerUnitIdSnapshot ?? r.categoryObject.object.ownerUnitId)),
                )
                .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

              return (
                <div key={group}>
                  <h3 className="app-panel__label">
                    {groupLabel[group]}
                  </h3>
                  {results.length === 0 ? (
                    <p className="app-empty">Belum ada penilaian.</p>
                  ) : (
                    <ul className="app-stack">
                      {results.map((r) => (
                        <li key={r.id}>
                          <details className="group px-4 py-3">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block truncate font-medium">
                                  {r.categoryObject.nameSnapshot}
                                </span>
                                <span className="block truncate app-text-xs text-[var(--muted)]">
                                  {r.categoryObject.unitSnapshot} &middot; {r.responseCount} respons
                                </span>
                              </span>
                              <span className="shrink-0 text-right font-semibold text-[var(--foreground)]">
                                {r.score !== null ? r.score.toFixed(2) : "—"}
                              </span>
                            </summary>
                            <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
                              <p className="app-text-xs text-[var(--muted)]">
                                {eligibilityLabel[r.eligibility] ?? r.eligibility}
                              </p>
                              {r.parameterResults.map((v) => (
                                <p key={v.id} className="flex items-baseline justify-between app-text-xs">
                                  <span className="text-[var(--foreground)]">
                                    {v.parameter.name} <span className="text-[var(--muted)]">({v.parameter.weight}%)</span>
                                  </span>
                                  <span className="text-[var(--muted)]">
                                    {v.aggregate.toFixed(2)} &rarr; {v.contribution.toFixed(2)}
                                  </span>
                                </p>
                              ))}
                            </div>
                          </details>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
