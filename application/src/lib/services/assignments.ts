import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";
import type { AssessmentGroup } from "@/generated/prisma/enums";
import { periksaPenambahan } from "@/lib/services/penambahan-berjalan";

export async function listAssignmentsForCategory(categoryId: string) {
  return prisma.assignment.findMany({
    where: { categoryObject: { categoryId } },
    include: {
      evaluator: { select: { name: true, loginIdentifier: true } },
      categoryObject: { select: { nameSnapshot: true } },
      batch: { select: { createdAt: true, seed: true } },
    },
    orderBy: [{ categoryObjectId: "asc" }, { group: "asc" }, { createdAt: "asc" }],
  });
}

// Bab 10.5 "Pengganti manual": admin memilih langsung pengguna sah untuk mengisi kekurangan.
// Aturan inti (aktif, larangan menilai diri sendiri, pengecualian pembuat karya, tidak duplikat)
// tetap ditegakkan; keanggotaan pool otomatis (unit/jabatan) sengaja tidak disyaratkan di sini
// karena tujuan jalur ini justru mengatasi kekurangan pada pool otomatis tersebut.
export async function manualAssignEvaluator(
  input: { categoryObjectId: string; group: AssessmentGroup; evaluatorId: string; reason?: string | null },
  actor: AuthContext
) {
  const categoryObject = await prisma.categoryObject.findUnique({
    where: { id: input.categoryObjectId },
    include: {
      category: {
        include: {
          period: true,
          instrumentVersions: { orderBy: { revision: "desc" }, take: 1 },
        },
      },
      object: { include: { contributors: true } },
    },
  });
  if (!categoryObject) throw new ServiceError("Objek peserta tidak ditemukan.");
  const alasan = periksaPenambahan(categoryObject.category.period, input.reason, "Penugasan manual");
  const instrumentVersion = categoryObject.category.instrumentVersions[0];
  if (!instrumentVersion) throw new ServiceError("Kategori belum memiliki versi instrumen.");

  const evaluator = await prisma.user.findUnique({ where: { id: input.evaluatorId } });
  if (!evaluator) throw new ServiceError("Pengguna tidak ditemukan.");
  if (!evaluator.active) throw new ServiceError("Pengguna nonaktif tidak dapat ditugaskan.");

  if (
    categoryObject.object.referenceUserId &&
    categoryObject.object.referenceUserId === input.evaluatorId
  ) {
    throw new ServiceError("Pengguna tidak dapat menilai dirinya sendiri.");
  }
  if (
    categoryObject.category.excludeContributors &&
    categoryObject.object.contributors.some((c) => c.userId === input.evaluatorId)
  ) {
    throw new ServiceError("Pengguna adalah anggota pembuat objek ini dan dikecualikan sebagai penilai.");
  }

  const existing = await prisma.assignment.findUnique({
    where: {
      categoryObjectId_evaluatorId: {
        categoryObjectId: input.categoryObjectId,
        evaluatorId: input.evaluatorId,
      },
    },
  });

  let assignment;
  if (existing) {
    if (existing.status !== "DIBATALKAN") {
      throw new ServiceError("Pengguna ini sudah memiliki tugas pada objek tersebut.");
    }
    assignment = await prisma.assignment.update({
      where: { id: existing.id },
      data: {
        status: "BELUM_MULAI",
        group: input.group,
        instrumentVersionId: instrumentVersion.id,
        reason: alasan ? `Pengganti manual saat periode berjalan: ${alasan}` : "Pengganti manual",
        cancelledAt: null,
        cancelReason: null,
      },
    });
  } else {
    assignment = await prisma.assignment.create({
      data: {
        categoryObjectId: input.categoryObjectId,
        evaluatorId: input.evaluatorId,
        group: input.group,
        instrumentVersionId: instrumentVersion.id,
        evaluatorNameSnapshot: evaluator.name,
        evaluatorLoginSnapshot: evaluator.loginIdentifier,
        reason: alasan ? `Pengganti manual saat periode berjalan: ${alasan}` : "Pengganti manual",
      },
    });
  }

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "ASSIGNMENT_MANUAL_CREATE",
    entity: "Assignment",
    entityId: assignment.id,
    after: assignment,
    reason: alasan ?? undefined,
  });

  return assignment;
}

// Bab 10.6: tugas belum dikirim dapat dibatalkan; riwayat tetap tersimpan (tidak dihapus).
async function cancelAssignmentImpl(assignmentId: string, reason: string, actor: AuthContext) {
  const before = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!before) throw new ServiceError("Tugas tidak ditemukan.");
  if (before.status === "DIBATALKAN") {
    throw new ServiceError("Tugas ini sudah dibatalkan sebelumnya.");
  }
  if (before.status === "TERKIRIM") {
    throw new ServiceError("Tugas yang sudah terkirim tidak dapat dibatalkan langsung dari sini.");
  }
  if (!reason.trim()) {
    throw new ServiceError("Alasan pembatalan wajib diisi.");
  }

  const assignment = await prisma.assignment.update({
    where: { id: assignmentId },
    data: { status: "DIBATALKAN", cancelledAt: new Date(), cancelReason: reason.trim() },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "ASSIGNMENT_CANCEL",
    entity: "Assignment",
    entityId: assignment.id,
    before,
    after: assignment,
    reason,
  });

  return assignment;
}

export async function cancelAssignment(...args: Parameters<typeof cancelAssignmentImpl>): Promise<Awaited<ReturnType<typeof cancelAssignmentImpl>>> {
  return atomic(() => cancelAssignmentImpl(...args));
}
