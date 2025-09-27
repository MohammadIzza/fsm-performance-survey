import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import Link from "next/link";
import type { ReactNode } from "react";
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
import { PeriodStepper, type PeriodStep } from "@/components/theme/period-stepper";
import { AdminAction, AdminActionList } from "@/components/theme/admin-actions";
import { ParameterManager } from "./kategori/[categoryId]/parameter-manager";
import { ParticipantManager } from "./kategori/[categoryId]/participant-manager";
import { GroupRuleForm } from "./kategori/[categoryId]/group-rule-form";
import { AssignmentRuleForm } from "./kategori/[categoryId]/assignment-rule-form";
import { AssignmentPlanner } from "./kategori/[categoryId]/assignment-planner";
import { listObjectTypes } from "@/lib/services/objectTypes";

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
  const [period, objectTypes, userTypes, ctx] = await Promise.all([
    getPeriodDetail(id),
    listObjectTypes({ active: true }),
    prisma.userType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
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

  const activeCategories = period.categories.filter((category) => category.active);
  const categoryCount = activeCategories.length;
  type ActiveCategory = (typeof activeCategories)[number];
  const candidateObjects =
    categoryCount > 0
      ? await prisma.assessmentObject.findMany({
          where: {
            active: true,
            typeId: { in: [...new Set(activeCategories.map((category) => category.objectTypeId))] },
          },
          include: { ownerUnit: true },
          orderBy: { name: "asc" },
        })
      : [];
  const editable = period.status === "DRAF" || period.status === "REVISI";
  const units =
    categoryCount > 0
      ? await prisma.unit.findMany({ select: { id: true, name: true, parentId: true }, orderBy: { name: "asc" } })
      : [];

  const instrumentReady = (category: ActiveCategory) => {
    const instrument = category.instrumentVersions[0];
    if (!instrument || instrument.parameters.length === 0) return false;
    const weight = instrument.parameters.reduce((total, parameter) => total + parameter.weight, 0);
    return Math.abs(weight - 100) < 0.001;
  };
  const rulesReady = (category: ActiveCategory) => {
    const groups = new Set(category.groupRules.map((rule) => rule.group));
    const assignments = new Set(category.assignmentRules.map((rule) => rule.group));
    return (
      groups.has("PIMPINAN") &&
      groups.has("SELAIN_PIMPINAN") &&
      assignments.has("PIMPINAN") &&
      assignments.has("SELAIN_PIMPINAN")
    );
  };
  const assignmentsReady = (category: ActiveCategory) => {
    const needsAssignments = category.groupRules.some((rule) => rule.target > 0);
    return !needsAssignments || category._count.assignmentBatches > 0;
  };

  const instrumentReadyCount = activeCategories.filter(instrumentReady).length;
  const participantReadyCount = activeCategories.filter(
    (category) => category._count.categoryObjects > 0
  ).length;
  const rulesReadyCount = activeCategories.filter(rulesReady).length;
  const assignmentReadyCount = activeCategories.filter(assignmentsReady).length;
  const setupDone = [
    true,
    categoryCount > 0,
    categoryCount > 0 && instrumentReadyCount === categoryCount,
    categoryCount > 0 && participantReadyCount === categoryCount,
    categoryCount > 0 && rulesReadyCount === categoryCount,
    categoryCount > 0 && assignmentReadyCount === categoryCount,
  ];

  const activated = ["AKTIF", "DITUTUP", "FINAL", "REVISI"].includes(period.status);
  const finalized = period.status === "FINAL";
  let currentStep = setupDone.findIndex((done, index) => index > 0 && !done);
  if (currentStep === -1) currentStep = 6;
  if (activated) currentStep = 7;
  if (finalized) currentStep = -1;

  const categoryHref = (
    section: "instrumen" | "kelompok" | "peserta" | "penugasan",
    predicate: (category: ActiveCategory) => boolean
  ) => {
    const category = activeCategories.find(predicate) ?? activeCategories[0];
    return category
      ? `/admin/periode/${period.id}/kategori/${category.id}?bagian=${section}`
      : "#tambah-kategori";
  };
  const stepState = (index: number): PeriodStep["state"] => {
    if (currentStep === -1 || index < currentStep) return "done";
    if (index === currentStep) return "current";
    return "todo";
  };
  const categoryStepContent = ({
    intro,
    statusText,
    ready,
    renderForm,
  }: {
    intro: string;
    statusText: (category: ActiveCategory) => string;
    ready: (category: ActiveCategory) => boolean;
    renderForm: (category: ActiveCategory) => ReactNode;
  }) => {
    const defaultCategoryId =
      activeCategories.find((category) => !ready(category))?.id ?? activeCategories[0]?.id;

    return (
      <div>
        <p className="period-stepper__category-intro">{intro}</p>
        <div className="period-stepper__categories">
          {activeCategories.map((category) => (
            <details key={category.id} open={category.id === defaultCategoryId}>
              <summary>
                <span>
                  <strong>{category.name}</strong>
                  <small>{statusText(category)}</small>
                </span>
                <span className="period-stepper__category-arrow" aria-hidden="true" />
              </summary>
              <div className="period-stepper__category-form">{renderForm(category)}</div>
            </details>
          ))}
        </div>
      </div>
    );
  };
  const steps: PeriodStep[] = [
    {
      title: "Periksa informasi periode",
      description: "Pastikan nama dan jadwal pelaksanaan sudah benar.",
      note: `Jadwal ${new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).formatRange(period.startsAt, period.endsAt)}`,
      href: "#pengaturan-periode",
      state: stepState(0),
      content: (
        <div className="period-stepper__form-grid">
          <section className="period-stepper__form-section">
            <h3>Informasi periode</h3>
            <PeriodSettingsForm period={period} />
          </section>
          <section className="period-stepper__form-section">
            <h3>Waktu akses hasil</h3>
            {canManageAccess ? (
              <AccessPolicyForm periodId={period.id} accessPolicy={period.accessPolicy} />
            ) : (
              <p className="app-text-sm" style={{ color: "var(--color-text)" }}>
                Pengaturan ini hanya dapat diubah oleh Admin atau Dekan.
              </p>
            )}
          </section>
        </div>
      ),
    },
    {
      title: "Tambahkan kategori penilaian",
      description: "Pilih hal yang ingin dinilai dalam periode ini.",
      note: categoryCount > 0 ? `${categoryCount} kategori aktif` : "Belum ada kategori",
      href: "#tambah-kategori",
      state: stepState(1),
      content: <CategoryCreateForm periodId={period.id} objectTypes={objectTypes} />,
    },
    {
      title: "Susun pertanyaan dan bobot",
      description: "Tentukan aspek penilaian dan pastikan total bobot 100%.",
      note: `${instrumentReadyCount}/${categoryCount || 0} kategori siap`,
      href: categoryHref("instrumen", (category) => !instrumentReady(category)),
      state: stepState(2),
      content: categoryStepContent({
        intro: "Atur parameter, indikator operasional, dan bobot untuk setiap kategori.",
        statusText: (category) =>
          instrumentReady(category) ? "Pertanyaan dan bobot sudah lengkap" : "Perlu dilengkapi",
        ready: instrumentReady,
        renderForm: (category) => {
          const instrument = category.instrumentVersions[0];
          if (!instrument) {
            return <p className="period-stepper__category-intro">Instrumen belum tersedia.</p>;
          }
          const totalWeight = instrument.parameters.reduce(
            (total, parameter) => total + parameter.weight,
            0
          );
          return (
            <div className="space-y-3">
              <p className="period-stepper__form-status">Total bobot: {totalWeight}%</p>
              <ParameterManager
                instrumentVersionId={instrument.id}
                parameters={instrument.parameters}
                periodId={period.id}
                categoryId={category.id}
                editable={editable}
              />
            </div>
          );
        },
      }),
    },
    {
      title: "Pilih yang akan dinilai",
      description: "Tambahkan dosen, karya, layanan, atau unit yang sesuai.",
      note: `${participantReadyCount}/${categoryCount || 0} kategori sudah memiliki objek`,
      href: categoryHref("peserta", (category) => category._count.categoryObjects === 0),
      state: stepState(3),
      content: categoryStepContent({
        intro: "Pilih objek yang akan menerima penilaian pada setiap kategori.",
        statusText: (category) => `${category._count.categoryObjects} objek sudah dipilih`,
        ready: (category) => category._count.categoryObjects > 0,
        renderForm: (category) => {
          const selectedIds = new Set(category.categoryObjects.map((item) => item.objectId));
          return (
            <ParticipantManager
              periodId={period.id}
              categoryId={category.id}
              participants={category.categoryObjects}
              candidateObjects={candidateObjects.filter(
                (item) => item.typeId === category.objectTypeId && !selectedIds.has(item.id)
              )}
              units={units}
              objectTypeName={category.objectType.name}
              editable={editable}
            />
          );
        },
      }),
    },
    {
      title: "Tentukan siapa yang menilai",
      description: "Atur kelompok penilai, jumlah penilai, dan syaratnya.",
      note: `${rulesReadyCount}/${categoryCount || 0} kategori sudah diatur`,
      href: categoryHref("kelompok", (category) => !rulesReady(category)),
      state: stepState(4),
      content: categoryStepContent({
        intro: "Tentukan jumlah penilai, cara menghitung hasil, dan siapa yang boleh menilai.",
        statusText: (category) =>
          rulesReady(category) ? "Aturan penilai sudah tersedia" : "Perlu dilengkapi",
        ready: rulesReady,
        renderForm: (category) => {
          const parameters = category.instrumentVersions[0]?.parameters ?? [];
          return (
            <div className="period-stepper__rules-grid">
              {category.groupRules
                .slice()
                .sort((a) => (a.group === "PIMPINAN" ? -1 : 1))
                .map((rule) => (
                  <section key={rule.id} className="period-stepper__form-section">
                    <h3>{rule.group === "PIMPINAN" ? "Pimpinan" : "Selain pimpinan"}</h3>
                    <GroupRuleForm
                      parameters={parameters}
                      rule={rule}
                      periodId={period.id}
                      categoryId={category.id}
                      editable={editable}
                    />
                  </section>
                ))}
              {category.assignmentRules
                .slice()
                .sort((a) => (a.group === "PIMPINAN" ? -1 : 1))
                .map((rule) => (
                  <section key={rule.id} className="period-stepper__form-section">
                    <h3>
                      Syarat {rule.group === "PIMPINAN" ? "pimpinan" : "selain pimpinan"}
                    </h3>
                    <AssignmentRuleForm
                      rule={rule}
                      userTypes={userTypes}
                      periodId={period.id}
                      categoryId={category.id}
                      editable={editable}
                    />
                  </section>
                ))}
            </div>
          );
        },
      }),
    },
    {
      title: "Bagikan tugas penilaian",
      description: "Tinjau penilai yang dipilih lalu terbitkan tugasnya.",
      note: `${assignmentReadyCount}/${categoryCount || 0} kategori sudah memiliki penugasan`,
      href: categoryHref("penugasan", (category) => !assignmentsReady(category)),
      state: stepState(5),
      content: categoryStepContent({
        intro: "Tinjau hasil pembagian penilai sebelum tugas diterbitkan.",
        statusText: (category) =>
          assignmentsReady(category) ? "Tugas sudah dibagikan" : "Belum ada pembagian tugas",
        ready: assignmentsReady,
        renderForm: (category) => (
          <div className="space-y-3">
            <AssignmentPlanner
              periodId={period.id}
              categoryId={category.id}
              editable={editable}
            />
            <Link
              href={`/admin/periode/${period.id}/kategori/${category.id}?bagian=penugasan`}
              className="period-stepper__secondary-link"
            >
              Lihat daftar tugas dan penugasan manual →
            </Link>
          </div>
        ),
      }),
    },
    {
      title: "Buka pengisian",
      description: "Periksa kesiapan, lalu izinkan penilai mulai mengisi.",
      note: `Status saat ini: ${statusLabel[period.status]}`,
      href: "#status-periode",
      state: stepState(6),
      content: activated ? (
        <p className="period-stepper__category-intro">
          Pengisian sudah pernah dibuka. Penilai dapat melihat tugas yang diberikan kepada mereka.
        </p>
      ) : (
        <StatusActions periodId={period.id} status={period.status} problems={problems} />
      ),
    },
    {
      title: "Pantau dan selesaikan",
      description: "Pantau jawaban, tutup pengisian, lalu tetapkan hasil.",
      note: finalized ? "Hasil sudah ditetapkan" : "Pemantauan dan finalisasi",
      href:
        period.status === "AKTIF"
          ? "/admin/pemantauan"
          : ["DITUTUP", "FINAL", "REVISI"].includes(period.status)
            ? "#selesaikan-periode"
            : "#status-periode",
      state: stepState(7),
      content: (
        <div className="space-y-4">
          <Link href="/admin/pemantauan" className="app-btn app-btn--primary">
            Lihat pemantauan
          </Link>
          {(period.status === "AKTIF" || period.status === "REVISI") && (
            <StatusActions periodId={period.id} status={period.status} problems={problems} />
          )}
          <FinalizationPanel
            periodId={period.id}
            status={period.status}
            preview={finalizationPreview}
          />
          {finalizationHistory.length > 0 && <FinalizationHistory history={finalizationHistory} />}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <Link href="/admin/periode" className="app-back">
        ← Semua periode
      </Link>
      <PageIntro title={period.name} intro="Periode penilaian">
        <SummaryCard
          tone={statusTone[period.status as keyof typeof statusTone]}
          label="Status"
          value={statusLabel[period.status]}
        />
        <SummaryCard
          tone="biru"
          label="Jadwal"
          value={<DateRange from={period.startsAt} to={period.endsAt} />}
        />
        <SummaryCard
          tone="kuning"
          label="Kategori"
          value={period.categories.length}
          note="dalam periode ini"
        />
      </PageIntro>

      <PeriodStepper steps={steps} />

      <AdminActionList>
        <AdminAction
          name="Gunakan kembali periode ini"
          description="Buat periode baru memakai susunan periode ini tanpa menyalin tugas dan jawaban lama."
        >
          <CopyPeriodForm sourcePeriodId={period.id} />
        </AdminAction>
      </AdminActionList>
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof PeriodDetailPage>) { await requirePageAdmin(); return PeriodDetailPage(...args); }
