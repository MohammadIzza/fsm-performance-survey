import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";
import { kodeUnikDariNama } from "@/lib/kode-otomatis";
import { periksaPenambahan } from "@/lib/services/penambahan-berjalan";

export interface CategoryInput {
  code: string;
  name: string;
  description: string | null;
  objectTypeId: string;
  excludeContributors: boolean;
}

async function assertPeriodEditable(periodId: string) {
  const period = await prisma.period.findUnique({ where: { id: periodId } });
  if (!period) throw new ServiceError("Periode tidak ditemukan.");
  if (period.status !== "DRAF") {
    throw new ServiceError("Kategori hanya dapat diubah selama periode berstatus Draf.");
  }
  return period;
}

// Bab 8.1: konfigurasi kategori mengikat satu jenis objek; instrumen & aturan kelompok dibuat menyusul.
async function createCategoryImpl(
  periodId: string,
  input: CategoryInput,
  actor: AuthContext
) {
  await assertPeriodEditable(periodId);

  const name = input.name.trim();
  if (!name) throw new ServiceError("Nama kategori wajib diisi.");
  const code =
    input.code.trim() ||
    (await kodeUnikDariNama(name, async (k) =>
      !!(await prisma.category.findUnique({ where: { periodId_code: { periodId, code: k } } }))
    ));

  const objectType = await prisma.objectType.findUnique({ where: { id: input.objectTypeId } });
  if (!objectType) throw new ServiceError("Jenis objek tidak ditemukan.");

  const existing = await prisma.category.findUnique({
    where: { periodId_code: { periodId, code } },
  });
  if (existing) throw new ServiceError("Kode kategori sudah dipakai pada periode ini.");

  const category = await prisma.$transaction(async (tx) => {
    const cat = await tx.category.create({
      data: {
        periodId,
        code,
        name,
        description: input.description?.trim() || null,
        objectTypeId: input.objectTypeId,
        excludeContributors: input.excludeContributors,
      },
    });
    // Bab 9: setiap kategori langsung memiliki versi instrumen awal (revisi 1) agar parameter
    // dan aturan kelompok punya tempat sejak dibuat, sesuai UC-02.
    await tx.instrumentVersion.create({
      data: { categoryId: cat.id, revision: 1 },
    });
    await tx.groupRule.createMany({
      data: [
        { categoryId: cat.id, group: "PIMPINAN" },
        { categoryId: cat.id, group: "SELAIN_PIMPINAN" },
      ],
    });
    await tx.assignmentRule.createMany({
      data: [
        { categoryId: cat.id, group: "PIMPINAN" },
        { categoryId: cat.id, group: "SELAIN_PIMPINAN" },
      ],
    });
    return cat;
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "CATEGORY_CREATE",
    entity: "Category",
    entityId: category.id,
    after: category,
  });

  return category;
}

async function updateCategoryImpl(
  categoryId: string,
  input: CategoryInput,
  actor: AuthContext
) {
  const before = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!before) throw new ServiceError("Kategori tidak ditemukan.");
  await assertPeriodEditable(before.periodId);

  const code = input.code.trim() || before.code;
  const name = input.name.trim();
  if (!name) throw new ServiceError("Nama kategori wajib diisi.");

  if (code !== before.code) {
    const existing = await prisma.category.findUnique({
      where: { periodId_code: { periodId: before.periodId, code } },
    });
    if (existing) throw new ServiceError("Kode kategori sudah dipakai pada periode ini.");
  }

  const category = await prisma.category.update({
    where: { id: categoryId },
    data: {
      code,
      name,
      description: input.description?.trim() || null,
      excludeContributors: input.excludeContributors,
    },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "CATEGORY_UPDATE",
    entity: "Category",
    entityId: category.id,
    before,
    after: category,
  });

  return category;
}

async function setCategoryActiveImpl(categoryId: string, active: boolean, actor: AuthContext) {
  const before = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!before) throw new ServiceError("Kategori tidak ditemukan.");
  await assertPeriodEditable(before.periodId);

  const category = await prisma.category.update({ where: { id: categoryId }, data: { active } });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: active ? "CATEGORY_ACTIVATE" : "CATEGORY_DEACTIVATE",
    entity: "Category",
    entityId: category.id,
    before,
    after: category,
  });

  return category;
}

export async function getCategoryDetail(categoryId: string) {
  return prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      period: true,
      objectType: true,
      groupRules: true,
      assignmentRules: true,
      instrumentVersions: {
        orderBy: { revision: "desc" },
        take: 1,
        include: { parameters: { orderBy: { order: "asc" } } },
      },
      categoryObjects: {
        orderBy: { createdAt: "asc" },
        include: { object: { include: { type: true } } },
      },
    },
  });
}

// Bab 8.2: menambah objek peserta dengan snapshot nama/unit saat ditetapkan.
async function addCategoryObjectsImpl(
  categoryId: string,
  objectIds: string[],
  actor: AuthContext,
  alasan?: string | null
) {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, include: { period: true } });
  if (!category) throw new ServiceError("Kategori tidak ditemukan.");
  const reason = periksaPenambahan(category.period, alasan, "Penambahan objek");

  if (objectIds.length === 0) throw new ServiceError("Pilih minimal satu objek.");

  const objects = await prisma.assessmentObject.findMany({
    where: { id: { in: objectIds } },
    include: { ownerUnit: true },
  });
  if (objects.length !== objectIds.length) {
    throw new ServiceError("Salah satu objek tidak ditemukan.");
  }
  const mismatched = objects.filter((o) => o.typeId !== category.objectTypeId);
  if (mismatched.length > 0) {
    throw new ServiceError("Semua objek harus berjenis sama dengan kategori.");
  }

  const existing = await prisma.categoryObject.findMany({
    where: { categoryId, objectId: { in: objectIds } },
    select: { objectId: true },
  });
  const existingIds = new Set(existing.map((e) => e.objectId));
  const toAdd = objects.filter((o) => !existingIds.has(o.id));
  if (toAdd.length === 0) {
    throw new ServiceError("Objek terpilih sudah menjadi peserta kategori ini.");
  }

  await prisma.categoryObject.createMany({
    data: toAdd.map((o) => ({
      categoryId,
      objectId: o.id,
      unitSnapshot: o.ownerUnit.name,
      ownerUnitIdSnapshot: o.ownerUnitId,
      nameSnapshot: o.name,
    })),
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "CATEGORY_OBJECTS_ADD",
    entity: "Category",
    entityId: categoryId,
    after: { added: toAdd.map((o) => o.name), periodStatus: category.period.status },
    reason: reason ?? undefined,
  });

  return toAdd.length;
}

async function removeCategoryObjectImpl(categoryObjectId: string, actor: AuthContext) {
  const before = await prisma.categoryObject.findUnique({
    where: { id: categoryObjectId },
    include: { category: true },
  });
  if (!before) throw new ServiceError("Data peserta tidak ditemukan.");
  await assertPeriodEditable(before.category.periodId);

  await prisma.categoryObject.delete({ where: { id: categoryObjectId } });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "CATEGORY_OBJECT_REMOVE",
    entity: "Category",
    entityId: before.categoryId,
    before,
  });
}

export async function createCategory(...args: Parameters<typeof createCategoryImpl>): Promise<Awaited<ReturnType<typeof createCategoryImpl>>> {
  return atomic(() => createCategoryImpl(...args));
}

export async function updateCategory(...args: Parameters<typeof updateCategoryImpl>): Promise<Awaited<ReturnType<typeof updateCategoryImpl>>> {
  return atomic(() => updateCategoryImpl(...args));
}

export async function setCategoryActive(...args: Parameters<typeof setCategoryActiveImpl>): Promise<Awaited<ReturnType<typeof setCategoryActiveImpl>>> {
  return atomic(() => setCategoryActiveImpl(...args));
}

export async function addCategoryObjects(...args: Parameters<typeof addCategoryObjectsImpl>): Promise<Awaited<ReturnType<typeof addCategoryObjectsImpl>>> {
  return atomic(() => addCategoryObjectsImpl(...args));
}

export async function removeCategoryObject(...args: Parameters<typeof removeCategoryObjectImpl>): Promise<Awaited<ReturnType<typeof removeCategoryObjectImpl>>> {
  return atomic(() => removeCategoryObjectImpl(...args));
}

/**
 * Membuat kategori baru dengan menyalin kategori yang sudah ada — dari periode mana pun.
 *
 * Menyiapkan kategori yang serupa (Dies tahun berikutnya, kategori sejenis antar-prodi) sebelumnya
 * berarti mengetik ulang pertanyaan, bobot, aturan kelompok, dan syarat calon satu per satu.
 * Yang ikut tersalin: instrumen (skala, panduan, seluruh parameter beserta bobot, urutan, dan
 * penanda nilai mentah), aturan kelompok (agregasi, target, minimum, parameter pembeda),
 * bobot nilai gabungan, syarat calon penilai, dan — bila diminta — daftar objek pesertanya.
 *
 * Yang SENGAJA tidak ikut: jawaban, penugasan, dan hasil perhitungan. Kategori baru selalu mulai
 * kosong, jenis objeknya mengikuti sumbernya (instrumen dan objek tidak masuk akal berpindah jenis).
 */
async function createCategoryFromImpl(
  periodId: string,
  sourceCategoryId: string,
  input: { name: string; code: string; description: string | null; includeObjects: boolean },
  actor: AuthContext
) {
  const source = await prisma.category.findUnique({
    where: { id: sourceCategoryId },
    include: {
      instrumentVersions: { orderBy: { revision: "desc" }, take: 1, include: { parameters: { orderBy: { order: "asc" } } } },
      groupRules: true,
      assignmentRules: true,
      categoryObjects: { include: { object: true } },
    },
  });
  if (!source) throw new ServiceError("Kategori sumber tidak ditemukan.");
  const sumberInstrumen = source.instrumentVersions[0];
  if (!sumberInstrumen || sumberInstrumen.parameters.length === 0) {
    throw new ServiceError("Kategori sumber belum memiliki parameter untuk disalin.");
  }

  const category = await createCategory(
    periodId,
    {
      code: input.code,
      name: input.name,
      description: input.description,
      objectTypeId: source.objectTypeId,
      excludeContributors: source.excludeContributors,
    },
    actor
  );

  const parameterIdMap = new Map<string, string>();
  await prisma.$transaction(async (tx) => {
    const instrumen = await tx.instrumentVersion.findFirstOrThrow({ where: { categoryId: category.id } });
    await tx.instrumentVersion.update({
      where: { id: instrumen.id },
      data: {
        scaleMin: sumberInstrumen.scaleMin,
        scaleMax: sumberInstrumen.scaleMax,
        scaleStep: sumberInstrumen.scaleStep,
        guide: sumberInstrumen.guide,
      },
    });
    for (const p of sumberInstrumen.parameters) {
      const baru = await tx.parameter.create({
        data: {
          instrumentVersionId: instrumen.id,
          name: p.name,
          indicator: p.indicator,
          weight: p.weight,
          order: p.order,
          normalized: p.normalized,
        },
      });
      parameterIdMap.set(p.id, baru.id);
    }

    for (const rule of source.groupRules) {
      // Parameter pembeda menunjuk parameter sumber; id-nya dipetakan ke parameter salinan.
      const pembeda = ((rule.tieBreakParameterIds as string[] | null) ?? [])
        .map((id) => parameterIdMap.get(id))
        .filter((id): id is string => !!id);
      await tx.groupRule.updateMany({
        where: { categoryId: category.id, group: rule.group },
        data: {
          aggregation: rule.aggregation,
          target: rule.target,
          minimum: rule.minimum,
          tieBreakParameterIds: pembeda,
        },
      });
    }

    for (const rule of source.assignmentRules) {
      const tujuan = await tx.assignmentRule.findFirstOrThrow({ where: { categoryId: category.id, group: rule.group } });
      await tx.assignmentRule.update({
        where: { id: tujuan.id },
        data: {
          scope: rule.scope,
          userTypeIds: rule.userTypeIds ?? [],
          revision: { increment: 1 },
        },
      });
    }

    await tx.category.update({ where: { id: category.id }, data: { pimpinanWeight: source.pimpinanWeight } });
  });

  let objekDisalin = 0;
  if (input.includeObjects) {
    // Objek yang sudah dinonaktifkan tidak ikut: ia tidak boleh dinilai lagi.
    const objectIds = source.categoryObjects.filter((co) => co.object.active).map((co) => co.objectId);
    if (objectIds.length > 0) {
      await addCategoryObjects(category.id, objectIds, actor);
      objekDisalin = objectIds.length;
    }
  }

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "CATEGORY_CREATE_FROM",
    entity: "Category",
    entityId: category.id,
    after: {
      sourceCategoryId,
      sourceName: source.name,
      parameters: sumberInstrumen.parameters.length,
      objects: objekDisalin,
    },
  });

  return { category, parameters: sumberInstrumen.parameters.length, objects: objekDisalin };
}

export async function createCategoryFrom(...args: Parameters<typeof createCategoryFromImpl>): Promise<Awaited<ReturnType<typeof createCategoryFromImpl>>> {
  return atomic(() => createCategoryFromImpl(...args));
}

/** Kategori yang layak dijadikan sumber salinan: instrumennya sudah berisi parameter. */
export async function listCategorySources() {
  const categories = await prisma.category.findMany({
    where: { active: true },
    include: {
      period: { select: { name: true } },
      objectType: { select: { name: true } },
      instrumentVersions: { orderBy: { revision: "desc" }, take: 1, include: { _count: { select: { parameters: true } } } },
      _count: { select: { categoryObjects: true } },
    },
    orderBy: [{ period: { startsAt: "desc" } }, { name: "asc" }],
  });
  return categories
    .filter((c) => (c.instrumentVersions[0]?._count.parameters ?? 0) > 0)
    .map((c) => ({
      id: c.id,
      label: `${c.period.name} · ${c.name}`,
      objectTypeName: c.objectType.name,
      parameterCount: c.instrumentVersions[0]._count.parameters,
      objectCount: c._count.categoryObjects,
    }));
}
