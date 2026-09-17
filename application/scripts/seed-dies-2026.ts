// Rancangan penilaian Dies Natalis FSM UNDIP 2026 beserta orang dan objek yang dinilai.
//
// Skrip ini MENGGANTI seluruh rancangan penilaian yang ada di basis data: setiap periode berikut
// kategori, instrumen, aturan, penugasan, jawaban, dan hasilnya dihapus lebih dulu, lalu satu
// periode Dies dibangun dari berkas panitia (src/lib/data/dies-2026.ts). Unit, jenis pengguna,
// jenis objek, dan pengguna yang sudah ada TIDAK dihapus — orang dari roster demo ditambahkan di
// atasnya (src/lib/data/fsm-people.ts).
//
// Dijalankan dengan `npm run seed:dies`, sesudah `npm run db:seed` dan `npm run seed:units`.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { createRng } from "../src/lib/prng";
import { KATEGORI_DIES, panduanInstrumen, type KategoriDies } from "../src/lib/data/dies-2026";
import { bangunRoster, UNIT_PANITIA } from "../src/lib/data/fsm-people";
import { FSM_UNITS } from "../src/lib/data/fsm-org";
import { createPeriod, transitionPeriodStatus, setAccessPolicy } from "../src/lib/services/periods";
import { createCategory, addCategoryObjects } from "../src/lib/services/categories";
import { addParameter, updateInstrumentScale } from "../src/lib/services/instruments";
import { updateGroupRule } from "../src/lib/services/groupRules";
import { updateAssignmentRule } from "../src/lib/services/assignmentRules";
import { createObject } from "../src/lib/services/objects";
import { commitPlan, computePlan } from "../src/lib/services/assignmentPlanning";
import type { AuthContext } from "../src/lib/authz";

const PERIODE_KODE = "DIES-FSM-2026";

/**
 * Akun penilai yang tercantum di halaman masuk sebagai contoh. Tugasnya sengaja dibiarkan kosong
 * seluruhnya supaya siapa pun yang mencoba demo bisa mengisi dari awal sampai kirim.
 */
const AKUN_DEMO_PENILAI = "dosen1004";

// Jendela pengisian dihitung dari hari seed dijalankan, bukan tanggal tetap. Dengan tanggal tetap
// periode ini kedaluwarsa begitu tanggalnya lewat — layanan pengisian menolak setiap jawaban
// sesudah tenggat, dan demo berhenti bisa dipakai tanpa ada yang berubah di kodenya.
const HARI = 24 * 60 * 60 * 1000;
const hariIni = new Date();
const MULAI_PERIODE = new Date(hariIni.getTime() - 14 * HARI);
const TENGGAT_PERIODE = new Date(hariIni.getTime() + 75 * HARI);
const tanggal = (d: Date) => d.toISOString().slice(0, 10);
const rng = createRng("dies-fsm-2026");

/** Bilangan bulat 0..n-1 yang sama di tiap kali jalan. */
const acak = (n: number) => Math.floor(rng() * n);
const pilih = <T,>(a: T[]) => a[acak(a.length)];

// ————————————————————————————————————————————————————————————————————————————————
// 1. Menghapus seluruh rancangan penilaian yang ada
// ————————————————————————————————————————————————————————————————————————————————
async function hapusRancanganLama() {
  const sebelum = {
    periode: await prisma.period.count(),
    kategori: await prisma.category.count(),
    objek: await prisma.assessmentObject.count(),
    penugasan: await prisma.assignment.count(),
    jawaban: await prisma.responseRevision.count(),
  };

  // Urutan mengikuti arah kunci asing: anak lebih dulu, induk belakangan.
  await prisma.parameterResult.deleteMany({});
  await prisma.objectGroupResult.deleteMany({});
  await prisma.calculationRun.deleteMany({});
  await prisma.finalization.deleteMany({});
  await prisma.responseScore.deleteMany({});
  await prisma.responseRevision.deleteMany({});
  // Tugas pengganti menunjuk tugas yang digantikannya; tautannya diputus dulu supaya penghapusan
  // tidak bergantung pada urutan baris.
  await prisma.assignment.updateMany({ data: { replacesId: null } });
  await prisma.assignment.deleteMany({});
  await prisma.assignmentBatch.deleteMany({});
  await prisma.categoryObject.deleteMany({});
  await prisma.groupRule.deleteMany({});
  await prisma.parameter.deleteMany({});
  await prisma.instrumentVersion.deleteMany({});
  await prisma.assignmentRule.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.accessPolicy.deleteMany({});
  // Periode salinan menunjuk periode asalnya.
  await prisma.period.updateMany({ data: { copiedFromId: null } });
  await prisma.period.deleteMany({});
  await prisma.objectContributor.deleteMany({});
  await prisma.assessmentObject.deleteMany({});

  console.log(
    `Rancangan lama dihapus — periode ${sebelum.periode}, kategori ${sebelum.kategori}, ` +
      `objek ${sebelum.objek}, penugasan ${sebelum.penugasan}, jawaban ${sebelum.jawaban}.`
  );
}

// ————————————————————————————————————————————————————————————————————————————————
// 2. Unit panitia, orang, dan penetapan pimpinan
// ————————————————————————————————————————————————————————————————————————————————
async function siapkanOrang() {
  const fsm = await prisma.unit.findUniqueOrThrow({ where: { code: "FSM" } });
  await prisma.unit.upsert({
    where: { code: UNIT_PANITIA },
    update: { name: "Panitia Dies Natalis FSM 2026", parentId: fsm.id, active: true },
    create: { code: UNIT_PANITIA, name: "Panitia Dies Natalis FSM 2026", parentId: fsm.id },
  });

  const jenis = await prisma.userType.findMany();
  const jenisId = (kode: string) => jenis.find((j) => j.code === kode)!.id;
  const unit = await prisma.unit.findMany();
  const unitId = (kode: string) => {
    const u = unit.find((x) => x.code === kode);
    if (!u) throw new Error(`Unit ${kode} belum ada — jalankan \`npm run seed:units\` lebih dulu.`);
    return u.id;
  };

  const roster = bangunRoster();
  let baru = 0;
  for (const o of roster.orang) {
    const data = {
      name: o.nama,
      userTypeId: jenisId(o.peran),
      primaryUnitId: unitId(o.unit),
      active: true,
    };
    const ada = await prisma.user.findUnique({ where: { loginIdentifier: o.loginIdentifier } });
    if (ada) {
      await prisma.user.update({ where: { id: ada.id }, data });
    } else {
      await prisma.user.create({ data: { loginIdentifier: o.loginIdentifier, ...data } });
      baru++;
    }
  }

  // Roster yang berubah (mis. jumlah dosen per departemen bertambah) menggeser nomor induk
  // sesudahnya, sehingga orang dari roster versi sebelumnya akan tertinggal sebagai data yatim.
  // Yang dibuang hanya yang bernomor induk bentuk roster — 18 angka untuk NIP, 14 untuk NIM —
  // sehingga akun contoh seed dasar (admin01, dosen1001, 2311100001) tidak pernah ikut terhapus.
  const dikenal = new Set(roster.orang.map((o) => o.loginIdentifier));
  const lama = (
    await prisma.user.findMany({ select: { id: true, loginIdentifier: true } })
  ).filter(
    (u) =>
      /^\d{18}$|^\d{14}$/.test(u.loginIdentifier) && !dikenal.has(u.loginIdentifier)
  );
  if (lama.length > 0) {
    const ids = lama.map((u) => u.id);
    await prisma.leadership.deleteMany({ where: { userId: { in: ids } } });
    await prisma.roleGrant.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  // Jabatan roster versi sebelumnya yang tidak lagi ada — jabatan karangan seperti "Koordinator
  // Program Studi" atau sekretaris departemen yang tidak diumumkan fakultas — dilepas dari orang
  // roster. Yang dicocokkan orang, unit, dan sebutan jabatannya sekaligus; jabatan akun seed dasar
  // (dekan01, dosen1001, …) tidak tersentuh karena bukan orang roster.
  const jabatanRoster = new Set(roster.pimpinan.map((p) => `${p.loginIdentifier}|${p.unit}|${p.jabatan}`));
  const jabatanUsang = (
    await prisma.leadership.findMany({
      where: { user: { loginIdentifier: { in: [...dikenal] } } },
      select: { id: true, title: true, user: { select: { loginIdentifier: true } }, unit: { select: { code: true } } },
    })
  ).filter((l) => !jabatanRoster.has(`${l.user.loginIdentifier}|${l.unit.code}|${l.title}`));
  if (jabatanUsang.length > 0) {
    await prisma.leadership.deleteMany({ where: { id: { in: jabatanUsang.map((l) => l.id) } } });
  }

  // Jabatan dari roster dipasang hanya bila unitnya belum punya pimpinan berjalan, sehingga
  // penetapan yang sudah ada di basis data (mis. Dekan dan Ketua Departemen dari seed dasar)
  // tidak digandakan.
  const sekarang = new Date();
  // Dipulihkan LEBIH DULU daripada memasang jabatan roster: kalau urutannya terbalik, unit yang
  // jabatannya sedang kedaluwarsa dianggap kosong, diberi pimpinan baru, lalu jabatan lamanya
  // ikut dihidupkan — dan unit itu berakhir dengan pimpinan lebih banyak daripada seharusnya.
  // Jabatan yang pernah diakhiri lewat panel admin membuat unitnya tak punya calon kelompok
  // Pimpinan sama sekali. Untuk lingkungan demonstrasi jabatan itu dibuka kembali daripada
  // menyisakan departemen tanpa pimpinan.
  const dipulihkan = await prisma.leadership.updateMany({
    where: { active: true, effectiveTo: { not: null, lte: sekarang } },
    data: { effectiveTo: null },
  });

  // Dicocokkan per sebutan jabatan, bukan per unit: satu departemen butuh ketua DAN sekretaris,
  // dan bila salah satunya sudah dijabat orang dari seed dasar, yang lain tetap harus terisi.
  const jabatanTerisi = new Set(
    (
      await prisma.leadership.findMany({
        where: {
          active: true,
          effectiveFrom: { lte: sekarang },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: sekarang } }],
        },
        select: { unitId: true, title: true },
      })
    ).map((l) => `${l.unitId}|${l.title}`)
  );
  let jabatanBaru = 0;
  for (const p of roster.pimpinan) {
    const u = unitId(p.unit);
    if (jabatanTerisi.has(`${u}|${p.jabatan}`)) continue;
    jabatanTerisi.add(`${u}|${p.jabatan}`);
    const orang = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: p.loginIdentifier } });
    await prisma.leadership.create({
      data: { userId: orang.id, unitId: u, title: p.jabatan, effectiveFrom: new Date("2025-01-01") },
    });
    jabatanBaru++;
  }

  console.log(
    `Orang: ${roster.orang.length} di roster (${baru} baru, ${lama.length} sisa roster lama dihapus), ` +
      `jabatan baru ${jabatanBaru}, jabatan usang dilepas ${jabatanUsang.length}, jabatan kedaluwarsa dipulihkan ${dipulihkan.count}.`
  );
  return roster;
}

// ————————————————————————————————————————————————————————————————————————————————
// 3. Periode Dies dan sembilan kategorinya
// ————————————————————————————————————————————————————————————————————————————————

/** Aturan penilai tiap kategori: siapa yang dinilai, siapa yang menilai, dan berapa banyak. */
interface RencanaKategori {
  /** Kelompok Pimpinan: target & minimum respons. */
  pimpinan: { target: number; minimum: number };
  /** Kelompok Selain Pimpinan: target, minimum, lingkup, dan jenis pengguna yang boleh menilai. */
  selain: {
    target: number;
    minimum: number;
    scope: "UNIT_OBJEK" | "UNIT_DAN_SUBUNIT";
    jenis: ("DOSEN" | "TENDIK" | "MAHASISWA")[];
  };
}

const RENCANA: Record<string, RencanaKategori> = {
  // Prodi dinilai pimpinan departemennya. Menurut data resmi, departemen Matematika, Biologi,
  // Fisika, dan Kimia hanya punya ketua di tingkat departemen — target dua akan selalu kurang calon.
  "01-PUBLIKASI-PRODI": {
    pimpinan: { target: 1, minimum: 1 },
    selain: { target: 8, minimum: 3, scope: "UNIT_DAN_SUBUNIT", jenis: ["DOSEN"] },
  },
  "02-IKU-PRODI": {
    pimpinan: { target: 1, minimum: 1 },
    selain: { target: 8, minimum: 3, scope: "UNIT_DAN_SUBUNIT", jenis: ["DOSEN"] },
  },
  // Sebuah prodi berisi enam dosen. Untuk satu objek, dirinya sendiri dan pimpinan prodi
  // (terpakai kelompok Pimpinan pada objek yang sama) tidak ikut, jadi calonnya empat.
  "03-PUBLIKASI-DOSEN": {
    pimpinan: { target: 1, minimum: 1 },
    selain: { target: 4, minimum: 3, scope: "UNIT_DAN_SUBUNIT", jenis: ["DOSEN"] },
  },
  // Prodi paling kecil (magister) berisi enam dosen dan enam mahasiswa; dikurangi objek itu
  // sendiri dan pimpinannya, sepuluh orang tersisa sebagai responden.
  "04-DOSEN-FAVORIT": {
    pimpinan: { target: 1, minimum: 1 },
    selain: { target: 10, minimum: 5, scope: "UNIT_DAN_SUBUNIT", jenis: [] },
  },
  "05-TENDIK-AKADEMIK": {
    pimpinan: { target: 1, minimum: 1 },
    selain: { target: 5, minimum: 3, scope: "UNIT_OBJEK", jenis: ["TENDIK"] },
  },
  "06-TENDIK-SUMBER-DAYA": {
    pimpinan: { target: 1, minimum: 1 },
    selain: { target: 5, minimum: 3, scope: "UNIT_OBJEK", jenis: ["TENDIK"] },
  },
  "07-VIDEO-HM": {
    pimpinan: { target: 1, minimum: 1 },
    selain: { target: 3, minimum: 3, scope: "UNIT_OBJEK", jenis: [] },
  },
  "08-VIDEO-PENGELOLA": {
    pimpinan: { target: 1, minimum: 1 },
    selain: { target: 3, minimum: 3, scope: "UNIT_OBJEK", jenis: [] },
  },
  "09-FSM-GOT-TALENT": {
    pimpinan: { target: 1, minimum: 1 },
    selain: { target: 3, minimum: 3, scope: "UNIT_OBJEK", jenis: [] },
  },
};

const JENIS_BAKAT = [
  "Vokal solo", "Band akustik", "Tari tradisional", "Stand-up comedy", "Sulap panggung",
  "Musikalisasi puisi", "Tari modern", "Permainan biola", "Beatbox", "Monolog",
];

/**
 * Tugas untuk akun demo penilai. Pembagian otomatis hanya memberinya objek yang sesuai aturan
 * kategorinya — dua atau tiga tugas, dan kebetulan semuanya ikut terisi acak. Untuk demo itu
 * terlalu sedikit dan terlalu seragam, jadi di sini ia diberi tugas tambahan dari kategori-kategori
 * yang berbeda jenisnya: dosen, video, dan bakat. Tugas ditulis langsung karena penugasan manual
 * lewat layanan hanya dibuka selama periode Draf, sedangkan tahap ini dijalankan sesudah pembagian.
 */
async function siapkanTugasDemo(periodeId: string) {
  const penilai = await prisma.user.findUniqueOrThrow({
    where: { loginIdentifier: AKUN_DEMO_PENILAI },
  });

  // Berapa tugas tambahan per kategori. Kategori tendik (05, 06) tidak ikut: penilainya atasan
  // dan sejawat sesama tendik, dan dosen yang menilai tendik tidak masuk akal sebagai contoh.
  const tambahan: Record<string, number> = {
    "04-DOSEN-FAVORIT": 2,
    "07-VIDEO-HM": 1,
    "08-VIDEO-PENGELOLA": 1,
    "09-FSM-GOT-TALENT": 1,
  };

  let dibuat = 0;
  for (const [kode, jumlah] of Object.entries(tambahan)) {
    const kategori = await prisma.category.findFirstOrThrow({
      where: { periodId: periodeId, code: kode },
      include: {
        instrumentVersions: { orderBy: { revision: "desc" }, take: 1 },
        categoryObjects: {
          orderBy: { nameSnapshot: "asc" },
          include: { object: { include: { contributors: true } }, assignments: true },
        },
      },
    });
    const instrumen = kategori.instrumentVersions[0];
    const calon = kategori.categoryObjects.filter(
      (co) =>
        co.object.referenceUserId !== penilai.id &&
        !co.object.contributors.some((c) => c.userId === penilai.id) &&
        !co.assignments.some((a) => a.evaluatorId === penilai.id)
    );
    for (const co of calon.slice(0, jumlah)) {
      await prisma.assignment.create({
        data: {
          categoryObjectId: co.id,
          evaluatorId: penilai.id,
          group: "SELAIN_PIMPINAN",
          instrumentVersionId: instrumen.id,
          status: "BELUM_MULAI",
          evaluatorNameSnapshot: penilai.name,
          evaluatorLoginSnapshot: penilai.loginIdentifier,
        },
      });
      dibuat++;
    }
  }
  const total = await prisma.assignment.count({ where: { evaluatorId: penilai.id } });
  console.log(`\nAkun demo ${AKUN_DEMO_PENILAI}: ${dibuat} tugas tambahan, ${total} tugas seluruhnya.`);
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

  await hapusRancanganLama();
  await siapkanOrang();

  const unit = await prisma.unit.findMany();
  const unitOleh = (kode: string) => unit.find((u) => u.code === kode)!;
  const jenisObjek = await prisma.objectType.findMany();
  const jenisObjekId = (kode: string) => jenisObjek.find((t) => t.code === kode)!.id;
  const jenisPengguna = await prisma.userType.findMany();
  const jenisPenggunaId = (kode: string) => jenisPengguna.find((t) => t.code === kode)!.id;

  const orangDi = async (kodeUnit: string, peran: string) =>
    prisma.user.findMany({
      where: {
        primaryUnitId: unitOleh(kodeUnit).id,
        active: true,
        userType: { code: peran },
      },
      orderBy: { loginIdentifier: "asc" },
    });
  const pemimpinDi = async (kodeUnit: string) =>
    (
      await prisma.leadership.findMany({
        where: { unitId: unitOleh(kodeUnit).id, active: true, effectiveTo: null },
        orderBy: { createdAt: "asc" },
        select: { user: true },
      })
    ).map((l) => l.user);
  // Pimpinan mengikuti data resmi fakultas, dan tidak setiap program studi punya pimpinan sendiri
  // (Sarjana Statistika dan Sarjana Informatika hanya dipimpin departemennya). Unit semacam itu
  // diwakili unit terdekat di atasnya yang berpimpinan — sebagai penanggung jawab objek dan
  // sebagai unit pemilik yang menentukan calon kelompok Pimpinan.
  const unitBerpimpinan = async (kodeUnit: string): Promise<string> => {
    let kode = kodeUnit;
    for (;;) {
      if ((await pemimpinDi(kode)).length > 0) return kode;
      const induk = unit.find((u) => u.id === unitOleh(kode).parentId);
      if (!induk) return kodeUnit;
      kode = induk.code;
    }
  };
  const pimpinanUnit = async (kodeUnit: string) =>
    (await pemimpinDi(await unitBerpimpinan(kodeUnit)))[0] ?? null;

  console.log("\nMembuat periode Dies FSM UNDIP 2026…");
  const periode = await createPeriod(
    {
      code: PERIODE_KODE,
      name: "Dies Natalis FSM UNDIP 2026",
      description:
        "Sembilan kategori penilaian Dies Natalis Fakultas Sains dan Matematika UNDIP 2026, " +
        "disusun mengikuti instrumen yang ditetapkan panitia.",
      timezone: "Asia/Jakarta",
      startsAt: tanggal(MULAI_PERIODE),
      endsAt: tanggal(TENGGAT_PERIODE),
    },
    actor
  );

  const prodiSemua = FSM_UNITS.filter((u) => u.code.startsWith("PS-"));

  for (const k of KATEGORI_DIES) {
    const rencana = RENCANA[k.kode];
    const kategori = await createCategory(
      periode.id,
      {
        code: k.kode,
        name: k.nama,
        description: k.ringkasan,
        objectTypeId: jenisObjekId(k.jenisObjek),
        excludeContributors: true,
      },
      actor
    );
    const lengkap = await prisma.category.findUniqueOrThrow({
      where: { id: kategori.id },
      include: { instrumentVersions: true, assignmentRules: true, groupRules: true },
    });
    const instrumen = lengkap.instrumentVersions[0];
    await updateInstrumentScale(
      instrumen.id,
      { scaleMin: 0, scaleMax: 100, scaleStep: 1, guide: panduanInstrumen(k) },
      actor
    );
    const parameterId: string[] = [];
    for (const p of k.parameter) {
      const dibuat = await addParameter(
        instrumen.id,
        { name: p.nama, indicator: p.indikator, weight: p.bobot },
        actor
      );
      parameterId.push(dibuat.id);
    }
    const pembedaIds = k.pembeda.map((i) => parameterId[i]);

    for (const g of lengkap.groupRules) {
      const r = g.group === "PIMPINAN" ? rencana.pimpinan : rencana.selain;
      await updateGroupRule(
        g.id,
        {
          aggregation: "RATA_RATA",
          target: r.target,
          minimum: r.minimum,
          tieBreakParameterIds: pembedaIds,
        },
        actor
      );
    }
    for (const a of lengkap.assignmentRules) {
      if (a.group === "PIMPINAN") {
        await updateAssignmentRule(a.id, { scope: "UNIT_OBJEK", userTypeIds: [] }, actor);
      } else {
        await updateAssignmentRule(
          a.id,
          {
            scope: rencana.selain.scope,
            userTypeIds: rencana.selain.jenis.map(jenisPenggunaId),
          },
          actor
        );
      }
    }

    // —— Objek yang dinilai, sesuai jenis kategorinya ——
    const objekIds: string[] = [];

    if (k.kode === "01-PUBLIKASI-PRODI" || k.kode === "02-IKU-PRODI") {
      for (const p of prodiSemua) {
        const penanggungJawab = await pimpinanUnit(p.code);
        const objek = await createObject(
          {
            typeId: jenisObjekId("UNIT"),
            name: p.name,
            // Unit pemilik = induknya: yang menilai prodi adalah pimpinan dan dosen di atasnya,
            // bukan prodi itu sendiri.
            ownerUnitId: unitOleh(p.parentCode!).id,
            referenceUserId: null,
            referenceUnitId: unitOleh(p.code).id,
            responsibleUserId: penanggungJawab?.id ?? null,
            url: null,
            description: `Capaian ${p.name} pada periode Dies FSM UNDIP 2026.`,
            contributorUserIds: [],
          },
          actor
        );
        objekIds.push(objek.id);
      }
    }

    if (k.kode === "03-PUBLIKASI-DOSEN" || k.kode === "04-DOSEN-FAVORIT") {
      for (const p of prodiSemua) {
        const dosen = await orangDi(p.code, "DOSEN");
        // Pimpinan prodi tidak dijadikan objek: mereka calon kelompok Pimpinan di unitnya, dan
        // larangan menilai diri sendiri akan mengosongkan kelompok itu. Pejabat asli juga tidak
        // diberi nilai karangan.
        const pimpinanProdi = new Set((await pemimpinDi(p.code)).map((u) => u.id));
        const calon = dosen.filter((d) => !pimpinanProdi.has(d.id));
        const pemilik = await unitBerpimpinan(p.code);
        // Dua kategori ini mengambil dosen dari ujung daftar yang berlawanan supaya tidak selalu
        // orang yang sama, tetapi prodi yang hanya punya satu calon tetap terwakili di keduanya.
        const terpilih =
          k.kode === "03-PUBLIKASI-DOSEN" ? calon.slice(0, 1) : calon.slice(-1);
        for (const d of terpilih) {
          const objek = await createObject(
            {
              typeId: jenisObjekId("ORANG"),
              name: d.name,
              ownerUnitId: unitOleh(pemilik).id,
              referenceUserId: d.id,
              referenceUnitId: null,
              responsibleUserId: null,
              url: null,
              description: null,
              contributorUserIds: [],
            },
            actor
          );
          objekIds.push(objek.id);
        }
      }
    }

    if (k.kode === "05-TENDIK-AKADEMIK" || k.kode === "06-TENDIK-SUMBER-DAYA") {
      const tendik = await orangDi("TU-FSM", "TENDIK");
      const pimpinanTu = new Set((await pemimpinDi("TU-FSM")).map((u) => u.id));
      const calon = tendik.filter((t) => !pimpinanTu.has(t.id));
      const bagian = k.kode === "05-TENDIK-AKADEMIK" ? calon.slice(0, 8) : calon.slice(8, 16);
      for (const t of bagian) {
        const objek = await createObject(
          {
            typeId: jenisObjekId("ORANG"),
            name: t.name,
            ownerUnitId: unitOleh("TU-FSM").id,
            referenceUserId: t.id,
            referenceUnitId: null,
            responsibleUserId: null,
            url: null,
            description: null,
            contributorUserIds: [],
          },
          actor
        );
        objekIds.push(objek.id);
      }
    }

    if (k.kode === "07-VIDEO-HM" || k.kode === "08-VIDEO-PENGELOLA") {
      const daftar =
        k.kode === "07-VIDEO-HM"
          ? prodiSemua.filter((p) => p.name.startsWith("Sarjana"))
          : prodiSemua;
      for (const p of daftar) {
        const penanggungJawab = await pimpinanUnit(p.code);
        const pembuat =
          k.kode === "07-VIDEO-HM"
            ? (await orangDi(p.code, "MAHASISWA")).slice(0, 3)
            : (await orangDi(p.code, "DOSEN")).slice(0, 2);
        const objek = await createObject(
          {
            typeId: jenisObjekId("KARYA"),
            name:
              k.kode === "07-VIDEO-HM"
                ? `Video Promosi ${p.name} — HM`
                : `Video Promosi ${p.name} — Pengelola Prodi`,
            // Juri berada di panitia, jadi panitia yang menjadi unit pemilik karya; prodi yang
            // dipromosikan tetap tercatat sebagai unit rujukan.
            ownerUnitId: unitOleh(UNIT_PANITIA).id,
            referenceUserId: null,
            referenceUnitId: unitOleh(p.code).id,
            responsibleUserId: penanggungJawab?.id ?? null,
            url: `https://video.fsm.undip.ac.id/dies-2026/${p.code.toLowerCase()}`,
            description: null,
            contributorUserIds: pembuat.map((u) => u.id),
          },
          actor
        );
        objekIds.push(objek.id);
      }
    }

    if (k.kode === "09-FSM-GOT-TALENT") {
      const pimpinanTuSemua = new Set((await pemimpinDi("TU-FSM")).map((u) => u.id));
      const peserta = [
        ...(await orangDi("PS-MAT", "MAHASISWA")).slice(0, 2),
        ...(await orangDi("PS-BIO", "MAHASISWA")).slice(0, 2),
        ...(await orangDi("PS-KIM", "MAHASISWA")).slice(0, 1),
        ...(await orangDi("PS-FIS", "MAHASISWA")).slice(0, 1),
        ...(await orangDi("PS-STAT", "MAHASISWA")).slice(0, 1),
        ...(await orangDi("PS-INFOR", "MAHASISWA")).slice(0, 1),
        ...(await orangDi("PS-INFOR", "DOSEN")).slice(0, 1),
        ...(await orangDi("TU-FSM", "TENDIK"))
          .filter((t) => !pimpinanTuSemua.has(t.id))
          .slice(15, 16),
      ];
      for (const [i, p] of peserta.entries()) {
        const objek = await createObject(
          {
            typeId: jenisObjekId("ORANG"),
            name: p.name,
            ownerUnitId: unitOleh(UNIT_PANITIA).id,
            referenceUserId: p.id,
            referenceUnitId: null,
            responsibleUserId: null,
            url: null,
            description: `${JENIS_BAKAT[i % JENIS_BAKAT.length]}.`,
            contributorUserIds: [],
          },
          actor
        );
        objekIds.push(objek.id);
      }
    }

    await addCategoryObjects(kategori.id, objekIds, actor);
    console.log(
      `  ${String(k.nomor).padStart(2, "0")} ${k.nama} — ${k.parameter.length} parameter, ${objekIds.length} objek`
    );
  }

  // Hasil dibuka setelah periode ditutup: pimpinan bisa menelusuri capaian unitnya begitu
  // pengisian selesai, tanpa menunggu finalisasi.
  const kebijakan = await prisma.accessPolicy.findUniqueOrThrow({ where: { periodId: periode.id } });
  await setAccessPolicy(
    periode.id,
    { mode: "SETELAH_DITUTUP", availableAt: null, expectedVersion: kebijakan.version },
    actor
  );

  // —— Penugasan penilai ——
  console.log("\nMenerbitkan penugasan penilai…");
  const kategoriPeriode = await prisma.category.findMany({
    where: { periodId: periode.id },
    orderBy: { code: "asc" },
  });
  for (const kat of kategoriPeriode) {
    const rencana = await computePlan(kat.id, `dies-2026-${kat.code}`);
    const { plan } = await commitPlan(kat.id, rencana.seed, actor, rencana.fingerprint);
    const kurang = plan.entries.filter((e) => e.shortage > 0).length;
    console.log(
      `  ${kat.code} — ${plan.totalNewAssignments} tugas${kurang ? `, ${kurang} slot kurang calon` : ""}`
    );
  }

  await siapkanTugasDemo(periode.id);

  await transitionPeriodStatus(periode.id, "SIAP", actor);
  await transitionPeriodStatus(periode.id, "AKTIF", actor);

  // —— Sebagian penilai sudah mengisi ——
  console.log("\nMengisi sebagian jawaban…");
  const penilaiDemo = await prisma.user.findUniqueOrThrow({
    where: { loginIdentifier: AKUN_DEMO_PENILAI },
  });
  const tugas = await prisma.assignment.findMany({
    where: {
      categoryObject: { category: { periodId: periode.id } },
      evaluatorId: { not: penilaiDemo.id },
    },
    include: { categoryObject: { include: { category: true } } },
    orderBy: { id: "asc" },
  });
  const parameterPerInstrumen = new Map<string, { id: string; weight: number }[]>();
  let terkirim = 0;
  let draf = 0;
  for (const t of tugas) {
    const undi = rng();
    if (undi > 0.88) continue; // belum dibuka sama sekali
    let params = parameterPerInstrumen.get(t.instrumentVersionId);
    if (!params) {
      params = await prisma.parameter.findMany({
        where: { instrumentVersionId: t.instrumentVersionId },
        select: { id: true, weight: true },
        orderBy: { order: "asc" },
      });
      parameterPerInstrumen.set(t.instrumentVersionId, params);
    }
    const kirim = undi <= 0.74;
    // Tiap objek punya "tingkat" sendiri supaya peringkatnya tidak rata; skor tiap parameter
    // bergoyang di sekitar tingkat itu.
    const dasar = 62 + acak(34);
    const revisi = await prisma.responseRevision.create({
      data: {
        assignmentId: t.id,
        revision: 1,
        state: kirim ? "SUBMITTED" : "DRAFT",
        submittedAt: kirim
          ? new Date(MULAI_PERIODE.getTime() + acak(13) * HARI + (8 + acak(10)) * 3600 * 1000)
          : null,
        editedById: t.evaluatorId,
      },
    });
    for (const p of params) {
      const nilai = Math.max(0, Math.min(100, dasar + acak(13) - 6));
      await prisma.responseScore.create({
        data: { responseRevisionId: revisi.id, parameterId: p.id, score: nilai },
      });
    }
    await prisma.assignment.update({
      where: { id: t.id },
      data: { status: kirim ? "TERKIRIM" : "DRAF" },
    });
    if (kirim) terkirim++;
    else draf++;
  }
  console.log(
    `  ${tugas.length} tugas: ${terkirim} terkirim, ${draf} masih draf, ${tugas.length - terkirim - draf} belum dibuka.`
  );

  const ringkas = await prisma.category.findMany({
    where: { periodId: periode.id },
    select: { code: true, name: true, _count: { select: { categoryObjects: true } } },
    orderBy: { code: "asc" },
  });
  console.log(`\nPeriode ${PERIODE_KODE} siap dipakai (status AKTIF).`);
  for (const r of ringkas) console.log(`  ${r.code.padEnd(22)} ${r._count.categoryObjects} objek — ${r.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
