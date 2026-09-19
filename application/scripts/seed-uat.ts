import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { createPeriod, setAccessPolicy, checkReadiness, transitionPeriodStatus } from "../src/lib/services/periods";
import { createCategory, addCategoryObjects } from "../src/lib/services/categories";
import { addParameter } from "../src/lib/services/instruments";
import { updateCombinedWeight, updateGroupRule } from "../src/lib/services/groupRules";
import { ensureAssignmentRules, updateAssignmentRule } from "../src/lib/services/assignmentRules";
import { createObject } from "../src/lib/services/objects";
import { commitPlan } from "../src/lib/services/assignmentPlanning";
import { calculateResults } from "../src/lib/services/calculations";
import type { AuthContext } from "../src/lib/authz";

/**
 * Menyiapkan data uji terima (UAT) di basis data v2:
 *
 *   1. Menghapus periode percobaan lama ("Ulang Tahun Kita" dan "Demo Nilai Mentah & Gabungan").
 *   2. Menambah pengguna sampai setiap program studi punya minimal 50 orang aktif, dengan
 *      campuran dosen, tenaga kependidikan, dan mahasiswa — supaya pembagian tugas benar-benar
 *      menyebar ke banyak orang.
 *   3. Membuat SATU periode berisi empat kategori yang bersama-sama memakai seluruh fitur
 *      perhitungan: agregasi rata-rata dan total, parameter bernilai mentah (dinormalisasi),
 *      nilai gabungan antar-kelompok, parameter pembeda nilai sama, minimum respons ala juri,
 *      dan keempat jenis objek yang dipakai FSM.
 *   4. Menerbitkan pembagian tugas, membuka periodenya, lalu mengisi sebagian jawaban supaya
 *      halaman Hasil dan Pemantauan sudah ada isinya sejak awal. Sisanya sengaja dibiarkan
 *      kosong untuk diisi manual saat pengujian.
 *
 * Aman dijalankan ulang: periode UAT yang lama beserta seluruh turunannya dihapus lebih dulu.
 *
 *   npm run seed:uat
 */

const KODE_UAT = "UAT-2026";
const MIN_ORANG_PER_PRODI = 50;

const DEPAN = [
  "Adinda","Bagus","Cahya","Dewi","Eko","Fitri","Gilang","Hana","Indra","Joko","Kartika","Lestari",
  "Mega","Nanda","Oktavia","Putra","Rahma","Satria","Tari","Umar","Vina","Wahyu","Yuda","Zahra",
  "Arif","Bella","Candra","Dian","Elang","Farah","Galih","Hesti","Ilham","Jihan","Kevin","Laras",
];
const BELAKANG = [
  "Pratama","Wijaya","Kusuma","Hartono","Saputra","Anggraini","Nugroho","Maharani","Setiawan",
  "Rahayu","Firmansyah","Puspita","Santoso","Ramadhan","Handayani","Prabowo","Lestari","Wibowo",
];
function namaKe(i: number) {
  return `${DEPAN[i % DEPAN.length]} ${BELAKANG[Math.floor(i / DEPAN.length) % BELAKANG.length]}`;
}

function actorFor(user: { id: string; loginIdentifier: string; name: string }): AuthContext {
  return {
    userId: user.id,
    loginIdentifier: user.loginIdentifier,
    name: user.name,
    active: true,
    isAdmin: true,
    isDekan: false,
    leadershipUnitIds: [],
    scopeUnitIds: [],
  };
}

/** Menghapus satu periode beserta seluruh turunannya, apa pun statusnya. */
async function hapusPeriode(code: string) {
  const period = await prisma.period.findUnique({ where: { code } });
  if (!period) return false;
  const id = period.id;
  await prisma.parameterResult.deleteMany({ where: { result: { run: { category: { periodId: id } } } } });
  await prisma.objectGroupResult.deleteMany({ where: { run: { category: { periodId: id } } } });
  await prisma.calculationRun.deleteMany({ where: { category: { periodId: id } } });
  await prisma.responseScore.deleteMany({ where: { responseRevision: { assignment: { categoryObject: { category: { periodId: id } } } } } });
  await prisma.responseRevision.deleteMany({ where: { assignment: { categoryObject: { category: { periodId: id } } } } });
  await prisma.assignment.deleteMany({ where: { categoryObject: { category: { periodId: id } } } });
  await prisma.assignmentBatch.deleteMany({ where: { category: { periodId: id } } });
  await prisma.categoryObject.deleteMany({ where: { category: { periodId: id } } });
  await prisma.groupRule.deleteMany({ where: { category: { periodId: id } } });
  await prisma.parameter.deleteMany({ where: { instrumentVersion: { category: { periodId: id } } } });
  await prisma.instrumentVersion.deleteMany({ where: { category: { periodId: id } } });
  await prisma.assignmentRule.deleteMany({ where: { category: { periodId: id } } });
  await prisma.category.deleteMany({ where: { periodId: id } });
  await prisma.finalization.deleteMany({ where: { periodId: id } });
  await prisma.accessPolicy.deleteMany({ where: { periodId: id } });
  await prisma.period.delete({ where: { id } });
  return true;
}

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "admin01" } });
  const actor = actorFor(admin);
  const [tDosen, tTendik, tMhs] = await Promise.all(
    ["DOSEN", "TENDIK", "MAHASISWA"].map((code) => prisma.userType.findUniqueOrThrow({ where: { code } }))
  );
  const [oOrang, oUnit, oKarya] = await Promise.all(
    ["ORANG", "UNIT", "KARYA"].map((code) => prisma.objectType.findUniqueOrThrow({ where: { code } }))
  );

  console.log("== 1. Menghapus periode percobaan lama ==");
  for (const code of ["ULANG-TAHUN-KITA", "DEMO-GABUNGAN", KODE_UAT]) {
    console.log(`   ${code}: ${(await hapusPeriode(code)) ? "dihapus" : "tidak ada"}`);
  }
  // Objek bikinan percobaan sebelumnya ikut dibersihkan bila tidak dipakai periode lain.
  const objekDemo = await prisma.assessmentObject.findMany({
    where: { name: { startsWith: "Demo Tendik" }, categoryObjects: { none: {} } },
  });
  if (objekDemo.length) {
    await prisma.assessmentObject.deleteMany({ where: { id: { in: objekDemo.map((o) => o.id) } } });
    console.log(`   ${objekDemo.length} objek demo lama dihapus`);
  }

  console.log("== 2. Melengkapi pengguna tiap program studi sampai 50 orang ==");
  const prodi = await prisma.unit.findMany({ where: { code: { startsWith: "PS-" }, active: true }, orderBy: { code: "asc" } });
  let dibuat = 0;
  for (const [iUnit, unit] of prodi.entries()) {
    const perJenis = async (typeId: string) =>
      prisma.user.count({ where: { primaryUnitId: unit.id, userTypeId: typeId, active: true } });
    const kurang = {
      [tDosen.id]: Math.max(0, 8 - (await perJenis(tDosen.id))),
      [tTendik.id]: Math.max(0, 5 - (await perJenis(tTendik.id))),
    };
    const total = await prisma.user.count({ where: { primaryUnitId: unit.id, active: true } });
    const tambahDosen = kurang[tDosen.id];
    const tambahTendik = kurang[tTendik.id];
    const tambahMhs = Math.max(0, MIN_ORANG_PER_PRODI - total - tambahDosen - tambahTendik);
    const singkat = unit.code.replace("PS-", "").toLowerCase().replace(/-/g, "");
    let urut = 1;
    const buat = async (typeId: string, jumlah: number, awalan: string) => {
      for (let i = 0; i < jumlah; i++) {
        const login = `uat${awalan}${singkat}${String(urut).padStart(2, "0")}`;
        urut += 1;
        if (await prisma.user.findUnique({ where: { loginIdentifier: login } })) continue;
        await prisma.user.create({
          data: {
            loginIdentifier: login,
            name: namaKe(iUnit * 53 + urut),
            userTypeId: typeId,
            primaryUnitId: unit.id,
            active: true,
          },
        });
        dibuat += 1;
      }
    };
    await buat(tDosen.id, tambahDosen, "d");
    await buat(tTendik.id, tambahTendik, "t");
    await buat(tMhs.id, tambahMhs, "m");
    const sesudah = await prisma.user.count({ where: { primaryUnitId: unit.id, active: true } });
    console.log(`   ${unit.code.padEnd(15)} ${String(total).padStart(3)} → ${sesudah} orang`);
  }
  console.log(`   total pengguna baru: ${dibuat}`);

  console.log("== 2b. Memastikan tiap program studi punya pimpinan ==");
  for (const unit of prodi) {
    const ada = await prisma.leadership.count({
      where: { unitId: unit.id, OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }] },
    });
    if (ada > 0) continue;
    const calon = await prisma.user.findFirst({
      where: { primaryUnitId: unit.id, userTypeId: tDosen.id, active: true },
      orderBy: { loginIdentifier: "asc" },
    });
    if (!calon) continue;
    await prisma.leadership.create({
      data: { userId: calon.id, unitId: unit.id, title: "Koordinator Program Studi", effectiveFrom: new Date("2026-01-01") },
    });
    console.log(`   ${unit.code}: ${calon.name} ditetapkan sebagai koordinator`);
  }

  console.log("== 3. Membuat periode UAT beserta kategorinya ==");
  const kemarin = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const duaBulan = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
  const period = await createPeriod(
    {
      code: KODE_UAT,
      name: "UAT — Uji Coba Lengkap 2026",
      description: "Periode uji terima: mencakup seluruh fitur penilaian, dari nilai mentah sampai nilai gabungan.",
      timezone: "Asia/Jakarta",
      startsAt: kemarin,
      endsAt: duaBulan,
    },
    actor
  );

  const dosenPerProdi = new Map<string, { id: string; name: string }[]>();
  const tendikPerProdi = new Map<string, { id: string; name: string }[]>();
  for (const unit of prodi) {
    dosenPerProdi.set(unit.id, await prisma.user.findMany({ where: { primaryUnitId: unit.id, userTypeId: tDosen.id, active: true }, select: { id: true, name: true }, take: 3, orderBy: { loginIdentifier: "asc" } }));
    tendikPerProdi.set(unit.id, await prisma.user.findMany({ where: { primaryUnitId: unit.id, userTypeId: tTendik.id, active: true }, select: { id: true, name: true }, take: 1, orderBy: { loginIdentifier: "asc" } }));
  }

  /** Membuat kategori lengkap: instrumen, aturan kelompok, aturan calon, dan objek pesertanya. */
  async function buatKategori(opts: {
    code: string;
    name: string;
    objectTypeId: string;
    parameters: { name: string; indicator: string; weight: number; normalized?: boolean }[];
    pimpinan: { target: number; minimum: number; aggregation: "RATA_RATA" | "TOTAL" };
    selain: { target: number; minimum: number; aggregation: "RATA_RATA" | "TOTAL"; userTypeIds: string[] };
    pembeda?: number[];
    bobotGabungan?: number;
    objectIds: string[];
  }) {
    const kategori = await createCategory(
      period.id,
      { code: opts.code, name: opts.name, description: null, objectTypeId: opts.objectTypeId, excludeContributors: true },
      actor
    );
    const detail = await prisma.category.findUniqueOrThrow({
      where: { id: kategori.id },
      include: { instrumentVersions: true, groupRules: true },
    });
    const instrumen = detail.instrumentVersions[0].id;
    const params: { id: string }[] = [];
    for (const p of opts.parameters) {
      params.push(await addParameter(instrumen, { name: p.name, indicator: p.indicator, weight: p.weight, normalized: p.normalized }, actor));
    }
    const rP = detail.groupRules.find((r) => r.group === "PIMPINAN")!;
    const rS = detail.groupRules.find((r) => r.group === "SELAIN_PIMPINAN")!;
    const pembeda = (opts.pembeda ?? []).map((i) => params[i].id);
    await updateGroupRule(rP.id, { ...opts.pimpinan, tieBreakParameterIds: pembeda }, actor);
    await updateGroupRule(rS.id, { aggregation: opts.selain.aggregation, target: opts.selain.target, minimum: opts.selain.minimum, tieBreakParameterIds: pembeda }, actor);
    if (opts.bobotGabungan) await updateCombinedWeight(kategori.id, opts.bobotGabungan, actor);

    await ensureAssignmentRules(kategori.id);
    const aturan = await prisma.assignmentRule.findMany({ where: { categoryId: kategori.id } });
    for (const a of aturan) {
      await updateAssignmentRule(
        a.id,
        a.group === "PIMPINAN"
          ? { scope: "UNIT_DAN_SUBUNIT", userTypeIds: [] }
          : { scope: "UNIT_DAN_SUBUNIT", userTypeIds: opts.selain.userTypeIds },
        actor
      );
    }
    await addCategoryObjects(kategori.id, opts.objectIds, actor);
    console.log(`   ${opts.name}: ${opts.objectIds.length} objek, ${params.length} pertanyaan`);
    return { kategori, params };
  }

  // --- Objek: dibuat khusus UAT supaya mudah dikenali dan tidak mengganggu periode lain.
  const objDosen: string[] = [];
  const objTendik: string[] = [];
  const objUnit: string[] = [];
  const objKarya: string[] = [];
  for (const unit of prodi) {
    const dosen = dosenPerProdi.get(unit.id) ?? [];
    const tendik = tendikPerProdi.get(unit.id) ?? [];
    for (const d of dosen.slice(0, 2)) {
      const o = await createObject(
        { typeId: oOrang.id, name: `${d.name} (${unit.name})`, ownerUnitId: unit.id, referenceUserId: d.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
        actor
      );
      objDosen.push(o.id);
    }
    for (const t of tendik) {
      const o = await createObject(
        { typeId: oOrang.id, name: `${t.name} (Tendik ${unit.name})`, ownerUnitId: unit.id, referenceUserId: t.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
        actor
      );
      objTendik.push(o.id);
    }
    const oU = await createObject(
      { typeId: oUnit.id, name: unit.name, ownerUnitId: unit.id, referenceUserId: null, referenceUnitId: unit.id, responsibleUserId: dosen[0]?.id ?? null, url: null, description: null, contributorUserIds: [] },
      actor
    );
    objUnit.push(oU.id);
    const oK = await createObject(
      { typeId: oKarya.id, name: `Video Promosi ${unit.name}`, ownerUnitId: unit.id, referenceUserId: null, referenceUnitId: null, responsibleUserId: dosen[0]?.id ?? admin.id, url: "https://contoh.undip.ac.id/video", description: "Video promosi program studi untuk UAT.", contributorUserIds: dosen.slice(1, 2).map((d) => d.id) },
      actor
    );
    objKarya.push(oK.id);
  }

  const k1 = await buatKategori({
    code: "UAT-DOSEN", name: "Dosen Favorit Mahasiswa (UAT)", objectTypeId: oOrang.id,
    parameters: [
      { name: "Kualitas mengajar", indicator: "Materi jelas, terstruktur, dan mudah diikuti.", weight: 40 },
      { name: "Bimbingan & konsultasi", indicator: "Mudah ditemui dan memberi arahan yang membantu.", weight: 35 },
      { name: "Keteladanan", indicator: "Disiplin, adil, dan menjadi contoh yang baik.", weight: 25 },
    ],
    pimpinan: { target: 2, minimum: 1, aggregation: "RATA_RATA" },
    selain: { target: 8, minimum: 3, aggregation: "RATA_RATA", userTypeIds: [tMhs.id] },
    pembeda: [0, 1],
    objectIds: objDosen,
  });

  const k2 = await buatKategori({
    code: "UAT-PRODI", name: "Prodi dengan Publikasi Terbanyak (UAT)", objectTypeId: oUnit.id,
    parameters: [
      { name: "Jumlah publikasi", indicator: "Tulis jumlah karya ilmiah terverifikasi — angka apa adanya.", weight: 60, normalized: true },
      { name: "Kualitas publikasi", indicator: "Reputasi penerbit dan dampak sitasi.", weight: 25 },
      { name: "Kelengkapan data", indicator: "Bukti dan metadata lengkap serta dapat diperiksa.", weight: 15 },
    ],
    pimpinan: { target: 2, minimum: 1, aggregation: "RATA_RATA" },
    selain: { target: 6, minimum: 2, aggregation: "RATA_RATA", userTypeIds: [tDosen.id, tTendik.id] },
    pembeda: [1],
    bobotGabungan: 60,
    objectIds: objUnit,
  });

  const k3 = await buatKategori({
    code: "UAT-VIDEO", name: "Video Promosi Prodi (UAT)", objectTypeId: oKarya.id,
    parameters: [
      { name: "Kualitas visual & audio", indicator: "Gambar, suara, dan penyuntingan terlihat profesional.", weight: 40 },
      { name: "Kejelasan pesan", indicator: "Informasi tersusun logis dan mudah ditangkap.", weight: 35 },
      { name: "Kreativitas", indicator: "Ide dan penyajian yang membedakan dari video lain.", weight: 25 },
    ],
    pimpinan: { target: 2, minimum: 1, aggregation: "RATA_RATA" },
    selain: { target: 5, minimum: 3, aggregation: "RATA_RATA", userTypeIds: [tDosen.id] },
    pembeda: [0],
    objectIds: objKarya,
  });

  const k4 = await buatKategori({
    code: "UAT-TENDIK", name: "Tendik Terbaik Layanan (UAT)", objectTypeId: oOrang.id,
    parameters: [
      { name: "Kecepatan layanan", indicator: "Permintaan diselesaikan tepat waktu.", weight: 50 },
      { name: "Keramahan", indicator: "Melayani dengan sopan dan sabar.", weight: 30 },
      { name: "Ketelitian", indicator: "Berkas dan data diproses tanpa keliru.", weight: 20 },
    ],
    pimpinan: { target: 2, minimum: 1, aggregation: "TOTAL" },
    selain: { target: 6, minimum: 2, aggregation: "TOTAL", userTypeIds: [tDosen.id, tTendik.id] },
    bobotGabungan: 70,
    objectIds: objTendik,
  });

  console.log("== 4. Membagi tugas penilaian ==");
  const kategoriSemua = [k1, k2, k3, k4];
  let totalTugas = 0;
  for (const k of kategoriSemua) {
    const { plan } = await commitPlan(k.kategori.id, `uat-${k.kategori.code}`, actor);
    totalTugas += plan.totalNewAssignments;
    const kurang = plan.entries.reduce((s, e) => s + e.shortage, 0);
    console.log(`   ${k.kategori.name}: ${plan.totalNewAssignments} tugas${kurang ? `, kekurangan ${kurang} slot` : ""}`);
  }

  console.log("== 5. Membuka periode ==");
  const policy = await prisma.accessPolicy.findUniqueOrThrow({ where: { periodId: period.id } });
  await setAccessPolicy(period.id, { mode: "SELAMA_AKTIF", availableAt: null, expectedVersion: policy.version }, actor);
  const masalah = await checkReadiness(period.id);
  if (masalah.length) {
    console.log("   Belum siap:", masalah.join(" | "));
  } else {
    await transitionPeriodStatus(period.id, "SIAP", actor, "Siap untuk UAT.");
    await transitionPeriodStatus(period.id, "AKTIF", actor, "Dibuka untuk UAT.");
    console.log("   Periode dibuka (AKTIF).");
  }

  console.log("== 6. Mengisi sebagian jawaban ==");
  // Sekitar separuh tugas dikirim dan sebagian kecil dibiarkan sebagai draf, supaya Hasil dan
  // Pemantauan langsung ada isinya sementara sisanya tetap bisa diisi manual saat pengujian.
  const acak = (() => {
    let s = 20260920;
    return () => ((s = (s * 1103515245 + 12345) % 2147483648), s / 2147483648);
  })();
  const tugas = await prisma.assignment.findMany({
    where: { categoryObject: { category: { periodId: period.id } } },
    include: { instrumentVersion: { include: { parameters: true } } },
  });
  let terkirim = 0;
  let draf = 0;
  for (const t of tugas) {
    const undi = acak();
    if (undi > 0.7) continue; // dibiarkan belum mulai
    const scores = t.instrumentVersion.parameters.map((p) => ({
      parameterId: p.id,
      // Parameter bernilai mentah diisi angka besar (mis. jumlah publikasi), selain itu skor 60–95.
      score: p.normalized ? Math.round(5 + acak() * 295) : Math.round(60 + acak() * 35),
    }));
    const state = undi > 0.58 ? "DRAFT" : "SUBMITTED";
    const rev = await prisma.responseRevision.create({
      data: {
        assignmentId: t.id,
        revision: 1,
        state,
        submittedAt: state === "SUBMITTED" ? new Date() : null,
        editedById: t.evaluatorId,
      },
    });
    await prisma.responseScore.createMany({ data: scores.map((s) => ({ responseRevisionId: rev.id, ...s })) });
    await prisma.assignment.update({ where: { id: t.id }, data: { status: state === "SUBMITTED" ? "TERKIRIM" : "DRAF" } });
    if (state === "SUBMITTED") terkirim += 1;
    else draf += 1;
  }
  console.log(`   ${terkirim} tugas terkirim, ${draf} draf, ${tugas.length - terkirim - draf} belum disentuh`);

  console.log("== 7. Menghitung hasil ==");
  for (const k of kategoriSemua) {
    await calculateResults(k.kategori.id, actor);
    console.log(`   ${k.kategori.name}: hasil dihitung`);
  }

  const ringkas = await prisma.user.count({ where: { active: true } });
  console.log(`\nSelesai. Periode ${KODE_UAT} siap diuji · total pengguna aktif: ${ringkas} · total tugas: ${totalTugas}`);
}

main()
  .catch((e) => {
    console.error("Penyiapan UAT gagal:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
