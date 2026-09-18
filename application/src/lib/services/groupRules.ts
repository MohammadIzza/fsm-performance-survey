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

/**
 * Bobot nilai gabungan antar-kelompok: Pimpinan mendapat `pimpinanWeight`%, Selain Pimpinan
 * sisanya; null = kedua kelompok diperingkat terpisah tanpa nilai gabungan.
 *
 * Berbeda dari aturan kelompok, bobot ini boleh diubah sampai periode ditutup: ia tidak
 * menyentuh jawaban maupun siapa yang menilai, hanya cara kedua nilai kelompok digabung. Setelah
 * ditutup bobot dikunci, karena hasil sedang diperiksa dan difinalkan. Perhitungan berikutnya
 * memakai bobot baru (kategori yang berubah memicu hitung ulang otomatis), sedangkan run lama
 * tetap memakai bobot yang dipatri di snapshot-nya.
 */
async function updateCombinedWeightImpl(categoryId: string, pimpinanWeight: number | null, actor: AuthContext) {
  const before = await prisma.category.findUnique({ where: { id: categoryId }, include: { period: true } });
  if (!before) throw new ServiceError("Kategori tidak ditemukan.");
  if (!["DRAF", "SIAP", "AKTIF"].includes(before.period.status)) {
    throw new ServiceError("Bobot nilai gabungan hanya dapat diubah sebelum periode ditutup.");
  }
  if (pimpinanWeight !== null && (!Number.isInteger(pimpinanWeight) || pimpinanWeight < 1 || pimpinanWeight > 99)) {
    throw new ServiceError("Bobot Pimpinan harus bilangan bulat antara 1 dan 99 persen.");
  }
  const category = await prisma.category.update({ where: { id: categoryId }, data: { pimpinanWeight } });
  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "CATEGORY_COMBINED_WEIGHT_UPDATE",
    entity: "Category",
    entityId: categoryId,
    before: { pimpinanWeight: before.pimpinanWeight },
    after: { pimpinanWeight: category.pimpinanWeight },
  });
  return category;
}

export async function updateCombinedWeight(...args: Parameters<typeof updateCombinedWeightImpl>): Promise<Awaited<ReturnType<typeof updateCombinedWeightImpl>>> {
  return atomic(() => updateCombinedWeightImpl(...args));
}
