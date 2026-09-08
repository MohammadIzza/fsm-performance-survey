import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { ServiceError } from "../src/lib/services/units";
import { createPeriod, transitionPeriodStatus } from "../src/lib/services/periods";
import { createCategory, addCategoryObjects } from "../src/lib/services/categories";
import { addParameter } from "../src/lib/services/instruments";
import { updateGroupRule } from "../src/lib/services/groupRules";
import { updateAssignmentRule } from "../src/lib/services/assignmentRules";
import { commitPlan } from "../src/lib/services/assignmentPlanning";
import { createObject } from "../src/lib/services/objects";
import {
  saveDraft,
  submitResponse,
  reopenAssignment,
  adminEditResponse,
  voidResponse,
  getAssignmentFormData,
} from "../src/lib/services/responses";
import { reportIssue, resolveIssue } from "../src/lib/services/assignmentIssues";
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
  const dosen1004 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1004" } }); // objek dinilai
  const dosen1005 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1005" } }); // penilai
  const dosen1006 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1006" } }); // penilai lain
  const orangType = await prisma.objectType.findUniqueOrThrow({ where: { code: "ORANG" } });

  console.log("== Setup periode aktif dengan 1 tugas terbit ==");
  const period = await createPeriod(
    {
      code: "TEST-T4-1",
      name: "Uji Tahap 4",
      description: null,
      timezone: "Asia/Jakarta",
      startsAt: "2020-01-01", // sudah lewat agar periode segera bisa dibuka Aktif tanpa menunggu
      endsAt: "2099-12-31",
    },
    adminActor
  );
  const category = await createCategory(
    period.id,
    { code: "KINERJA-T4", name: "Kinerja (Uji T4)", description: null, objectTypeId: orangType.id, excludeContributors: true },
    adminActor
  );
  const catFull = await prisma.category.findUniqueOrThrow({
    where: { id: category.id },
    include: { instrumentVersions: true, groupRules: true, assignmentRules: true },
  });
  const instrumentId = catFull.instrumentVersions[0].id;
  const paramLayanan = await addParameter(instrumentId, { name: "Layanan", indicator: null, weight: 60, order: 1 }, adminActor);
  const paramDisiplin = await addParameter(instrumentId, { name: "Disiplin", indicator: null, weight: 40, order: 2 }, adminActor);

  const pimpinanRule = catFull.groupRules.find((r) => r.group === "PIMPINAN")!;
  const selainRule = catFull.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
  await updateGroupRule(pimpinanRule.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, adminActor);
  await updateGroupRule(selainRule.id, { aggregation: "RATA_RATA", target: 2, minimum: 1 }, adminActor);
  const assignSelainRule = catFull.assignmentRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
  await updateAssignmentRule(assignSelainRule.id, { scope: "UNIT_DAN_SUBUNIT", userTypeIds: [] }, adminActor);

  const objDosen1004 = await createObject(
    { typeId: orangType.id, name: dosen1004.name, ownerUnitId: depMat.id, referenceUserId: dosen1004.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    adminActor
  );
  await addCategoryObjects(category.id, [objDosen1004.id], adminActor);
  await commitPlan(category.id, "test-t4-seed", adminActor);

  const categoryObjectId = (await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: category.id } })).id;
  const selainAssignments = await prisma.assignment.findMany({
    where: { categoryObjectId, group: "SELAIN_PIMPINAN" },
    orderBy: { createdAt: "asc" },
  });
  if (selainAssignments.length < 2) {
    throw new Error(`Prasyarat uji tidak terpenuhi: butuh 2 tugas Selain Pimpinan, hanya ada ${selainAssignments.length}.`);
  }
  const assignment = selainAssignments[0];
  const otherAssignment = selainAssignments[1];

  const evaluatorUser = await prisma.user.findUniqueOrThrow({ where: { id: assignment.evaluatorId } });
  const evaluatorActor = actorFor(evaluatorUser);
  // "Orang asing" untuk uji kepemilikan: siapa pun yang aktif dan BUKAN pemilik tugas ini.
  const strangerUser = dosen1005.id === evaluatorUser.id ? dosen1006 : dosen1005;
  const strangerActor = actorFor(strangerUser);

  await transitionPeriodStatus(period.id, "SIAP", adminActor);
  await transitionPeriodStatus(period.id, "AKTIF", adminActor);

  console.log("== Kepemilikan tugas ==");
  await expectServiceError("Pengguna lain tidak dapat mengisi tugas milik orang lain", () =>
    saveDraft(assignment.id, [{ parameterId: paramLayanan.id, score: 80 }], null, strangerActor)
  );

  console.log("== Draf: boleh tidak lengkap ==");
  const draft1 = await saveDraft(assignment.id, [{ parameterId: paramLayanan.id, score: 85 }], null, evaluatorActor);
  ok("Draf dengan 1 dari 2 parameter berhasil disimpan", draft1.state === "DRAFT" && draft1.scores.length === 1);

  const afterDraftAssignment = await prisma.assignment.findUniqueOrThrow({ where: { id: assignment.id } });
  ok("Status tugas berubah menjadi DRAF setelah simpan draf pertama", afterDraftAssignment.status === "DRAF");

  console.log("== EDGE-02/EDGE-03: validasi skor ==");
  await expectServiceError("Skor di luar skala (0-100) ditolak", () =>
    saveDraft(assignment.id, [{ parameterId: paramLayanan.id, score: 150 }], null, evaluatorActor)
  );
  await expectServiceError("Submit dengan parameter belum lengkap ditolak (AC-10)", () =>
    submitResponse(assignment.id, [{ parameterId: paramLayanan.id, score: 85 }], "key-incomplete", null, evaluatorActor)
  );

  // Draf sudah ada sejak draft1 di atas (wasCreated=false) — versi yang diharapkan harus
  // mengikuti versi TERAKHIR yang dikembalikan, persis seperti klien nyata melacak baseline-nya.
  const draft0 = await saveDraft(assignment.id, [{ parameterId: paramLayanan.id, score: 0 }], draft1.version, evaluatorActor);
  ok("Skor 0 pada skala 0-100 sah dan tersimpan (EDGE-02)", draft0.scores.find((s) => s.parameterId === paramLayanan.id)?.score === 0);

  console.log("== Submit lengkap (AC-11 idempotensi) ==");
  const idKey = "test-t4-idem-key-1";
  const scores = [
    { parameterId: paramLayanan.id, score: 90 },
    { parameterId: paramDisiplin.id, score: 80 },
  ];
  const submitted1 = await submitResponse(assignment.id, scores, idKey, draft0.version, evaluatorActor);
  ok("Submit pertama berhasil, state SUBMITTED", submitted1.state === "SUBMITTED");

  const submitted2 = await submitResponse(assignment.id, scores, idKey, null, evaluatorActor);
  ok("Submit ulang dengan idempotency key sama mengembalikan revisi yang sama (bukan revisi baru)", submitted2.id === submitted1.id);

  const revisionsAfterSubmit = await prisma.responseRevision.count({ where: { assignmentId: assignment.id } });
  ok("Hanya 1 revisi tersimpan meski submit dipanggil dua kali (AC-11)", revisionsAfterSubmit === 1);

  console.log("== Kunci setelah terkirim (AC-12) ==");
  await expectServiceError("Simpan draf setelah terkirim ditolak", () =>
    saveDraft(assignment.id, [{ parameterId: paramLayanan.id, score: 70 }], null, evaluatorActor)
  );
  await expectServiceError("Submit lagi (tanpa idempotency key sama) setelah terkirim ditolak", () =>
    submitResponse(assignment.id, scores, "key-different", null, evaluatorActor)
  );

  const lockedAssignment = await prisma.assignment.findUniqueOrThrow({ where: { id: assignment.id } });
  ok("Status tugas menjadi TERKIRIM", lockedAssignment.status === "TERKIRIM");

  console.log("== getAssignmentFormData: respons berlaku ==");
  const formData = await getAssignmentFormData(assignment.id, evaluatorActor);
  ok("effectiveRevision terisi dengan skor terkirim", formData.effectiveRevision?.scores.length === 2);
  ok("editableRevision null karena sudah terkirim", formData.editableRevision === null);

  console.log("== Admin: buka kembali untuk pengisi (Bab 11.5/UC-07) ==");
  const reopened = await reopenAssignment(assignment.id, "Uji pembukaan kembali", adminActor);
  ok("Revisi baru berstatus DRAFT dengan skor lama tersalin", reopened.state === "DRAFT");
  ok("Revisi baru mewarisi 2 skor dari respons terkirim sebelumnya", reopened.scores.length === 2);

  const reopenedAssignmentStatus = await prisma.assignment.findUniqueOrThrow({ where: { id: assignment.id } });
  ok("Status tugas menjadi DIBUKA_KEMBALI", reopenedAssignmentStatus.status === "DIBUKA_KEMBALI");

  const formDataAfterReopen = await getAssignmentFormData(assignment.id, evaluatorActor);
  ok(
    "Respons berlaku TETAP jawaban lama (revisi draf belum mengubah leaderboard, Bab 11.5)",
    formDataAfterReopen.effectiveRevision?.id === submitted1.id
  );
  ok("editableRevision kini terisi (revisi draf baru)", formDataAfterReopen.editableRevision?.id === reopened.id);

  console.log("== Revisi setelah dibuka kembali menggantikan respons berlaku ==");
  const revisedScores = [
    { parameterId: paramLayanan.id, score: 95 },
    { parameterId: paramDisiplin.id, score: 85 },
  ];
  // Revisi draf dari reopenAssignment SUDAH ADA (wasCreated=false di sisi submitResponse),
  // sehingga versi yang diharapkan harus mengikuti versi revisi tersebut.
  const submitted3 = await submitResponse(assignment.id, revisedScores, "key-after-reopen", reopened.version, evaluatorActor);
  ok("Revisi baru berhasil dikirim", submitted3.state === "SUBMITTED");

  const formDataAfterResubmit = await getAssignmentFormData(assignment.id, evaluatorActor);
  ok(
    "Respons berlaku kini revisi terbaru yang menggantikan yang lama",
    formDataAfterResubmit.effectiveRevision?.id === submitted3.id
  );
  ok("Kedua revisi (lama & baru) tetap tersimpan di audit (Bab 11.5)", formDataAfterResubmit.assignment.responseRevisions.length === 2);

  console.log("== Admin edit langsung (koreksi, Bab 2.1) ==");
  await expectServiceError("Edit langsung tanpa alasan ditolak", () =>
    adminEditResponse(assignment.id, revisedScores, "", adminActor)
  );
  const corrected = await adminEditResponse(
    assignment.id,
    [
      { parameterId: paramLayanan.id, score: 100 },
      { parameterId: paramDisiplin.id, score: 100 },
    ],
    "Koreksi kesalahan input",
    adminActor
  );
  ok("Koreksi admin langsung tersimpan sebagai revisi SUBMITTED baru", corrected.state === "SUBMITTED");

  console.log("== Admin membatalkan jawaban (void, Bab 10.6) ==");
  await expectServiceError("Void tanpa alasan ditolak", () => voidResponse(corrected.id, "", adminActor));
  const voided = await voidResponse(corrected.id, "Data tidak valid, diminta ulang", adminActor);
  ok("Jawaban berhasil dibatalkan (voided=true)", voided.voided === true);

  const formDataAfterVoid = await getAssignmentFormData(assignment.id, evaluatorActor);
  ok("Pembatalan mengeluarkan respons dari agregasi tanpa menghidupkan revisi lama", formDataAfterVoid.effectiveRevision === null);

  await expectServiceError("Void ulang pada revisi yang sudah voided ditolak", () =>
    voidResponse(corrected.id, "Coba lagi", adminActor)
  );

  console.log("== Laporan masalah penugasan (Bab 11.6) ==");
  await expectServiceError("Melaporkan tugas milik orang lain ditolak", () =>
    reportIssue(assignment.id, "OBJEK_KELIRU", "Ini bukan tugas saya", strangerActor)
  );
  const otherAssignmentEvaluator = await prisma.user.findUniqueOrThrow({ where: { id: otherAssignment!.evaluatorId } });
  const issue = await reportIssue(
    otherAssignment!.id,
    "OBJEK_KELIRU",
    "Objek yang dinilai sudah pindah unit",
    actorFor(otherAssignmentEvaluator)
  );
  ok("Laporan masalah berhasil dibuat berstatus TERBUKA", issue.status === "TERBUKA");

  const resolved = await resolveIssue(issue.id, { status: "SELESAI", resolution: "Data unit sudah diperbaiki" }, adminActor);
  ok("Laporan berhasil ditandai SELESAI dengan tanggapan", resolved.status === "SELESAI" && resolved.resolution === "Data unit sudah diperbaiki");

  console.log("== Tugas dibatalkan tidak dapat diisi ==");
  const cancelTarget = otherAssignment!;
  await prisma.assignment.update({ where: { id: cancelTarget.id }, data: { status: "DIBATALKAN", cancelledAt: new Date(), cancelReason: "Uji" } });
  const cancelTargetActor = actorFor(otherAssignmentEvaluator);
  await expectServiceError("Mengisi tugas yang sudah dibatalkan ditolak", () =>
    saveDraft(cancelTarget.id, [{ parameterId: paramLayanan.id, score: 50 }], null, cancelTargetActor)
  );

  console.log("\n=== Ringkasan ===");
  console.log(`Lulus: ${pass}  Gagal: ${fail}`);
  if (fail > 0) process.exitCode = 1;

  console.log("\n== Membersihkan data uji ==");
  const periodIds = [period.id];
  await prisma.assignmentIssue.deleteMany({ where: { assignment: { categoryObject: { category: { periodId: { in: periodIds } } } } } });
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
  await prisma.assessmentObject.deleteMany({ where: { id: objDosen1004.id } });
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
