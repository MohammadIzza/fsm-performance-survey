import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { ServiceError } from "../src/lib/services/units";
import { createPeriod, transitionPeriodStatus } from "../src/lib/services/periods";
import { openRevision } from "../src/lib/services/finalization";
import { createCategory, addCategoryObjects, removeCategoryObject } from "../src/lib/services/categories";
import { manualAssignEvaluator } from "../src/lib/services/assignments";
import { addParameter } from "../src/lib/services/instruments";
import { updateGroupRule } from "../src/lib/services/groupRules";
import { updateAssignmentRule } from "../src/lib/services/assignmentRules";
import { commitPlan } from "../src/lib/services/assignmentPlanning";
import { createObject } from "../src/lib/services/objects";
import {
  saveDraft,
  submitResponse,
  reopenAssignment,
  openLateAssignments,
  adminEditResponse,
  voidResponse,
  getAssignmentFormData,
} from "../src/lib/services/responses";
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
  // Target 4 (bukan 2): 2 slot ekstra dipakai EDGE-08 (pindah unit) dan EDGE-09/10 (nonaktifkan
  // penilai) di bawah, tanpa mengganggu `assignment`/`otherAssignment` yang sudah dipakai luas.
  await updateGroupRule(selainRule.id, { aggregation: "RATA_RATA", target: 4, minimum: 1 }, adminActor);
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
  if (selainAssignments.length < 4) {
    throw new Error(`Prasyarat uji tidak terpenuhi: butuh 4 tugas Selain Pimpinan, hanya ada ${selainAssignments.length}.`);
  }
  const assignment = selainAssignments[0];
  const otherAssignment = selainAssignments[1];
  const moverAssignment = selainAssignments[2]; // EDGE-08
  const deactivatedAssignment = selainAssignments[3]; // EDGE-09/10

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

  const otherAssignmentEvaluator = await prisma.user.findUniqueOrThrow({ where: { id: otherAssignment!.evaluatorId } });

  console.log("== Tugas dibatalkan tidak dapat diisi ==");
  const cancelTarget = otherAssignment!;
  await prisma.assignment.update({ where: { id: cancelTarget.id }, data: { status: "DIBATALKAN", cancelledAt: new Date(), cancelReason: "Uji" } });
  const cancelTargetActor = actorFor(otherAssignmentEvaluator);
  await expectServiceError("Mengisi tugas yang sudah dibatalkan ditolak", () =>
    saveDraft(cancelTarget.id, [{ parameterId: paramLayanan.id, score: 50 }], null, cancelTargetActor)
  );

  console.log("== EDGE-08: penilai pindah unit SAAT periode aktif -> tugas lama tidak berubah ==");
  const moverUser = await prisma.user.findUniqueOrThrow({ where: { id: moverAssignment.evaluatorId } });
  const moverOriginalUnitId = moverUser.primaryUnitId;
  const tuFsm = await prisma.unit.findUniqueOrThrow({ where: { code: "TU-FSM" } });
  const moverActor = actorFor(moverUser);
  const submittedByMoverBeforeMove = await submitResponse(
    moverAssignment.id,
    [{ parameterId: paramLayanan.id, score: 70 }, { parameterId: paramDisiplin.id, score: 60 }],
    "test-t4-mover-key",
    null,
    moverActor
  );
  ok("Penilai mengirim jawaban normal sebelum pindah unit", submittedByMoverBeforeMove.state === "SUBMITTED");
  await prisma.user.update({ where: { id: moverUser.id }, data: { primaryUnitId: tuFsm.id } });
  const assignmentAfterMove = await prisma.assignment.findUniqueOrThrow({ where: { id: moverAssignment.id } });
  ok(
    "Snapshot penilai (nama/ID login) di tugas TIDAK berubah walau primaryUnitId pengguna berubah",
    assignmentAfterMove.evaluatorNameSnapshot === moverUser.name &&
      assignmentAfterMove.evaluatorLoginSnapshot === moverUser.loginIdentifier &&
      assignmentAfterMove.evaluatorId === moverUser.id
  );
  const formDataAfterMove = await getAssignmentFormData(moverAssignment.id, moverActor);
  ok(
    "Jawaban lama tetap terbaca utuh (skor 70/60) meski penilai sudah pindah unit",
    formDataAfterMove.effectiveRevision?.scores.find((s) => s.parameterId === paramLayanan.id)?.score === 70
  );
  // Kembalikan agar tidak mengotori data pengguna seed untuk skrip/demo lain.
  await prisma.user.update({ where: { id: moverUser.id }, data: { primaryUnitId: moverOriginalUnitId } });

  console.log("== EDGE-09/10: nonaktifkan penilai -> tidak bisa mengoreksi, jawaban lama tetap terbaca ==");
  const deactivatedUser = await prisma.user.findUniqueOrThrow({ where: { id: deactivatedAssignment.evaluatorId } });
  const deactivatedActor = actorFor(deactivatedUser);
  const submittedBeforeDeactivate = await submitResponse(
    deactivatedAssignment.id,
    [{ parameterId: paramLayanan.id, score: 55 }, { parameterId: paramDisiplin.id, score: 65 }],
    "test-t4-deactivated-key",
    null,
    deactivatedActor
  );
  ok("Penilai mengirim jawaban normal sebelum dinonaktifkan", submittedBeforeDeactivate.state === "SUBMITTED");
  // Admin membuka kembali untuk koreksi (Bab 11.5) SEBELUM dinonaktifkan — supaya penolakan di
  // bawah benar-benar teruji karena akun nonaktif, bukan karena status tugas TERKIRIM terkunci.
  await reopenAssignment(deactivatedAssignment.id, "Uji EDGE-09/10", adminActor, new Date(Date.now() + 3600_000).toISOString());
  await prisma.user.update({ where: { id: deactivatedUser.id }, data: { active: false } });
  await expectServiceError(
    "Simpan draf oleh penilai nonaktif ditolak walau tugas sedang dibuka kembali (EDGE-09)",
    () => saveDraft(deactivatedAssignment.id, [{ parameterId: paramLayanan.id, score: 90 }], null, { ...deactivatedActor, active: false })
  );
  await expectServiceError(
    "Kirim jawaban oleh penilai nonaktif ditolak (EDGE-09)",
    () =>
      submitResponse(
        deactivatedAssignment.id,
        [{ parameterId: paramLayanan.id, score: 90 }, { parameterId: paramDisiplin.id, score: 90 }],
        "test-t4-deactivated-key-2",
        null,
        { ...deactivatedActor, active: false }
      )
  );
  const formDataForDeactivated = await getAssignmentFormData(deactivatedAssignment.id, { ...deactivatedActor, active: false });
  ok(
    "Jawaban lama (skor 55/65) tetap dapat DILIHAT oleh pemiliknya sendiri walau akunnya nonaktif (EDGE-10)",
    formDataForDeactivated.effectiveRevision?.scores.find((s) => s.parameterId === paramLayanan.id)?.score === 55
  );
  const formDataForAdminViewingDeactivated = await getAssignmentFormData(deactivatedAssignment.id, adminActor);
  ok(
    "Admin juga tetap dapat melihat jawaban lama milik penilai yang sudah nonaktif",
    formDataForAdminViewingDeactivated.effectiveRevision?.scores.length === 2
  );
  // Kembalikan aktif agar tidak mengotori data pengguna seed untuk skrip/demo lain.
  await prisma.user.update({ where: { id: deactivatedUser.id }, data: { active: true } });

  console.log("== AC-27/EDGE-13: tenggat pengisian ditegakkan presisi ke waktu server, bukan status tersimpan ==");
  const shortPeriod = await createPeriod(
    {
      code: "TEST-T4-DEADLINE",
      name: "Uji Tenggat Presisi",
      description: null,
      timezone: "Asia/Jakarta",
      startsAt: new Date(Date.now() - 60_000).toISOString(),
      endsAt: new Date(Date.now() + 2000).toISOString(), // 2 detik dari sekarang
    },
    adminActor
  );
  const shortCategory = await createCategory(
    shortPeriod.id,
    { code: "TENGGAT-T4", name: "Tenggat (Uji T4)", description: null, objectTypeId: orangType.id, excludeContributors: true },
    adminActor
  );
  const shortCatFull = await prisma.category.findUniqueOrThrow({
    where: { id: shortCategory.id },
    include: { instrumentVersions: true, groupRules: true, assignmentRules: true },
  });
  const shortParam = await addParameter(shortCatFull.instrumentVersions[0].id, { name: "Nilai", indicator: null, weight: 100, order: 1 }, adminActor);
  const shortPimpinanRule = shortCatFull.groupRules.find((r) => r.group === "PIMPINAN")!;
  const shortSelainRule = shortCatFull.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
  await updateGroupRule(shortPimpinanRule.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, adminActor);
  await updateGroupRule(shortSelainRule.id, { aggregation: "RATA_RATA", target: 1, minimum: 1 }, adminActor);
  const shortAssignRule = shortCatFull.assignmentRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
  await updateAssignmentRule(shortAssignRule.id, { scope: "UNIT_DAN_SUBUNIT", userTypeIds: [] }, adminActor);
  const shortObj = await createObject(
    { typeId: orangType.id, name: dosen1004.name, ownerUnitId: depMat.id, referenceUserId: dosen1004.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    adminActor
  );
  await addCategoryObjects(shortCategory.id, [shortObj.id], adminActor);
  await commitPlan(shortCategory.id, "test-t4-deadline-seed", adminActor);
  const shortAssignment = await prisma.assignment.findFirstOrThrow({ where: { categoryObject: { categoryId: shortCategory.id } } });
  const shortEvaluator = await prisma.user.findUniqueOrThrow({ where: { id: shortAssignment.evaluatorId } });
  const shortActor = actorFor(shortEvaluator);
  await transitionPeriodStatus(shortPeriod.id, "SIAP", adminActor);
  await transitionPeriodStatus(shortPeriod.id, "AKTIF", adminActor);

  const beforeDeadline = await submitResponse(
    shortAssignment.id,
    [{ parameterId: shortParam.id, score: 80 }],
    "test-t4-deadline-before",
    null,
    shortActor
  );
  ok("Kirim jawaban SEBELUM tenggat lewat berhasil (status Period masih AKTIF di DB)", beforeDeadline.state === "SUBMITTED");

  // Reset ke DRAF secara langsung di DB (bukan lewat admin-tools) semata untuk menguji ulang
  // assertFillable dengan assignment BELUM_MULAI setelah tenggat lewat, tanpa terganjal status
  // TERKIRIM yang sudah benar diuji terpisah di "Kunci setelah terkirim (AC-12)" di atas.
  await prisma.responseScore.deleteMany({ where: { responseRevision: { assignmentId: shortAssignment.id } } });
  await prisma.responseRevision.deleteMany({ where: { assignmentId: shortAssignment.id } });
  await prisma.assignment.update({ where: { id: shortAssignment.id }, data: { status: "BELUM_MULAI" } });

  await new Promise((r) => setTimeout(r, 2500)); // lewati endsAt (Period.status TETAP "AKTIF" di DB — tidak ada penutup otomatis, Bab 7.2)
  const periodStillMarkedActive = await prisma.period.findUniqueOrThrow({ where: { id: shortPeriod.id } });
  ok(
    "Period.status TETAP tersimpan AKTIF di DB walau waktu tenggat sudah lewat (tidak ada penutup otomatis)",
    periodStillMarkedActive.status === "AKTIF"
  );
  await expectServiceError(
    "Kirim jawaban SETELAH tenggat lewat ditolak (dibandingkan ke waktu server saat ini, bukan status Period yang tersimpan)",
    () => submitResponse(shortAssignment.id, [{ parameterId: shortParam.id, score: 80 }], "test-t4-deadline-after", null, shortActor)
  );

  console.log("== Penambahan saat periode berjalan (Aktif) ==");
  const dosen1007 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1007" } });
  const objBerjalan = await createObject(
    { typeId: orangType.id, name: dosen1007.name, ownerUnitId: depMat.id, referenceUserId: dosen1007.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    adminActor
  );
  await expectServiceError("Tambah objek saat Aktif tanpa alasan ditolak", () =>
    addCategoryObjects(category.id, [objBerjalan.id], adminActor)
  );
  const ditambah = await addCategoryObjects(category.id, [objBerjalan.id], adminActor, "Dosen baru bergabung");
  ok("Tambah objek saat Aktif dengan alasan berhasil", ditambah === 1);
  const auditTambah = await prisma.auditEvent.findFirst({
    where: { action: "CATEGORY_OBJECTS_ADD", entityId: category.id },
    orderBy: { createdAt: "desc" },
  });
  ok("Alasan penambahan objek tercatat di audit", auditTambah?.reason === "Dosen baru bergabung");
  const coBerjalan = await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: category.id, objectId: objBerjalan.id } });
  await expectServiceError("Mengeluarkan objek saat Aktif tetap ditolak", () => removeCategoryObject(coBerjalan.id, adminActor));
  await expectServiceError("Mengubah aturan penilai saat Aktif tetap ditolak", () =>
    updateGroupRule(selainRule.id, { aggregation: "RATA_RATA", target: 5, minimum: 1 }, adminActor)
  );
  await expectServiceError("Penugasan manual saat Aktif tanpa alasan ditolak", () =>
    manualAssignEvaluator({ categoryObjectId: coBerjalan.id, group: "SELAIN_PIMPINAN", evaluatorId: dosen1005.id }, adminActor)
  );
  const manual = await manualAssignEvaluator(
    { categoryObjectId: coBerjalan.id, group: "SELAIN_PIMPINAN", evaluatorId: dosen1005.id, reason: "Penilai tambahan" },
    adminActor
  );
  ok("Penugasan manual saat Aktif dengan alasan berhasil (dengan snapshot nama penilai)", manual.status === "BELUM_MULAI" && manual.evaluatorNameSnapshot === dosen1005.name);
  await expectServiceError("Pembagian otomatis saat Aktif tanpa alasan ditolak", () =>
    commitPlan(category.id, "test-t4-berjalan", adminActor)
  );
  const sebelumBagi = await prisma.assignment.count({ where: { categoryObject: { categoryId: category.id } } });
  const bagi = await commitPlan(category.id, "test-t4-berjalan", adminActor, undefined, "Objek baru perlu penilai");
  const sesudahBagi = await prisma.assignment.count({ where: { categoryObject: { categoryId: category.id } } });
  ok(
    `Pembagian otomatis saat Aktif hanya menambah tugas (${bagi.plan.totalNewAssignments} baru)`,
    bagi.plan.totalNewAssignments > 0 && sesudahBagi === sebelumBagi + bagi.plan.totalNewAssignments
  );
  await expectServiceError("Penambahan setelah tenggat lewat ditolak walau status masih Aktif", () =>
    addCategoryObjects(shortCategory.id, [objBerjalan.id], adminActor, "Terlambat")
  );

  console.log("== Pengisian terlambat saat Revisi ==");
  await transitionPeriodStatus(shortPeriod.id, "DITUTUP", adminActor);
  await openRevision(shortPeriod.id, "Memberi kesempatan pengisian terlambat", adminActor);
  const lateDraft = await reopenAssignment(
    shortAssignment.id,
    "Penilai belum sempat mengisi",
    adminActor,
    new Date(Date.now() + 3600_000).toISOString()
  );
  ok("Tugas belum mulai dapat dibuka saat Revisi", lateDraft.state === "DRAFT" && lateDraft.scores.length === 0);
  const lateAssignment = await prisma.assignment.findUniqueOrThrow({ where: { id: shortAssignment.id } });
  ok("Tugas terlambat berstatus DIBUKA_KEMBALI", lateAssignment.status === "DIBUKA_KEMBALI");
  const lateSubmitted = await submitResponse(
    shortAssignment.id,
    [{ parameterId: shortParam.id, score: 80 }],
    "test-t4-late-open",
    lateDraft.version,
    shortActor
  );
  ok("Penilai dapat mengirim jawaban dalam jendela pengisian terlambat", lateSubmitted.state === "SUBMITTED");

  console.log("== Pengisian terlambat massal saat Revisi ==");
  await transitionPeriodStatus(period.id, "DITUTUP", adminActor);
  await openRevision(period.id, "Membuka kesempatan terlambat secara massal", adminActor);
  const bulkTargets = await prisma.assignment.findMany({
    where: {
      status: { in: ["BELUM_MULAI", "DRAF"] },
      categoryObject: { categoryId: category.id },
    },
    take: 2,
  });
  if (bulkTargets.length !== 2) throw new Error("Prasyarat uji massal tidak terpenuhi: butuh 2 tugas yang belum terkirim.");
  const bulkResult = await openLateAssignments(
    bulkTargets.map((assignment) => assignment.id),
    "Memberi kesempatan terlambat kepada beberapa penilai",
    adminActor,
    new Date(Date.now() + 3600_000).toISOString()
  );
  ok("Dua tugas dibuka sekaligus", bulkResult.openedCount === 2);
  const bulkOpened = await prisma.assignment.count({
    where: { id: { in: bulkTargets.map((assignment) => assignment.id) }, status: "DIBUKA_KEMBALI" },
  });
  ok("Semua tugas pilihan berstatus DIBUKA_KEMBALI", bulkOpened === 2);

  console.log("\n=== Ringkasan ===");
  console.log(`Lulus: ${pass}  Gagal: ${fail}`);
  if (fail > 0) process.exitCode = 1;

  console.log("\n== Membersihkan data uji ==");
  const periodIds = [period.id, shortPeriod.id];
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
  await prisma.assessmentObject.deleteMany({ where: { id: { in: [objDosen1004.id, shortObj.id, objBerjalan.id] } } });
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
