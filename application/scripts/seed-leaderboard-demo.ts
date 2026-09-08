// Data demo TAMBAHAN (di luar seed-demo.ts): leaderboard besar dan padat untuk keperluan
// tinjauan visual — banyak objek dinilai, banyak penilai per objek, skor bervariasi realistis.
// Aman dijalankan ulang: dilewati bila periode dengan kode yang sama sudah ada.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { createPeriod, transitionPeriodStatus } from "../src/lib/services/periods";
import { createCategory, addCategoryObjects } from "../src/lib/services/categories";
import { addParameter } from "../src/lib/services/instruments";
import { updateGroupRule } from "../src/lib/services/groupRules";
import { updateAssignmentRule } from "../src/lib/services/assignmentRules";
import { createObject } from "../src/lib/services/objects";
import { commitPlan } from "../src/lib/services/assignmentPlanning";
import { calculateResults } from "../src/lib/services/calculations";
import type { AuthContext } from "../src/lib/authz";

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

async function submitVaried(
  assignmentId: string,
  evaluatorId: string,
  instrumentVersionId: string,
  parameterIds: string[],
  baseScore: number,
  submittedAt: Date
) {
  const rev = await prisma.responseRevision.create({
    data: { assignmentId, revision: 1, state: "SUBMITTED", submittedAt, editedById: evaluatorId },
  });
  for (const parameterId of parameterIds) {
    // Sedikit jitter per parameter agar tidak semua parameter sama persis nilainya.
    const score = clamp(Math.round(baseScore + randInt(-6, 6)), 0, 100);
    await prisma.responseScore.create({ data: { responseRevisionId: rev.id, parameterId, score } });
  }
  await prisma.assignment.update({ where: { id: assignmentId }, data: { status: "TERKIRIM", instrumentVersionId } });
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

  const existing = await prisma.period.findUnique({ where: { code: "SHOWCASE-2026-GANJIL" } });
  if (existing) {
    console.log("Data showcase sudah ada (SHOWCASE-2026-GANJIL). Lewati agar tidak duplikat.");
    console.log("Untuk membuat ulang, hapus periode ini lebih dulu dari halaman Admin > Periode.");
    return;
  }

  const orangType = await prisma.objectType.findUniqueOrThrow({ where: { code: "ORANG" } });
  const karyaType = await prisma.objectType.findUniqueOrThrow({ where: { code: "KARYA" } });

  console.log("== Membuat periode showcase ==");
  const period = await createPeriod(
    {
      code: "SHOWCASE-2026-GANJIL",
      name: "Penilaian Kinerja Semester Ganjil 2026",
      description: "Data demonstrasi dengan populasi penilaian yang luas untuk tinjauan leaderboard.",
      timezone: "Asia/Jakarta",
      startsAt: "2026-07-01",
      endsAt: "2026-08-31",
    },
    actor
  );

  // ---------------------------------------------------------------------
  // Kategori 1: Kinerja Dosen — seluruh dosen aktif sebagai objek dinilai.
  // ---------------------------------------------------------------------
  console.log("== Kategori: Kinerja Dosen ==");
  const dosenUsers = await prisma.user.findMany({
    where: {
      active: true,
      loginIdentifier: { startsWith: "dosen" },
    },
    include: { primaryUnit: true },
    orderBy: { loginIdentifier: "asc" },
  });
  console.log(`  ${dosenUsers.length} dosen ditemukan sebagai calon objek.`);

  const catDosen = await createCategory(
    period.id,
    {
      code: "KINERJA-DOSEN-SHOWCASE",
      name: "Kinerja Dosen",
      description: "Penilaian kinerja dosen oleh atasan dan sejawat, mencakup layanan, kedisiplinan, dan kerja sama.",
      objectTypeId: orangType.id,
      excludeContributors: true,
    },
    actor
  );
  const catDosenFull = await prisma.category.findUniqueOrThrow({
    where: { id: catDosen.id },
    include: { instrumentVersions: true, groupRules: true, assignmentRules: true },
  });
  const instrumentDosen = catDosenFull.instrumentVersions[0];
  const pLayanan = await addParameter(instrumentDosen.id, { name: "Layanan", indicator: "Ketanggapan dan mutu layanan kepada mahasiswa dan kolega", weight: 40, order: 1 }, actor);
  const pDisiplin = await addParameter(instrumentDosen.id, { name: "Kedisiplinan", indicator: "Ketepatan waktu dan konsistensi kehadiran", weight: 30, order: 2 }, actor);
  const pKerjaSama = await addParameter(instrumentDosen.id, { name: "Kerja Sama", indicator: "Kontribusi dalam kerja tim dan lintas unit", weight: 30, order: 3 }, actor);
  const dosenParamIds = [pLayanan.id, pDisiplin.id, pKerjaSama.id];

  const pimpinanRuleDosen = catDosenFull.groupRules.find((r) => r.group === "PIMPINAN")!;
  const selainRuleDosen = catDosenFull.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
  await updateGroupRule(pimpinanRuleDosen.id, { aggregation: "RATA_RATA", target: 1, minimum: 1 }, actor);
  await updateGroupRule(selainRuleDosen.id, { aggregation: "RATA_RATA", target: 4, minimum: 3 }, actor);
  const assignSelainDosen = catDosenFull.assignmentRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
  await updateAssignmentRule(assignSelainDosen.id, { scope: "UNIT_DAN_SUBUNIT", userTypeIds: [] }, actor);

  const dosenObjectIds: string[] = [];
  for (const u of dosenUsers) {
    const obj = await createObject(
      {
        typeId: orangType.id,
        name: u.name,
        ownerUnitId: u.primaryUnitId!,
        referenceUserId: u.id,
        referenceUnitId: null,
        responsibleUserId: null,
        url: null,
        description: null,
        contributorUserIds: [],
      },
      actor
    );
    dosenObjectIds.push(obj.id);
  }
  await addCategoryObjects(catDosen.id, dosenObjectIds, actor);
  console.log(`  ${dosenObjectIds.length} objek dosen ditambahkan sebagai peserta.`);

  const { plan: dosenPlan } = await commitPlan(catDosen.id, "showcase-dosen-seed", actor);
  console.log(`  ${dosenPlan.totalNewAssignments} tugas penilaian diterbitkan.`);

  // Beri setiap objek "tingkat kualitas dasar" berbeda-beda agar leaderboard punya sebaran
  // nilai yang meyakinkan (bukan seragam), termasuk beberapa yang sengaja mepet/seri.
  const dosenAssignments = await prisma.assignment.findMany({
    where: { categoryObject: { categoryId: catDosen.id }, status: { not: "DIBATALKAN" } },
    include: { categoryObject: true },
  });
  const baseScoreByObject = new Map<string, number>();
  for (const objId of dosenObjectIds) {
    baseScoreByObject.set(objId, randInt(62, 97));
  }
  // Dua objek sengaja disamakan skor dasarnya untuk mendemonstrasikan peringkat kompetisi.
  if (dosenObjectIds.length >= 2) {
    baseScoreByObject.set(dosenObjectIds[0], 90);
    baseScoreByObject.set(dosenObjectIds[1], 90);
  }

  for (const a of dosenAssignments) {
    const base = baseScoreByObject.get(a.categoryObject.objectId) ?? 75;
    await submitVaried(a.id, a.evaluatorId, instrumentDosen.id, dosenParamIds, base, new Date("2026-08-10"));
  }
  console.log(`  ${dosenAssignments.length} jawaban penilaian tersimpan dengan skor bervariasi.`);

  await calculateResults(catDosen.id, actor);
  console.log("  Perhitungan hasil selesai — leaderboard Kinerja Dosen siap.");

  // ---------------------------------------------------------------------
  // Kategori 2: Karya Inovasi — objek Karya, dinilai kelompok Selain Pimpinan saja.
  // ---------------------------------------------------------------------
  console.log("== Kategori: Karya Inovasi ==");
  const catKarya = await createCategory(
    period.id,
    {
      code: "KARYA-INOVASI-SHOWCASE",
      name: "Karya Inovasi Digital",
      description: "Penilaian karya inovasi digital yang dihasilkan unit-unit di lingkungan fakultas.",
      objectTypeId: karyaType.id,
      excludeContributors: true,
    },
    actor
  );
  const catKaryaFull = await prisma.category.findUniqueOrThrow({
    where: { id: catKarya.id },
    include: { instrumentVersions: true, groupRules: true, assignmentRules: true },
  });
  const instrumentKarya = catKaryaFull.instrumentVersions[0];
  const pOrisinalitas = await addParameter(instrumentKarya.id, { name: "Orisinalitas", indicator: null, weight: 35, order: 1 }, actor);
  const pKemanfaatan = await addParameter(instrumentKarya.id, { name: "Kemanfaatan", indicator: null, weight: 35, order: 2 }, actor);
  const pKualitasTeknis = await addParameter(instrumentKarya.id, { name: "Kualitas Teknis", indicator: null, weight: 30, order: 3 }, actor);
  const karyaParamIds = [pOrisinalitas.id, pKemanfaatan.id, pKualitasTeknis.id];

  await updateGroupRule(catKaryaFull.groupRules.find((r) => r.group === "PIMPINAN")!.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, actor);
  const selainRuleKarya = catKaryaFull.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
  await updateGroupRule(selainRuleKarya.id, { aggregation: "RATA_RATA", target: 3, minimum: 2 }, actor);
  const assignSelainKarya = catKaryaFull.assignmentRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
  await updateAssignmentRule(assignSelainKarya.id, { scope: "UNIT_DAN_SUBUNIT", userTypeIds: [] }, actor);

  const fsm = await prisma.unit.findUniqueOrThrow({ where: { code: "FSM" } });
  const depMat = await prisma.unit.findUniqueOrThrow({ where: { code: "DEP-MAT" } });
  const depFis = await prisma.unit.findUniqueOrThrow({ where: { code: "DEP-FIS" } });

  const karyaSeed = [
    { name: "Sistem Presensi Wajah Terpadu", unit: depMat, pj: "dosen1004" },
    { name: "Portal Skripsi Digital", unit: depMat, pj: "dosen1005" },
    { name: "Aplikasi Simulasi Laboratorium Fisika", unit: depFis, pj: "dosen1007" },
    { name: "Dashboard Monitoring Riset Dosen", unit: depFis, pj: "dosen1010" },
    { name: "Chatbot Layanan Akademik Mahasiswa", unit: fsm, pj: "dosen1002" },
    { name: "Sistem Peminjaman Alat Laboratorium", unit: depFis, pj: "dosen1011" },
    { name: "Aplikasi Bimbingan Skripsi Daring", unit: depMat, pj: "dosen1006" },
    { name: "Platform Publikasi Riset Mahasiswa", unit: fsm, pj: "dosen1003" },
  ];

  const karyaObjectIds: string[] = [];
  for (const k of karyaSeed) {
    const pjUser = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: k.pj } });
    const obj = await createObject(
      {
        typeId: karyaType.id,
        name: k.name,
        ownerUnitId: k.unit.id,
        referenceUserId: null,
        referenceUnitId: null,
        responsibleUserId: pjUser.id,
        url: null,
        description: `Karya inovasi digital dari ${k.unit.name}.`,
        contributorUserIds: [],
      },
      actor
    );
    karyaObjectIds.push(obj.id);
  }
  await addCategoryObjects(catKarya.id, karyaObjectIds, actor);
  console.log(`  ${karyaObjectIds.length} objek karya ditambahkan sebagai peserta.`);

  const { plan: karyaPlan } = await commitPlan(catKarya.id, "showcase-karya-seed", actor);
  console.log(`  ${karyaPlan.totalNewAssignments} tugas penilaian diterbitkan.`);

  const karyaAssignments = await prisma.assignment.findMany({
    where: { categoryObject: { categoryId: catKarya.id }, status: { not: "DIBATALKAN" } },
    include: { categoryObject: true },
  });
  const karyaBaseByObject = new Map<string, number>();
  for (const objId of karyaObjectIds) {
    karyaBaseByObject.set(objId, randInt(58, 95));
  }
  for (const a of karyaAssignments) {
    const base = karyaBaseByObject.get(a.categoryObject.objectId) ?? 75;
    await submitVaried(a.id, a.evaluatorId, instrumentKarya.id, karyaParamIds, base, new Date("2026-08-12"));
  }
  console.log(`  ${karyaAssignments.length} jawaban penilaian tersimpan dengan skor bervariasi.`);

  await calculateResults(catKarya.id, actor);
  console.log("  Perhitungan hasil selesai — leaderboard Karya Inovasi siap.");

  // ---------------------------------------------------------------------
  // Buka akses hasil segera (periode Aktif, kebijakan "selama aktif").
  // ---------------------------------------------------------------------
  await transitionPeriodStatus(period.id, "SIAP", actor).catch((e) => {
    console.log(`  Catatan: transisi ke Siap belum lulus otomatis (${(e as Error).message.split("\n")[0]}); dipaksa langsung.`);
  });
  const check = await prisma.period.findUniqueOrThrow({ where: { id: period.id } });
  if (check.status !== "SIAP") {
    await prisma.period.update({ where: { id: period.id }, data: { status: "SIAP" } });
  }
  await transitionPeriodStatus(period.id, "AKTIF", actor);
  await prisma.accessPolicy.update({ where: { periodId: period.id }, data: { mode: "SELAMA_AKTIF" } });

  console.log("\nData showcase selesai dibuat:");
  console.log(`- Periode: ${period.name} (${period.code}), status Aktif, hasil dapat dilihat langsung.`);
  console.log(`- Kategori "Kinerja Dosen": ${dosenObjectIds.length} objek, ${dosenAssignments.length} jawaban.`);
  console.log(`- Kategori "Karya Inovasi Digital": ${karyaObjectIds.length} objek, ${karyaAssignments.length} jawaban.`);
  console.log("Lihat di /hasil (pimpinan/dekan/admin) atau /admin/periode untuk detail.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
