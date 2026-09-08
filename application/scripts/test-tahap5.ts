import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { ServiceError } from "../src/lib/services/units";
import { createPeriod } from "../src/lib/services/periods";
import { createCategory, addCategoryObjects } from "../src/lib/services/categories";
import { addParameter } from "../src/lib/services/instruments";
import { updateGroupRule } from "../src/lib/services/groupRules";
import { createObject } from "../src/lib/services/objects";
import { calculateResults, getLatestRun, getGroupDetailBulk } from "../src/lib/services/calculations";
import { getRanking, filterRankingByScope } from "../src/lib/services/rankings";
import { getPeriodScope } from "../src/lib/authz";
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

function approxEqual(a: number | null, b: number, eps = 0.01): boolean {
  return a !== null && Math.abs(a - b) < eps;
}

function actorFor(user: { id: string; loginIdentifier: string; name: string }, isAdmin = false, isDekan = false, leadershipUnitIds: string[] = [], scopeUnitIds: string[] = []): AuthContext {
  return {
    userId: user.id,
    loginIdentifier: user.loginIdentifier,
    name: user.name,
    active: true,
    isAdmin,
    isDekan,
    leadershipUnitIds,
    scopeUnitIds,
  };
}

// Membuat 1 assignment + 1 respons SUBMITTED langsung di DB (melewati Tahap 3/4 penuh)
// karena skrip ini menguji lapisan PERHITUNGAN, bukan alur pengacakan/pengisian yang sudah
// diuji tersendiri di test-tahap3.ts/test-tahap4.ts.
async function submitDirectResponse(
  categoryObjectId: string,
  evaluatorId: string,
  group: "PIMPINAN" | "SELAIN_PIMPINAN",
  instrumentVersionId: string,
  scores: Record<string, number>
) {
  const assignment = await prisma.assignment.create({
    data: { categoryObjectId, evaluatorId, group, instrumentVersionId, status: "TERKIRIM" },
  });
  const rev = await prisma.responseRevision.create({
    data: { assignmentId: assignment.id, revision: 1, state: "SUBMITTED", submittedAt: new Date(), editedById: evaluatorId },
  });
  for (const [parameterId, score] of Object.entries(scores)) {
    await prisma.responseScore.create({ data: { responseRevisionId: rev.id, parameterId, score } });
  }
  return assignment;
}

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "admin01" } });
  const adminActor = actorFor(admin, true);

  const depMat = await prisma.unit.findUniqueOrThrow({ where: { code: "DEP-MAT" } });
  const psMat = await prisma.unit.findUniqueOrThrow({ where: { code: "PS-MAT" } });
  const psStat = await prisma.unit.findUniqueOrThrow({ where: { code: "PS-STAT" } });
  const psFis = await prisma.unit.findUniqueOrThrow({ where: { code: "PS-FIS" } });
  const orangType = await prisma.objectType.findUniqueOrThrow({ where: { code: "ORANG" } });

  // 6 penilai berbeda dipakai sebagai "pengisi" murni (bukan objek dinilai) agar tidak
  // melanggar constraint unik assignment (objek+penilai) dan larangan menilai diri sendiri.
  const p1 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1001" } });
  const p2 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1002" } });
  const s1 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1005" } });
  const s2 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1006" } });
  const s3 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1007" } });
  const objectRefUser = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1004" } });

  console.log("== Fixture Bab 12.4: Layanan 50%, Disiplin 30%, Kerja sama 20% ==");
  const period = await createPeriod(
    { code: "TEST-T5-1", name: "Uji Tahap 5", description: null, timezone: "Asia/Jakarta", startsAt: "2020-01-01", endsAt: "2099-12-31" },
    adminActor
  );
  const category = await createCategory(
    period.id,
    { code: "FIXTURE-T5", name: "Fixture Bab 12.4", description: null, objectTypeId: orangType.id, excludeContributors: true },
    adminActor
  );
  const catFull = await prisma.category.findUniqueOrThrow({
    where: { id: category.id },
    include: { instrumentVersions: true, groupRules: true },
  });
  const instrumentId = catFull.instrumentVersions[0].id;
  const pLayanan = await addParameter(instrumentId, { name: "Layanan", indicator: null, weight: 50, order: 1 }, adminActor);
  const pDisiplin = await addParameter(instrumentId, { name: "Disiplin", indicator: null, weight: 30, order: 2 }, adminActor);
  const pKerjaSama = await addParameter(instrumentId, { name: "Kerja sama", indicator: null, weight: 20, order: 3 }, adminActor);

  const pimpinanRule = catFull.groupRules.find((r) => r.group === "PIMPINAN")!;
  const selainRule = catFull.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
  await updateGroupRule(pimpinanRule.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, adminActor);
  await updateGroupRule(selainRule.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, adminActor);

  const obj = await createObject(
    { typeId: orangType.id, name: objectRefUser.name, ownerUnitId: depMat.id, referenceUserId: objectRefUser.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    adminActor
  );
  await addCategoryObjects(category.id, [obj.id], adminActor);
  const categoryObject = await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: category.id } });

  // Pimpinan 1: 80,90,85 · Pimpinan 2: 100,80,95
  await submitDirectResponse(categoryObject.id, p1.id, "PIMPINAN", instrumentId, { [pLayanan.id]: 80, [pDisiplin.id]: 90, [pKerjaSama.id]: 85 });
  await submitDirectResponse(categoryObject.id, p2.id, "PIMPINAN", instrumentId, { [pLayanan.id]: 100, [pDisiplin.id]: 80, [pKerjaSama.id]: 95 });
  // Staf 1: 70,80,90 · Staf 2: 90,100,80 · Staf 3: 80,90,85
  await submitDirectResponse(categoryObject.id, s1.id, "SELAIN_PIMPINAN", instrumentId, { [pLayanan.id]: 70, [pDisiplin.id]: 80, [pKerjaSama.id]: 90 });
  await submitDirectResponse(categoryObject.id, s2.id, "SELAIN_PIMPINAN", instrumentId, { [pLayanan.id]: 90, [pDisiplin.id]: 100, [pKerjaSama.id]: 80 });
  await submitDirectResponse(categoryObject.id, s3.id, "SELAIN_PIMPINAN", instrumentId, { [pLayanan.id]: 80, [pDisiplin.id]: 90, [pKerjaSama.id]: 85 });

  await calculateResults(category.id, adminActor);
  const run1 = await getLatestRun(category.id);
  ok("CalculationRun tersimpan berstatus BERHASIL", run1?.status === "BERHASIL");

  const bulkPimpinan = await getGroupDetailBulk(category.id, "PIMPINAN");
  const bulkSelain = await getGroupDetailBulk(category.id, "SELAIN_PIMPINAN");
  const resultPimpinan = bulkPimpinan?.byObject.get(categoryObject.id)?.result;
  const resultSelain = bulkSelain?.byObject.get(categoryObject.id)?.result;

  console.log("== AC-14: rata-rata → Pimpinan 88,5; Selain Pimpinan 84 ==");
  ok(`Nilai akhir Pimpinan = 88.5 (aktual: ${resultPimpinan?.score})`, approxEqual(resultPimpinan?.score ?? null, 88.5));
  ok(`Nilai akhir Selain Pimpinan = 84 (aktual: ${resultSelain?.score})`, approxEqual(resultSelain?.score ?? null, 84));
  ok("responseCount Pimpinan = 2", resultPimpinan?.responseCount === 2);
  ok("responseCount Selain Pimpinan = 3", resultSelain?.responseCount === 3);
  ok("Kedua kelompok MEMENUHI_SYARAT (minimum=1)", resultPimpinan?.eligibility === "MEMENUHI_SYARAT" && resultSelain?.eligibility === "MEMENUHI_SYARAT");

  console.log("== AC-15: metode total → Pimpinan 177; Selain Pimpinan 252 ==");
  await updateGroupRule(pimpinanRule.id, { aggregation: "TOTAL", target: 0, minimum: 1 }, adminActor);
  await updateGroupRule(selainRule.id, { aggregation: "TOTAL", target: 0, minimum: 1 }, adminActor);
  await calculateResults(category.id, adminActor);
  const bulkPimpinanTotal = await getGroupDetailBulk(category.id, "PIMPINAN");
  const bulkSelainTotal = await getGroupDetailBulk(category.id, "SELAIN_PIMPINAN");
  const resultPimpinanTotal = bulkPimpinanTotal?.byObject.get(categoryObject.id)?.result;
  const resultSelainTotal = bulkSelainTotal?.byObject.get(categoryObject.id)?.result;
  ok(`Nilai akhir Pimpinan (total) = 177 (aktual: ${resultPimpinanTotal?.score})`, approxEqual(resultPimpinanTotal?.score ?? null, 177));
  ok(`Nilai akhir Selain Pimpinan (total) = 252 (aktual: ${resultSelainTotal?.score})`, approxEqual(resultSelainTotal?.score ?? null, 252));

  // kembalikan ke rata-rata untuk pengujian berikutnya
  await updateGroupRule(pimpinanRule.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, adminActor);
  await updateGroupRule(selainRule.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, adminActor);

  console.log("== AC-16: objek tanpa respons sama sekali → null, bukan 0 ==");
  const objNoResponse = await createObject(
    { typeId: orangType.id, name: "Objek Tanpa Respons", ownerUnitId: depMat.id, referenceUserId: s3.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    adminActor
  );
  await addCategoryObjects(category.id, [objNoResponse.id], adminActor);
  await calculateResults(category.id, adminActor);
  const bulkAfterEmpty = await getGroupDetailBulk(category.id, "PIMPINAN");
  const coNoResponse = await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: category.id, objectId: objNoResponse.id } });
  const emptyResult = bulkAfterEmpty?.byObject.get(coNoResponse.id)?.result;
  ok("score null untuk objek tanpa respons (bukan 0)", emptyResult?.score === null);
  ok("eligibility BELUM_ADA_PENILAIAN", emptyResult?.eligibility === "BELUM_ADA_PENILAIAN");

  console.log("== AC-17: minimum 5, masuk 3 → rekap ada, ranking belum layak ==");
  await updateGroupRule(selainRule.id, { aggregation: "RATA_RATA", target: 0, minimum: 5 }, adminActor);
  await calculateResults(category.id, adminActor);
  const rankingAfterMin = await getRanking({ categoryId: category.id, group: "SELAIN_PIMPINAN" });
  const mainEntry = rankingAfterMin.find((e) => e.categoryObjectId === categoryObject.id);
  ok("Entri tetap muncul di rekap (bukan hilang)", !!mainEntry);
  ok("eligibility BELUM_MEMENUHI_MINIMUM", mainEntry?.eligibility === "BELUM_MEMENUHI_MINIMUM");
  ok("rank null (tidak diperingkat)", mainEntry?.rank === null);
  ok("score tetap ditampilkan (84) meski tidak diperingkat", approxEqual(mainEntry?.score ?? null, 84));
  await updateGroupRule(selainRule.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, adminActor);

  console.log("== AC-18: dua nilai sama → peringkat kompetisi (1,2,2,4) ==");
  const objTie1 = await createObject(
    { typeId: orangType.id, name: "Objek Seri A", ownerUnitId: depMat.id, referenceUserId: s2.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    adminActor
  );
  const objTie2 = await createObject(
    { typeId: orangType.id, name: "Objek Seri B", ownerUnitId: depMat.id, referenceUserId: s3.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    adminActor
  );
  await addCategoryObjects(category.id, [objTie1.id, objTie2.id], adminActor);
  const coTie1 = await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: category.id, objectId: objTie1.id } });
  const coTie2 = await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: category.id, objectId: objTie2.id } });
  // Keduanya diberi skor identik 84 (sama seperti objek utama) pada kelompok Selain Pimpinan.
  await submitDirectResponse(coTie1.id, s1.id, "SELAIN_PIMPINAN", instrumentId, { [pLayanan.id]: 70, [pDisiplin.id]: 80, [pKerjaSama.id]: 90 });
  await submitDirectResponse(coTie1.id, s2.id, "SELAIN_PIMPINAN", instrumentId, { [pLayanan.id]: 90, [pDisiplin.id]: 100, [pKerjaSama.id]: 80 });
  await submitDirectResponse(coTie1.id, s3.id, "SELAIN_PIMPINAN", instrumentId, { [pLayanan.id]: 80, [pDisiplin.id]: 90, [pKerjaSama.id]: 85 });
  await submitDirectResponse(coTie2.id, s1.id, "SELAIN_PIMPINAN", instrumentId, { [pLayanan.id]: 70, [pDisiplin.id]: 80, [pKerjaSama.id]: 90 });
  await submitDirectResponse(coTie2.id, s2.id, "SELAIN_PIMPINAN", instrumentId, { [pLayanan.id]: 90, [pDisiplin.id]: 100, [pKerjaSama.id]: 80 });
  await submitDirectResponse(coTie2.id, s3.id, "SELAIN_PIMPINAN", instrumentId, { [pLayanan.id]: 80, [pDisiplin.id]: 90, [pKerjaSama.id]: 85 });
  // Objek keempat dengan skor lebih rendah, untuk memverifikasi peringkat "melompat" ke 4.
  const objLower = await createObject(
    { typeId: orangType.id, name: "Objek Nilai Rendah", ownerUnitId: depMat.id, referenceUserId: p1.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    adminActor
  );
  await addCategoryObjects(category.id, [objLower.id], adminActor);
  const coLower = await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: category.id, objectId: objLower.id } });
  await submitDirectResponse(coLower.id, s1.id, "SELAIN_PIMPINAN", instrumentId, { [pLayanan.id]: 50, [pDisiplin.id]: 50, [pKerjaSama.id]: 50 });

  await calculateResults(category.id, adminActor);
  const tieRanking = await getRanking({ categoryId: category.id, group: "SELAIN_PIMPINAN" });
  const rankMain = tieRanking.find((e) => e.categoryObjectId === categoryObject.id)?.rank;
  const rankTie1 = tieRanking.find((e) => e.categoryObjectId === coTie1.id)?.rank;
  const rankTie2 = tieRanking.find((e) => e.categoryObjectId === coTie2.id)?.rank;
  const rankLower = tieRanking.find((e) => e.categoryObjectId === coLower.id)?.rank;
  ok(`Tiga objek bernilai sama (84) semuanya peringkat 1 (aktual: ${rankMain},${rankTie1},${rankTie2})`, rankMain === 1 && rankTie1 === 1 && rankTie2 === 1);
  ok(`Objek berikutnya melompat ke peringkat 4, bukan 2 (aktual: ${rankLower})`, rankLower === 4);

  console.log("== EDGE-19/Bab 13.5: pemangkasan lingkup unit ==");
  const pimpinanDepMatActor = actorFor(p1, false, false, [depMat.id], [depMat.id, psMat.id, psStat.id]);
  const scopedRanking = filterRankingByScope(tieRanking, pimpinanDepMatActor);
  ok("Semua entri terlihat karena objek berada di DEP-MAT (dalam lingkup)", scopedRanking.length === tieRanking.length);

  const pimpinanLuarActor = actorFor(p2, false, false, [psFis.id], [psFis.id]);
  const scopedOutside = filterRankingByScope(tieRanking, pimpinanLuarActor);
  ok("Pimpinan unit lain (PS-FIS) tidak melihat objek DEP-MAT sama sekali (EDGE-19)", scopedOutside.length === 0);

  // AC-19/AC-20/AC-24: filterRankingByScope di atas TIDAK dipakai oleh halaman/ekspor hasil yang
  // sebenarnya — keduanya memangkas lebih awal lewat getRanking({unitIds}) diisi dari
  // getPeriodScope() (lihat rankings.ts). Uji jalur NYATA ini secara langsung, bukan hanya jalur
  // paralel yang sudah tidak dipakai, supaya kepercayaan pada AC-19/20/24 bukan kepercayaan semu.
  console.log("== AC-19/20/24: jalur otorisasi NYATA halaman/ekspor hasil (getPeriodScope + getRanking unitIds) ==");
  const scopeInPimpinan = await getPeriodScope(pimpinanDepMatActor, category.periodId);
  const rankingInScope = await getRanking({ categoryId: category.id, group: "SELAIN_PIMPINAN", unitIds: scopeInPimpinan });
  ok(
    "Pimpinan Departemen Matematika melihat seluruh entri dalam lingkupnya lewat jalur nyata halaman hasil",
    rankingInScope.length === tieRanking.length
  );

  const scopeOutsidePimpinan = await getPeriodScope(pimpinanLuarActor, category.periodId);
  const rankingOutsideScope = await getRanking({ categoryId: category.id, group: "SELAIN_PIMPINAN", unitIds: scopeOutsidePimpinan });
  ok(
    "Pimpinan unit lain (PS-FIS) menerima array KOSONG lewat jalur nyata — bukan ditolak dengan bocoran jumlah data (AC-20)",
    rankingOutsideScope.length === 0
  );

  const scopeAdmin = await getPeriodScope(adminActor, category.periodId);
  ok("Admin tidak dibatasi unitIds (getPeriodScope mengembalikan undefined)", scopeAdmin === undefined);

  console.log("== Bab 21.4: kegagalan kalkulasi tidak merusak hasil sebelumnya ==");
  await prisma.instrumentVersion.update({ where: { id: instrumentId }, data: { scaleMin: 0, scaleMax: 100 } });
  const beforeFailCount = await prisma.calculationRun.count({ where: { categoryId: category.id, status: "BERHASIL" } });
  try {
    // Memaksa kegagalan dengan categoryId palsu tidak mengganggu run yang sudah berhasil.
    await calculateResults("id-kategori-tidak-ada", adminActor);
    ok("Perhitungan pada kategori tak dikenal semestinya melempar error", false);
  } catch (e) {
    ok("Kategori tak dikenal ditolak dengan ServiceError", e instanceof ServiceError);
  }
  const afterFailCount = await prisma.calculationRun.count({ where: { categoryId: category.id, status: "BERHASIL" } });
  ok("Jumlah run BERHASIL sebelumnya tidak berubah setelah percobaan gagal", beforeFailCount === afterFailCount);
  const stillLatest = await getLatestRun(category.id);
  ok("Hasil terakhir yang berhasil tetap dapat diambil", stillLatest?.status === "BERHASIL");

  console.log("\n=== Ringkasan ===");
  console.log(`Lulus: ${pass}  Gagal: ${fail}`);
  if (fail > 0) process.exitCode = 1;

  console.log("\n== Membersihkan data uji ==");
  const periodIds = [period.id];
  await prisma.parameterResult.deleteMany({ where: { result: { run: { category: { periodId: { in: periodIds } } } } } });
  await prisma.objectGroupResult.deleteMany({ where: { run: { category: { periodId: { in: periodIds } } } } });
  await prisma.calculationRun.deleteMany({ where: { category: { periodId: { in: periodIds } } } });
  await prisma.responseScore.deleteMany({ where: { responseRevision: { assignment: { categoryObject: { category: { periodId: { in: periodIds } } } } } } });
  await prisma.responseRevision.deleteMany({ where: { assignment: { categoryObject: { category: { periodId: { in: periodIds } } } } } });
  await prisma.assignment.deleteMany({ where: { categoryObject: { category: { periodId: { in: periodIds } } } } });
  await prisma.categoryObject.deleteMany({ where: { category: { periodId: { in: periodIds } } } });
  await prisma.groupRule.deleteMany({ where: { category: { periodId: { in: periodIds } } } });
  await prisma.parameter.deleteMany({ where: { instrumentVersion: { category: { periodId: { in: periodIds } } } } });
  await prisma.instrumentVersion.deleteMany({ where: { category: { periodId: { in: periodIds } } } });
  await prisma.assignmentRule.deleteMany({ where: { category: { periodId: { in: periodIds } } } });
  await prisma.category.deleteMany({ where: { periodId: { in: periodIds } } });
  await prisma.accessPolicy.deleteMany({ where: { periodId: { in: periodIds } } });
  await prisma.period.deleteMany({ where: { id: { in: periodIds } } });
  await prisma.assessmentObject.deleteMany({ where: { id: { in: [obj.id, objNoResponse.id, objTie1.id, objTie2.id, objLower.id] } } });
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
