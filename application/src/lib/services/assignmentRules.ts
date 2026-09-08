import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";
import type { AssessmentGroup, AssignmentScope } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";

export interface AssignmentRuleInput {
  scope: AssignmentScope;
  userTypeIds: string[];
}

async function assertDraftCategory(categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { period: true },
  });
  if (!category) throw new ServiceError("Kategori tidak ditemukan.");
  if (category.period.status !== "DRAF") {
    throw new ServiceError("Aturan penugasan hanya dapat diubah selama periode berstatus Draf.");
  }
  return category;
}

// Bab 10.2: filter diterapkan sebelum pengacakan. Dipanggil otomatis (upsert) agar kategori
// baru selalu punya aturan default untuk kedua kelompok, konsisten dengan GroupRule (Bab 8.1).
export async function ensureAssignmentRules(categoryId: string) {
  for (const group of ["PIMPINAN", "SELAIN_PIMPINAN"] as AssessmentGroup[]) {
    await prisma.assignmentRule.upsert({
      where: { categoryId_group: { categoryId, group } },
      update: {},
      create: { categoryId, group },
    });
  }
}

async function updateAssignmentRuleImpl(
  ruleId: string,
  input: AssignmentRuleInput,
  actor: AuthContext
) {
  const before = await prisma.assignmentRule.findUnique({ where: { id: ruleId } });
  if (!before) throw new ServiceError("Aturan penugasan tidak ditemukan.");
  await assertDraftCategory(before.categoryId);

  if (input.userTypeIds.length > 0) {
    const count = await prisma.userType.count({ where: { id: { in: input.userTypeIds } } });
    if (count !== input.userTypeIds.length) {
      throw new ServiceError("Salah satu jenis pengguna tidak ditemukan.");
    }
  }

  const rule = await prisma.assignmentRule.update({
    where: { id: ruleId },
    data: {
      scope: input.scope,
      userTypeIds: input.userTypeIds.length > 0 ? input.userTypeIds : Prisma.JsonNull,
      revision: { increment: 1 },
    },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "ASSIGNMENT_RULE_UPDATE",
    entity: "AssignmentRule",
    entityId: rule.id,
    before,
    after: rule,
  });

  return rule;
}

export async function updateAssignmentRule(...args: Parameters<typeof updateAssignmentRuleImpl>): Promise<Awaited<ReturnType<typeof updateAssignmentRuleImpl>>> {
  return atomic(() => updateAssignmentRuleImpl(...args));
}
