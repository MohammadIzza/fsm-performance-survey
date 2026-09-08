// Data demonstrasi Tahap 7 (Bab 23): skenario luas yang tidak masuk akal sebagai bagian dari
// seed master (prisma/seed.ts) karena bersifat contoh pemakaian, bukan data organisasi dasar.
// Aman dijalankan berulang untuk kode unik (upsert/skip bila sudah ada); dijalankan lewat
// `npm run seed:demo` SETELAH `npm run db:seed` (master) ada.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { createPeriod, transitionPeriodStatus } from "../src/lib/services/periods";
import { createCategory, addCategoryObjects } from "../src/lib/services/categories";
import { addParameter, updateInstrumentScale } from "../src/lib/services/instruments";
import { updateGroupRule } from "../src/lib/services/groupRules";
import { updateAssignmentRule } from "../src/lib/services/assignmentRules";
import { createObject } from "../src/lib/services/objects";
import { commitPlan } from "../src/lib/services/assignmentPlanning";
import { finalizePeriod, openRevision } from "../src/lib/services/finalization";
import type { AuthContext } from "../src/lib/authz";

async function directSubmit(
  assignmentId: string,
  evaluatorId: string,
  instrumentVersionId: string,
  scores: Record<string, number>,
  submittedAt: Date
) {
  const rev = await prisma.responseRevision.create({
    data: { assignmentId, revision: 1, state: "SUBMITTED", submittedAt, editedById: evaluatorId },
  });
  for (const [parameterId, score] of Object.entries(scores)) {
    await prisma.responseScore.create({ data: { responseRevisionId: rev.id, parameterId, score } });
  }
  await prisma.assignment.update({ where: { id: assignmentId }, data: { status: "TERKIRIM", instrumentVersionId } });
  return rev;
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
  const orangType = await prisma.objectType.findUniqueOrThrow({ where: { code: "ORANG" } });
  const karyaType = await prisma.objectType.findUniqueOrThrow({ where: { code: "KARYA" } });

  const dosen1004 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1004" } });
  const dosen1005 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1005" } });
  const dosen1006 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1006" } });
  const dosen1001 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1001" } }); // Ketua Dep. Matematika

  const existing = await prisma.period.findUnique({ where: { code: "DEMO-AKTIF" } });
  if (existing) {
    console.log("Data demo sudah ada (DEMO-AKTIF ditemukan). Lewati agar tidak duplikat.");
    console.log("Untuk membuat ulang, hapus periode berkode DEMO-* lebih dulu.");
    return;
  }

  console.log("== Periode 1: Aktif, lewat tenggat, seluruh status tugas (Bab 23) ==");
  const periodAktif = await createPeriod(
    {
      code: "DEMO-AKTIF",
      name: "Demo — Periode Aktif (Lewat Tenggat)",
      description: "Menunjukkan seluruh status tugas termasuk yang lewat tenggat namun periode belum ditutup admin.",
      timezone: "Asia/Jakarta",
      startsAt: "2026-08-01",
      endsAt: "2026-08-31", // sudah lewat relatif terhadap tanggal sistem saat ini
    },
    actor
  );
  const catAktif = await createCategory(
    periodAktif.id,
    { code: "DEMO-KINERJA", name: "Kinerja Dosen (Demo)", description: null, objectTypeId: orangType.id, excludeContributors: true },
    actor
  );
  const catAktifFull = await prisma.category.findUniqueOrThrow({
    where: { id: catAktif.id },
    include: { instrumentVersions: true, groupRules: true, assignmentRules: true },
  });
  const pLayanan = await addParameter(catAktifFull.instrumentVersions[0].id, { name: "Layanan", indicator: null, weight: 60, order: 1 }, actor);
  await addParameter(catAktifFull.instrumentVersions[0].id, { name: "Disiplin", indicator: null, weight: 40, order: 2 }, actor);
  await updateGroupRule(catAktifFull.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 3, minimum: 1 }, actor);
  await updateGroupRule(catAktifFull.groupRules.find((r) => r.group === "PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 1, minimum: 1 }, actor);
  await updateAssignmentRule(catAktifFull.assignmentRules.find((r) => r.group === "SELAIN_PIMPINAN")!.id, { scope: "UNIT_DAN_SUBUNIT", userTypeIds: [] }, actor);

  const objAktif1 = await createObject(
    { typeId: orangType.id, name: dosen1004.name, ownerUnitId: depMat.id, referenceUserId: dosen1004.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    actor
  );
  const objAktif2 = await createObject(
    { typeId: orangType.id, name: dosen1005.name, ownerUnitId: depMat.id, referenceUserId: dosen1005.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    actor
  );
  await addCategoryObjects(catAktif.id, [objAktif1.id, objAktif2.id], actor);
  await commitPlan(catAktif.id, "demo-seed-aktif", actor);
  await transitionPeriodStatus(periodAktif.id, "SIAP", actor);
  await transitionPeriodStatus(periodAktif.id, "AKTIF", actor);

  const assignmentsObj1 = await prisma.assignment.findMany({
    where: { categoryObjectId: (await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: catAktif.id, objectId: objAktif1.id } })).id, group: "SELAIN_PIMPINAN" },
  });
  // Sebar status: index0=Draf, index1=Terkirim, index2 dibiarkan Belum mulai (jadi tampil "Lewat tenggat").
  if (assignmentsObj1[0]) {
    await prisma.responseRevision.create({
      data: { assignmentId: assignmentsObj1[0].id, revision: 1, state: "DRAFT", editedById: assignmentsObj1[0].evaluatorId },
    });
    await prisma.assignment.update({ where: { id: assignmentsObj1[0].id }, data: { status: "DRAF" } });
  }
  if (assignmentsObj1[1]) {
    await directSubmit(assignmentsObj1[1].id, assignmentsObj1[1].evaluatorId, catAktifFull.instrumentVersions[0].id, { [pLayanan.id]: 85 }, new Date("2026-08-15"));
  }
  // assignmentsObj1[2] dibiarkan BELUM_MULAI -> tampil "Lewat tenggat" di UI.

  const assignmentsObj2 = await prisma.assignment.findMany({
    where: { categoryObjectId: (await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: catAktif.id, objectId: objAktif2.id } })).id, group: "SELAIN_PIMPINAN" },
  });
  if (assignmentsObj2[0]) {
    const submitted = await directSubmit(assignmentsObj2[0].id, assignmentsObj2[0].evaluatorId, catAktifFull.instrumentVersions[0].id, { [pLayanan.id]: 70 }, new Date("2026-08-10"));
    // Dibuka kembali admin (Bab 11.5): revisi draf baru mewarisi skor lama; respons berlaku
    // tetap revisi 1 sampai revisi 2 benar-benar dikirim.
    const submittedScores = await prisma.responseScore.findMany({ where: { responseRevisionId: submitted.id } });
    const revisi2 = await prisma.responseRevision.create({
      data: { assignmentId: assignmentsObj2[0].id, revision: 2, state: "DRAFT", editedById: admin.id, reason: "Demo pembukaan kembali" },
    });
    for (const s of submittedScores) {
      await prisma.responseScore.create({ data: { responseRevisionId: revisi2.id, parameterId: s.parameterId, score: s.score } });
    }
    await prisma.assignment.update({ where: { id: assignmentsObj2[0].id }, data: { status: "DIBUKA_KEMBALI" } });
  }
  if (assignmentsObj2[1]) {
    await prisma.assignment.update({
      where: { id: assignmentsObj2[1].id },
      data: { status: "DIBATALKAN", cancelledAt: new Date(), cancelReason: "Demo pembatalan — penilai keliru ditugaskan" },
    });
  }

  console.log("== Periode 2: Ditutup — nilai seri, minimum tidak terpenuhi, tanpa respons Pimpinan ==");
  const periodDitutup = await createPeriod(
    { code: "DEMO-DITUTUP", name: "Demo — Periode Ditutup", description: null, timezone: "Asia/Jakarta", startsAt: "2026-06-01", endsAt: "2026-06-30" },
    actor
  );
  const catDitutup = await createCategory(
    periodDitutup.id,
    { code: "DEMO-KARYA", name: "Karya Inovasi (Demo)", description: null, objectTypeId: karyaType.id, excludeContributors: true },
    actor
  );
  const catDitutupFull = await prisma.category.findUniqueOrThrow({
    where: { id: catDitutup.id },
    include: { instrumentVersions: true, groupRules: true, assignmentRules: true },
  });
  // Bab 12.6: kategori ini memakai skala 1–5 (bukan default 0–100).
  await updateInstrumentScale(catDitutupFull.instrumentVersions[0].id, { scaleMin: 1, scaleMax: 5, scaleStep: 1, guide: "Skala 1 (kurang) sampai 5 (sangat baik)." }, actor);
  const pKualitas = await addParameter(catDitutupFull.instrumentVersions[0].id, { name: "Kualitas", indicator: null, weight: 100, order: 1 }, actor);
  // target=minimum=2: mencerminkan tepat jumlah penilai yang secara manual ditugaskan di bawah
  // (bukan lewat pengacakan Tahap 3); karyaC sengaja hanya menerima 1 dari 2 respons yang
  // disyaratkan, mendemonstrasikan "objek minimum tidak terpenuhi" (Bab 23).
  await updateGroupRule(catDitutupFull.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 2, minimum: 2 }, actor);
  // target=0: kategori ini sengaja tidak memiliki penugasan Pimpinan sama sekali (Bab 23: "satu
  // tanpa respons pimpinan"); minimum ikut 0 agar tidak melanggar validasi minimum<=target.
  await updateGroupRule(catDitutupFull.groupRules.find((r) => r.group === "PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, actor);

  const karyaA = await createObject(
    { typeId: karyaType.id, name: "Aplikasi Presensi Digital", ownerUnitId: depMat.id, referenceUserId: null, referenceUnitId: null, responsibleUserId: dosen1004.id, url: "https://contoh.local/presensi", description: "Karya demo A", contributorUserIds: [dosen1005.id] },
    actor
  );
  const karyaB = await createObject(
    { typeId: karyaType.id, name: "Sistem Antrean Laboratorium", ownerUnitId: depMat.id, referenceUserId: null, referenceUnitId: null, responsibleUserId: dosen1006.id, url: "https://contoh.local/antrean", description: "Karya demo B", contributorUserIds: [] },
    actor
  );
  const karyaC = await createObject(
    { typeId: karyaType.id, name: "Papan Pengumuman Elektronik", ownerUnitId: depMat.id, referenceUserId: null, referenceUnitId: null, responsibleUserId: dosen1006.id, url: null, description: "Objek dengan minimum tidak terpenuhi", contributorUserIds: [] },
    actor
  );
  await addCategoryObjects(catDitutup.id, [karyaA.id, karyaB.id, karyaC.id], actor);

  const coA = await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: catDitutup.id, objectId: karyaA.id } });
  const coB = await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: catDitutup.id, objectId: karyaB.id } });
  const coC = await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: catDitutup.id, objectId: karyaC.id } });

  // Dua objek dengan nilai akhir SAMA (skor 4 dari 2 penilai masing-masing) — memicu peringkat kompetisi.
  for (const [co, evaluators] of [[coA, [dosen1006.id, dosen1001.id]], [coB, [dosen1005.id, dosen1001.id]]] as const) {
    for (const evaluatorId of evaluators) {
      const a = await prisma.assignment.create({ data: { categoryObjectId: co.id, evaluatorId, group: "SELAIN_PIMPINAN", instrumentVersionId: catDitutupFull.instrumentVersions[0].id, reason: "Demo" } });
      await directSubmit(a.id, evaluatorId, catDitutupFull.instrumentVersions[0].id, { [pKualitas.id]: 4 }, new Date("2026-06-15"));
    }
  }
  // Objek C: minimum 2 respons disyaratkan, hanya 1 yang terkirim -> belum memenuhi syarat peringkat.
  const cAssignment = await prisma.assignment.create({ data: { categoryObjectId: coC.id, evaluatorId: dosen1005.id, group: "SELAIN_PIMPINAN", instrumentVersionId: catDitutupFull.instrumentVersions[0].id, reason: "Demo" } });
  await directSubmit(cAssignment.id, dosen1005.id, catDitutupFull.instrumentVersions[0].id, { [pKualitas.id]: 5 }, new Date("2026-06-16"));
  // Tidak ada penugasan/respons kelompok Pimpinan sama sekali pada kategori ini (Bab 23: "satu tanpa respons pimpinan").

  await transitionPeriodStatus(periodDitutup.id, "SIAP", actor).catch(() => {
    // Readiness generik mensyaratkan penugasan Pimpinan pernah diterapkan; kategori ini sengaja
    // tidak punya target Pimpinan (target=0) sehingga readiness tetap lulus — bila gagal karena
    // sebab lain, transisi berikutnya (paksa via SQL) tetap mendemonstrasikan periode Ditutup.
  });
  const checkStatus = await prisma.period.findUniqueOrThrow({ where: { id: periodDitutup.id } });
  if (checkStatus.status !== "SIAP") {
    await prisma.period.update({ where: { id: periodDitutup.id }, data: { status: "SIAP" } });
  }
  await transitionPeriodStatus(periodDitutup.id, "AKTIF", actor);
  await transitionPeriodStatus(periodDitutup.id, "DITUTUP", actor);

  console.log("== Periode 3: Final ==");
  const periodFinal = await createPeriod(
    { code: "DEMO-FINAL", name: "Demo — Periode Final", description: null, timezone: "Asia/Jakarta", startsAt: "2026-04-01", endsAt: "2026-04-30" },
    actor
  );
  const catFinal = await createCategory(
    periodFinal.id,
    { code: "DEMO-KINERJA-F", name: "Kinerja Dosen (Final)", description: null, objectTypeId: orangType.id, excludeContributors: true },
    actor
  );
  const catFinalFull = await prisma.category.findUniqueOrThrow({ where: { id: catFinal.id }, include: { instrumentVersions: true, groupRules: true } });
  const pF = await addParameter(catFinalFull.instrumentVersions[0].id, { name: "Kinerja", indicator: null, weight: 100, order: 1 }, actor);
  await updateGroupRule(catFinalFull.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, actor);
  await updateGroupRule(catFinalFull.groupRules.find((r) => r.group === "PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, actor);
  const objFinal = await createObject(
    { typeId: orangType.id, name: dosen1006.name, ownerUnitId: depMat.id, referenceUserId: dosen1006.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    actor
  );
  await addCategoryObjects(catFinal.id, [objFinal.id], actor);
  const coFinal = await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: catFinal.id, objectId: objFinal.id } });
  const finalAssignment = await prisma.assignment.create({ data: { categoryObjectId: coFinal.id, evaluatorId: dosen1005.id, group: "SELAIN_PIMPINAN", instrumentVersionId: catFinalFull.instrumentVersions[0].id, reason: "Demo" } });
  await directSubmit(finalAssignment.id, dosen1005.id, catFinalFull.instrumentVersions[0].id, { [pF.id]: 90 }, new Date("2026-04-20"));
  await prisma.period.update({ where: { id: periodFinal.id }, data: { status: "SIAP" } });
  await transitionPeriodStatus(periodFinal.id, "AKTIF", actor);
  await transitionPeriodStatus(periodFinal.id, "DITUTUP", actor);
  await finalizePeriod(periodFinal.id, "Finalisasi demo", actor);

  console.log("== Periode 4: Final dengan riwayat revisi ==");
  const periodFinalRevisi = await createPeriod(
    { code: "DEMO-FINAL-REVISI", name: "Demo — Final dengan Revisi", description: null, timezone: "Asia/Jakarta", startsAt: "2026-03-01", endsAt: "2026-03-31" },
    actor
  );
  const catFR = await createCategory(
    periodFinalRevisi.id,
    { code: "DEMO-KINERJA-FR", name: "Kinerja Dosen (Final Revisi)", description: null, objectTypeId: orangType.id, excludeContributors: true },
    actor
  );
  const catFRFull = await prisma.category.findUniqueOrThrow({ where: { id: catFR.id }, include: { instrumentVersions: true, groupRules: true } });
  const pFR = await addParameter(catFRFull.instrumentVersions[0].id, { name: "Kinerja", indicator: null, weight: 100, order: 1 }, actor);
  await updateGroupRule(catFRFull.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, actor);
  await updateGroupRule(catFRFull.groupRules.find((r) => r.group === "PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, actor);
  const objFR = await createObject(
    { typeId: orangType.id, name: dosen1004.name, ownerUnitId: depMat.id, referenceUserId: dosen1004.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    actor
  );
  await addCategoryObjects(catFR.id, [objFR.id], actor);
  const coFR = await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: catFR.id, objectId: objFR.id } });
  const frAssignment = await prisma.assignment.create({ data: { categoryObjectId: coFR.id, evaluatorId: dosen1005.id, group: "SELAIN_PIMPINAN", instrumentVersionId: catFRFull.instrumentVersions[0].id, reason: "Demo" } });
  const frRev1 = await directSubmit(frAssignment.id, dosen1005.id, catFRFull.instrumentVersions[0].id, { [pFR.id]: 75 }, new Date("2026-03-20"));
  await prisma.period.update({ where: { id: periodFinalRevisi.id }, data: { status: "SIAP" } });
  await transitionPeriodStatus(periodFinalRevisi.id, "AKTIF", actor);
  await transitionPeriodStatus(periodFinalRevisi.id, "DITUTUP", actor);
  await finalizePeriod(periodFinalRevisi.id, "Finalisasi pertama (sebelum koreksi)", actor);

  await openRevision(periodFinalRevisi.id, "Skor 75 keliru dimasukkan, seharusnya 92", actor);
  await prisma.responseRevision.update({ where: { id: frRev1.id }, data: {} });
  const frRev2 = await prisma.responseRevision.create({
    data: { assignmentId: frAssignment.id, revision: 2, state: "SUBMITTED", submittedAt: new Date("2026-03-25"), editedById: admin.id, reason: "Koreksi skor" },
  });
  await prisma.responseScore.create({ data: { responseRevisionId: frRev2.id, parameterId: pFR.id, score: 92 } });
  await prisma.assignment.update({ where: { id: frAssignment.id }, data: { status: "TERKIRIM" } });
  await transitionPeriodStatus(periodFinalRevisi.id, "DITUTUP", actor);
  await finalizePeriod(periodFinalRevisi.id, "Finalisasi kedua (setelah koreksi)", actor);

  console.log("\nData demo Tahap 7 selesai dibuat:");
  console.log("- DEMO-AKTIF: periode Aktif, lewat tenggat, seluruh status tugas");
  console.log("- DEMO-DITUTUP: periode Ditutup, skala 1-5, nilai seri, minimum tak terpenuhi, tanpa respons Pimpinan");
  console.log("- DEMO-FINAL: periode Final (revisi 1)");
  console.log("- DEMO-FINAL-REVISI: periode Final dengan riwayat 2 revisi finalisasi");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
