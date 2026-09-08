import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPeriodDetail, checkReadiness } from "@/lib/services/periods";
import { getFinalizationPreview, listFinalizationHistory } from "@/lib/services/finalization";
import { getCurrentAuthContext } from "@/lib/authz";
import { PeriodSettingsForm } from "./period-settings-form";
import { AccessPolicyForm } from "./access-policy-form";
import { StatusActions } from "./status-actions";
import { FinalizationPanel } from "./finalization-panel";
import { FinalizationHistory } from "./finalization-history";
import { CategoryCreateForm } from "./category-create-form";

const statusLabel: Record<string, string> = {
  DRAF: "Draf",
  SIAP: "Siap",
  AKTIF: "Aktif",
  DITUTUP: "Ditutup",
  FINAL: "Final",
  REVISI: "Revisi",
};

async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [period, objectTypes, ctx] = await Promise.all([
    getPeriodDetail(id),
    prisma.objectType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    getCurrentAuthContext(),
  ]);
  if (!period) notFound();

  const problems = period.status === "DRAF" ? await checkReadiness(id) : [];
  const canManageAccess = !!ctx && (ctx.isAdmin || ctx.isDekan);
  const finalizationPreview =
    period.status === "DITUTUP" ? await getFinalizationPreview(id) : null;
  const finalizationHistory =
    period.status === "FINAL" || period.status === "REVISI"
      ? await listFinalizationHistory(id)
      : [];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/periode" className="text-[13px] text-[var(--muted)] hover:underline">
          ← Semua periode
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="page-title text-[24px] sm:text-[28px] text-[var(--foreground)]">
            {period.name}
          </h1>
          <span className="inline-flex rounded-full bg-black/5 px-2.5 py-1 text-[12px] font-medium text-[var(--muted)]">
            {statusLabel[period.status]}
          </span>
        </div>
        <p className="mt-1 font-mono text-[13px] text-[var(--muted)]">{period.code}</p>
      </div>

      <StatusActions
        periodId={period.id}
        status={period.status}
        problems={problems}
      />

      <FinalizationPanel periodId={period.id} status={period.status} preview={finalizationPreview} />

      {finalizationHistory.length > 0 && <FinalizationHistory history={finalizationHistory} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Pengaturan dasar
          </h2>
          <PeriodSettingsForm period={period} />
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Waktu akses hasil (Bab 4.3)
          </h2>
          {canManageAccess ? (
            <AccessPolicyForm periodId={period.id} accessPolicy={period.accessPolicy} />
          ) : (
            <p className="text-[14px] text-[var(--muted)]">
              Hanya Admin atau Dekan yang dapat mengatur kebijakan ini.
              {period.accessPolicy && (
                <>
                  {" "}
                  Saat ini: <strong>{period.accessPolicy.mode}</strong>.
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Tambah kategori
        </h2>
        <CategoryCreateForm periodId={period.id} objectTypes={objectTypes} />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <table className="w-full min-w-[760px] text-left text-[14px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[12px] uppercase tracking-wide text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Kategori</th>
              <th className="px-4 py-3 font-medium">Jenis objek</th>
              <th className="px-4 py-3 font-medium">Peserta</th>
              <th className="px-4 py-3 font-medium">Bobot instrumen</th>
              <th className="px-4 py-3 font-medium">Kelompok</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {period.categories.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--muted)]">
                  Belum ada kategori.
                </td>
              </tr>
            )}
            {period.categories.map((cat) => {
              const instrument = cat.instrumentVersions[0];
              const totalWeight = instrument
                ? instrument.parameters.reduce((s, p) => s + p.weight, 0)
                : 0;
              return (
                <tr key={cat.id} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/periode/${period.id}/kategori/${cat.id}`}
                      className="font-medium text-[var(--accent)] hover:underline"
                    >
                      {cat.name}
                    </Link>
                    <div className="font-mono text-[12px] text-[var(--muted)]">{cat.code}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{cat.objectType.name}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{cat._count.categoryObjects}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        Math.abs(totalWeight - 100) < 0.001
                          ? "text-[var(--success)]"
                          : "text-[var(--danger)]"
                      }
                    >
                      {totalWeight}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{cat.groupRules.length}/2 diatur</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-medium ${
                        cat.active
                          ? "bg-[var(--success)]/10 text-[var(--success)]"
                          : "bg-black/5 text-[var(--muted)]"
                      }`}
                    >
                      {cat.active ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof PeriodDetailPage>) { await requirePageAdmin(); return PeriodDetailPage(...args); }
