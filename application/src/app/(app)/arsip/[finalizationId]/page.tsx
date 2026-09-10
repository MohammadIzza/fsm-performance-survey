import { PageHero } from "@/components/page-hero";
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
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
      <p className="text-[15px] font-medium text-[var(--foreground)]">{title}</p>
      {body && <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>}
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
      <div>
        <PageHero
          compact
          eyebrow={`ARSIP FINAL · REVISI ${f.revision}`}
          title={f.period.name}
          description={`Difinalkan ${dateFmt.format(f.finalizedAt)} WIB`}
        />
        {f.note && <p className="text-[13px] text-[var(--muted)]">Catatan: {f.note}</p>}
      </div>

      {f.calculationRuns.map((run) => (
        <div key={run.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <h2 className="mb-4 text-[18px] font-semibold text-[var(--foreground)]">{run.category.name}</h2>
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
                  <h3 className="mb-2 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    {groupLabel[group]}
                  </h3>
                  {results.length === 0 ? (
                    <p className="text-[13px] text-[var(--muted)]">Belum ada penilaian.</p>
                  ) : (
                    <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                      {results.map((r) => (
                        <li key={r.id}>
                          <details className="group px-4 py-3">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block truncate text-[14px] font-medium text-[var(--foreground)]">
                                  {r.categoryObject.nameSnapshot}
                                </span>
                                <span className="block truncate text-[12px] text-[var(--muted)]">
                                  {r.categoryObject.unitSnapshot} &middot; {r.responseCount} respons
                                </span>
                              </span>
                              <span className="shrink-0 text-right text-[15px] font-semibold text-[var(--foreground)]">
                                {r.score !== null ? r.score.toFixed(2) : "—"}
                              </span>
                            </summary>
                            <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
                              <p className="text-[12px] text-[var(--muted)]">
                                {eligibilityLabel[r.eligibility] ?? r.eligibility}
                              </p>
                              {r.parameterResults.map((v) => (
                                <p key={v.id} className="flex items-baseline justify-between text-[12px]">
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
