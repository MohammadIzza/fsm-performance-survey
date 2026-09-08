import { InstrumentRevisionForm } from "./instrument-revision-form";
import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import Link from "next/link";
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
}: {
  params: Promise<{ id: string; categoryId: string }>;
}) {
  const { id: periodId, categoryId } = await params;
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
      <div>
        <Link
          href={`/admin/periode/${periodId}`}
          className="text-[13px] text-[var(--muted)] hover:underline"
        >
          ← {category.period.name}
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="page-title text-[24px] sm:text-[28px] text-[var(--foreground)]">
            {category.name}
          </h1>
          <Link
            href={`/admin/periode/${periodId}/kategori/${categoryId}/hasil`}
            className="text-[13px] font-medium text-[var(--accent)] hover:underline"
          >
            Lihat hasil →
          </Link>
        </div>
        <p className="mt-1 font-mono text-[13px] text-[var(--muted)]">
          {category.code} · {category.objectType.name}
        </p>
      </div>

      <CategoryTabs
        tabs={[
          {
            key: "instrumen",
            label: "Instrumen",
            content: (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
                    <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
                      Pengaturan kategori
                    </h2>
                    <CategoryEditForm category={category} periodId={periodId} editable={editable} />
                  </div>

                  {instrument && (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
                      <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
                        Skala instrumen
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
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
                        Parameter &amp; bobot
                      </h2>
                      <span
                        className={`text-[13px] font-medium ${
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
            label: "Kelompok & Kelayakan",
            content: (
              <>
                <div>
                  <p className="eyebrow mb-3">Aturan kelompok</p>
                  <div className="grid gap-6 sm:grid-cols-2">
                    {category.groupRules
                      .slice()
                      .sort((a) => (a.group === "PIMPINAN" ? -1 : 1))
                      .map((rule) => (
                        <div
                          key={rule.id}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
                        >
                          <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
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
                  <p className="eyebrow mb-3">Aturan kelayakan</p>
                  <div className="grid gap-6 sm:grid-cols-2">
                    {category.assignmentRules
                      .slice()
                      .sort((a) => (a.group === "PIMPINAN" ? -1 : 1))
                      .map((rule) => (
                        <div
                          key={rule.id}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm"
                        >
                          <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
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
            label: `Peserta (${category.categoryObjects.length})`,
            content: (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
                <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  Peserta ({category.categoryObjects.length})
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
            label: `Penugasan (${assignments.length})`,
            content: (
              <>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
                  <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    Pengacakan penugasan (Bab 10)
                  </h2>
                  <AssignmentPlanner periodId={periodId} categoryId={categoryId} editable={editable} />
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
                  <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
                    Daftar tugas ({assignments.length})
                  </h2>
                  <div className="space-y-4">
                    <AssignmentList assignments={assignments} periodId={periodId} categoryId={categoryId} />
                    {editable && category.categoryObjects.length > 0 && (
                      <div className="border-t border-[var(--border)] pt-4">
                        <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[var(--muted)]">
                          Tugaskan manual (Bab 10.5)
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
