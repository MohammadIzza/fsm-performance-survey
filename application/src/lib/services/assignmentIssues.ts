import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";
import type { IssueStatus, IssueType } from "@/generated/prisma/enums";

// Bab 11.6: laporan bukan jawaban survei dan tidak membebaskan kewajiban sebelum admin bertindak.
async function reportIssueImpl(
  assignmentId: string,
  type: IssueType,
  detail: string,
  actor: AuthContext
) {
  if (!detail.trim()) throw new ServiceError("Keterangan wajib diisi.");

  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new ServiceError("Tugas tidak ditemukan.");
  if (assignment.evaluatorId !== actor.userId) {
    throw new ServiceError("Tugas ini bukan milik Anda.");
  }

  const issue = await prisma.assignmentIssue.create({
    data: { assignmentId, reporterId: actor.userId, type, detail: detail.trim() },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "PENGGUNA",
    action: "ISSUE_REPORT",
    entity: "AssignmentIssue",
    entityId: issue.id,
    after: issue,
  });

  return issue;
}

export async function listAllIssues() {
  return prisma.assignmentIssue.findMany({
    include: {
      assignment: {
        include: {
          categoryObject: {
            include: { category: { include: { period: true } } },
          },
          evaluator: { select: { name: true, loginIdentifier: true } },
        },
      },
      reporter: { select: { name: true } },
      resolvedBy: { select: { name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

// Bab 11.6: admin dapat mempertahankan tugas dengan penjelasan, memperbaiki data, mengganti
// penilai, atau membatalkan tugas — tindakan itu sendiri memakai aksi admin yang sudah ada
// (Tahap 3); fungsi ini mencatat keputusan/status penanganan laporannya.
async function resolveIssueImpl(
  issueId: string,
  input: { status: IssueStatus; resolution: string },
  actor: AuthContext
) {
  const before = await prisma.assignmentIssue.findUnique({ where: { id: issueId } });
  if (!before) throw new ServiceError("Laporan tidak ditemukan.");

  const issue = await prisma.assignmentIssue.update({
    where: { id: issueId },
    data: {
      status: input.status,
      resolution: input.resolution.trim() || null,
      resolvedById: input.status !== "TERBUKA" ? actor.userId : null,
      resolvedAt: input.status !== "TERBUKA" ? new Date() : null,
    },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "ISSUE_RESOLVE",
    entity: "AssignmentIssue",
    entityId: issue.id,
    before,
    after: issue,
  });

  return issue;
}

export async function reportIssue(...args: Parameters<typeof reportIssueImpl>): Promise<Awaited<ReturnType<typeof reportIssueImpl>>> {
  return atomic(() => reportIssueImpl(...args));
}

export async function resolveIssue(...args: Parameters<typeof resolveIssueImpl>): Promise<Awaited<ReturnType<typeof resolveIssueImpl>>> {
  return atomic(() => resolveIssueImpl(...args));
}
