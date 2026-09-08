import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";

export async function listObjectTypes() {
  return prisma.objectType.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
}

// Bab 8.1: "Jenis baru dapat dibuat admin dengan metadata dasar."
async function createObjectTypeImpl(input: { code: string; name: string }, actor: AuthContext) {
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!code) throw new ServiceError("Kode jenis objek wajib diisi.");
  if (!name) throw new ServiceError("Nama jenis objek wajib diisi.");

  const existing = await prisma.objectType.findUnique({ where: { code } });
  if (existing) throw new ServiceError("Kode jenis objek sudah dipakai.");

  const objectType = await prisma.objectType.create({ data: { code, name } });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "OBJECT_TYPE_CREATE",
    entity: "ObjectType",
    entityId: objectType.id,
    after: objectType,
  });

  return objectType;
}

export async function createObjectType(...args: Parameters<typeof createObjectTypeImpl>): Promise<Awaited<ReturnType<typeof createObjectTypeImpl>>> {
  return atomic(() => createObjectTypeImpl(...args));
}
