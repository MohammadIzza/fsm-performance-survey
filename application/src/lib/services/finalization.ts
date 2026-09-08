import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import { calculateResults } from "@/lib/services/calculations";
import type { AuthContext } from "@/lib/authz";

export interface FinalizationWarning {
  categoryName: string;
  message: string;
}

export interface FinalizationPreview {
  ready: boolean; // false hanya bila ada BLOCKER keras (bukan sekadar warning)
  blockers: string[];
  warnings: FinalizationWarning[];
}

// Bab 14.1: checklist sebelum finalisasi. Sebagian besar item adalah PERINGATAN (admin tetap
// dapat melanjutkan, "Finalisasi tidak wajib menunggu 100% respons") — hanya status periode
// yang menjadi pemblokir keras (ditegakkan juga oleh state machine transitionPeriodStatus).
export async function getFinalizationPreview(periodId: string): Promise<FinalizationPreview> {
  const period = await prisma.period.findUnique({
    where: { id: periodId },
    include: {
      categories: {
        where: { active: true },
        include: {
          groupRules: true,
          categoryObjects: {
            include: {
              assignments: {
                where: { status: { not: "DIBATALKAN" } },
                include: { issues: { where: { status: "TERBUKA" } } },
              },
            },
          },
        },
      },
    },
  });

  const blockers: string[] = [];
  const warnings: FinalizationWarning[] = [];

  if (!period) {
    blockers.push("Periode tidak ditemukan.");
    return { ready: false, blockers, warnings };
  }
  if (period.status !== "DITUTUP") {
    blockers.push(`Periode harus berstatus Ditutup untuk difinalkan (saat ini: ${period.status}).`);
  }

  const pendingRuns = await prisma.calculationRun.count({
    where: { category: { periodId }, status: "BERJALAN" },
  });
  if (pendingRuns > 0) {
    blockers.push("Ada proses perhitungan yang masih berjalan. Tunggu hingga selesai.");
  }

  for (const cat of period.categories) {
    const allAssignments = cat.categoryObjects.flatMap((co) => co.assignments);
    const openIssues = allAssignments.reduce((s, a) => s + a.issues.length, 0);
    if (openIssues > 0) {
      blockers.push(`${cat.name}: ${openIssues} laporan masalah belum diberi disposisi.`);
    }

    for (const rule of cat.groupRules) {
      if (rule.target === 0) continue;
      // Perkiraan cepat: objek tanpa penugasan sama sekali pada kelompok ini.
      const assignedObjectIds = new Set(
        allAssignments.filter((a) => a.group === rule.group).map((a) => a.categoryObjectId)
      );
      const untouched = cat.categoryObjects.filter((co) => !assignedObjectIds.has(co.id)).length;
      if (untouched > 0) {
        warnings.push({
          categoryName: cat.name,
          message: `${untouched} objek belum memiliki penugasan sama sekali pada kelompok ${rule.group === "PIMPINAN" ? "Pimpinan" : "Selain Pimpinan"}.`,
        });
      }
    }
  }

  if (period.categories.length === 0) {
    warnings.push({ categoryName: "-", message: "Periode ini tidak memiliki kategori aktif." });
  }

  return { ready: blockers.length === 0, blockers, warnings };
}

// Bab 14.1/14.2/18: menetapkan hasil resmi berversi. Menjalankan perhitungan ulang untuk setiap
// kategori aktif agar snapshot final selalu mencerminkan respons berlaku TERKINI (bukan hasil
// lama yang mungkin sudah usang), lalu mematri seluruh CalculationRun tersebut ke Finalization ini.
async function finalizePeriodImpl(periodId: string, note: string | undefined, actor: AuthContext) {
  if (!actor.isAdmin || !actor.active) throw new ServiceError("Tidak berwenang.");
  if (!note?.trim()) throw new ServiceError("Pernyataan finalisasi wajib diisi.");
  const preview = await getFinalizationPreview(periodId);
  if (!preview.ready) {
    throw new ServiceError(`Belum dapat difinalkan:\n${preview.blockers.join("\n")}`);
  }

  const period = await prisma.period.findUniqueOrThrow({ where: { id: periodId } });
  const activeCategories = await prisma.category.findMany({ where: { periodId, active: true } });

  const priorFinal = await prisma.finalization.findFirst({
    where: { periodId },
    orderBy: { revision: "desc" },
  });

  const finalization = await prisma.finalization.create({
    data: {
      periodId,
      revision: (priorFinal?.revision ?? 0) + 1,
      finalizedById: actor.userId,
      note: note?.trim() || null,
      priorFinalId: priorFinal?.id ?? null,
    },
  });

  for (const cat of activeCategories) {
    const run = await calculateResults(cat.id, actor);
    await prisma.calculationRun.update({ where: { id: run.id }, data: { finalizationId: finalization.id } });
  }

  const updatedPeriod = await prisma.period.update({
    where: { id: periodId },
    data: { status: "FINAL", finalizedAt: new Date(), version: { increment: 1 } },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "PERIOD_FINALIZE",
    entity: "Finalization",
    entityId: finalization.id,
    before: { status: period.status },
    after: { status: "FINAL", revision: finalization.revision },
    reason: note,
  });

  return { finalization, period: updatedPeriod };
}

// Bab 14.3/UC-09: admin membuka revisi dari hasil final (atau langsung dari Ditutup sebelum
// pernah difinalkan). Finalization/CalculationRun yang ada TIDAK diubah — tetap dapat ditelusuri
// sebagai versi terdahulu; revisi berikutnya baru tercatat saat finalizePeriod dipanggil lagi.
async function openRevisionImpl(periodId: string, reason: string, actor: AuthContext) {
  if (!reason.trim()) throw new ServiceError("Alasan pembukaan revisi wajib diisi.");

  const period = await prisma.period.findUnique({ where: { id: periodId } });
  if (!period) throw new ServiceError("Periode tidak ditemukan.");
  if (period.status !== "DITUTUP" && period.status !== "FINAL") {
    throw new ServiceError("Revisi hanya dapat dibuka dari status Ditutup atau Final.");
  }

  const updated = await prisma.period.update({
    where: { id: periodId },
    data: { status: "REVISI", version: { increment: 1 } },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "PERIOD_OPEN_REVISION",
    entity: "Period",
    entityId: periodId,
    before: { status: period.status },
    after: { status: "REVISI" },
    reason,
  });

  return updated;
}

export async function listFinalizationHistory(periodId: string) {
  return prisma.finalization.findMany({
    where: { periodId },
    orderBy: { revision: "desc" },
    include: {
      finalizedBy: { select: { name: true } },
      calculationRuns: { select: { id: true, categoryId: true, category: { select: { name: true } } } },
    },
  });
}

export async function finalizePeriod(...args: Parameters<typeof finalizePeriodImpl>): Promise<Awaited<ReturnType<typeof finalizePeriodImpl>>> {
  return atomic(() => finalizePeriodImpl(...args));
}

export async function openRevision(...args: Parameters<typeof openRevisionImpl>): Promise<Awaited<ReturnType<typeof openRevisionImpl>>> {
  return atomic(() => openRevisionImpl(...args));
}
