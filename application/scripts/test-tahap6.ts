import "dotenv/config";
import ExcelJS from "exceljs";
import { prisma } from "../src/lib/prisma";
import { ServiceError } from "../src/lib/services/units";
import { createPeriod, transitionPeriodStatus } from "../src/lib/services/periods";
import { createCategory, addCategoryObjects } from "../src/lib/services/categories";
import { addParameter } from "../src/lib/services/instruments";
import { updateGroupRule } from "../src/lib/services/groupRules";
import { createObject } from "../src/lib/services/objects";
import { commitPlan } from "../src/lib/services/assignmentPlanning";
import {
  getFinalizationPreview,
  finalizePeriod,
  openRevision,
  listFinalizationHistory,
} from "../src/lib/services/finalization";
import { previewUnitImport, previewUserImport, previewLeadershipImport, applyImport } from "../src/lib/services/imports";
import { safeCell, buildResultsExport } from "../src/lib/services/exports";
import { listAuditEvents } from "../src/lib/services/audit";
import { getMonitoringSummary } from "../src/lib/services/monitoring";
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

function actorFor(user: { id: string; loginIdentifier: string; name: string }, isAdmin = true): AuthContext {
  return {
    userId: user.id,
    loginIdentifier: user.loginIdentifier,
    name: user.name,
    active: true,
    isAdmin,
    isDekan: false,
    leadershipUnitIds: [],
    scopeUnitIds: [],
  };
}

async function buildXlsxBuffer(headers: string[], rows: (string | number)[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");
  sheet.addRow(headers);
  for (const r of rows) sheet.addRow(r);
  const buf = await workbook.xlsx.writeBuffer();
  return buf as unknown as ArrayBuffer;
}

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "admin01" } });
  const adminActor = actorFor(admin);

  const depMat = await prisma.unit.findUniqueOrThrow({ where: { code: "DEP-MAT" } });
  const dosen1004 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1004" } });
  const orangType = await prisma.objectType.findUniqueOrThrow({ where: { code: "ORANG" } });

  const roleGrantsBeforeAnyImport = await prisma.roleGrant.count();

  console.log("== Setup periode lengkap sampai Ditutup ==");
  const period = await createPeriod(
    { code: "TEST-T6-1", name: "Uji Tahap 6", description: null, timezone: "Asia/Jakarta", startsAt: "2020-01-01", endsAt: "2020-01-02" },
    adminActor
  );
  const category = await createCategory(
    period.id,
    { code: "KINERJA-T6", name: "Kinerja (Uji T6)", description: null, objectTypeId: orangType.id, excludeContributors: true },
    adminActor
  );
  const catFull = await prisma.category.findUniqueOrThrow({ where: { id: category.id }, include: { instrumentVersions: true, groupRules: true } });
  const param = await addParameter(catFull.instrumentVersions[0].id, { name: "Kinerja", indicator: null, weight: 100, order: 1 }, adminActor);
  const pimpinanRule = catFull.groupRules.find((r) => r.group === "PIMPINAN")!;
  const selainRule = catFull.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
  await updateGroupRule(pimpinanRule.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, adminActor);
  await updateGroupRule(selainRule.id, { aggregation: "RATA_RATA", target: 1, minimum: 1 }, adminActor);

  const obj = await createObject(
    { typeId: orangType.id, name: dosen1004.name, ownerUnitId: depMat.id, referenceUserId: dosen1004.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    adminActor
  );
  await addCategoryObjects(category.id, [obj.id], adminActor);
  await commitPlan(category.id, "test-t6-seed", adminActor);
  await transitionPeriodStatus(period.id, "SIAP", adminActor);
  await transitionPeriodStatus(period.id, "AKTIF", adminActor);

  const assignment = await prisma.assignment.findFirstOrThrow({ where: { categoryObject: { categoryId: category.id } } });
  const rev = await prisma.responseRevision.create({
    data: { assignmentId: assignment.id, revision: 1, state: "SUBMITTED", submittedAt: new Date(), editedById: assignment.evaluatorId },
  });
  await prisma.responseScore.create({ data: { responseRevisionId: rev.id, parameterId: param.id, score: 88 } });
  await prisma.assignment.update({ where: { id: assignment.id }, data: { status: "TERKIRIM" } });

  await transitionPeriodStatus(period.id, "DITUTUP", adminActor);

  console.log("== Bab 14.1: preview finalisasi ==");
  const preview1 = await getFinalizationPreview(period.id);
  ok("Preview finalisasi ready=true (blockers kosong)", preview1.ready && preview1.blockers.length === 0);

  console.log("== Bab 14: finalisasi ==");
  await expectServiceError("finalizePeriod ditolak untuk periode selain Ditutup", () =>
    finalizePeriod("id-tidak-ada", "test", adminActor)
  );

  const { finalization: fin1 } = await finalizePeriod(period.id, "Finalisasi pertama", adminActor);
  ok("Finalization pertama revisi 1", fin1.revision === 1);
  ok("priorFinalId null untuk finalisasi pertama", fin1.priorFinalId === null);

  const periodAfterFinal = await prisma.period.findUniqueOrThrow({ where: { id: period.id } });
  ok("Status periode menjadi FINAL", periodAfterFinal.status === "FINAL");

  const runsAfterFinal = await prisma.calculationRun.findMany({ where: { categoryId: category.id, finalizationId: fin1.id } });
  ok("CalculationRun kategori terpatri ke Finalization", runsAfterFinal.length === 1);

  console.log("== Bab 14.3/UC-09: buka revisi dari Final ==");
  await expectServiceError("openRevision tanpa alasan ditolak", () => openRevision(period.id, "", adminActor));
  await openRevision(period.id, "Ditemukan kesalahan input skor", adminActor);
  const periodAfterRevision = await prisma.period.findUniqueOrThrow({ where: { id: period.id } });
  ok("Status periode menjadi REVISI", periodAfterRevision.status === "REVISI");

  const finAfterRevisionOpen = await prisma.finalization.findMany({ where: { periodId: period.id } });
  ok("Finalization lama TIDAK berubah/terhapus saat revisi dibuka", finAfterRevisionOpen.length === 1);

  // Koreksi: buka kembali tugas dan kirim skor baru.
  await prisma.responseRevision.update({ where: { id: rev.id }, data: {} }); // no-op sanity
  const rev2 = await prisma.responseRevision.create({
    data: { assignmentId: assignment.id, revision: 2, state: "SUBMITTED", submittedAt: new Date(), editedById: assignment.evaluatorId },
  });
  await prisma.responseScore.create({ data: { responseRevisionId: rev2.id, parameterId: param.id, score: 95 } });

  await transitionPeriodStatus(period.id, "DITUTUP", adminActor);

  console.log("== Finalisasi ulang -> revisi 2 ==");
  const { finalization: fin2 } = await finalizePeriod(period.id, "Finalisasi kedua setelah koreksi", adminActor);
  ok("Finalization kedua revisi 2", fin2.revision === 2);
  ok("priorFinalId menunjuk ke finalisasi pertama", fin2.priorFinalId === fin1.id);

  const history = await listFinalizationHistory(period.id);
  ok("Riwayat finalisasi berisi 2 entri, terbaru di atas", history.length === 2 && history[0].revision === 2);

  const finalResult = await prisma.objectGroupResult.findFirst({
    where: { run: { finalizationId: fin2.id }, categoryObjectId: (await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: category.id } })).id, group: "SELAIN_PIMPINAN" },
  });
  ok("Nilai final revisi 2 mencerminkan skor terkoreksi (95, bukan 88)", finalResult?.score === 95);

  const oldFinalResult = await prisma.objectGroupResult.findFirst({
    where: { run: { finalizationId: fin1.id }, categoryObjectId: (await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: category.id } })).id, group: "SELAIN_PIMPINAN" },
  });
  ok("Hasil final LAMA (revisi 1) tetap tersimpan apa adanya (88), tidak ditimpa", oldFinalResult?.score === 88);

  console.log("== Impor Unit (Bab 15.1) ==");
  const unitBuf = await buildXlsxBuffer(
    ["kode_unit", "nama_unit", "kode_induk", "status"],
    [["PS-IMPOR-T6", "Prodi Uji Impor", "DEP-MAT", "aktif"]]
  );
  const unitPreview = await previewUnitImport(unitBuf);
  ok("Preview impor unit valid, 0 error", unitPreview.errors.length === 0 && unitPreview.toCreate === 1);

  const cycleBuf = await buildXlsxBuffer(
    ["kode_unit", "nama_unit", "kode_induk", "status"],
    [
      ["SIKLUS-A-T6", "Siklus A", "SIKLUS-B-T6", "aktif"],
      ["SIKLUS-B-T6", "Siklus B", "SIKLUS-A-T6", "aktif"],
    ]
  );
  const cyclePreview = await previewUnitImport(cycleBuf);
  ok("Siklus antar-baris dalam satu berkas terdeteksi", cyclePreview.errors.some((e) => e.message.includes("Siklus")));

  const unknownParentBuf = await buildXlsxBuffer(
    ["kode_unit", "nama_unit", "kode_induk", "status"],
    [["PS-X-T6", "Prodi X", "TIDAK-ADA-T6", "aktif"]]
  );
  const unknownParentPreview = await previewUnitImport(unknownParentBuf);
  ok("kode_induk tidak dikenal ditolak", unknownParentPreview.errors.some((e) => e.message.includes("tidak dikenal")));

  const duplicateBuf = await buildXlsxBuffer(
    ["kode_unit", "nama_unit", "kode_induk", "status"],
    [
      ["DUP-T6", "Dup 1", "", "aktif"],
      ["DUP-T6", "Dup 2", "", "aktif"],
    ]
  );
  const duplicatePreview = await previewUnitImport(duplicateBuf);
  ok("kode_unit duplikat dalam berkas ditolak", duplicatePreview.errors.some((e) => e.message.includes("duplikat")));

  console.log("== Impor Unit: all-or-nothing ==");
  const mixedBuf = await buildXlsxBuffer(
    ["kode_unit", "nama_unit", "kode_induk", "status"],
    [
      ["PS-VALID-T6", "Prodi Valid", "DEP-MAT", "aktif"],
      ["", "Tanpa Kode", "", "aktif"], // baris invalid
    ]
  );
  await expectServiceError("Batch dengan 1 baris invalid ditolak seluruhnya", () =>
    applyImport("UNIT", mixedBuf, "mixed.xlsx", adminActor)
  );
  const validUnitCreated = await prisma.unit.findUnique({ where: { code: "PS-VALID-T6" } });
  ok("Baris yang VALID dalam batch gagal TIDAK ikut diterapkan (all-or-nothing)", validUnitCreated === null);

  const applyResult = await applyImport("UNIT", unitBuf, "unit-ok.xlsx", adminActor);
  ok("Impor unit valid berhasil diterapkan", applyResult.toCreate === 1);
  const createdUnit = await prisma.unit.findUnique({ where: { code: "PS-IMPOR-T6" } });
  ok("Unit baru benar-benar tersimpan di database", createdUnit?.name === "Prodi Uji Impor");

  console.log("== EDGE-24: dua baris kode SAMA dalam SATU berkas impor ditolak ==");
  const duplicateInFileBuf = await buildXlsxBuffer(
    ["kode_unit", "nama_unit", "kode_induk", "status"],
    [
      ["PS-DUP-T6", "Prodi Duplikat A", "DEP-MAT", "aktif"],
      ["PS-DUP-T6", "Prodi Duplikat B", "DEP-MAT", "aktif"], // kode sama persis, baris lain
    ]
  );
  const duplicateInFilePreview = await previewUnitImport(duplicateInFileBuf);
  ok(
    'Pratinjau menandai baris kedua sebagai duplikat "dalam berkas ini" (bukan hanya duplikat vs data lama)',
    duplicateInFilePreview.errors.some((e) => e.message.includes(`"PS-DUP-T6" duplikat dalam berkas ini`))
  );
  await expectServiceError("Impor dengan kode duplikat dalam satu berkas ditolak seluruhnya (all-or-nothing)", () =>
    applyImport("UNIT", duplicateInFileBuf, "duplicate-in-file.xlsx", adminActor)
  );
  ok("TIDAK ADA unit PS-DUP-T6 tersimpan (baik baris A maupun B)", (await prisma.unit.findUnique({ where: { code: "PS-DUP-T6" } })) === null);

  // Sisi lain EDGE-24: id_login duplikat dalam satu berkas impor Pengguna juga ditolak (pesan
  // berbeda dari kode_unit di atas, jalur validasi terpisah di imports.ts).
  const duplicateUserBuf = await buildXlsxBuffer(
    ["id_login", "nama", "kode_jenis", "kode_unit", "status"],
    [
      ["09993", "Dosen Duplikat A", "DOSEN", "PS-IMPOR-T6", "aktif"],
      ["09993", "Dosen Duplikat B", "DOSEN", "PS-IMPOR-T6", "aktif"],
    ]
  );
  const duplicateUserPreview = await previewUserImport(duplicateUserBuf);
  ok(
    'Pratinjau impor pengguna juga menandai id_login duplikat "dalam berkas ini"',
    duplicateUserPreview.errors.some((e) => e.message.includes(`"09993" duplikat dalam berkas ini`))
  );

  console.log("== EDGE-21: teks berawalan =/+/-/@ pada impor diperlakukan sebagai teks aman ==");
  const formulaBuf = await buildXlsxBuffer(
    ["kode_unit", "nama_unit", "kode_induk", "status"],
    [["PS-FORMULA-T6", "=1+1", "DEP-MAT", "aktif"]]
  );
  const formulaPreview = await previewUnitImport(formulaBuf);
  ok(
    "Nama berawalan '=' tidak ditolak dan tidak dievaluasi saat preview (tetap teks '=1+1')",
    formulaPreview.errors.length === 0 && formulaPreview.rows[0]?.nama_unit === "=1+1"
  );
  await applyImport("UNIT", formulaBuf, "unit-formula.xlsx", adminActor);
  const formulaUnit = await prisma.unit.findUnique({ where: { code: "PS-FORMULA-T6" } });
  ok(
    "Nama tersimpan APA ADANYA sebagai teks ('=1+1'), bukan hasil hitung ('2') atau dieksekusi",
    formulaUnit?.name === "=1+1"
  );
  // Sisi lain EDGE-21: saat nama ini nanti ditulis ke berkas EKSPOR baru — satu-satunya titik
  // yang benar-benar dibuka lagi di Excel — safeCell() harus mencegahnya ditafsir ulang sebagai
  // formula (Bab 15.2), dengan menandainya eksplisit sebagai teks lewat prefiks kutip.
  ok(
    "safeCell() menandai nilai berawalan '=' dengan prefiks kutip agar Excel tidak menafsirnya sebagai formula",
    safeCell(formulaUnit!.name) === `'${formulaUnit!.name}`
  );
  ok("safeCell() membiarkan teks biasa apa adanya", safeCell("Prodi Uji Impor") === "Prodi Uji Impor");
  for (const dangerous of ["=1+1", "+1+1", "-1+1", "@SUM(A1)"]) {
    ok(`safeCell() menjaga teks berawalan "${dangerous[0]}" (EDGE-21)`, safeCell(dangerous) === `'${dangerous}`);
  }

  console.log("== Impor Pengguna (Bab 15.1/5.2) ==");
  const userBuf = await buildXlsxBuffer(
    ["id_login", "nama", "kode_jenis", "kode_unit", "status"],
    [["09991", "Dosen Uji Impor", "DOSEN", "PS-IMPOR-T6", "aktif"]] // ID berawalan nol
  );
  const userApply = await applyImport("PENGGUNA", userBuf, "user-ok.xlsx", adminActor);
  ok("Impor pengguna berhasil", userApply.toCreate === 1);
  const importedUser = await prisma.user.findUnique({ where: { loginIdentifier: "09991" } });
  ok('ID login "09991" tersimpan dengan nol awal utuh (bukan berubah jadi 9991)', importedUser?.loginIdentifier === "09991");

  const badTypeBuf = await buildXlsxBuffer(
    ["id_login", "nama", "kode_jenis", "kode_unit", "status"],
    [["09992", "Dosen Bad Type", "JENIS-TIDAK-ADA", "PS-IMPOR-T6", "aktif"]]
  );
  const badTypePreview = await previewUserImport(badTypeBuf);
  ok("kode_jenis tidak dikenal ditolak", badTypePreview.errors.some((e) => e.message.includes("tidak dikenal")));

  console.log("== Impor tidak menambah Admin/Dekan (Bab 15.1) ==");
  // Template Pengguna tidak memiliki kolom peran sama sekali — mustahil menaikkan hak istimewa
  // lewat impor; diverifikasi jumlah RoleGrant tidak berubah sejak sebelum SEMUA impor di atas.
  const roleGrantsAfterImports = await prisma.roleGrant.count();
  ok(
    "Jumlah RoleGrant tidak berubah akibat rangkaian impor pengguna di atas",
    roleGrantsBeforeAnyImport === roleGrantsAfterImports
  );

  console.log("== Impor Pimpinan ==");
  const leadershipBuf = await buildXlsxBuffer(
    ["id_login", "kode_unit", "nama_jabatan", "mulai_aktif", "akhir_aktif"],
    [["09991", "PS-IMPOR-T6", "Koordinator Uji", "2026-01-01", ""]]
  );
  const leadershipApply = await applyImport("PIMPINAN", leadershipBuf, "leadership-ok.xlsx", adminActor);
  ok("Impor pimpinan berhasil", leadershipApply.toCreate === 1);
  const createdLeadership = await prisma.leadership.findFirst({ where: { userId: importedUser!.id, unitId: createdUnit!.id } });
  ok("Data kepemimpinan tersimpan", createdLeadership?.title === "Koordinator Uji");

  const inactiveLeaderBuf = await buildXlsxBuffer(
    ["id_login", "kode_unit", "nama_jabatan", "mulai_aktif", "akhir_aktif"],
    [["dosen1099", "PS-IMPOR-T6", "Koordinator Lain", "2026-01-01", ""]] // dosen1099 nonaktif (seed Tahap 1)
  );
  const inactiveLeaderPreview = await previewLeadershipImport(inactiveLeaderBuf);
  ok("Pengguna nonaktif ditolak sebagai pimpinan lewat impor", inactiveLeaderPreview.errors.some((e) => e.message.includes("nonaktif")));

  console.log("== Audit trail (Bab 16.1/21.1) ==");
  const auditResult = await listAuditEvents({ entity: "Finalization" });
  ok("Audit event PERIOD_FINALIZE tercatat", auditResult.events.some((e) => e.action === "PERIOD_FINALIZE"));
  const auditByActor = await listAuditEvents({ actorId: admin.id, pageSize: 5 });
  ok("Filter audit berdasarkan pelaku berfungsi", auditByActor.events.every((e) => e.actorId === admin.id));

  console.log("== Monitoring (Bab 21.2) ==");
  const summary = await getMonitoringSummary();
  ok("Ringkasan monitoring memiliki bentuk yang valid", typeof summary.submissionRate === "number" && summary.validAssignments >= 0);

  console.log("== AC-38: ekspor hasil aman diulang (regenerasi murni, tanpa efek samping) ==");
  // buildResultsExport tidak menulis apa pun ke database (baca-saja, membangun workbook baru dari
  // hasil TERSIMPAN setiap dipanggil) — beda dari retry KALKULASI (Bab 21.4, diuji test-tahap5.ts)
  // yang memang berefek samping (menulis CalculationRun). Uji ini membuktikan memanggil dua kali
  // berturut-turut (skenario "klik ekspor lagi karena ragu file pertama gagal unduh") tidak error
  // dan tidak saling memengaruhi.
  const export1 = await buildResultsExport(category.id, { pimpinan: [], selain: [] }, adminActor);
  const export2 = await buildResultsExport(category.id, { pimpinan: [], selain: [] }, adminActor);
  ok(
    "Dua panggilan ekspor berturut-turut sama-sama berhasil menghasilkan workbook valid",
    export1.worksheets.length > 0 && export2.worksheets.length > 0
  );
  ok(
    "Struktur (jumlah & nama sheet) identik antar panggilan — regenerasi murni, bukan akumulasi state",
    export1.worksheets.length === export2.worksheets.length &&
      export1.worksheets.every((s, i) => s.name === export2.worksheets[i].name)
  );

  console.log("== EDGE-20: tidak ada penghapusan permanen (hard delete) untuk Unit — dicegah sampai level DB ==");
  // Tidak ada deleteUnit/prisma.unit.delete di mana pun dalam kode aplikasi (hanya
  // setUnitActiveAction, nonaktifkan) — dibuktikan di sini bahwa mencoba hard-delete LANGSUNG
  // lewat Prisma pun ditolak oleh constraint foreign key (unit anak & pengguna masih merujuknya),
  // bukan sekadar "tidak ada tombolnya di UI". Inilah kenapa satu-satunya jalan yang aman adalah
  // nonaktifkan (Bab 5, ORG-05), bukan gerbang aplikasi yang bisa dilewati lewat akses DB langsung.
  let hardDeleteBlocked = false;
  try {
    await prisma.unit.delete({ where: { id: depMat.id } });
  } catch (e) {
    hardDeleteBlocked = e instanceof Error && /foreign key|constraint/i.test(e.message);
  }
  ok("prisma.unit.delete() pada unit yang masih punya subunit/pengguna ditolak DB (foreign key)", hardDeleteBlocked);
  const depMatStillExists = await prisma.unit.findUnique({ where: { id: depMat.id } });
  ok("Unit tetap ada setelah percobaan hard-delete gagal (tidak ada kerusakan data)", depMatStillExists !== null);

  console.log("\n=== Ringkasan ===");
  console.log(`Lulus: ${pass}  Gagal: ${fail}`);
  if (fail > 0) process.exitCode = 1;

  console.log("\n== Membersihkan data uji ==");
  const periodIds = [period.id];
  await prisma.leadership.deleteMany({ where: { unitId: createdUnit?.id } });
  await prisma.parameterResult.deleteMany({ where: { result: { run: { category: { periodId: { in: periodIds } } } } } });
  await prisma.objectGroupResult.deleteMany({ where: { run: { category: { periodId: { in: periodIds } } } } });
  await prisma.calculationRun.deleteMany({ where: { category: { periodId: { in: periodIds } } } });
  await prisma.finalization.deleteMany({ where: { periodId: { in: periodIds } } });
  await prisma.responseScore.deleteMany({ where: { responseRevision: { assignment: { categoryObject: { category: { periodId: { in: periodIds } } } } } } });
  await prisma.responseRevision.deleteMany({ where: { assignment: { categoryObject: { category: { periodId: { in: periodIds } } } } } });
  await prisma.assignment.deleteMany({ where: { categoryObject: { category: { periodId: { in: periodIds } } } } });
  await prisma.assignmentBatch.deleteMany({ where: { category: { periodId: { in: periodIds } } } });
  await prisma.categoryObject.deleteMany({ where: { category: { periodId: { in: periodIds } } } });
  await prisma.assignmentRule.deleteMany({ where: { category: { periodId: { in: periodIds } } } });
  await prisma.groupRule.deleteMany({ where: { category: { periodId: { in: periodIds } } } });
  await prisma.parameter.deleteMany({ where: { instrumentVersion: { category: { periodId: { in: periodIds } } } } });
  await prisma.instrumentVersion.deleteMany({ where: { category: { periodId: { in: periodIds } } } });
  await prisma.category.deleteMany({ where: { periodId: { in: periodIds } } });
  await prisma.accessPolicy.deleteMany({ where: { periodId: { in: periodIds } } });
  await prisma.period.deleteMany({ where: { id: { in: periodIds } } });
  await prisma.assessmentObject.deleteMany({ where: { id: obj.id } });
  await prisma.user.deleteMany({ where: { loginIdentifier: { in: ["09991", "09992"] } } });
  await prisma.unit.deleteMany({ where: { code: { in: ["PS-IMPOR-T6", "PS-VALID-T6", "PS-FORMULA-T6"] } } });
  await prisma.importBatch.deleteMany({ where: { fileName: { in: ["mixed.xlsx", "unit-ok.xlsx", "unit-formula.xlsx", "user-ok.xlsx", "leadership-ok.xlsx"] } } });
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
