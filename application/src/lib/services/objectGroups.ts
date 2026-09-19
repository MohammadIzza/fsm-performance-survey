import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";

/**
 * Kelompok objek: sekumpulan objek bernama yang sering dipakai bersama — mis. "Finalis Got Talent
 * 2026" atau "Video Promosi Prodi S1". Anggotanya boleh lintas unit dan lintas jenis objek.
 *
 * Gunanya semata mempercepat penyusunan peserta kategori: memilih objek yang tersebar di banyak
 * unit sebelumnya berarti mencentangnya satu per satu setiap kali kategori serupa dibuat, karena
 * penyaring yang ada hanya "semua objek dari satu unit". Kelompok TIDAK ikut ke perhitungan, tidak
 * menggantikan unit pemilik objek, dan tidak memengaruhi siapa yang boleh menilai.
 */

export interface ObjectGroupInput {
  name: string;
  description: string | null;
  objectIds: string[];
}

function bersihkan(input: ObjectGroupInput) {
  const name = input.name.trim();
  if (!name) throw new ServiceError("Nama kelompok wajib diisi.");
  return { name, description: input.description?.trim() || null, objectIds: [...new Set(input.objectIds)] };
}

async function pastikanObjekAda(objectIds: string[]) {
  if (objectIds.length === 0) return;
  const ada = await prisma.assessmentObject.count({ where: { id: { in: objectIds } } });
  if (ada !== objectIds.length) throw new ServiceError("Sebagian objek tidak ditemukan.");
}

export async function listObjectGroups() {
  const groups = await prisma.objectGroup.findMany({
    orderBy: { name: "asc" },
    include: {
      members: {
        include: { object: { include: { type: true, ownerUnit: true } } },
        orderBy: { object: { name: "asc" } },
      },
    },
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    members: g.members.map((m) => ({
      id: m.object.id,
      name: m.object.name,
      typeName: m.object.type.name,
      typeId: m.object.typeId,
      unitName: m.object.ownerUnit.name,
      active: m.object.active,
    })),
  }));
}

async function createObjectGroupImpl(input: ObjectGroupInput, actor: AuthContext) {
  const { name, description, objectIds } = bersihkan(input);
  if (await prisma.objectGroup.findUnique({ where: { name } })) {
    throw new ServiceError("Nama kelompok sudah dipakai.");
  }
  await pastikanObjekAda(objectIds);
  const group = await prisma.objectGroup.create({
    data: { name, description, members: { create: objectIds.map((objectId) => ({ objectId })) } },
  });
  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "OBJECT_GROUP_CREATE",
    entity: "ObjectGroup",
    entityId: group.id,
    after: { name, anggota: objectIds.length },
  });
  return group;
}

async function updateObjectGroupImpl(groupId: string, input: ObjectGroupInput, actor: AuthContext) {
  const before = await prisma.objectGroup.findUnique({ where: { id: groupId }, include: { members: true } });
  if (!before) throw new ServiceError("Kelompok objek tidak ditemukan.");
  const { name, description, objectIds } = bersihkan(input);
  const bentrok = await prisma.objectGroup.findUnique({ where: { name } });
  if (bentrok && bentrok.id !== groupId) throw new ServiceError("Nama kelompok sudah dipakai.");
  await pastikanObjekAda(objectIds);

  const group = await prisma.$transaction(async (tx) => {
    await tx.objectGroupMember.deleteMany({ where: { groupId, objectId: { notIn: objectIds.length ? objectIds : ["-"] } } });
    for (const objectId of objectIds) {
      await tx.objectGroupMember.upsert({
        where: { groupId_objectId: { groupId, objectId } },
        update: {},
        create: { groupId, objectId },
      });
    }
    return tx.objectGroup.update({ where: { id: groupId }, data: { name, description } });
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "OBJECT_GROUP_UPDATE",
    entity: "ObjectGroup",
    entityId: groupId,
    before: { name: before.name, anggota: before.members.length },
    after: { name, anggota: objectIds.length },
  });
  return group;
}

async function deleteObjectGroupImpl(groupId: string, actor: AuthContext) {
  const before = await prisma.objectGroup.findUnique({ where: { id: groupId }, include: { members: true } });
  if (!before) throw new ServiceError("Kelompok objek tidak ditemukan.");
  // Aman dihapus kapan saja: kelompok hanya pintasan memilih, tidak dirujuk hasil mana pun.
  await prisma.objectGroup.delete({ where: { id: groupId } });
  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "OBJECT_GROUP_DELETE",
    entity: "ObjectGroup",
    entityId: groupId,
    before: { name: before.name, anggota: before.members.length },
  });
}

export async function createObjectGroup(...args: Parameters<typeof createObjectGroupImpl>): Promise<Awaited<ReturnType<typeof createObjectGroupImpl>>> {
  return atomic(() => createObjectGroupImpl(...args));
}
export async function updateObjectGroup(...args: Parameters<typeof updateObjectGroupImpl>): Promise<Awaited<ReturnType<typeof updateObjectGroupImpl>>> {
  return atomic(() => updateObjectGroupImpl(...args));
}
export async function deleteObjectGroup(...args: Parameters<typeof deleteObjectGroupImpl>): Promise<Awaited<ReturnType<typeof deleteObjectGroupImpl>>> {
  return atomic(() => deleteObjectGroupImpl(...args));
}
