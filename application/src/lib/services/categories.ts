import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";
import { kodeUnikDariNama } from "@/lib/kode-otomatis";

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
  actor: AuthContext
) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new ServiceError("Kategori tidak ditemukan.");
  await assertPeriodEditable(category.periodId);

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
    after: { added: toAdd.map((o) => o.name) },
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
