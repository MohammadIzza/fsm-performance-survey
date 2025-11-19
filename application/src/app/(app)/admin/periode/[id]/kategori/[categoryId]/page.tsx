import { InstrumentRevisionForm } from "./instrument-revision-form";
import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import Link from "next/link";
import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCategoryDetail } from "@/lib/services/categories";
import { listAssignmentsForCategory } from "@/lib/services/assignments";
import { CategoryEditForm } from "./category-edit-form";
import { ScaleForm } from "./scale-form";
import { ParameterManager } from "./parameter-manager";
import { DuplicateInstrumentForm } from "./duplicate-instrument-form";
import { GroupRuleForm } from "./group-rule-form";
import { ParticipantManager } from "./participant-manager";
import { AssignmentRuleForm } from "./assignment-rule-form";
import { AssignmentPlanner } from "./assignment-planner";
import { AssignmentList } from "./assignment-list";
import { ManualAssignForm } from "./manual-assign-form";
import { CategoryTabs } from "./category-tabs";

async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; categoryId: string }>;
  searchParams: Promise<{ bagian?: string }>;
}) {
  const { id: periodId, categoryId } = await params;
  const { bagian } = await searchParams;
  const category = await getCategoryDetail(categoryId);
  if (!category || category.periodId !== periodId) notFound();

  const editable = category.period.status === "DRAF" || category.period.status === "REVISI";
  const instrument = category.instrumentVersions[0];
  const totalWeight = instrument
    ? instrument.parameters.reduce((s, p) => s + p.weight, 0)
    : 0;

  const [candidateObjects, userTypes, assignments, activeUsers, sourceCandidates] =
    await Promise.all([
      prisma.assessmentObject.findMany({
        where: {
          typeId: category.objectTypeId,
          active: true,
          id: { notIn: category.categoryObjects.map((co) => co.objectId) },
        },
        include: { ownerUnit: true },
        orderBy: { name: "asc" },
      }),
      prisma.userType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      listAssignmentsForCategory(categoryId),
      prisma.user.findMany({
        where: { active: true },
        select: { id: true, name: true, loginIdentifier: true },
        orderBy: { name: "asc" },
      }),
      prisma.category.findMany({
        where: { id: { not: categoryId } },
        include: {
          period: { select: { name: true } },
          instrumentVersions: {
            orderBy: { revision: "desc" },
            take: 1,
            include: { _count: { select: { parameters: true } } },
          },
        },
        orderBy: [{ period: { createdAt: "desc" } }, { name: "asc" }],
      }),
    ]);

  // Hanya kategori yang instrumennya sudah punya parameter yang layak jadi sumber salinan.
  const duplicateSources = sourceCandidates
    .filter((c) => (c.instrumentVersions[0]?._count.parameters ?? 0) > 0)
    .map((c) => ({
      id: c.id,
      label: `${c.period.name} · ${c.name} (${c.instrumentVersions[0]._count.parameters} parameter)`,
    }));

  return (
    <div className="space-y-6">
      {category.period.status === "REVISI" && <InstrumentRevisionForm categoryId={categoryId} periodId={periodId}/>}
      <Link href={`/admin/periode/${periodId}`} className="app-back">
        ← {category.period.name}
      </Link>
      <PageIntro title={category.name} intro={`${category.code} · ${category.objectType.name}`}>
        <SummaryCard tone="biru" label="Jenis objek" value={category.objectType.name} />
        <SummaryCard
          tone="kuning"
          label="Peserta"
          value={category.categoryObjects.length}
          note="objek dinilai"
        />
        <SummaryCard
          tone="tosca"
          label="Hasil"
          value={
            <Link href={`/admin/periode/${periodId}/kategori/${categoryId}/hasil`}>
              Lihat hasil →
            </Link>
          }
        />
      </PageIntro>

      <CategoryTabs
        initialKey={bagian}
        tabs={[
          {
            key: "instrumen",
            label: "Pertanyaan & Bobot",
            content: (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="app-panel app-panel--ruled">
                    <h2 className="app-panel__label">
                      Pengaturan kategori
                    </h2>
                    <CategoryEditForm category={category} periodId={periodId} editable={editable} />
                  </div>

                  {instrument && (
                    <div className="app-panel app-panel--ruled">
                      <h2 className="app-panel__label">
                        Rentang nilai
                      </h2>
                      <ScaleForm
                        instrument={instrument}
                        periodId={periodId}
                        categoryId={categoryId}
                        editable={editable}
                      />
                    </div>
                  )}
                </div>

                {instrument && (
                  <div className="app-panel app-panel--ruled">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="app-panel__label app-panel__label--tight">
                        Parameter &amp; bobot
                      </h2>
                      <span
                        className={`app-text-sm font-medium ${
                          Math.abs(totalWeight - 100) < 0.001
                            ? "text-[var(--success)]"
                            : "text-[var(--danger)]"
                        }`}
                      >
                        Total bobot: {totalWeight}%
                      </span>
                    </div>
                    {editable && (
                      <DuplicateInstrumentForm
                        instrumentVersionId={instrument.id}
                        periodId={periodId}
                        categoryId={categoryId}
                        sources={duplicateSources}
                      />
                    )}
                    <ParameterManager
                      instrumentVersionId={instrument.id}
                      parameters={instrument.parameters}
                      periodId={periodId}
                      categoryId={categoryId}
                      editable={editable}
                    />
                  </div>
                )}
              </>
            ),
          },
          {
            key: "kelompok",
            label: "Aturan Penilai",
            content: (
              <>
                <div>
                  <p className="eyebrow mb-3">Jumlah penilai dan perhitungan</p>
                  <div className="grid gap-6 sm:grid-cols-2">
                    {category.groupRules
                      .slice()
                      .sort((a) => (a.group === "PIMPINAN" ? -1 : 1))
                      .map((rule) => (
                        <div
                          key={rule.id}
                          className="app-panel app-panel--ruled"
                        >
                          <h2 className="app-panel__label">
                            {rule.group === "PIMPINAN" ? "Pimpinan" : "Selain Pimpinan"}
                          </h2>
                          <GroupRuleForm parameters={instrument?.parameters ?? []}
                            rule={rule}
                            periodId={periodId}
                            categoryId={categoryId}
                            editable={editable}
                          />
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <p className="eyebrow mb-3">Syarat penilai</p>
                  <div className="grid gap-6 sm:grid-cols-2">
                    {category.assignmentRules
                      .slice()
                      .sort((a) => (a.group === "PIMPINAN" ? -1 : 1))
                      .map((rule) => (
                        <div
                          key={rule.id}
                          className="app-panel app-panel--ruled"
                        >
                          <h2 className="app-panel__label">
                            {rule.group === "PIMPINAN" ? "Pimpinan" : "Selain Pimpinan"}
                          </h2>
                          <AssignmentRuleForm
                            rule={rule}
                            userTypes={userTypes}
                            periodId={periodId}
                            categoryId={categoryId}
                            editable={editable}
                          />
                        </div>
                      ))}
                  </div>
                </div>
              </>
            ),
          },
          {
            key: "peserta",
            label: `Yang Dinilai (${category.categoryObjects.length})`,
            content: (
              <div className="app-panel app-panel--ruled">
                <h2 className="app-panel__label">
                  Objek yang dinilai ({category.categoryObjects.length})
                </h2>
                <ParticipantManager
                  periodId={periodId}
                  categoryId={categoryId}
                  participants={category.categoryObjects}
                  candidateObjects={candidateObjects}
                  editable={editable}
                />
              </div>
            ),
          },
          {
            key: "penugasan",
            label: `Pembagian Tugas (${assignments.length})`,
            content: (
              <>
                <div className="app-panel app-panel--ruled">
                  <h2 className="app-panel__label">
                    Buat pembagian tugas
                  </h2>
                  <AssignmentPlanner periodId={periodId} categoryId={categoryId} editable={editable} />
                </div>

                <div className="app-panel app-panel--ruled">
                  <h2 className="app-panel__label">
                    Daftar tugas ({assignments.length})
                  </h2>
                  <div className="space-y-4">
                    <AssignmentList assignments={assignments} periodId={periodId} categoryId={categoryId} />
                    {editable && category.categoryObjects.length > 0 && (
                      <div className="border-t border-[var(--border)] pt-4">
                        <h3 className="app-panel__label">
                          Tambah penilai secara manual
                        </h3>
                        <ManualAssignForm
                          periodId={periodId}
                          categoryId={categoryId}
                          categoryObjects={category.categoryObjects.map((co) => ({
                            id: co.id,
                            nameSnapshot: co.nameSnapshot,
                          }))}
                          users={activeUsers}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof CategoryDetailPage>) { await requirePageAdmin(); return CategoryDetailPage(...args); }
