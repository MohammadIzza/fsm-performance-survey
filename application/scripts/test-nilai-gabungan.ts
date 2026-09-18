import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { ServiceError } from "../src/lib/services/units";
import { createPeriod } from "../src/lib/services/periods";
import { createCategory, addCategoryObjects } from "../src/lib/services/categories";
import { addParameter } from "../src/lib/services/instruments";
import { updateCombinedWeight, updateGroupRule } from "../src/lib/services/groupRules";
import { createObject } from "../src/lib/services/objects";
import { calculateResults, getGroupDetailBulk, getLatestRun } from "../src/lib/services/calculations";
import { getCombinedRanking, getRanking } from "../src/lib/services/rankings";
import { saveDraft } from "../src/lib/services/responses";
import type { AuthContext } from "../src/lib/authz";

/**
 * Uji tiga tambahan perhitungan dari survey2:
 *   1. Parameter bernilai mentah yang dinormalisasi terhadap nilai tertinggi.
 *   2. Nilai gabungan antar-kelompok (mis. Pimpinan 60% + Selain Pimpinan 40%).
 *   3. Penanda seri untuk nilai yang tetap sama setelah parameter pembeda dipakai.
 */

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
const kira = (a: number | null | undefined, b: number, eps = 0.001) => a != null && Math.abs(a - b) < eps;

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

async function tolak(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    ok(`${label} (seharusnya ditolak)`, false);
  } catch (e) {
    ok(`${label} ditolak: ${e instanceof Error ? e.message : e}`, e instanceof ServiceError);
  }
}

// Respons terkirim langsung di basis data — skrip ini menguji perhitungan, bukan alur pengisian.
async function kirimLangsung(
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
}

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "admin01" } });
  const adminActor = actorFor(admin, true);
  const depMat = await prisma.unit.findUniqueOrThrow({ where: { code: "DEP-MAT" } });
  const orang = await prisma.objectType.findUniqueOrThrow({ where: { code: "ORANG" } });
  const u = async (login: string) => prisma.user.findUniqueOrThrow({ where: { loginIdentifier: login } });
  const [p1, p2, s1, s2] = await Promise.all(["dosen1001", "dosen1002", "dosen1005", "dosen1006"].map(u));
  const refs = await Promise.all(["dosen1010", "dosen1011", "dosen1012", "dosen1013", "dosen1014"].map(u));

  const period = await createPeriod(
    { code: "TEST-GABUNGAN", name: "Uji nilai mentah & gabungan", description: null, timezone: "Asia/Jakarta", startsAt: "2020-01-01", endsAt: "2099-12-31" },
    adminActor
  );
  const kategori = await createCategory(
    period.id,
    { code: "PUBLIKASI-UJI", name: "Publikasi Uji", description: null, objectTypeId: orang.id, excludeContributors: true },
    adminActor
  );
  const kat = await prisma.category.findUniqueOrThrow({
    where: { id: kategori.id },
    include: { instrumentVersions: true, groupRules: true },
  });
  const instrumen = kat.instrumentVersions[0].id;
  const pJumlah = await addParameter(instrumen, { name: "Jumlah publikasi", indicator: null, weight: 60, normalized: true }, adminActor);
  const pKualitas = await addParameter(instrumen, { name: "Kualitas", indicator: null, weight: 40 }, adminActor);
  const rP = kat.groupRules.find((r) => r.group === "PIMPINAN")!;
  const rS = kat.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
  await updateGroupRule(rP.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, adminActor);
  await updateGroupRule(rS.id, { aggregation: "RATA_RATA", target: 0, minimum: 1 }, adminActor);

  const objek: { id: string }[] = [];
  for (const [i, nama] of ["Objek A", "Objek B", "Objek C", "Objek D"].entries()) {
    objek.push(
      await createObject(
        { typeId: orang.id, name: nama, ownerUnitId: depMat.id, referenceUserId: refs[i].id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
        adminActor
      )
    );
  }
  await addCategoryObjects(kategori.id, objek.map((o) => o.id), adminActor);
  const co = async (i: number) =>
    prisma.categoryObject.findFirstOrThrow({ where: { categoryId: kategori.id, objectId: objek[i].id } });
  const [A, B, C, D] = await Promise.all([0, 1, 2, 3].map(co));

  // Selain Pimpinan — jumlah publikasi mentah (dua penilai, dirata-rata) dan kualitas 0–100.
  //   A: (40+60)/2 = 50 publikasi, kualitas 80
  //   B: 25 publikasi, kualitas 60
  //   C: 0 publikasi, kualitas 100
  //   D: sama persis dengan B, untuk uji seri
  await kirimLangsung(A.id, s1.id, "SELAIN_PIMPINAN", instrumen, { [pJumlah.id]: 40, [pKualitas.id]: 80 });
  await kirimLangsung(A.id, s2.id, "SELAIN_PIMPINAN", instrumen, { [pJumlah.id]: 60, [pKualitas.id]: 80 });
  await kirimLangsung(B.id, s1.id, "SELAIN_PIMPINAN", instrumen, { [pJumlah.id]: 25, [pKualitas.id]: 60 });
  await kirimLangsung(C.id, s1.id, "SELAIN_PIMPINAN", instrumen, { [pJumlah.id]: 0, [pKualitas.id]: 100 });
  await kirimLangsung(D.id, s1.id, "SELAIN_PIMPINAN", instrumen, { [pJumlah.id]: 25, [pKualitas.id]: 60 });
  // Pimpinan — hanya A, B, dan D; C belum dinilai pimpinan.
  await kirimLangsung(A.id, p1.id, "PIMPINAN", instrumen, { [pJumlah.id]: 10, [pKualitas.id]: 90 });
  await kirimLangsung(B.id, p1.id, "PIMPINAN", instrumen, { [pJumlah.id]: 20, [pKualitas.id]: 70 });
  await kirimLangsung(D.id, p2.id, "PIMPINAN", instrumen, { [pJumlah.id]: 20, [pKualitas.id]: 70 });

  console.log("== 1. Nilai mentah dinormalisasi terhadap nilai tertinggi ==");
  await calculateResults(kategori.id, adminActor);
  const selain = await getGroupDetailBulk(kategori.id, "SELAIN_PIMPINAN");
  const hasil = (id: string) => selain?.byObject.get(id)?.result;
  const pr = (id: string, pid: string) => hasil(id)?.parameterResults.find((x) => x.parameterId === pid);
  ok("A (tertinggi, 50 publikasi) → jumlah publikasi 100", kira(pr(A.id, pJumlah.id)?.aggregate, 100));
  ok("A menyimpan angka mentahnya (50)", kira(pr(A.id, pJumlah.id)?.rawAggregate, 50));
  ok("B (25 publikasi) → 50, separuh yang tertinggi", kira(pr(B.id, pJumlah.id)?.aggregate, 50));
  ok("C (0 publikasi) → 0", kira(pr(C.id, pJumlah.id)?.aggregate, 0));
  ok("Parameter biasa tidak menyimpan angka mentah", pr(A.id, pKualitas.id)?.rawAggregate == null);
  ok(`Nilai A = 100×60% + 80×40% = 92 (aktual ${hasil(A.id)?.score})`, kira(hasil(A.id)?.score, 92));
  ok(`Nilai B = 50×60% + 60×40% = 54 (aktual ${hasil(B.id)?.score})`, kira(hasil(B.id)?.score, 54));
  ok(`Nilai C = 0×60% + 100×40% = 40 (aktual ${hasil(C.id)?.score})`, kira(hasil(C.id)?.score, 40));

  // Pimpinan dinormalisasi terhadap tertinggi di kelompoknya sendiri (20), bukan milik Selain.
  const pim = await getGroupDetailBulk(kategori.id, "PIMPINAN");
  ok(
    "Normalisasi per kelompok: A di Pimpinan (10 dari tertinggi 20) → 50",
    kira(pim?.byObject.get(A.id)?.result.parameterResults.find((x) => x.parameterId === pJumlah.id)?.aggregate, 50)
  );

  console.log("== 1b. Angka mentah boleh melewati batas atas skala; parameter biasa tidak ==");
  await prisma.period.update({ where: { id: period.id }, data: { status: "AKTIF" } });
  const tugas = await prisma.assignment.create({
    data: { categoryObjectId: C.id, evaluatorId: p2.id, group: "PIMPINAN", instrumentVersionId: instrumen, status: "BELUM_MULAI" },
  });
  const p2Actor = actorFor(p2);
  try {
    await saveDraft(tugas.id, [{ parameterId: pJumlah.id, score: 250 }], null, p2Actor);
    ok("Jumlah publikasi 250 (di atas skala 100) diterima", true);
  } catch (e) {
    ok(`Jumlah publikasi 250 diterima (galat: ${e instanceof Error ? e.message : e})`, false);
  }
  const draf = await prisma.responseRevision.findFirstOrThrow({ where: { assignmentId: tugas.id } });
  await tolak("Kualitas 250 pada parameter biasa", () =>
    saveDraft(tugas.id, [{ parameterId: pKualitas.id, score: 250 }], draf.version, p2Actor)
  );
  await tolak("Angka mentah negatif", () =>
    saveDraft(tugas.id, [{ parameterId: pJumlah.id, score: -3 }], draf.version, p2Actor)
  );
  await prisma.responseScore.deleteMany({ where: { responseRevision: { assignmentId: tugas.id } } });
  await prisma.responseRevision.deleteMany({ where: { assignmentId: tugas.id } });
  await prisma.assignment.delete({ where: { id: tugas.id } });

  console.log("== 2. Nilai gabungan Pimpinan 60% + Selain Pimpinan 40% ==");
  ok("Tanpa bobot gabungan: tidak ada peringkat gabungan", (await getCombinedRanking({ categoryId: kategori.id })) === null);
  await tolak("Bobot 0%", () => updateCombinedWeight(kategori.id, 0, adminActor));
  await tolak("Bobot 100%", () => updateCombinedWeight(kategori.id, 100, adminActor));
  await tolak("Bobot pecahan 60,5%", () => updateCombinedWeight(kategori.id, 60.5, adminActor));
  await updateCombinedWeight(kategori.id, 60, adminActor);
  await calculateResults(kategori.id, adminActor);
  const run = await getLatestRun(kategori.id);
  const snap = run?.groupRuleSnapshot as { GABUNGAN?: { pimpinanWeight?: number } } | undefined;
  ok("Bobot 60 dipatri di snapshot run", snap?.GABUNGAN?.pimpinanWeight === 60);

  const gabungan = await getCombinedRanking({ categoryId: kategori.id });
  const g = (id: string) => gabungan?.entries.find((e) => e.categoryObjectId === id);
  const pimA = pim?.byObject.get(A.id)?.result.score ?? null;
  // Pimpinan A: jumlah 10/20 → 50; kualitas 90 → 50×0,6 + 90×0,4 = 66. Gabungan = 66×0,6 + 92×0,4 = 76,4.
  ok(`Nilai Pimpinan A = 66 (aktual ${pimA})`, kira(pimA, 66));
  ok(`Gabungan A = 66×60% + 92×40% = 76,4 (aktual ${g(A.id)?.score})`, kira(g(A.id)?.score, 76.4));
  ok("C belum dinilai Pimpinan → tidak masuk peringkat gabungan", g(C.id)?.rank === null && g(C.id)?.eligibility !== "MEMENUHI_SYARAT");
  ok("Nilai gabungan C kosong, bukan separuh nilai", g(C.id)?.score === null);
  ok("A peringkat 1 di papan gabungan", g(A.id)?.rank === 1);

  console.log("== 3. Penanda seri ==");
  ok("B dan D bernilai sama → peringkat sama", g(B.id)?.rank !== null && g(B.id)?.rank === g(D.id)?.rank);
  ok("B dan D ditandai seri", !!g(B.id)?.tied && !!g(D.id)?.tied);
  ok("A tidak ditandai seri", g(A.id)?.tied === false);
  const perKelompok = await getRanking({ categoryId: kategori.id, group: "SELAIN_PIMPINAN" });
  ok(
    "Seri juga ditandai di papan per kelompok",
    !!perKelompok.find((e) => e.categoryObjectId === B.id)?.tied && !!perKelompok.find((e) => e.categoryObjectId === D.id)?.tied
  );

  console.log("== 2b. Bobot gabungan terkunci setelah periode ditutup; bisa dimatikan sebelumnya ==");
  await updateCombinedWeight(kategori.id, null, adminActor);
  await calculateResults(kategori.id, adminActor);
  ok("Bobot dimatikan → peringkat gabungan hilang", (await getCombinedRanking({ categoryId: kategori.id })) === null);
  await prisma.period.update({ where: { id: period.id }, data: { status: "DITUTUP" } });
  await tolak("Mengubah bobot setelah periode ditutup", () => updateCombinedWeight(kategori.id, 60, adminActor));

  console.log(`\nLulus: ${pass}  Gagal: ${fail}`);
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
  await prisma.assessmentObject.deleteMany({ where: { id: { in: objek.map((o) => o.id) } } });
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
