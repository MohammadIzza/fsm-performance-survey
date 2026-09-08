import { prisma } from "@/lib/prisma";

// Bab 21.2: "Angka progress harus memiliki definisi: respons terkirim berlaku dibagi tugas
// berlaku; tugas batal tidak menjadi denominator." Dihitung per periode aktif/ditutup/revisi
// (yang masih relevan dipantau), bukan seluruh riwayat periode selamanya.
export async function getMonitoringSummary() {
  const [assignmentsByStatus, openIssueCount, pendingCalcCount, failedCalcCount] = await Promise.all([
    prisma.assignment.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.assignmentIssue.count({ where: { status: "TERBUKA" } }),
    prisma.calculationRun.count({ where: { status: "BERJALAN" } }),
    prisma.calculationRun.count({ where: { status: "GAGAL" } }),
  ]);

  const totalAssignments = assignmentsByStatus.reduce((s, r) => s + r._count._all, 0);
  const cancelled = assignmentsByStatus.find((r) => r.status === "DIBATALKAN")?._count._all ?? 0;
  const submitted = assignmentsByStatus.find((r) => r.status === "TERKIRIM")?._count._all ?? 0;
  const validAssignments = totalAssignments - cancelled;
  const submissionRate = validAssignments > 0 ? (submitted / validAssignments) * 100 : 0;

  // Hanya dihitung dari run TERBARU per kategori (bukan seluruh riwayat run), agar angka tidak
  // dobel-hitung dari perhitungan lama yang sudah digantikan.
  const latestRunIdByCategory = await prisma.calculationRun.findMany({
    where: { status: "BERHASIL" },
    orderBy: { createdAt: "desc" },
    distinct: ["categoryId"],
    select: { id: true },
  });
  const belowMinimum = await prisma.objectGroupResult.findMany({
    where: {
      runId: { in: latestRunIdByCategory.map((r) => r.id) },
      eligibility: { in: ["BELUM_MEMENUHI_MINIMUM", "BELUM_ADA_PENILAIAN"] },
    },
    distinct: ["categoryObjectId"],
    select: { categoryObjectId: true },
  });

  return {
    assignmentsByStatus: assignmentsByStatus.map((r) => ({ status: r.status, count: r._count._all })),
    validAssignments,
    submitted,
    submissionRate,
    openIssueCount,
    pendingCalcCount,
    failedCalcCount,
    belowMinimumObjectCount: belowMinimum.length,
  };
}
