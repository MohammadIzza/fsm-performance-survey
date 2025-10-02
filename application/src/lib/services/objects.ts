import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";

export interface ObjectInput {
  typeId: string;
  name: string;
  ownerUnitId: string;
  referenceUserId: string | null;
  referenceUnitId: string | null;
  responsibleUserId: string | null;
  url: string | null;
  description: string | null;
  contributorUserIds: string[];
}

export async function listObjects() {
  return prisma.assessmentObject.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      type: true,
      ownerUnit: true,
      referenceUser: { select: { name: true, loginIdentifier: true } },
      referenceUnit: { select: { name: true, code: true } },
      responsibleUser: { select: { name: true, loginIdentifier: true } },
      contributors: { include: { user: { select: { name: true, loginIdentifier: true } } } },
      _count: { select: { categoryObjects: true } },
    },
  });
}

async function validateInput(input: ObjectInput) {
  let name = input.name.trim();
  let ownerUnitId = input.ownerUnitId;

  const objectType = await prisma.objectType.findUnique({ where: { id: input.typeId } });
  if (!objectType) throw new ServiceError("Jenis objek tidak ditemukan.");

  // Bab 8.3: objek jenis Orang wajib merujuk pengguna terkait (dipakai mencegah menilai diri sendiri, DEF-17).
  // Nama dan unit pemiliknya sudah tercatat pada pengguna itu, jadi yang dikosongkan diambil dari sana —
  // unit utama pengguna menjadi unit snapshot objek (Bab 8.3).
  if (objectType.code === "ORANG") {
    if (!input.referenceUserId) {
      throw new ServiceError("Objek jenis Orang wajib merujuk pengguna terkait.");
    }
    const user = await prisma.user.findUnique({ where: { id: input.referenceUserId } });
    if (!user) throw new ServiceError("Pengguna terkait tidak ditemukan.");
    if (!name) name = user.name;
    if (!ownerUnitId && user.primaryUnitId) ownerUnitId = user.primaryUnitId;
    if (!ownerUnitId) {
      throw new ServiceError("Pengguna ini belum punya unit utama — pilih unit pemilik objeknya.");
    }
  }

  if (!name) throw new ServiceError("Nama objek wajib diisi.");
  if (!ownerUnitId) throw new ServiceError("Unit pemilik wajib dipilih.");
  const ownerUnit = await prisma.unit.findUnique({ where: { id: ownerUnitId } });
  if (!ownerUnit) throw new ServiceError("Unit pemilik tidak ditemukan.");

  if (objectType.code === "UNIT") {
    if (!input.referenceUnitId) {
      throw new ServiceError("Objek jenis Unit wajib merujuk unit yang dinilai.");
    }
    const unit = await prisma.unit.findUnique({ where: { id: input.referenceUnitId } });
    if (!unit) throw new ServiceError("Unit yang dinilai tidak ditemukan.");
  }

  if (input.responsibleUserId) {
    const responsible = await prisma.user.findUnique({ where: { id: input.responsibleUserId } });
    if (!responsible) throw new ServiceError("Penanggung jawab tidak ditemukan.");
  }

  return { name, ownerUnitId, objectType };
}

async function createObjectImpl(input: ObjectInput, actor: AuthContext) {
  const { name, ownerUnitId } = await validateInput(input);

  const object = await prisma.$transaction(async (tx) => {
    const obj = await tx.assessmentObject.create({
      data: {
        typeId: input.typeId,
        name,
        ownerUnitId,
        referenceUserId: input.referenceUserId,
        referenceUnitId: input.referenceUnitId,
        responsibleUserId: input.responsibleUserId,
        url: input.url?.trim() || null,
        description: input.description?.trim() || null,
      },
    });
    if (input.contributorUserIds.length > 0) {
      await tx.objectContributor.createMany({
        data: input.contributorUserIds.map((userId) => ({ objectId: obj.id, userId })),
        skipDuplicates: true,
      });
    }
    return obj;
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "OBJECT_CREATE",
    entity: "AssessmentObject",
    entityId: object.id,
    after: object,
  });

  return object;
}

async function updateObjectImpl(objectId: string, input: ObjectInput, actor: AuthContext) {
  const before = await prisma.assessmentObject.findUnique({
    where: { id: objectId },
    include: { contributors: true },
  });
  if (!before) throw new ServiceError("Objek tidak ditemukan.");

  const { name, ownerUnitId } = await validateInput(input);

  const object = await prisma.$transaction(async (tx) => {
    const obj = await tx.assessmentObject.update({
      where: { id: objectId },
      data: {
        typeId: input.typeId,
        name,
        ownerUnitId,
        referenceUserId: input.referenceUserId,
        referenceUnitId: input.referenceUnitId,
        responsibleUserId: input.responsibleUserId,
        url: input.url?.trim() || null,
        description: input.description?.trim() || null,
      },
    });
    await tx.objectContributor.deleteMany({ where: { objectId } });
    if (input.contributorUserIds.length > 0) {
      await tx.objectContributor.createMany({
        data: input.contributorUserIds.map((userId) => ({ objectId, userId })),
        skipDuplicates: true,
      });
    }
    return obj;
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "OBJECT_UPDATE",
    entity: "AssessmentObject",
    entityId: object.id,
    before,
    after: object,
  });

  return object;
}

async function setObjectActiveImpl(objectId: string, active: boolean, actor: AuthContext) {
  const before = await prisma.assessmentObject.findUnique({ where: { id: objectId } });
  if (!before) throw new ServiceError("Objek tidak ditemukan.");

  const object = await prisma.assessmentObject.update({ where: { id: objectId }, data: { active } });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: active ? "OBJECT_ACTIVATE" : "OBJECT_DEACTIVATE",
    entity: "AssessmentObject",
    entityId: object.id,
    before,
    after: object,
  });

  return object;
}

export async function createObject(...args: Parameters<typeof createObjectImpl>): Promise<Awaited<ReturnType<typeof createObjectImpl>>> {
  return atomic(() => createObjectImpl(...args));
}

export async function updateObject(...args: Parameters<typeof updateObjectImpl>): Promise<Awaited<ReturnType<typeof updateObjectImpl>>> {
  return atomic(() => updateObjectImpl(...args));
}

export async function setObjectActive(...args: Parameters<typeof setObjectActiveImpl>): Promise<Awaited<ReturnType<typeof setObjectActiveImpl>>> {
  return atomic(() => setObjectActiveImpl(...args));
}
