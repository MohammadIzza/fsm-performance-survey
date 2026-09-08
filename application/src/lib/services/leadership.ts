import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";

export interface LeadershipInput {
  userId: string;
  unitId: string;
  title: string;
  effectiveFrom: string; // yyyy-mm-dd dari <input type="date">
}

// ORG-05: satu atau lebih pimpinan dapat ditetapkan dengan masa aktif.
async function assignLeadershipImpl(input: LeadershipInput, actor: AuthContext) {
  const title = input.title.trim();
  if (!title) throw new ServiceError("Nama jabatan wajib diisi.");
  if (!input.userId) throw new ServiceError("Pengguna wajib dipilih.");
  if (!input.unitId) throw new ServiceError("Unit wajib dipilih.");

  const [user, unit] = await Promise.all([
    prisma.user.findUnique({ where: { id: input.userId } }),
    prisma.unit.findUnique({ where: { id: input.unitId } }),
  ]);
  if (!user) throw new ServiceError("Pengguna tidak ditemukan.");
  if (!user.active) throw new ServiceError("Pengguna nonaktif tidak dapat ditetapkan sebagai pimpinan.");
  if (!unit) throw new ServiceError("Unit tidak ditemukan.");

  const effectiveFrom = new Date(input.effectiveFrom || Date.now());
  if (Number.isNaN(effectiveFrom.getTime())) {
    throw new ServiceError("Tanggal mulai tidak valid.");
  }

  const leadership = await prisma.leadership.create({
    data: {
      userId: input.userId,
      unitId: input.unitId,
      title,
      effectiveFrom,
    },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "LEADERSHIP_ASSIGN",
    entity: "Leadership",
    entityId: leadership.id,
    after: leadership,
  });

  return leadership;
}

// Mengakhiri masa jabatan (bukan hapus) agar riwayat tetap tertelusuri (Bab 5.3, 21.1).
export async function endLeadership(leadershipId: string, actor: AuthContext, reason?: string) {
  const before = await prisma.leadership.findUnique({ where: { id: leadershipId } });
  if (!before) throw new ServiceError("Data kepemimpinan tidak ditemukan.");

  const now = new Date();
  const leadership = await prisma.leadership.update({
    where: { id: leadershipId },
    data: { effectiveTo: now },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "LEADERSHIP_END",
    entity: "Leadership",
    entityId: leadership.id,
    before,
    after: leadership,
    reason,
  });

  return leadership;
}

export async function assignLeadership(...args: Parameters<typeof assignLeadershipImpl>): Promise<Awaited<ReturnType<typeof assignLeadershipImpl>>> {
  return atomic(() => assignLeadershipImpl(...args));
}
