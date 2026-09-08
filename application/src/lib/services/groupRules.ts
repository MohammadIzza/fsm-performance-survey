import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";
import type { AggregationMethod } from "@/generated/prisma/enums";

export interface GroupRuleInput {
  aggregation: AggregationMethod;
  target: number;
  minimum: number;
  expectedRevision?:number;
  tieBreakParameterIds?:string[];
}

// Bab 10.2/13.1: target & minimum per kelompok; Sistem tidak menurunkan minimum secara diam-diam,
// jadi di sini hanya validasi bentuk (bilangan bulat tak negatif, minimum ≤ target diperingatkan
// saat pemeriksaan kesiapan periode, bukan ditolak di sini agar admin bisa menetapkan bertahap).
async function updateGroupRuleImpl(
  groupRuleId: string,
  input: GroupRuleInput,
  actor: AuthContext
) {
  const before = await prisma.groupRule.findUnique({
    where: { id: groupRuleId },
    include: { category: { include: { period: true } } },
  });
  if (!before) throw new ServiceError("Aturan kelompok tidak ditemukan.");
  if (before.category.period.status !== "DRAF") {
    throw new ServiceError("Aturan kelompok hanya dapat diubah selama periode berstatus Draf.");
  }

  if (!Number.isInteger(input.target) || input.target < 0) {
    throw new ServiceError("Target penilai harus bilangan bulat tidak negatif.");
  }
  if (!Number.isInteger(input.minimum) || input.minimum < 1) {
    throw new ServiceError("Minimum respons harus bilangan bulat minimal 1.");
  }

  if(input.expectedRevision !== undefined && before.revision!==input.expectedRevision) throw new ServiceError("Data berubah sejak terakhir dibuka. Muat ulang sebelum menyimpan.");
  if(!["RATA_RATA","TOTAL"].includes(input.aggregation)) throw new ServiceError("Metode agregasi tidak valid.");
  if(input.tieBreakParameterIds?.length) {
    const valid = await prisma.parameter.count({where:{id:{in:input.tieBreakParameterIds},instrumentVersion:{categoryId:before.categoryId}}});
    if(valid!==input.tieBreakParameterIds.length) throw new ServiceError("Parameter pembeda tidak valid atau duplikat.");
  }
  const rule = await prisma.groupRule.update({
    where: { id: groupRuleId },
    data: {
      aggregation: input.aggregation,
      target: input.target,
      minimum: input.minimum,
      revision:{increment:1},
      tieBreakParameterIds:input.tieBreakParameterIds,
    },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "GROUP_RULE_UPDATE",
    entity: "GroupRule",
    entityId: rule.id,
    before,
    after: rule,
  });

  return rule;
}

export async function updateGroupRule(...args: Parameters<typeof updateGroupRuleImpl>): Promise<Awaited<ReturnType<typeof updateGroupRuleImpl>>> {
  return atomic(() => updateGroupRuleImpl(...args));
}
