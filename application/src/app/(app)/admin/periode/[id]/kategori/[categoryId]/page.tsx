import { Info } from "@/components/theme/info";
import { KET } from "@/lib/keterangan";
import { TombolHapus } from "@/components/theme/tombol-hapus";
import { deleteCategoryAction } from "@/lib/actions/admin-hapus";
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
import { CombinedWeightForm } from "./combined-weight-form";
import { PredikatForm } from "./predikat-form";
import { bacaAmbang, skorMaksimum } from "@/lib/predikat";
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
  // Saat periode berjalan, objek dan penilai masih boleh DITAMBAH (tidak diubah atau dihapus) —
  // lib/services/penambahan-berjalan.ts.
  const berjalan = category.period.status === "AKTIF" && new Date() < category.period.endsAt;
  const bisaTambah = category.period.status === "DRAF" || berjalan;
  const instrument = category.instrumentVersions[0];
  const totalWeight = instrument
    ? instrument.parameters.reduce((s, p) => s + p.weight, 0)
    : 0;
  // Nilai tertinggi yang mungkin dicapai kategori ini — dipakai formulir predikat untuk
  // menerjemahkan ambang persen menjadi angka nilai. Metode Rerata kedua kelompok memberi
  // maksimum yang sama; bila salah satunya Total, maksimumnya tidak ada (null).
  const skorTertinggi = instrument
    ? skorMaksimum(
        instrument.parameters,
        instrument.scaleMax,
        category.groupRules.every((r) => r.aggregation === "RATA_RATA") ? "RATA_RATA" : "TOTAL"
      )
    : null;

  const [candidateObjects, userTypes, assignments, activeUsers, sourceCandidates, units, objectGroups] =
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
      prisma.unit.findMany({ select: { id: true, name: true, parentId: true }, orderBy: { name: "asc" } }),
      // Kelompok objek dipakai sebagai pilih cepat saat menyusun peserta; anggotanya disaring ke
      // jenis objek kategori ini supaya tidak menawarkan objek yang pasti ditolak.
      prisma.objectGroup.findMany({
        include: { members: { include: { object: { select: { id: true, typeId: true, active: true } } } } },
        orderBy: { name: "asc" },
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
      <PageIntro title={category.name} intro={`Menilai: ${category.objectType.name}`}>
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
            title: "Susun isi formulir penilaian",
            hint: "Aspek apa saja yang dinilai, dan berapa bobot masing-masing. Totalnya harus 100%.",
            completion: "parameter sudah lengkap dan total bobot tepat 100%.",
            content: (
              <>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="app-panel app-panel--ruled">
                    <h2 className="app-panel__label">
                      Pengaturan kategori
                    </h2>
                    <CategoryEditForm category={category} periodId={periodId} editable={editable} />
                    {category.period.status === "DRAF" && (
                      <div className="hapus-zona">
                        <TombolHapus
                          aksi={deleteCategoryAction}
                          id={category.id}
                          label="Hapus kategori"
                          judul={`Hapus kategori ${category.name}?`}
                          pesan={
                            <p>
                              Pertanyaan, aturan penilai, {category.categoryObjects.length} objek yang dinilai, dan tugas yang sudah
                              dibagikan di kategori ini ikut terhapus permanen. Hanya bisa selama periode masih Draf.
                            </p>
                          }
                          berhasil="Kategori dihapus."
                        />
                      </div>
                    )}
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
            title: "Tentukan siapa yang boleh menilai",
            hint: "Siapa yang boleh menilai, berapa orang per objek, dan berapa jawaban minimum agar nilainya sah.",
            completion: "jumlah, minimum respons, dan syarat calon untuk setiap kelompok sudah tersimpan.",
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
                            <Info>{KET.kelompok}</Info>
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
                  <p className="eyebrow mb-3">Nilai gabungan</p>
                  <div className="app-panel app-panel--ruled">
                    <CombinedWeightForm
                      periodId={periodId}
                      categoryId={categoryId}
                      pimpinanWeight={category.pimpinanWeight}
                      editable={["DRAF", "SIAP", "AKTIF"].includes(category.period.status)}
                    />
                  </div>
                </div>

                <div>
                  <p className="eyebrow mb-3">Predikat nilai</p>
                  <div className="app-panel app-panel--ruled">
                    <PredikatForm
                      periodId={periodId}
                      categoryId={categoryId}
                      bands={bacaAmbang(category.gradeBands)}
                      skorMaksimum={skorTertinggi}
                      editable={category.period.status !== "FINAL"}
                    />
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
                            <Info>{KET.kelompok}</Info>
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
            label: "Yang Dinilai",
            count: category.categoryObjects.length,
            title: "Pilih objek yang akan menerima penilaian",
            hint: "Objek yang masuk kategori ini dan akan mendapat nilai.",
            completion: "semua dosen, karya, layanan, atau unit yang diperlukan sudah masuk daftar.",
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
                  units={units}
                  objectGroups={objectGroups
                    .map((g) => ({
                      id: g.id,
                      name: g.name,
                      objectIds: g.members
                        .filter((m) => m.object.typeId === category.objectTypeId && m.object.active)
                        .map((m) => m.object.id),
                    }))
                    .filter((g) => g.objectIds.length > 0)}
                  objectTypeName={category.objectType.name}
                  editable={category.period.status === "DRAF"}
                  bisaTambah={bisaTambah}
                  berjalan={berjalan}
                />
              </div>
            ),
          },
          {
            key: "penugasan",
            label: "Pembagian Tugas",
            count: assignments.length,
            title: "Bagikan formulir kepada penilai",
            hint: "Tentukan siapa yang menerima tugas untuk menilai setiap objek. Gunakan pembagian otomatis, lalu koreksi secara manual bila diperlukan.",
            completion: "setiap objek sudah memiliki penilai dan tugasnya muncul pada daftar.",
            content: (
              <>
                <div className="app-panel app-panel--ruled">
                  <h2 className="app-panel__label">
                    Pembagian otomatis
                  </h2>
                  <p className="assignment-section__intro">
                    Klik pratinjau untuk melihat usulan pembagian tanpa menyimpan perubahan. Setelah
                    hasilnya sesuai, pilih <strong>Terapkan penugasan</strong> untuk menerbitkan tugas.
                  </p>
                  <ol className="assignment-process" aria-label="Cara membuat pembagian tugas">
                    <li>
                      <span>1</span>
                      <div><strong>Pratinjau</strong><small>Sistem mencari calon penilai yang memenuhi aturan.</small></div>
                    </li>
                    <li>
                      <span>2</span>
                      <div><strong>Periksa</strong><small>Pastikan nama penilai dan kekurangannya sudah benar.</small></div>
                    </li>
                    <li>
                      <span>3</span>
                      <div><strong>Terapkan</strong><small>Tugas baru diterbitkan dan masuk ke daftar di bawah.</small></div>
                    </li>
                  </ol>
                  <AssignmentPlanner periodId={periodId} categoryId={categoryId} editable={bisaTambah} berjalan={berjalan} />
                </div>

                <div className="app-panel app-panel--ruled">
                  <h2 className="app-panel__label">
                    Tugas yang sudah diterbitkan ({assignments.length})
                  </h2>
                  <p className="assignment-section__intro">
                    Daftar ini menunjukkan objek, penilai, kelompok, dan status pengisian setiap tugas.
                  </p>
                  <div className="space-y-4">
                    <AssignmentList assignments={assignments} periodId={periodId} categoryId={categoryId} />
                    {bisaTambah && category.categoryObjects.length > 0 && (
                      <div className="assignment-manual border-t border-[var(--border)] pt-4">
                        <h3 className="app-panel__label">
                          Tambah satu tugas secara manual
                        </h3>
                        <p className="assignment-section__intro">
                          Gunakan ini untuk menambah atau memperbaiki pasangan objek dan penilai tertentu.
                        </p>
                        <ManualAssignForm
                          periodId={periodId}
                          categoryId={categoryId}
                          categoryObjects={category.categoryObjects.map((co) => ({
                            id: co.id,
                            nameSnapshot: co.nameSnapshot,
                          }))}
                          users={activeUsers}
                          berjalan={berjalan}
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
