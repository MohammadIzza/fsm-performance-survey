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

// ---------------------------------------------------------------------------------------------
// Pemantauan per periode (halaman /admin/pemantauan).
//
// Ringkasan fakultas di atas mencampur semua periode dan hanya berisi angka, sehingga admin tidak
// tahu siapa yang perlu diingatkan atau objek mana yang perlu ditambah penilainya. Fungsi ini
// menjawab pertanyaan itu untuk SATU periode: seberapa jauh pengisiannya, per kategori, siapa yang
// belum mengisi, dan objek mana yang belum cukup dinilai untuk masuk peringkat.

const BELUM_SELESAI = ["BELUM_MULAI", "DRAF", "DIBUKA_KEMBALI"] as const;

export async function listMonitorablePeriods() {
  const periods = await prisma.period.findMany({
    where: { status: { not: "DRAF" } },
    select: { id: true, name: true, status: true, endsAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const tugas = await prisma.assignment.groupBy({
    by: ["categoryObjectId"],
    where: { status: { not: "DIBATALKAN" } },
    _count: { _all: true },
  });
  const coKePeriode = new Map(
    (await prisma.categoryObject.findMany({ select: { id: true, category: { select: { periodId: true } } } })).map((c) => [c.id, c.category.periodId])
  );
  const jumlahTugas = new Map<string, number>();
  for (const t of tugas) {
    const pid = coKePeriode.get(t.categoryObjectId);
    if (pid) jumlahTugas.set(pid, (jumlahTugas.get(pid) ?? 0) + t._count._all);
  }
  // Yang sedang berjalan lebih dulu; di antara yang setara, periode dengan tugas terbanyak (periode
  // utama, bukan periode percobaan kecil), lalu yang terbaru.
  const bobot = (s: string) => (s === "AKTIF" ? 0 : s === "REVISI" ? 1 : s === "DITUTUP" ? 2 : s === "SIAP" ? 3 : 4);
  return periods.sort(
    (a, b) =>
      bobot(a.status) - bobot(b.status) ||
      (jumlahTugas.get(b.id) ?? 0) - (jumlahTugas.get(a.id) ?? 0) ||
      b.createdAt.getTime() - a.createdAt.getTime()
  );
}

export async function getPeriodMonitoring(periodId: string) {
  const period = await prisma.period.findUnique({
    where: { id: periodId },
    select: { id: true, name: true, status: true, startsAt: true, endsAt: true },
  });
  if (!period) return null;

  const [categories, assignments, issues, runs] = await Promise.all([
    prisma.category.findMany({
      where: { periodId, active: true },
      select: {
        id: true,
        name: true,
        objectType: { select: { name: true } },
        groupRules: { select: { group: true, target: true, minimum: true } },
        categoryObjects: { select: { id: true, nameSnapshot: true, unitSnapshot: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.assignment.findMany({
      where: { status: { not: "DIBATALKAN" }, categoryObject: { category: { periodId, active: true } } },
      select: {
        status: true,
        group: true,
        categoryObjectId: true,
        categoryObject: { select: { categoryId: true } },
        evaluator: {
          select: { id: true, name: true, loginIdentifier: true, active: true, primaryUnit: { select: { name: true } } },
        },
      },
    }),
    prisma.assignmentIssue.findMany({
      where: { status: "TERBUKA", assignment: { categoryObject: { category: { periodId } } } },
      select: {
        id: true,
        type: true,
        detail: true,
        createdAt: true,
        assignmentId: true,
        reporter: { select: { name: true } },
        assignment: { select: { categoryObject: { select: { nameSnapshot: true, category: { select: { name: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.calculationRun.findMany({
      where: { category: { periodId } },
      select: { categoryId: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const total = assignments.length;
  const hitung = (s: string) => assignments.filter((a) => a.status === s).length;
  const terkirim = hitung("TERKIRIM");

  // Per objek + kelompok: berapa ditugaskan dan berapa sudah mengirim.
  const perSlot = new Map<string, { ditugaskan: number; terkirim: number }>();
  for (const a of assignments) {
    const k = `${a.categoryObjectId}|${a.group}`;
    const v = perSlot.get(k) ?? { ditugaskan: 0, terkirim: 0 };
    v.ditugaskan++;
    if (a.status === "TERKIRIM") v.terkirim++;
    perSlot.set(k, v);
  }

  // Satu baris per objek; tiap kelompok penilai yang belum memenuhi minimum dicantumkan di dalamnya.
  const objekKurang: {
    categoryId: string;
    kategori: string;
    objek: string;
    unit: string;
    kelompok: { kelompok: "PIMPINAN" | "SELAIN_PIMPINAN"; minimum: number; terkirim: number; ditugaskan: number }[];
  }[] = [];

  const kategori = categories.map((c) => {
    const milik = assignments.filter((a) => a.categoryObject.categoryId === c.id);
    let kurang = 0;
    for (const co of c.categoryObjects) {
      const kelompokKurang = [];
      for (const rule of [...c.groupRules].sort((a) => (a.group === "PIMPINAN" ? -1 : 1))) {
        // Kelompok bertarget 0 memang tidak dipakai kategori ini — tidak perlu dipantau.
        if (rule.target === 0) continue;
        const slot = perSlot.get(`${co.id}|${rule.group}`) ?? { ditugaskan: 0, terkirim: 0 };
        if (slot.terkirim < rule.minimum) {
          kelompokKurang.push({ kelompok: rule.group, minimum: rule.minimum, terkirim: slot.terkirim, ditugaskan: slot.ditugaskan });
        }
      }
      if (kelompokKurang.length) {
        kurang++;
        objekKurang.push({ categoryId: c.id, kategori: c.name, objek: co.nameSnapshot, unit: co.unitSnapshot, kelompok: kelompokKurang });
      }
    }
    const runTerakhir = runs.find((r) => r.categoryId === c.id);
    return {
      id: c.id,
      nama: c.name,
      jenis: c.objectType.name,
      objek: c.categoryObjects.length,
      tugas: milik.length,
      terkirim: milik.filter((a) => a.status === "TERKIRIM").length,
      objekKurang: kurang,
      perhitunganGagal: runTerakhir?.status === "GAGAL",
    };
  });

  // Penilai yang masih punya tugas belum dikirim.
  const perPenilai = new Map<
    string,
    { id: string; nama: string; login: string; unit: string | null; aktif: boolean; belumMulai: number; draf: number; terkirim: number }
  >();
  for (const a of assignments) {
    const e = a.evaluator;
    const v = perPenilai.get(e.id) ?? {
      id: e.id,
      nama: e.name,
      login: e.loginIdentifier,
      unit: e.primaryUnit?.name ?? null,
      aktif: e.active,
      belumMulai: 0,
      draf: 0,
      terkirim: 0,
    };
    if (a.status === "TERKIRIM") v.terkirim++;
    else if (a.status === "DRAF") v.draf++;
    else if ((BELUM_SELESAI as readonly string[]).includes(a.status)) v.belumMulai++;
    perPenilai.set(e.id, v);
  }
  const semuaPenilai = [...perPenilai.values()];
  const penilaiBelum = semuaPenilai
    .filter((p) => p.belumMulai + p.draf > 0)
    .sort((a, b) => b.belumMulai + b.draf - (a.belumMulai + a.draf) || a.nama.localeCompare(b.nama, "id"));

  // Yang penilainya kurang ditugaskan (butuh tindakan admin) lebih dulu, lalu menurut nama.
  const perluPenilai = (o: (typeof objekKurang)[number]) => (o.kelompok.some((k) => k.ditugaskan < k.minimum) ? 0 : 1);
  objekKurang.sort((a, b) => perluPenilai(a) - perluPenilai(b) || a.kategori.localeCompare(b.kategori, "id") || a.objek.localeCompare(b.objek, "id"));

  return {
    period,
    total,
    terkirim,
    draf: hitung("DRAF"),
    belumMulai: hitung("BELUM_MULAI"),
    dibukaKembali: hitung("DIBUKA_KEMBALI"),
    persen: total > 0 ? (terkirim / total) * 100 : 0,
    jumlahPenilai: semuaPenilai.length,
    penilaiSelesai: semuaPenilai.length - penilaiBelum.length,
    penilaiBelum,
    kategori,
    objekKurang,
    laporanTerbuka: issues.map((i) => ({
      id: i.id,
      jenis: i.type,
      detail: i.detail,
      dibuat: i.createdAt,
      assignmentId: i.assignmentId,
      pelapor: i.reporter.name,
      objek: i.assignment.categoryObject.nameSnapshot,
      kategori: i.assignment.categoryObject.category.name,
    })),
    perhitunganGagal: kategori.filter((k) => k.perhitunganGagal).map((k) => k.nama),
    perhitunganMacet: runs.filter((r) => r.status === "BERJALAN").length,
  };
}
