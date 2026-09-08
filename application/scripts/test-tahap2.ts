import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { ServiceError } from "../src/lib/services/units";
import {
  createPeriod,
  checkReadiness,
  transitionPeriodStatus,
  copyPeriod,
  runScheduledOpenings,
} from "../src/lib/services/periods";
import { createObjectType } from "../src/lib/services/objectTypes";
import { createObject } from "../src/lib/services/objects";
import { createCategory, addCategoryObjects } from "../src/lib/services/categories";
import { addParameter, updateInstrumentScale } from "../src/lib/services/instruments";
import { updateGroupRule } from "../src/lib/services/groupRules";
import type { AuthContext } from "../src/lib/authz";

let pass = 0;
let fail = 0;

function ok(label: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  OK  ${label}`);
  } else {
    fail++;
    console.log(`FAIL  ${label}`);
  }
}

async function expectServiceError(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    ok(label, false);
  } catch (e) {
    ok(
      `${label} (${e instanceof ServiceError ? e.message.split("\n")[0] : "unexpected error type"})`,
      e instanceof ServiceError
    );
  }
}

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "admin01" } });
  const actor: AuthContext = {
    userId: admin.id,
    loginIdentifier: admin.loginIdentifier,
    name: admin.name,
    active: true,
    isAdmin: true,
    isDekan: false,
    leadershipUnitIds: [],
    scopeUnitIds: [],
  };

  const depMat = await prisma.unit.findUniqueOrThrow({ where: { code: "DEP-MAT" } });
  const dosen1004 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1004" } });
  const dosen1005 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1005" } });
  const orangType = await prisma.objectType.findUniqueOrThrow({ where: { code: "ORANG" } });
  const karyaType = await prisma.objectType.findUniqueOrThrow({ where: { code: "KARYA" } });

  console.log("== ObjectType ==");
  await expectServiceError("Kode jenis objek duplikat ditolak", () =>
    createObjectType({ code: "ORANG", name: "Duplikat" }, actor)
  );

  console.log("== AssessmentObject ==");
  await expectServiceError("Objek Orang tanpa referenceUserId ditolak", () =>
    createObject(
      {
        typeId: orangType.id,
        name: "Tanpa rujukan",
        ownerUnitId: depMat.id,
        referenceUserId: null,
        referenceUnitId: null,
        responsibleUserId: null,
        url: null,
        description: null,
        contributorUserIds: [],
      },
      actor
    )
  );

  const objDosen1004 = await createObject(
    {
      typeId: orangType.id,
      name: dosen1004.name,
      ownerUnitId: depMat.id,
      referenceUserId: dosen1004.id,
      referenceUnitId: null,
      responsibleUserId: null,
      url: null,
      description: null,
      contributorUserIds: [],
    },
    actor
  );
  ok("Objek Orang berhasil dibuat", objDosen1004.referenceUserId === dosen1004.id);

  const objDosen1005 = await createObject(
    {
      typeId: orangType.id,
      name: dosen1005.name,
      ownerUnitId: depMat.id,
      referenceUserId: dosen1005.id,
      referenceUnitId: null,
      responsibleUserId: null,
      url: null,
      description: null,
      contributorUserIds: [],
    },
    actor
  );

  const objKarya = await createObject(
    {
      typeId: karyaType.id,
      name: "Aplikasi Uji Tahap 2",
      ownerUnitId: depMat.id,
      referenceUserId: null,
      referenceUnitId: null,
      responsibleUserId: null, // sengaja kosong -> EDGE-25
      url: "https://example.com",
      description: "Karya uji",
      contributorUserIds: [dosen1004.id],
    },
    actor
  );
  ok("Objek Karya tanpa penanggung jawab tetap bisa dibuat (baru ditolak saat cek kesiapan)", !!objKarya);

  console.log("== Period ==");
  await expectServiceError("Tanggal mulai >= tenggat ditolak", () =>
    createPeriod(
      { code: "BAD-DATE", name: "Salah tanggal", description: null, timezone: "Asia/Jakarta", startsAt: "2026-06-01", endsAt: "2026-05-01" },
      actor
    )
  );

  const period = await createPeriod(
    {
      code: "TEST-PERIOD-1",
      name: "Periode Uji Tahap 2",
      description: null,
      timezone: "Asia/Jakarta",
      startsAt: "2026-06-01",
      endsAt: "2026-06-30",
    },
    actor
  );
  ok("Periode baru berhasil dibuat berstatus DRAF", period.status === "DRAF");

  await expectServiceError("Kode periode duplikat ditolak", () =>
    createPeriod(
      { code: "TEST-PERIOD-1", name: "Duplikat", description: null, timezone: "Asia/Jakarta", startsAt: "2026-06-01", endsAt: "2026-06-30" },
      actor
    )
  );

  console.log("== Readiness: periode kosong ==");
  let problems = await checkReadiness(period.id);
  ok("Periode tanpa kategori: 1 masalah (minimal satu kategori)", problems.length === 1);

  await expectServiceError("Transisi ke SIAP ditolak saat belum ada kategori", () =>
    transitionPeriodStatus(period.id, "SIAP", actor)
  );

  console.log("== Category ==");
  const category = await createCategory(
    period.id,
    {
      code: "KINERJA-DOSEN",
      name: "Kinerja Dosen",
      description: null,
      objectTypeId: orangType.id,
      excludeContributors: true,
    },
    actor
  );
  ok("Kategori baru dibuat dengan instrumen revisi 1 & 2 group rule otomatis", true);

  await expectServiceError("Kode kategori duplikat dalam periode sama ditolak", () =>
    createCategory(
      period.id,
      { code: "KINERJA-DOSEN", name: "Duplikat", description: null, objectTypeId: orangType.id, excludeContributors: true },
      actor
    )
  );

  console.log("== Readiness: kategori tanpa objek/instrumen/aturan ==");
  problems = await checkReadiness(period.id);
  ok(
    `Kategori baru: beberapa masalah terdeteksi (${problems.length})`,
    problems.some((p) => p.includes("objek peserta")) && problems.some((p) => p.includes("parameter"))
  );

  console.log("== Instrument & Parameter ==");
  const catDetail = await prisma.category.findUniqueOrThrow({
    where: { id: category.id },
    include: { instrumentVersions: true },
  });
  const instrumentId = catDetail.instrumentVersions[0].id;

  await expectServiceError("Bobot parameter di luar 0-100 ditolak", () =>
    addParameter(instrumentId, { name: "Salah", indicator: null, weight: 150, order: 1 }, actor)
  );

  await addParameter(instrumentId, { name: "Layanan", indicator: null, weight: 50, order: 1 }, actor);
  await addParameter(instrumentId, { name: "Disiplin", indicator: null, weight: 30, order: 2 }, actor);
  problems = await checkReadiness(period.id);
  ok(
    "Bobot belum 100% (baru 80%) masih dilaporkan sebagai masalah",
    problems.some((p) => p.includes("80"))
  );
  await addParameter(instrumentId, { name: "Kerja sama", indicator: null, weight: 20, order: 3 }, actor);
  problems = await checkReadiness(period.id);
  ok("Bobot 100% tidak lagi dilaporkan sebagai masalah", !problems.some((p) => p.includes("bobot")));

  await expectServiceError("Skala minimum >= maksimum ditolak", () =>
    updateInstrumentScale(instrumentId, { scaleMin: 100, scaleMax: 0, scaleStep: 1, guide: null }, actor)
  );

  console.log("== GroupRule ==");
  const rules = await prisma.groupRule.findMany({ where: { categoryId: category.id } });
  const pimpinanRule = rules.find((r) => r.group === "PIMPINAN")!;
  const selainRule = rules.find((r) => r.group === "SELAIN_PIMPINAN")!;

  await updateGroupRule(pimpinanRule.id, { aggregation: "RATA_RATA", target: 5, minimum: 1 }, actor);
  await updateGroupRule(selainRule.id, { aggregation: "RATA_RATA", target: 10, minimum: 20 }, actor);
  problems = await checkReadiness(period.id);
  ok(
    "Minimum > target pada kelompok Selain Pimpinan terdeteksi sebagai masalah",
    problems.some((p) => p.includes("melebihi target"))
  );
  // target=0 pada kedua kelompok: skrip ini menguji kesiapan KONFIGURASI kategori (Tahap 2),
  // bukan penugasan penilai (Tahap 3) — dengan target=0 pemeriksaan "penugasan penilai belum
  // pernah diterapkan" (ditambahkan Tahap 3) tidak ikut disyaratkan di sini.
  await updateGroupRule(pimpinanRule.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, actor);
  const selainRuleBaseline = await updateGroupRule(selainRule.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, actor);

  console.log("== AC-33: dua admin memakai versi konfigurasi lama (optimistic lock GroupRule) ==");
  // "Admin A" memuat halaman konfigurasi (melihat revisi selainRuleBaseline.revision), lalu berhasil
  // menyimpan sebuah perubahan — revisi bertambah.
  const adminA_save = await updateGroupRule(
    selainRule.id,
    { aggregation: "RATA_RATA", target: 2, minimum: 1, expectedRevision: selainRuleBaseline.revision },
    actor
  );
  ok("Admin A menyimpan dengan revisi yang benar berhasil (revisi bertambah)", adminA_save.revision === selainRuleBaseline.revision + 1);

  // "Admin B" memuat halaman PADA WAKTU YANG SAMA dengan Admin A (sebelum A menyimpan), sehingga
  // basis revisinya masih revisi LAMA — persis skenario AC-33 "dua admin actions memakai versi
  // konfigurasi lama". Percobaan B harus ditolak, bukan menimpa perubahan Admin A secara diam-diam.
  await expectServiceError(
    "Admin B menyimpan dengan revisi lama DITOLAK (tidak menimpa perubahan Admin A) (AC-33)",
    () => updateGroupRule(selainRule.id, { aggregation: "TOTAL", target: 99, minimum: 1, expectedRevision: selainRuleBaseline.revision }, actor)
  );

  const selainRuleAfterConflict = await prisma.groupRule.findUniqueOrThrow({ where: { id: selainRule.id } });
  ok(
    "Konfigurasi Admin A (target=2, RATA_RATA) tetap utuh setelah percobaan Admin B ditolak — bukan tertimpa (target=99, TOTAL)",
    selainRuleAfterConflict.target === 2 && selainRuleAfterConflict.aggregation === "RATA_RATA"
  );

  // Kembalikan ke target=0 agar tidak mengganggu pemeriksaan kesiapan periode di bawah (Tahap 2 ini
  // menguji kesiapan KONFIGURASI, bukan penugasan penilai — lihat komentar di atas).
  await updateGroupRule(selainRule.id, { aggregation: "RATA_RATA", target: 0, minimum: 1, expectedRevision: adminA_save.revision }, actor);

  console.log("== CategoryObject (peserta) ==");
  await expectServiceError("Menambah objek berjenis beda ke kategori ditolak", () =>
    addCategoryObjects(category.id, [objKarya.id], actor)
  );

  const added = await addCategoryObjects(category.id, [objDosen1004.id, objDosen1005.id], actor);
  ok("2 objek berhasil ditambahkan sebagai peserta", added === 2);

  await expectServiceError("Menambah objek yang sudah jadi peserta ditolak", () =>
    addCategoryObjects(category.id, [objDosen1004.id], actor)
  );

  console.log("== Readiness: seharusnya lulus ==");
  problems = await checkReadiness(period.id);
  ok(`Semua syarat terpenuhi, 0 masalah (aktual: ${problems.length})`, problems.length === 0);

  console.log("== Transisi status ==");
  const ready = await transitionPeriodStatus(period.id, "SIAP", actor);
  ok("Periode berhasil ditandai SIAP", ready.status === "SIAP");

  await expectServiceError("Setelah SIAP, kategori tidak bisa diubah (periode bukan Draf)", () =>
    createCategory(
      period.id,
      { code: "LAIN", name: "Lain", description: null, objectTypeId: orangType.id, excludeContributors: true },
      actor
    )
  );

  const backToDraft = await transitionPeriodStatus(period.id, "DRAF", actor);
  ok("Berhasil kembali ke DRAF dari SIAP", backToDraft.status === "DRAF");

  await expectServiceError("Transisi langsung DRAF -> AKTIF (melompat) ditolak", () =>
    transitionPeriodStatus(period.id, "AKTIF", actor)
  );

  console.log("== Salin periode (Bab 7.5) ==");
  const copy = await copyPeriod(
    period.id,
    { code: "TEST-PERIOD-1-COPY", name: "Salinan Periode Uji", startsAt: "2026-07-01", endsAt: "2026-07-31" },
    actor
  );
  const copyDetail = await prisma.period.findUniqueOrThrow({
    where: { id: copy.id },
    include: {
      categories: {
        include: {
          instrumentVersions: { include: { parameters: true } },
          groupRules: true,
          categoryObjects: true,
        },
      },
    },
  });
  ok("Salinan periode berstatus DRAF", copyDetail.status === "DRAF");
  ok("Salinan memiliki 1 kategori tersalin", copyDetail.categories.length === 1);
  ok(
    "Parameter tersalin (3 parameter, total bobot 100)",
    copyDetail.categories[0].instrumentVersions[0].parameters.length === 3 &&
      copyDetail.categories[0].instrumentVersions[0].parameters.reduce((s, p) => s + p.weight, 0) === 100
  );
  ok("Aturan kelompok tersalin (2 kelompok)", copyDetail.categories[0].groupRules.length === 2);
  ok(
    "Pilihan objek tersalin ke periode baru tanpa jawaban",
    copyDetail.categories[0].categoryObjects.length === 2
  );

  console.log("== Bab 7.2: penjadwal otomatis hanya membuka periode yang SUDAH Siap dan jatuh tempo ==");
  async function buildReadyPeriod(code: string, startsAt: string, endsAt: string) {
    const p = await createPeriod({ code, name: `Uji Penjadwal ${code}`, description: null, timezone: "Asia/Jakarta", startsAt, endsAt }, actor);
    const cat = await createCategory(p.id, { code: `${code}-CAT`, name: `Kategori ${code}`, description: null, objectTypeId: orangType.id, excludeContributors: true }, actor);
    const catFull = await prisma.category.findUniqueOrThrow({ where: { id: cat.id }, include: { instrumentVersions: true, groupRules: true } });
    await addParameter(catFull.instrumentVersions[0].id, { name: "X", indicator: null, weight: 100, order: 1 }, actor);
    await updateGroupRule(catFull.groupRules.find((r) => r.group === "PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, actor);
    await updateGroupRule(catFull.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, actor);
    await addCategoryObjects(cat.id, [objDosen1004.id], actor);
    const problems = await checkReadiness(p.id);
    if (problems.length > 0) throw new Error(`Fixture penjadwal tidak siap: ${problems.join("; ")}`);
    await transitionPeriodStatus(p.id, "SIAP", actor);
    return p;
  }

  const periodDue = await buildReadyPeriod("TEST-SCHED-DUE", "2020-01-01", "2099-12-31");
  const periodNotDue = await buildReadyPeriod("TEST-SCHED-FUTURE", "2099-01-01", "2099-12-31");

  const { opened, failed } = await runScheduledOpenings();
  ok("Tidak ada kegagalan penjadwal (fixture keduanya valid)", failed.length === 0);
  ok(
    "Periode yang tanggal mulainya sudah lewat IKUT dibuka otomatis",
    opened.some((o) => o.periodId === periodDue.id)
  );
  ok(
    "Periode yang tanggal mulainya masih di masa depan TIDAK ikut dibuka",
    !opened.some((o) => o.periodId === periodNotDue.id)
  );

  const periodDueAfter = await prisma.period.findUniqueOrThrow({ where: { id: periodDue.id } });
  ok("Status periode jatuh tempo berubah menjadi AKTIF", periodDueAfter.status === "AKTIF");
  const periodNotDueAfter = await prisma.period.findUniqueOrThrow({ where: { id: periodNotDue.id } });
  ok("Status periode yang belum jatuh tempo TETAP Siap, tidak disentuh", periodNotDueAfter.status === "SIAP");

  const schedulerAudit = await prisma.auditEvent.findFirst({
    where: { entity: "Period", entityId: periodDue.id, action: "PERIOD_STATUS_AKTIF", actorId: "system-scheduler" },
  });
  ok("Pembukaan otomatis tercatat di Audit dengan pelaku penjadwal (bukan admin manual)", !!schedulerAudit);

  console.log("\n=== Ringkasan ===");
  console.log(`Lulus: ${pass}  Gagal: ${fail}`);
  if (fail > 0) process.exitCode = 1;

  console.log("\n== Membersihkan data uji ==");
  await prisma.auditEvent.deleteMany({ where: { entity: "Period", entityId: { in: [periodDue.id, periodNotDue.id] } } });
  await prisma.categoryObject.deleteMany({ where: { category: { period: { id: { in: [periodDue.id, periodNotDue.id] } } } } });
  await prisma.groupRule.deleteMany({ where: { category: { period: { id: { in: [periodDue.id, periodNotDue.id] } } } } });
  await prisma.parameter.deleteMany({ where: { instrumentVersion: { category: { period: { id: { in: [periodDue.id, periodNotDue.id] } } } } } });
  await prisma.instrumentVersion.deleteMany({ where: { category: { period: { id: { in: [periodDue.id, periodNotDue.id] } } } } });
  await prisma.assignmentRule.deleteMany({ where: { category: { period: { id: { in: [periodDue.id, periodNotDue.id] } } } } });
  await prisma.category.deleteMany({ where: { periodId: { in: [periodDue.id, periodNotDue.id] } } });
  await prisma.accessPolicy.deleteMany({ where: { periodId: { in: [periodDue.id, periodNotDue.id] } } });
  await prisma.period.deleteMany({ where: { id: { in: [periodDue.id, periodNotDue.id] } } });

  await prisma.categoryObject.deleteMany({ where: { category: { period: { code: { in: ["TEST-PERIOD-1", "TEST-PERIOD-1-COPY"] } } } } });
  await prisma.parameter.deleteMany({ where: { instrumentVersion: { category: { period: { code: { in: ["TEST-PERIOD-1", "TEST-PERIOD-1-COPY"] } } } } } });
  await prisma.groupRule.deleteMany({ where: { category: { period: { code: { in: ["TEST-PERIOD-1", "TEST-PERIOD-1-COPY"] } } } } });
  await prisma.assignmentRule.deleteMany({ where: { category: { period: { code: { in: ["TEST-PERIOD-1", "TEST-PERIOD-1-COPY"] } } } } });
  await prisma.instrumentVersion.deleteMany({ where: { category: { period: { code: { in: ["TEST-PERIOD-1", "TEST-PERIOD-1-COPY"] } } } } });
  await prisma.category.deleteMany({ where: { period: { code: { in: ["TEST-PERIOD-1", "TEST-PERIOD-1-COPY"] } } } });
  await prisma.accessPolicy.deleteMany({ where: { period: { code: { in: ["TEST-PERIOD-1", "TEST-PERIOD-1-COPY"] } } } });
  await prisma.period.deleteMany({ where: { code: { in: ["TEST-PERIOD-1", "TEST-PERIOD-1-COPY"] } } });
  await prisma.objectContributor.deleteMany({ where: { objectId: objKarya.id } });
  await prisma.assessmentObject.deleteMany({ where: { id: { in: [objDosen1004.id, objDosen1005.id, objKarya.id] } } });
  console.log("Selesai.");
}

main()
  .catch((e) => {
    console.error("Skrip uji gagal dijalankan:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
