import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { ServiceError } from "../src/lib/services/units";
import { createPeriod, transitionPeriodStatus } from "../src/lib/services/periods";
import { createCategory, addCategoryObjects } from "../src/lib/services/categories";
import { addParameter } from "../src/lib/services/instruments";
import { updateGroupRule } from "../src/lib/services/groupRules";
import { updateAssignmentRule } from "../src/lib/services/assignmentRules";
import { computePlan, commitPlan } from "../src/lib/services/assignmentPlanning";
import { manualAssignEvaluator, cancelAssignment } from "../src/lib/services/assignments";
import { createObject } from "../src/lib/services/objects";
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
  const dosen1001 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1001" } }); // Ketua Dep. Matematika
  const dosen1004 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1004" } }); // PS-MAT
  const dosen1005 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1005" } }); // PS-MAT
  const dosen1006 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1006" } }); // PS-STAT
  const dosen1007 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1007" } }); // PS-FIS (luar lingkup)
  const orangType = await prisma.objectType.findUniqueOrThrow({ where: { code: "ORANG" } });
  const karyaType = await prisma.objectType.findUniqueOrThrow({ where: { code: "KARYA" } });

  console.log("== Setup periode & kategori ==");
  const period = await createPeriod(
    { code: "TEST-T3-1", name: "Uji Tahap 3", description: null, timezone: "Asia/Jakarta", startsAt: "2026-09-01", endsAt: "2026-09-30" },
    actor
  );
  const category = await createCategory(
    period.id,
    { code: "KINERJA-T3", name: "Kinerja (Uji T3)", description: null, objectTypeId: orangType.id, excludeContributors: true },
    actor
  );
  const catFull = await prisma.category.findUniqueOrThrow({
    where: { id: category.id },
    include: { instrumentVersions: true, groupRules: true, assignmentRules: true },
  });
  const instrumentId = catFull.instrumentVersions[0].id;
  await addParameter(instrumentId, { name: "Kinerja", indicator: null, weight: 100, order: 1 }, actor);

  const pimpinanRule = catFull.groupRules.find((r) => r.group === "PIMPINAN")!;
  const selainRule = catFull.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
  await updateGroupRule(pimpinanRule.id, { aggregation: "RATA_RATA", target: 1, minimum: 1 }, actor);
  await updateGroupRule(selainRule.id, { aggregation: "RATA_RATA", target: 2, minimum: 1 }, actor);

  const assignSelainRule = catFull.assignmentRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
  await updateAssignmentRule(assignSelainRule.id, { scope: "UNIT_DAN_SUBUNIT", userTypeIds: [] }, actor);

  console.log("== Readiness sebelum penugasan ==");
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
  await addCategoryObjects(category.id, [objDosen1004.id], actor);

  console.log("== computePlan: objek biasa (bukan pimpinan) ==");
  let plan = await computePlan(category.id, "test-seed-1");
  const pimpinanEntry1 = plan.entries.find((e) => e.categoryObjectId && e.group === "PIMPINAN")!;
  ok(
    "Kelompok Pimpinan: hanya 1 calon (Ketua Dep. Matematika)",
    pimpinanEntry1.eligibleCount === 1 && pimpinanEntry1.picked[0]?.userId === dosen1001.id
  );
  const selainEntry1 = plan.entries.find((e) => e.group === "SELAIN_PIMPINAN")!;
  // Pool unit+subunit DEP-MAT (tanpa filter jenis pengguna) mencakup dosen1001, dosen1004,
  // dosen1005, dan 2 mahasiswa di PS-MAT = 5 anggota; dikurangi diri sendiri (dosen1004) dan
  // dosen1001 yang sudah terpakai kelompok Pimpinan pada objek yang sama (DEF-09) = 3 calon sah.
  // Statistika tidak ikut: sejak struktur fakultas dibetulkan, PS-STAT berada di bawah DEP-STAT.
  ok(
    "Kelompok Selain Pimpinan: 3 calon (unit+subunit dikurangi diri sendiri & pimpinan terpakai)",
    selainEntry1.eligibleCount === 3 && selainEntry1.picked.length === 2 && selainEntry1.shortage === 0
  );

  console.log("== commitPlan ==");
  const { batch } = await commitPlan(category.id, plan.seed, actor);
  ok("Batch tersimpan dengan seed yang sama", batch.seed === plan.seed);
  const createdAssignments = await prisma.assignment.findMany({ where: { batchId: batch.id } });
  ok("3 tugas diterbitkan (1 pimpinan + 2 selain pimpinan)", createdAssignments.length === 3);

  console.log("== Idempotensi: commit ulang tanpa tugas baru ditolak ==");
  await expectServiceError("Commit ulang tanpa slot kosong ditolak (tidak ada tugas baru)", () =>
    commitPlan(category.id, "test-seed-2", actor)
  );

  console.log("== EDGE-06: pimpinan menjadi objek dirinya sendiri ==");
  const objDosen1001 = await createObject(
    {
      typeId: orangType.id,
      name: dosen1001.name,
      ownerUnitId: depMat.id,
      referenceUserId: dosen1001.id,
      referenceUnitId: null,
      responsibleUserId: null,
      url: null,
      description: null,
      contributorUserIds: [],
    },
    actor
  );
  await addCategoryObjects(category.id, [objDosen1001.id], actor);
  const co1001Early = await prisma.categoryObject.findFirstOrThrow({
    where: { categoryId: category.id, objectId: objDosen1001.id },
  });
  plan = await computePlan(category.id, "test-seed-3");
  const pimpinanEntry2 = plan.entries.find(
    (e) => e.categoryObjectId === co1001Early.id && e.group === "PIMPINAN"
  )!;
  ok(
    "Pimpinan tidak menilai diri sendiri: 0 calon, kekurangan 1",
    pimpinanEntry2.eligibleCount === 0 && pimpinanEntry2.picked.length === 0 && pimpinanEntry2.shortage === 1
  );

  console.log("== Pengganti manual (Bab 10.5) mengisi kekurangan ==");
  const co1001 = co1001Early;

  await expectServiceError("Menugaskan objek untuk menilai dirinya sendiri ditolak", () =>
    manualAssignEvaluator({ categoryObjectId: co1001.id, group: "PIMPINAN", evaluatorId: dosen1001.id }, actor)
  );

  const manual = await manualAssignEvaluator(
    { categoryObjectId: co1001.id, group: "PIMPINAN", evaluatorId: dosen1007.id },
    actor
  );
  ok("Pengganti manual berhasil meski di luar pool otomatis (lintas unit)", manual.evaluatorId === dosen1007.id);

  await expectServiceError("Menugaskan penilai yang sama dua kali pada objek yang sama ditolak", () =>
    manualAssignEvaluator({ categoryObjectId: co1001.id, group: "SELAIN_PIMPINAN", evaluatorId: dosen1007.id }, actor)
  );

  console.log("== Pembatalan & pengisian ulang slot ==");
  const cancelled = await cancelAssignment(manual.id, "Uji pembatalan otomatis", actor);
  ok("Tugas berhasil dibatalkan", cancelled.status === "DIBATALKAN");

  await expectServiceError("Membatalkan tugas yang sudah dibatalkan ditolak", () =>
    cancelAssignment(manual.id, "Coba lagi", actor)
  );

  plan = await computePlan(category.id, "test-seed-4");
  const pimpinanEntry3 = plan.entries.find((e) => e.categoryObjectId === co1001.id && e.group === "PIMPINAN")!;
  ok("Setelah dibatalkan, slot kembali kosong (kekurangan 1 lagi)", pimpinanEntry3.shortage === 1);

  const reassigned = await manualAssignEvaluator(
    { categoryObjectId: co1001.id, group: "PIMPINAN", evaluatorId: dosen1007.id },
    actor
  );
  ok(
    "Menugaskan ulang penilai yang sama setelah dibatalkan memakai baris yang sama (bukan baris baru)",
    reassigned.id === manual.id && reassigned.status === "BELUM_MULAI"
  );

  console.log("== Pengecualian pembuat karya ==");
  const karyaObj = await createObject(
    {
      typeId: karyaType.id,
      name: "Karya Uji T3",
      ownerUnitId: depMat.id,
      referenceUserId: null,
      referenceUnitId: null,
      responsibleUserId: dosen1001.id,
      url: null,
      description: null,
      contributorUserIds: [dosen1005.id],
    },
    actor
  );
  // Kategori bertipe ORANG tidak menerima objek Karya; buat kategori kedua khusus untuk ini.
  const categoryKarya = await createCategory(
    period.id,
    { code: "KARYA-T3", name: "Karya (Uji T3)", description: null, objectTypeId: karyaType.id, excludeContributors: true },
    actor
  );
  const catKaryaFull = await prisma.category.findUniqueOrThrow({
    where: { id: categoryKarya.id },
    include: { instrumentVersions: true, assignmentRules: true },
  });
  await addParameter(catKaryaFull.instrumentVersions[0].id, { name: "Kualitas", indicator: null, weight: 100, order: 1 }, actor);
  const karyaSelainRule = catKaryaFull.assignmentRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
  await updateAssignmentRule(karyaSelainRule.id, { scope: "UNIT_DAN_SUBUNIT", userTypeIds: [] }, actor);
  await addCategoryObjects(categoryKarya.id, [karyaObj.id], actor);

  const karyaPlan = await computePlan(categoryKarya.id, "test-seed-karya");
  const karyaSelainEntry = karyaPlan.entries.find((e) => e.group === "SELAIN_PIMPINAN")!;
  ok(
    "Anggota pembuat karya (dosen1005) dikecualikan dari pool penilai",
    !karyaSelainEntry.picked.some((p) => p.userId === dosen1005.id) &&
      !(await prisma.user.findFirst({ where: { id: dosen1005.id } })) === false // sanity: user masih ada
  );
  // Pool dasar 5 (unit+subunit DEP-MAT) dikurangi dosen1005 (kontributor karya, dikecualikan)
  // dan dosen1001 (sudah terpakai kelompok Pimpinan pada objek yang sama) = 3 calon sah.
  ok(
    "Pool Selain Pimpinan karya = 3 calon (dosen1005 dikecualikan sbg kontributor, dosen1001 terpakai Pimpinan)",
    karyaSelainEntry.eligibleCount === 3
  );

  console.log("== Guard status periode ==");
  // Lengkapi syarat readiness sebelum transisi ke SIAP: commit kategori karya + minimum sesuai target.
  const karyaGroupRules = await prisma.groupRule.findMany({ where: { categoryId: categoryKarya.id } });
  for (const gr of karyaGroupRules) {
    await updateGroupRule(gr.id, { aggregation: gr.aggregation, target: gr.group === "PIMPINAN" ? 1 : 2, minimum: 1 }, actor);
  }
  await commitPlan(categoryKarya.id, "test-seed-karya-commit", actor);

  const ready = await transitionPeriodStatus(period.id, "SIAP", actor);
  ok("Periode berhasil ditandai SIAP setelah penugasan diterapkan", ready.status === "SIAP");

  await expectServiceError("Commit ditolak saat periode tidak berstatus Draf", () =>
    commitPlan(category.id, "test-seed-5", actor)
  );
  await expectServiceError("Penugasan manual ditolak saat periode tidak berstatus Draf", () =>
    manualAssignEvaluator({ categoryObjectId: co1001.id, group: "SELAIN_PIMPINAN", evaluatorId: dosen1006.id }, actor)
  );

  console.log("== AC-03/AC-05/EDGE-07/AC-07/EDGE-23: periode terpisah (DEP-FIS, dua pimpinan) ==");
  // Periode BARU dan TERPISAH dari yang di atas — dua pimpinan sekaligus (DEP-FIS: dosen1002
  // ketua, dosen1003 sekretaris, dari seed Tahap 1) tanpa mengganggu hitungan eligibleCount/
  // shortage yang sudah dipastikan persis di atas.
  const depFis = await prisma.unit.findUniqueOrThrow({ where: { code: "DEP-FIS" } });
  const psFis = await prisma.unit.findUniqueOrThrow({ where: { code: "PS-FIS" } });
  const dosen1002 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1002" } }); // Ketua Dep. Fisika
  const dosen1003 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1003" } }); // Sekretaris Dep. Fisika
  const dosen1006b = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1006" } }); // objek dinilai (luar DEP-FIS)
  const dosen1010 = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dosen1010" } }); // PS-FIS, dibebani manual
  const lainnyaType = await prisma.objectType.findUniqueOrThrow({ where: { code: "LAINNYA" } });

  const period2 = await createPeriod(
    { code: "TEST-T3-2", name: "Uji Tahap 3 (dua pimpinan)", description: null, timezone: "Asia/Jakarta", startsAt: "2026-09-01", endsAt: "2026-09-30" },
    actor
  );

  // AC-07: bebani dosen1010 (3 tugas, kategori terpisah) SEBELUM computePlan kategori utama di
  // bawah — beban dihitung SELURUH PERIODE (Bab 10.4 langkah 4), jadi dummy ini di periode2 yang
  // sama cukup, tidak perlu commitPlan/finalisasi, cukup baris Assignment yang statusnya bukan
  // DIBATALKAN (persis yang dibaca computePlan).
  const loaderCategory = await createCategory(
    period2.id,
    { code: "LOADER-T3", name: "Pembeban (Uji T3)", description: null, objectTypeId: lainnyaType.id, excludeContributors: false },
    actor
  );
  const loaderInstrument = await prisma.instrumentVersion.findFirstOrThrow({ where: { categoryId: loaderCategory.id } });
  const t3_2ObjectIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const dummyObj = await createObject(
      { typeId: lainnyaType.id, name: `Dummy Beban ${i + 1}`, ownerUnitId: depFis.id, referenceUserId: null, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
      actor
    );
    t3_2ObjectIds.push(dummyObj.id);
    await addCategoryObjects(loaderCategory.id, [dummyObj.id], actor);
    const dummyCo = await prisma.categoryObject.findFirstOrThrow({ where: { categoryId: loaderCategory.id, objectId: dummyObj.id } });
    await prisma.assignment.create({
      data: { categoryObjectId: dummyCo.id, evaluatorId: dosen1010.id, group: "SELAIN_PIMPINAN", instrumentVersionId: loaderInstrument.id, status: "BELUM_MULAI" },
    });
  }
  ok("Fixture beban: dosen1010 punya 3 tugas non-dibatalkan di periode2", (await prisma.assignment.count({ where: { evaluatorId: dosen1010.id, categoryObject: { category: { periodId: period2.id } } } })) === 3);

  const category2 = await createCategory(
    period2.id,
    { code: "KINERJA-T3-2", name: "Kinerja (dua pimpinan)", description: null, objectTypeId: orangType.id, excludeContributors: true },
    actor
  );
  const cat2Full = await prisma.category.findUniqueOrThrow({
    where: { id: category2.id },
    include: { instrumentVersions: true, groupRules: true, assignmentRules: true },
  });
  await addParameter(cat2Full.instrumentVersions[0].id, { name: "Kinerja", indicator: null, weight: 100, order: 1 }, actor);
  const pimpinanRule2 = cat2Full.groupRules.find((r) => r.group === "PIMPINAN")!;
  const selainRule2 = cat2Full.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
  await updateGroupRule(pimpinanRule2.id, { aggregation: "RATA_RATA", target: 2, minimum: 1 }, actor);
  const selainRule2After1 = await updateGroupRule(selainRule2.id, { aggregation: "RATA_RATA", target: 1, minimum: 1 }, actor);
  const assignSelainRule2 = cat2Full.assignmentRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
  await updateAssignmentRule(assignSelainRule2.id, { scope: "UNIT_DAN_SUBUNIT", userTypeIds: [] }, actor);

  const obj1006 = await createObject(
    { typeId: orangType.id, name: dosen1006b.name, ownerUnitId: depFis.id, referenceUserId: dosen1006b.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
    actor
  );
  t3_2ObjectIds.push(obj1006.id);
  await addCategoryObjects(category2.id, [obj1006.id], actor);

  console.log("== EDGE-23: pratinjau kedaluwarsa (konfigurasi berubah) ditolak saat diterapkan ==");
  const stalePlan = await computePlan(category2.id, "test-seed-stale");
  // Ubah target SELAIN_PIMPINAN setelah pratinjau diambil — fingerprint pratinjau lama jadi basi.
  await updateGroupRule(selainRule2After1.id, { aggregation: "RATA_RATA", target: 2, minimum: 1, expectedRevision: selainRule2After1.revision }, actor);
  await expectServiceError(
    "commitPlan menolak fingerprint pratinjau lama setelah GroupRule berubah (harus pratinjau ulang)",
    () => commitPlan(category2.id, stalePlan.seed, actor, stalePlan.fingerprint)
  );
  // Kembalikan ke target semula (1) supaya angka-angka di bawah sesuai rencana semula.
  const selainRule2Now = await prisma.groupRule.findUniqueOrThrow({ where: { id: selainRule2.id } });
  await updateGroupRule(selainRule2.id, { aggregation: "RATA_RATA", target: 1, minimum: 1, expectedRevision: selainRule2Now.revision }, actor);

  console.log("== AC-03: dua pimpinan satu unit -> dua tugas terpisah, instrumen sama ==");
  const plan2 = await computePlan(category2.id, "test-seed-t3-2");
  const pimpinanEntry2b = plan2.entries.find((e) => e.group === "PIMPINAN")!;
  ok(
    "Kelompok Pimpinan: 2 calon (kedua pimpinan DEP-FIS), keduanya terpilih (target 2)",
    pimpinanEntry2b.eligibleCount === 2 &&
      pimpinanEntry2b.picked.length === 2 &&
      new Set(pimpinanEntry2b.picked.map((p) => p.userId)).size === 2 &&
      [dosen1002.id, dosen1003.id].every((id) => pimpinanEntry2b.picked.some((p) => p.userId === id))
  );

  console.log("== AC-05/EDGE-07: staf (bukan pimpinan) -> masuk kelompok Selain Pimpinan ==");
  const selainEntry2b = plan2.entries.find((e) => e.group === "SELAIN_PIMPINAN")!;
  ok(
    // Pool mentah DEP-FIS+PS-FIS = 11 (dosen1002/1003 di DEP-FIS langsung + dosen1007 & dosen1010..1017
    // di PS-FIS, lihat komentar seed.ts) dikurangi 2 pimpinan yang sudah terpakai kelompok Pimpinan
    // pada objek yang sama (DEF-09) = 9 staf tersisa.
    "Pool Selain Pimpinan = 9 staf DEP-FIS+PS-FIS (kedua pimpinan DIKECUALIKAN, sudah terpakai kelompok Pimpinan objek yang sama)",
    selainEntry2b.eligibleCount === 9 &&
      !selainEntry2b.picked.some((p) => p.userId === dosen1002.id || p.userId === dosen1003.id)
  );

  console.log("== AC-07: pemerataan beban -> calon paling berbeban tidak dipilih saat yang lain nol ==");
  ok(
    "dosen1010 (beban 3, satu-satunya bukan nol) TIDAK terpilih untuk target 1 di antara 9 calon setara lainnya",
    !selainEntry2b.picked.some((p) => p.userId === dosen1010.id) && selainEntry2b.picked.length === 1
  );

  const { batch: batch2 } = await commitPlan(category2.id, plan2.seed, actor, plan2.fingerprint);
  const created2 = await prisma.assignment.findMany({ where: { batchId: batch2.id } });
  ok(
    "3 tugas diterbitkan (2 pimpinan + 1 selain pimpinan), instrumentVersionId sama untuk semua",
    created2.length === 3 && new Set(created2.map((a) => a.instrumentVersionId)).size === 1
  );

  console.log("\n=== Ringkasan ===");
  console.log(`Lulus: ${pass}  Gagal: ${fail}`);
  if (fail > 0) process.exitCode = 1;

  console.log("\n== Membersihkan data uji ==");
  const periodIds = [period.id, period2.id];
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
  await prisma.objectContributor.deleteMany({ where: { objectId: karyaObj.id } });
  await prisma.assessmentObject.deleteMany({ where: { id: { in: [objDosen1004.id, objDosen1001.id, karyaObj.id, ...t3_2ObjectIds] } } });
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
