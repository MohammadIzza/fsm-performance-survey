// Tahap 7 — Verifikasi: skenario yang belum tercakup skrip tahap sebelumnya, ditemukan dan
// diperbaiki selama proses verifikasi ini (Bab 24.2: lapisan Konkurensi & Regresi).
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { ServiceError } from "../src/lib/services/units";
import { createPeriod, checkReadiness, transitionPeriodStatus } from "../src/lib/services/periods";
import { createCategory, addCategoryObjects } from "../src/lib/services/categories";
import { addParameter } from "../src/lib/services/instruments";
import { updateGroupRule } from "../src/lib/services/groupRules";
import { updateAssignmentRule } from "../src/lib/services/assignmentRules";
import { createObject } from "../src/lib/services/objects";
import { commitPlan } from "../src/lib/services/assignmentPlanning";
import { saveDraft, submitResponse, getAssignmentFormData } from "../src/lib/services/responses";
import { finalizePeriod, openRevision } from "../src/lib/services/finalization";
import { beginInstrumentRevision } from "../src/lib/services/instruments";
import { calculateResults, getLatestRun } from "../src/lib/services/calculations";
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

function actorFor(user: { id: string; loginIdentifier: string; name: string }, isAdmin = false): AuthContext {
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

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "admin01" } });
  const adminActor = actorFor(admin, true);

  const depMat = await prisma.unit.findUniqueOrThrow({ where: { code: "DEP-MAT" } });
  const dosen1004 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1004" } });
  const dosen1005 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1005" } });
  const orangType = await prisma.objectType.findUniqueOrThrow({ where: { code: "ORANG" } });
  const karyaType = await prisma.objectType.findUniqueOrThrow({ where: { code: "KARYA" } });

  console.log("== EDGE-25: karya tanpa penanggung jawab tidak dapat Siap ==");
  const periodEdge25 = await createPeriod(
    { code: "TEST-T7-E25", name: "Uji EDGE-25", description: null, timezone: "Asia/Jakarta", startsAt: "2026-01-01", endsAt: "2026-01-31" },
    adminActor
  );
  const catKarya = await createCategory(
    periodEdge25.id,
    { code: "KARYA-E25", name: "Karya Tanpa PJ", description: null, objectTypeId: karyaType.id, excludeContributors: true },
    adminActor
  );
  const catKaryaFull = await prisma.category.findUniqueOrThrow({ where: { id: catKarya.id }, include: { instrumentVersions: true, groupRules: true } });
  await addParameter(catKaryaFull.instrumentVersions[0].id, { name: "Kualitas", indicator: null, weight: 100, order: 1 }, adminActor);
  await updateGroupRule(catKaryaFull.groupRules.find((r) => r.group === "PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, adminActor);
  await updateGroupRule(catKaryaFull.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, adminActor);

  const karyaTanpaPJ = await createObject(
    { typeId: karyaType.id, name: "Karya Tanpa Penanggung Jawab", ownerUnitId: depMat.id, referenceUserId: null, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    adminActor
  );
  await addCategoryObjects(catKarya.id, [karyaTanpaPJ.id], adminActor);

  const problemsBeforePJFix = await checkReadiness(periodEdge25.id);
  ok(
    "checkReadiness melaporkan karya tanpa penanggung jawab (EDGE-25)",
    problemsBeforePJFix.some((p) => p.includes("penanggung jawab"))
  );
  await expectServiceError("Transisi ke SIAP ditolak karena karya tanpa penanggung jawab", () =>
    transitionPeriodStatus(periodEdge25.id, "SIAP", adminActor)
  );

  await prisma.assessmentObject.update({ where: { id: karyaTanpaPJ.id }, data: { responsibleUserId: dosen1004.id } });
  const problemsAfterPJFix = await checkReadiness(periodEdge25.id);
  ok(
    "Setelah penanggung jawab diisi, masalah EDGE-25 hilang",
    !problemsAfterPJFix.some((p) => p.includes("penanggung jawab"))
  );

  console.log("== EDGE-12: dua tab mengedit draf — konflik versi tidak menimpa diam-diam ==");
  const periodT7 = await createPeriod(
    { code: "TEST-T7-1", name: "Uji Konkurensi T7", description: null, timezone: "Asia/Jakarta", startsAt: "2020-01-01", endsAt: "2099-12-31" },
    adminActor
  );
  const catT7 = await createCategory(
    periodT7.id,
    { code: "KINERJA-T7", name: "Kinerja (Uji T7)", description: null, objectTypeId: orangType.id, excludeContributors: true },
    adminActor
  );
  const catT7Full = await prisma.category.findUniqueOrThrow({ where: { id: catT7.id }, include: { instrumentVersions: true, groupRules: true, assignmentRules: true } });
  const pLayanan = await addParameter(catT7Full.instrumentVersions[0].id, { name: "Layanan", indicator: null, weight: 60, order: 1 }, adminActor);
  const pDisiplin = await addParameter(catT7Full.instrumentVersions[0].id, { name: "Disiplin", indicator: null, weight: 40, order: 2 }, adminActor);
  await updateGroupRule(catT7Full.groupRules.find((r) => r.group === "PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, adminActor);
  await updateGroupRule(catT7Full.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 1, minimum: 1 }, adminActor);
  await updateAssignmentRule(catT7Full.assignmentRules.find((r) => r.group === "SELAIN_PIMPINAN")!.id, { scope: "UNIT_OBJEK", userTypeIds: [] }, adminActor);

  const objT7 = await createObject(
    { typeId: orangType.id, name: dosen1004.name, ownerUnitId: depMat.id, referenceUserId: dosen1004.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    adminActor
  );
  await addCategoryObjects(catT7.id, [objT7.id], adminActor);
  await commitPlan(catT7.id, "test-t7-seed", adminActor);
  await transitionPeriodStatus(periodT7.id, "SIAP", adminActor);
  await transitionPeriodStatus(periodT7.id, "AKTIF", adminActor);

  const t7Assignment = await prisma.assignment.findFirstOrThrow({ where: { categoryObject: { categoryId: catT7.id } } });
  const evaluatorUser = await prisma.user.findUniqueOrThrow({ where: { id: t7Assignment.evaluatorId } });
  const evaluatorActor = actorFor(evaluatorUser);

  // "Tab A" membuka formulir kosong (belum ada draf) dan menyimpan draf pertama kali.
  const tabA_firstSave = await saveDraft(t7Assignment.id, [{ parameterId: pLayanan.id, score: 70 }], null, evaluatorActor);
  ok("Tab A: simpan draf pertama berhasil, version=2 (mulai dari 1, naik setelah simpan)", tabA_firstSave.version === 2);

  // "Tab B" dibuka SETELAH Tab A menyimpan, sehingga tab B melihat version=2 sebagai basisnya.
  const tabB_baseVersion = tabA_firstSave.version;

  // Tab A menyimpan LAGI (mis. mengubah parameter kedua) menggunakan basis version miliknya (2).
  const tabA_secondSave = await saveDraft(
    t7Assignment.id,
    [{ parameterId: pLayanan.id, score: 70 }, { parameterId: pDisiplin.id, score: 88 }],
    tabA_firstSave.version,
    evaluatorActor
  );
  ok("Tab A: simpan draf kedua berhasil (version naik ke 3)", tabA_secondSave.version === 3);

  // Tab B mencoba menyimpan dengan basis version LAMA (2) — datanya sudah usang karena Tab A
  // sudah menyimpan revisi baru (version 3). Permintaan ini HARUS ditolak, bukan menimpa.
  // Skor 40 sengaja dalam rentang valid (0-100) agar percobaan ini benar-benar diuji oleh
  // pemeriksaan VERSI, bukan tertangkap lebih dulu oleh validasi rentang skor.
  await expectServiceError(
    "Tab B menyimpan draf dengan versi usang DITOLAK (EDGE-12) — tidak menimpa perubahan Tab A",
    () => saveDraft(t7Assignment.id, [{ parameterId: pLayanan.id, score: 40 }], tabB_baseVersion, evaluatorActor)
  );

  const scoreAfterConflict = await prisma.responseScore.findFirst({
    where: { parameterId: pLayanan.id, responseRevision: { assignmentId: t7Assignment.id } },
  });
  ok(
    "Skor Tab A (70) TETAP UTUH setelah percobaan tulis Tab B ditolak — bukan tertimpa 40",
    scoreAfterConflict?.score === 70
  );

  // Tab B memuat ulang (mendapat version terbaru = 3), lalu berhasil menyimpan.
  const tabB_afterReload = await saveDraft(
    t7Assignment.id,
    [{ parameterId: pLayanan.id, score: 75 }, { parameterId: pDisiplin.id, score: 88 }],
    3,
    evaluatorActor
  );
  ok("Tab B setelah memuat ulang versi terbaru berhasil menyimpan", tabB_afterReload.version === 4);

  console.log("== EDGE-12: dua tab SAMA-SAMA baru (belum pernah ada draf sebelumnya) ==");
  const periodFresh = await createPeriod(
    { code: "TEST-T7-FRESH", name: "Uji Dua Tab Baru", description: null, timezone: "Asia/Jakarta", startsAt: "2020-01-01", endsAt: "2099-12-31" },
    adminActor
  );
  const catFresh = await createCategory(
    periodFresh.id,
    { code: "FRESH-CAT", name: "Kategori Fresh", description: null, objectTypeId: orangType.id, excludeContributors: true },
    adminActor
  );
  const catFreshFull = await prisma.category.findUniqueOrThrow({ where: { id: catFresh.id }, include: { instrumentVersions: true, groupRules: true, assignmentRules: true } });
  const pFresh = await addParameter(catFreshFull.instrumentVersions[0].id, { name: "X", indicator: null, weight: 100, order: 1 }, adminActor);
  await updateGroupRule(catFreshFull.groupRules.find((r) => r.group === "PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, adminActor);
  await updateGroupRule(catFreshFull.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 1, minimum: 1 }, adminActor);
  await updateAssignmentRule(catFreshFull.assignmentRules.find((r) => r.group === "SELAIN_PIMPINAN")!.id, { scope: "UNIT_OBJEK", userTypeIds: [] }, adminActor);
  const objFresh = await createObject(
    { typeId: orangType.id, name: dosen1005.name, ownerUnitId: depMat.id, referenceUserId: dosen1005.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    adminActor
  );
  await addCategoryObjects(catFresh.id, [objFresh.id], adminActor);
  await commitPlan(catFresh.id, "test-t7-fresh-seed", adminActor);
  await transitionPeriodStatus(periodFresh.id, "SIAP", adminActor);
  await transitionPeriodStatus(periodFresh.id, "AKTIF", adminActor);

  const freshAssignment = await prisma.assignment.findFirstOrThrow({ where: { categoryObject: { categoryId: catFresh.id } } });
  const freshEvaluator = await prisma.user.findUniqueOrThrow({ where: { id: freshAssignment.evaluatorId } });
  const freshActor = actorFor(freshEvaluator);

  // Kedua "tab" membuka formulir yang SAMA-SAMA belum pernah memiliki draf (expectedVersion=null
  // untuk keduanya, persis seperti klien nyata yang baru memuat halaman untuk tugas baru).
  const freshTabA = await saveDraft(freshAssignment.id, [{ parameterId: pFresh.id, score: 60 }], null, freshActor);
  ok("Tab A (fresh) berhasil membuat draf pertama", freshTabA.version === 2);

  await expectServiceError(
    "Tab B (fresh, expectedVersion=null) DITOLAK karena draf ternyata sudah dibuat Tab A — tidak menimpa diam-diam",
    () => saveDraft(freshAssignment.id, [{ parameterId: pFresh.id, score: 99 }], null, freshActor)
  );
  const freshScoreAfter = await prisma.responseScore.findFirst({
    where: { parameterId: pFresh.id, responseRevision: { assignmentId: freshAssignment.id } },
  });
  ok("Skor Tab A (60) tetap utuh, tidak tertimpa Tab B (99)", freshScoreAfter?.score === 60);

  console.log("== EDGE-12 juga berlaku saat submit (bukan hanya simpan draf) ==");
  await expectServiceError(
    "Submit dengan versi usang ditolak (mencegah kirim berbasis tampilan basi)",
    () =>
      submitResponse(
        t7Assignment.id,
        [{ parameterId: pLayanan.id, score: 1, }, { parameterId: pDisiplin.id, score: 1 }],
        "key-stale-submit",
        2, // versi lama, padahal sekarang sudah 4
        evaluatorActor
      )
  );
  const finalSubmit = await submitResponse(
    t7Assignment.id,
    [{ parameterId: pLayanan.id, score: 75 }, { parameterId: pDisiplin.id, score: 88 }],
    "key-correct-submit",
    4,
    evaluatorActor
  );
  ok("Submit dengan versi yang benar berhasil", finalSubmit.state === "SUBMITTED");

  console.log("== Bab 10.6: dua batch penugasan bersamaan tidak menerbitkan tugas duplikat ==");
  const periodRace = await createPeriod(
    { code: "TEST-T7-RACE", name: "Uji Race Commit", description: null, timezone: "Asia/Jakarta", startsAt: "2026-01-01", endsAt: "2026-01-31" },
    adminActor
  );
  const catRace = await createCategory(
    periodRace.id,
    { code: "RACE-CAT", name: "Kategori Race", description: null, objectTypeId: orangType.id, excludeContributors: true },
    adminActor
  );
  const catRaceFull = await prisma.category.findUniqueOrThrow({ where: { id: catRace.id }, include: { instrumentVersions: true, groupRules: true, assignmentRules: true } });
  await addParameter(catRaceFull.instrumentVersions[0].id, { name: "X", indicator: null, weight: 100, order: 1 }, adminActor);
  await updateGroupRule(catRaceFull.groupRules.find((r) => r.group === "PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, adminActor);
  await updateGroupRule(catRaceFull.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 1, minimum: 1 }, adminActor);
  await updateAssignmentRule(catRaceFull.assignmentRules.find((r) => r.group === "SELAIN_PIMPINAN")!.id, { scope: "UNIT_OBJEK", userTypeIds: [] }, adminActor);

  const objRace = await createObject(
    { typeId: orangType.id, name: dosen1005.name, ownerUnitId: depMat.id, referenceUserId: dosen1005.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    adminActor
  );
  await addCategoryObjects(catRace.id, [objRace.id], adminActor);

  // Dua admin (disimulasikan) memicu commitPlan dengan SEED YANG SAMA hampir bersamaan.
  const raceResults = await Promise.allSettled([
    commitPlan(catRace.id, "race-seed", adminActor),
    commitPlan(catRace.id, "race-seed", adminActor),
  ]);
  const raceSucceeded = raceResults.filter((r) => r.status === "fulfilled").length;
  const raceFailed = raceResults.filter((r) => r.status === "rejected").length;
  ok(
    `Tepat satu dari dua commitPlan bersamaan yang berhasil (aktual: ${raceSucceeded} berhasil, ${raceFailed} gagal)`,
    raceSucceeded === 1 && raceFailed === 1
  );

  const raceAssignments = await prisma.assignment.findMany({
    where: { categoryObject: { categoryId: catRace.id } },
  });
  ok(
    `Tidak ada tugas duplikat diterbitkan (aktual: ${raceAssignments.length} tugas untuk 1 objek+1 target)`,
    raceAssignments.length === 1
  );

  console.log("== Bab 9.3/14.3/AC-26: revisi instrumen substantif setelah final (beginInstrumentRevision) ==");
  const periodInsRev = await createPeriod(
    { code: "TEST-T7-INSREV", name: "Uji Revisi Instrumen", description: null, timezone: "Asia/Jakarta", startsAt: "2020-01-01", endsAt: "2099-12-31" },
    adminActor
  );
  const catInsRev = await createCategory(
    periodInsRev.id,
    { code: "INSREV-CAT", name: "Kategori Revisi Instrumen", description: null, objectTypeId: orangType.id, excludeContributors: true },
    adminActor
  );
  const catInsRevFull = await prisma.category.findUniqueOrThrow({ where: { id: catInsRev.id }, include: { instrumentVersions: true, groupRules: true, assignmentRules: true } });
  const paramLayananIns = await addParameter(catInsRevFull.instrumentVersions[0].id, { name: "Layanan", indicator: null, weight: 100, order: 1 }, adminActor);
  await updateGroupRule(catInsRevFull.groupRules.find((r) => r.group === "PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, adminActor);
  // Tie-break diisi SEKARANG (selagi periode masih Draf — updateGroupRule menolaknya setelahnya)
  // agar remap ID parameter oleh beginInstrumentRevision benar-benar teruji, bukan hanya array kosong.
  // updateGroupRule sendiri menaikkan `revision`, jadi baseline untuk perbandingan "+1" di bawah
  // diambil dari HASIL panggilan ini, bukan dari catInsRevFull yang diambil sebelum update ini.
  const selainRuleIns = await updateGroupRule(
    catInsRevFull.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!.id,
    { aggregation: "RATA_RATA", target: 1, minimum: 1, tieBreakParameterIds: [paramLayananIns.id] },
    adminActor
  );
  await updateAssignmentRule(catInsRevFull.assignmentRules.find((r) => r.group === "SELAIN_PIMPINAN")!.id, { scope: "UNIT_OBJEK", userTypeIds: [] }, adminActor);

  const objInsRev = await createObject(
    { typeId: orangType.id, name: dosen1004.name, ownerUnitId: depMat.id, referenceUserId: dosen1004.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    adminActor
  );
  await addCategoryObjects(catInsRev.id, [objInsRev.id], adminActor);
  await commitPlan(catInsRev.id, "test-t7-insrev-seed", adminActor);
  await transitionPeriodStatus(periodInsRev.id, "SIAP", adminActor);
  await transitionPeriodStatus(periodInsRev.id, "AKTIF", adminActor);

  const insAssignment = await prisma.assignment.findFirstOrThrow({ where: { categoryObject: { categoryId: catInsRev.id }, group: "SELAIN_PIMPINAN" } });
  const insEvaluator = await prisma.user.findUniqueOrThrow({ where: { id: insAssignment.evaluatorId } });
  const insEvaluatorActor = actorFor(insEvaluator);

  await submitResponse(insAssignment.id, [{ parameterId: paramLayananIns.id, score: 80 }], "insrev-submit-1", null, insEvaluatorActor);
  await transitionPeriodStatus(periodInsRev.id, "DITUTUP", adminActor);
  const { finalization: insFin1 } = await finalizePeriod(periodInsRev.id, "Finalisasi awal sebelum revisi instrumen", adminActor);
  ok("Finalisasi awal berhasil sebelum revisi instrumen", insFin1.revision === 1);

  const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const pastDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  await expectServiceError(
    "beginInstrumentRevision ditolak bila periode belum berstatus Revisi",
    () => beginInstrumentRevision(catInsRev.id, "Menambah parameter kedua", futureDeadline, adminActor)
  );
  await expectServiceError(
    "beginInstrumentRevision ditolak untuk aktor bukan admin",
    () => beginInstrumentRevision(catInsRev.id, "Menambah parameter kedua", futureDeadline, insEvaluatorActor)
  );

  await openRevision(periodInsRev.id, "Instrumen perlu parameter tambahan", adminActor);

  await expectServiceError(
    "beginInstrumentRevision ditolak tanpa alasan",
    () => beginInstrumentRevision(catInsRev.id, "", futureDeadline, adminActor)
  );
  await expectServiceError(
    "beginInstrumentRevision ditolak dengan tenggat pengisian ulang di masa lalu",
    () => beginInstrumentRevision(catInsRev.id, "Menambah parameter kedua", pastDeadline, adminActor)
  );

  const previousInstrumentId = catInsRevFull.instrumentVersions[0].id;
  const newVersion = await beginInstrumentRevision(catInsRev.id, "Menambah parameter kedua", futureDeadline, adminActor);
  ok("Versi instrumen baru bernomor revisi 2", newVersion.revision === 2);
  ok("Versi instrumen baru punya ID berbeda dari versi lama (immutable, Bab 9.1 INS-08)", newVersion.id !== previousInstrumentId);

  const newParams = await prisma.parameter.findMany({ where: { instrumentVersionId: newVersion.id } });
  ok("Parameter disalin ke versi baru (nama & bobot sama)", newParams.length === 1 && newParams[0].name === "Layanan" && newParams[0].weight === 100);
  ok("Parameter baru punya ID BERBEDA dari parameter lama (bukan diedit di tempat)", newParams[0].id !== paramLayananIns.id);

  const selainRuleAfter = await prisma.groupRule.findUniqueOrThrow({ where: { id: selainRuleIns.id } });
  ok("Revisi GroupRule bertambah setelah revisi instrumen", selainRuleAfter.revision === selainRuleIns.revision + 1);
  ok(
    "tieBreakParameterIds di-remap ke ID parameter BARU, bukan menunjuk ID lama yang sudah tak ada",
    JSON.stringify(selainRuleAfter.tieBreakParameterIds) === JSON.stringify([newParams[0].id])
  );

  const insAssignmentAfter = await prisma.assignment.findUniqueOrThrow({ where: { id: insAssignment.id } });
  ok("Tugas dipindah ke versi instrumen baru", insAssignmentAfter.instrumentVersionId === newVersion.id);
  ok("Status tugas menjadi Dibuka kembali", insAssignmentAfter.status === "DIBUKA_KEMBALI");
  ok(
    "correctionEndsAt tugas mengikuti tenggat pengisian ulang yang diberikan",
    insAssignmentAfter.correctionEndsAt?.toISOString() === futureDeadline
  );

  const revisionsAfterBegin = await prisma.responseRevision.findMany({ where: { assignmentId: insAssignment.id }, orderBy: { revision: "asc" } });
  ok("Revisi jawaban lama (SUBMITTED, skor 80) tetap ada, tidak dihapus", revisionsAfterBegin.some((r) => r.state === "SUBMITTED"));
  ok(
    "Draf baru (kosong) dibuat untuk pengisian ulang di bawah instrumen baru",
    revisionsAfterBegin.some((r) => r.state === "DRAFT")
  );

  const formDataDuringRevision = await getAssignmentFormData(insAssignment.id, insEvaluatorActor);
  ok(
    "Bab 11.5: jawaban lama (revisi 1, skor 80) TETAP menjadi respons berlaku sampai revisi baru dikirim",
    formDataDuringRevision.effectiveRevision?.revision === 1
  );
  ok(
    "Draf baru yang dapat diedit adalah revisi terpisah, bukan revisi lama yang ditimpa",
    formDataDuringRevision.editableRevision !== null &&
      formDataDuringRevision.editableRevision?.revision !== formDataDuringRevision.effectiveRevision?.revision
  );

  console.log("== AC-26: jawaban lama (parameter lama) tidak ikut tercampur ke perhitungan versi instrumen baru ==");
  await expectServiceError(
    "calculateResults menolak mencampur jawaban versi instrumen lama dengan parameter versi baru",
    () => calculateResults(catInsRev.id, adminActor)
  );
  await expectServiceError(
    "getLatestRun juga menolak (dipanggil otomatis oleh halaman hasil) alih-alih membocorkan hasil tercampur",
    () => getLatestRun(catInsRev.id)
  );
  const runsAfterFailedCalc = await prisma.calculationRun.findMany({ where: { categoryId: catInsRev.id }, orderBy: { createdAt: "desc" } });
  ok(
    "Percobaan kalkulasi yang gagal ditandai GAGAL, bukan merusak/menghapus riwayat run",
    runsAfterFailedCalc[0]?.status === "GAGAL"
  );

  console.log("== Setelah pengisian ulang di bawah instrumen baru, perhitungan berhasil ==");
  await submitResponse(
    insAssignment.id,
    [{ parameterId: newParams[0].id, score: 95 }],
    "insrev-submit-2",
    1,
    insEvaluatorActor
  );
  const formDataAfterResubmit = await getAssignmentFormData(insAssignment.id, insEvaluatorActor);
  ok(
    // submitResponse mempromosikan draf (revisi 2, dibuat oleh beginInstrumentRevision) menjadi
    // SUBMITTED di baris yang sama, bukan membuat baris revisi baru — jadi nomornya tetap 2.
    "Setelah dikirim ulang, respons berlaku adalah jawaban BARU (revisi 2, bukan lagi revisi 1 yang lama)",
    formDataAfterResubmit.effectiveRevision?.revision === 2 && formDataAfterResubmit.effectiveRevision?.state === "SUBMITTED"
  );

  const runAfterResubmit = await calculateResults(catInsRev.id, adminActor);
  ok("Perhitungan berhasil setelah pengisian ulang sesuai instrumen baru", runAfterResubmit.status === "BERHASIL");
  const resultAfterResubmit = await prisma.objectGroupResult.findFirstOrThrow({
    where: { runId: runAfterResubmit.id, categoryObjectId: (await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: catInsRev.id } })).id, group: "SELAIN_PIMPINAN" },
  });
  ok("Nilai mencerminkan jawaban baru (95), bukan jawaban lama di bawah instrumen sebelumnya (80)", resultAfterResubmit.score === 95);

  console.log("\n=== Ringkasan ===");
  console.log(`Lulus: ${pass}  Gagal: ${fail}`);
  if (fail > 0) process.exitCode = 1;

  console.log("\n== Membersihkan data uji ==");
  const periodIds = [periodEdge25.id, periodT7.id, periodRace.id, periodFresh.id, periodInsRev.id];
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
  await prisma.assessmentObject.deleteMany({ where: { id: { in: [karyaTanpaPJ.id, objT7.id, objRace.id, objFresh.id, objInsRev.id] } } });
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
