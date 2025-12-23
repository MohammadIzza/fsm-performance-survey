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
import { CopyPeriodForm } from "./copy-period-form";
import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { DateRange } from "@/components/theme/date-range";
import { StatusPill } from "@/components/theme/status-pill";

// Nada lencana status mengikuti daftar periode, supaya satu status berwarna sama di mana pun.
const statusTone = {
  DRAF: "kuning",
  SIAP: "biru",
  AKTIF: "tosca",
  DITUTUP: "kuning",
  FINAL: "biru",
  REVISI: "merah",
} as const;

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
      <Link href="/admin/periode" className="app-back">
        ← Semua periode
      </Link>
      <PageIntro title={period.name} intro={period.code}>
        <SummaryCard
          tone={statusTone[period.status as keyof typeof statusTone]}
          label="Status"
          value={statusLabel[period.status]}
        />
        <SummaryCard
          tone="biru"
          label="Jadwal"
          value={<DateRange from={period.startsAt} to={period.endsAt} />}
          note={period.timezone}
        />
        <SummaryCard
          tone="kuning"
          label="Kategori"
          value={period.categories.length}
          note="dalam periode ini"
        />
      </PageIntro>

      <StatusActions
        periodId={period.id}
        status={period.status}
        problems={problems}
      />

      <FinalizationPanel periodId={period.id} status={period.status} preview={finalizationPreview} />

      {finalizationHistory.length > 0 && <FinalizationHistory history={finalizationHistory} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="app-panel app-panel--ruled">
          <h2 className="app-panel__label">
            Pengaturan dasar
          </h2>
          <PeriodSettingsForm period={period} />
        </div>

        <div className="app-panel app-panel--ruled">
          <h2 className="app-panel__label">
            Waktu akses hasil
          </h2>
          {canManageAccess ? (
            <AccessPolicyForm periodId={period.id} accessPolicy={period.accessPolicy} />
          ) : (
            <p className="app-text-sm" style={{ color: "var(--color-text)" }}>
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

      <div className="app-panel app-panel--ruled">
        <h2 className="app-panel__label">
          Tambah kategori
        </h2>
        <CategoryCreateForm periodId={period.id} objectTypes={objectTypes} />
      </div>

      <div className="app-panel app-panel--ruled">
        <h2 className="app-panel__label app-panel__label--tight">
          Gunakan kembali periode ini (UC-10)
        </h2>
        <p className="app-panel__text" style={{ marginTop: 0, marginBottom: ".85rem" }}>
          Menyalin kategori, instrumen, aturan penilaian, dan peserta (hanya yang masih aktif) ke
          periode draf baru dengan jadwal baru — sebagai titik awal yang bisa ditinjau/diubah.
          Penugasan dan seluruh jawaban TIDAK ikut disalin — selalu dievaluasi ulang dari nol untuk
          periode baru, jadi tidak ada jawaban lama yang ikut dihitung.
        </p>
        <CopyPeriodForm sourcePeriodId={period.id} />
      </div>

      <div className="app-table-wrap">
        <table className="min-w-[760px]">
          <thead>
            <tr>
              <th >Kategori</th>
              <th >Jenis objek</th>
              <th >Peserta</th>
              <th >Bobot instrumen</th>
              <th >Kelompok</th>
              <th >Status</th>
            </tr>
          </thead>
          <tbody>
            {period.categories.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center" }}>
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
                  <td data-label="Kategori">
                    <Link
                      href={`/admin/periode/${period.id}/kategori/${cat.id}`}
                      className="font-medium"
                    >
                      {cat.name}
                    </Link>
                    <div className="app-text-xs font-mono" style={{ color: "var(--color-text)" }}>{cat.code}</div>
                  </td>
                  <td data-label="Jenis objek">{cat.objectType.name}</td>
                  <td data-label="Peserta">{cat._count.categoryObjects}</td>
                  <td data-label="Bobot">
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
                  <td data-label="Kelompok">{cat.groupRules.length}/2 diatur</td>
                  <td data-label="Status">
                    <StatusPill tone={cat.active ? "selesai" : "netral"}>
                      {cat.active ? "Aktif" : "Nonaktif"}
                    </StatusPill>
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
