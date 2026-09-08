import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";
import type { SystemRole } from "@/generated/prisma/enums";

// Bab 18.1: "Penetapan admin tunggal dijaga saat perubahan peran ... agar tidak menjadi nol
// admin aktif." Pencabutan peran Admin ditolak bila ini adalah satu-satunya Admin aktif, supaya
// fakultas tidak pernah kehilangan seluruh akses administratif.
async function grantRoleImpl(userId: string, role: SystemRole, actor: AuthContext) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ServiceError("Pengguna tidak ditemukan.");
  if (!user.active) throw new ServiceError("Pengguna nonaktif tidak dapat diberi peran sistem.");

  const existing = await prisma.roleGrant.findFirst({
    where: { userId, role, active: true },
  });
  if (existing) throw new ServiceError("Pengguna sudah memiliki peran ini.");

  if(role === "ADMIN") {
    await prisma.roleGrant.updateMany({where:{role:"ADMIN",active:true},data:{active:false}});
    await writeAudit({actorId:actor.userId,actorRole:"ADMIN",action:"ADMIN_TRANSFER",entity:"User",entityId:userId,reason:"Pemindahan admin tunggal melalui pengaturan peran"});
  }
  const grant = await prisma.roleGrant.create({ data: { userId, role } });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "ROLE_GRANT",
    entity: "RoleGrant",
    entityId: grant.id,
    after: grant,
  });

  return grant;
}

async function revokeRoleImpl(grantId: string, actor: AuthContext) {
  const before = await prisma.roleGrant.findUnique({ where: { id: grantId } });
  if (!before) throw new ServiceError("Data peran tidak ditemukan.");

  if (before.role === "ADMIN") {
    const otherActiveAdmins = await prisma.roleGrant.count({
      where: { role: "ADMIN", active: true, id: { not: grantId } },
    });
    if (otherActiveAdmins === 0) {
      throw new ServiceError(
        "Tidak dapat mencabut peran Admin terakhir. Tetapkan Admin lain terlebih dahulu."
      );
    }
  }

  const grant = await prisma.roleGrant.update({
    where: { id: grantId },
    data: { active: false },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "ROLE_REVOKE",
    entity: "RoleGrant",
    entityId: grant.id,
    before,
    after: grant,
  });

  return grant;
}

export async function grantRole(...args: Parameters<typeof grantRoleImpl>): Promise<Awaited<ReturnType<typeof grantRoleImpl>>> {
  return atomic(() => grantRoleImpl(...args));
}

export async function revokeRole(...args: Parameters<typeof revokeRoleImpl>): Promise<Awaited<ReturnType<typeof revokeRoleImpl>>> {
  return atomic(() => revokeRoleImpl(...args));
}
