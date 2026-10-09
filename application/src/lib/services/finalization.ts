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

export type JenisRiwayat = "dibuat" | "siap" | "dibuka" | "ditutup" | "draf" | "final" | "revisi" | "koreksi-selesai" | "gagal-buka";

/**
 * Linimasa lengkap satu periode untuk halaman admin: dibuat, dinyatakan siap, pengisian dibuka dan
 * ditutup, difinalkan (beserta versi hasilnya), revisi dibuka (beserta alasannya), dan koreksi
 * diselesaikan. Diambil dari Audit — sumber yang memang mencatat semua peralihan itu — jadi tidak
 * perlu tabel baru. Terbaru di atas.
 */
export async function listRiwayatPeriode(periodId: string) {
  const finalisasi = await prisma.finalization.findMany({
    where: { periodId },
    include: { calculationRuns: { select: { id: true } } },
  });
  const petaFinal = new Map(finalisasi.map((f) => [f.id, f]));
  const versiTerbaru = Math.max(0, ...finalisasi.map((f) => f.revision));

  const kejadian = await prisma.auditEvent.findMany({
    where: {
      OR: [
        {
          entity: "Period",
          entityId: periodId,
          action: {
            in: [
              "PERIOD_CREATE",
              "PERIOD_STATUS_SIAP",
              "PERIOD_STATUS_AKTIF",
              "PERIOD_STATUS_DITUTUP",
              "PERIOD_STATUS_DRAF",
              "PERIOD_OPEN_REVISION",
              "PERIOD_SCHEDULED_OPEN_FAILED",
            ],
          },
        },
        { action: "PERIOD_FINALIZE", entityId: { in: finalisasi.map((f) => f.id) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, action: true, actorId: true, before: true, reason: true, createdAt: true, entityId: true },
  });
  const pelakuIds = [...new Set(kejadian.map((k) => k.actorId).filter((x): x is string => !!x))];
  const pelaku = new Map(
    (await prisma.user.findMany({ where: { id: { in: pelakuIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name])
  );
  const statusSebelum = (k: { before: unknown }) =>
    k.before && typeof k.before === "object" ? (k.before as { status?: string }).status : undefined;

  return kejadian.map((k) => {
    const oleh = k.actorId ? (pelaku.get(k.actorId) ?? "Pengguna terhapus") : "Sistem (otomatis)";
    const dasar = { id: k.id, waktu: k.createdAt, oleh, alasan: k.reason };
    switch (k.action) {
      case "PERIOD_CREATE":
        return { ...dasar, jenis: "dibuat" as JenisRiwayat, judul: "Periode dibuat" };
      case "PERIOD_STATUS_SIAP":
        return { ...dasar, jenis: "siap" as JenisRiwayat, judul: "Dinyatakan siap dibuka" };
      case "PERIOD_STATUS_AKTIF":
        return { ...dasar, jenis: "dibuka" as JenisRiwayat, judul: "Pengisian dibuka" };
      case "PERIOD_STATUS_DRAF":
        return { ...dasar, jenis: "draf" as JenisRiwayat, judul: "Dikembalikan ke Draf" };
      case "PERIOD_STATUS_DITUTUP":
        return statusSebelum(k) === "REVISI"
          ? { ...dasar, jenis: "koreksi-selesai" as JenisRiwayat, judul: "Koreksi diselesaikan" }
          : { ...dasar, jenis: "ditutup" as JenisRiwayat, judul: "Pengisian ditutup" };
      case "PERIOD_OPEN_REVISION":
        return { ...dasar, jenis: "revisi" as JenisRiwayat, judul: "Revisi dibuka" };
      case "PERIOD_SCHEDULED_OPEN_FAILED":
        return { ...dasar, jenis: "gagal-buka" as JenisRiwayat, judul: "Pembukaan terjadwal gagal" };
      default: {
        const f = k.entityId ? petaFinal.get(k.entityId) : undefined;
        return {
          ...dasar,
          jenis: "final" as JenisRiwayat,
          judul: f ? `Difinalkan — versi ${f.revision}` : "Difinalkan",
          alasan: f?.note ?? k.reason,
          finalisasi: f
            ? { id: f.id, versi: f.revision, kategori: f.calculationRuns.length, terkini: f.revision === versiTerbaru }
            : undefined,
        };
      }
    }
  });
}
