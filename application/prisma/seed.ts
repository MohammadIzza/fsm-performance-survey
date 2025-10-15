import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { FSM_UNITS } from "../src/lib/data/fsm-org";
import { pejabatAkunSeed } from "../src/lib/data/fsm-pimpinan";

const db = new PrismaClient();

/**
 * Jabatan dipasang hanya bila belum ada. `create` biasa akan menggandakan keempat jabatan ini
 * setiap kali seed dijalankan ulang pada basis data yang sudah berisi.
 */
async function pastikanPimpinan(
  db: PrismaClient,
  userId: string,
  unitId: string,
  title: string,
  effectiveFrom: Date
) {
  const ada = await db.leadership.findFirst({ where: { userId, unitId, title } });
  if (ada) return ada;
  return db.leadership.create({ data: { userId, unitId, title, effectiveFrom } });
}

async function main() {
  const dosen = await db.userType.upsert({
    where: { code: "DOSEN" },
    update: {},
    create: { code: "DOSEN", name: "Dosen" },
  });
  const tendik = await db.userType.upsert({
    where: { code: "TENDIK" },
    update: {},
    create: { code: "TENDIK", name: "Tenaga Kependidikan" },
  });
  const mahasiswa = await db.userType.upsert({
    where: { code: "MAHASISWA" },
    update: {},
    create: { code: "MAHASISWA", name: "Mahasiswa" },
  });

  // Bab 8.3: jenis objek dasar. Admin dapat menambah jenis lain lewat halaman Objek Penilaian.
  await db.objectType.upsert({
    where: { code: "ORANG" },
    update: {},
    create: { code: "ORANG", name: "Orang" },
  });
  await db.objectType.upsert({
    where: { code: "UNIT" },
    update: {},
    create: { code: "UNIT", name: "Unit" },
  });
  await db.objectType.upsert({
    where: { code: "KARYA" },
    update: {},
    create: { code: "KARYA", name: "Karya" },
  });
  await db.objectType.upsert({
    where: { code: "LAINNYA" },
    update: {},
    create: { code: "LAINNYA", name: "Lainnya" },
  });

  // Struktur akademik fakultas — fakultas, enam departemen, tiga belas program studi — dibaca dari
  // satu daftar bersama agar seed dan penyelaras (`npm run seed:units`) tidak pernah berbeda.
  // Nama dan induk ikut diperbarui pada upsert: kalau daftar resminya berubah, seed ulang cukup.
  const unitByCode = new Map<string, { id: string }>();
  for (const u of FSM_UNITS) {
    const parentId = u.parentCode ? unitByCode.get(u.parentCode)!.id : null;
    const unit = await db.unit.upsert({
      where: { code: u.code },
      update: { name: u.name, parentId },
      create: { code: u.code, name: u.name, parentId },
    });
    unitByCode.set(u.code, unit);
  }
  const ambil = (code: string) => unitByCode.get(code)!;

  const fsm = ambil("FSM");
  const depMat = ambil("DEP-MAT");
  const depFis = ambil("DEP-FIS");
  const prodiMat = ambil("PS-MAT");
  const prodiStat = ambil("PS-STAT");
  const prodiFis = ambil("PS-FIS");

  const unitAdmin = await db.unit.upsert({
    where: { code: "TU-FSM" },
    update: {},
    create: { code: "TU-FSM", name: "Tata Usaha FSM", parentId: fsm.id },
  });

  const admin = await db.user.upsert({
    where: { loginIdentifier: "admin01" },
    update: { name: "Rangga Prakoso, S.Kom." },
    create: {
      loginIdentifier: "admin01",
      name: "Rangga Prakoso, S.Kom.",
      userTypeId: tendik.id,
      primaryUnitId: unitAdmin.id,
    },
  });
  await db.roleGrant.upsert({
    where: { id: `${admin.id}-ADMIN` },
    update: {},
    create: { id: `${admin.id}-ADMIN`, userId: admin.id, role: "ADMIN" },
  });

  // Akun contoh pimpinan memegang jabatan resmi dan memakai nama pejabatnya (fsm-pimpinan.ts).
  const jabatanDekan = pejabatAkunSeed("dekan01");
  const dekan = await db.user.upsert({
    where: { loginIdentifier: "dekan01" },
    update: { name: jabatanDekan.nama },
    create: {
      loginIdentifier: "dekan01",
      name: jabatanDekan.nama,
      userTypeId: dosen.id,
      primaryUnitId: fsm.id,
    },
  });
  await db.roleGrant.upsert({
    where: { id: `${dekan.id}-DEKAN` },
    update: {},
    create: { id: `${dekan.id}-DEKAN`, userId: dekan.id, role: "DEKAN" },
  });
  await pastikanPimpinan(db, dekan.id, fsm.id, jabatanDekan.jabatan, new Date("2026-01-01"));

  // Unit dengan satu pimpinan.
  const jabatanKaMat = pejabatAkunSeed("dosen1001");
  const kaMat = await db.user.upsert({
    where: { loginIdentifier: "dosen1001" },
    update: { name: jabatanKaMat.nama },
    create: {
      loginIdentifier: "dosen1001",
      name: jabatanKaMat.nama,
      userTypeId: dosen.id,
      primaryUnitId: depMat.id,
    },
  });
  await pastikanPimpinan(db, kaMat.id, depMat.id, jabatanKaMat.jabatan, new Date("2026-01-01"));

  // Departemen Fisika: ketua resmi. Sekretaris Departemen Fisika tidak diumumkan fakultas, jadi
  // dosen1003 kini dosen biasa di departemen itu. Uji yang membutuhkan unit berpimpinan dua
  // (scripts/test-tahap3.ts) membuat jabatan sementaranya sendiri.
  const jabatanKaFis = pejabatAkunSeed("dosen1002");
  const kaFis = await db.user.upsert({
    where: { loginIdentifier: "dosen1002" },
    update: { name: jabatanKaFis.nama },
    create: {
      loginIdentifier: "dosen1002",
      name: jabatanKaFis.nama,
      userTypeId: dosen.id,
      primaryUnitId: depFis.id,
    },
  });
  const sekFis = await db.user.upsert({
    where: { loginIdentifier: "dosen1003" },
    update: { name: "Dr. Hesti Wulandari, M.Si." },
    create: {
      loginIdentifier: "dosen1003",
      name: "Dr. Hesti Wulandari, M.Si.",
      userTypeId: dosen.id,
      primaryUnitId: depFis.id,
    },
  });
  await pastikanPimpinan(db, kaFis.id, depFis.id, jabatanKaFis.jabatan, new Date("2026-01-01"));
  // Basis data yang di-seed sebelumnya masih mencatat dosen1003 sebagai sekretaris; dilepas.
  await db.leadership.deleteMany({ where: { userId: sekFis.id, unitId: depFis.id, title: "Sekretaris Departemen" } });

  // Dosen, tendik, mahasiswa fiktif tambahan tersebar di beberapa unit.
  const extraUsers: Array<{ id: string; name: string; typeId: string; unitId: string }> = [
    { id: "dosen1004", name: "Dr. Sulistyo Raharjo, S.Si., M.Si.", typeId: dosen.id, unitId: prodiMat.id },
    { id: "dosen1005", name: "Dr. Ratih Puspaningrum, M.Sc.", typeId: dosen.id, unitId: prodiMat.id },
    { id: "dosen1006", name: "Dr. Bagus Alamsyah, M.Stat.", typeId: dosen.id, unitId: prodiStat.id },
    { id: "dosen1007", name: "Dr. Herlambang Susilo, M.Si.", typeId: dosen.id, unitId: prodiFis.id },
    { id: "tendik2001", name: "Sumarno Hartoyo, S.E.", typeId: tendik.id, unitId: unitAdmin.id },
    { id: "tendik2002", name: "Retno Palupi, A.Md.", typeId: tendik.id, unitId: unitAdmin.id },
    { id: "2311100001", name: "Alifia Ramadhani", typeId: mahasiswa.id, unitId: prodiMat.id },
    { id: "2311100002", name: "Bintang Prayoga", typeId: mahasiswa.id, unitId: prodiMat.id },
    { id: "2311200001", name: "Chandra Wicaksana", typeId: mahasiswa.id, unitId: prodiStat.id },
    // Bab 23: "Satu unit memiliki >10 calon" — PS-FIS ditambah 8 dosen agar DEP-FIS+PS-FIS
    // (lingkup unit+subunit) memiliki 11 calon aktif (dosen1002, dosen1003, dosen1007, + 8 ini).
    { id: "dosen1010", name: "Dr. Mulyadi Santosa, M.Si.", typeId: dosen.id, unitId: prodiFis.id },
    { id: "dosen1011", name: "Dr. Ningrum Sasmita, M.Sc.", typeId: dosen.id, unitId: prodiFis.id },
    { id: "dosen1012", name: "Dr. Oktario Pranaja, M.Si.", typeId: dosen.id, unitId: prodiFis.id },
    { id: "dosen1013", name: "Dr. Puspita Larasati, M.Sc.", typeId: dosen.id, unitId: prodiFis.id },
    { id: "dosen1014", name: "Dr. Qori Dwi Anggara, M.Si.", typeId: dosen.id, unitId: prodiFis.id },
    { id: "dosen1015", name: "Dr. Rusdiana Melati, M.Si.", typeId: dosen.id, unitId: prodiFis.id },
    { id: "dosen1016", name: "Dr. Samsul Ma\u2019arif, M.Sc.", typeId: dosen.id, unitId: prodiFis.id },
    { id: "dosen1017", name: "Dr. Tuti Rahmania, M.Si.", typeId: dosen.id, unitId: prodiFis.id },
  ];

  for (const u of extraUsers) {
    await db.user.upsert({
      where: { loginIdentifier: u.id },
      update: { name: u.name, userTypeId: u.typeId, primaryUnitId: u.unitId },
      create: {
        loginIdentifier: u.id,
        name: u.name,
        userTypeId: u.typeId,
        primaryUnitId: u.unitId,
      },
    });
  }

  // Bab 23: "satu [unit] tidak memiliki calon sah" — unit tanpa pengguna dan tanpa subunit,
  // sehingga kelompok Pimpinan maupun Selain Pimpinan sama-sama nol calon.
  await db.unit.upsert({
    where: { code: "UNIT-KOSONG" },
    update: {},
    create: { code: "UNIT-KOSONG", name: "Unit Riset Baru (Belum Berpenghuni)", parentId: fsm.id },
  });

  // Prodi Statistika sengaja tidak punya pimpinan (skenario ORG-04: kekosongan pimpinan).
  // Unit administratif TU-FSM sengaja punya sedikit calon penilai (<10) untuk skenario Bab 10.5.
  // Unit prodi fisika + departemen fisika bersama memiliki >10 calon jika digabung lintas unit.
  // UNIT-KOSONG sengaja tidak memiliki calon sah sama sekali.

  await db.user.updateMany({
    where: { loginIdentifier: "dosen1099" },
    data: { active: false },
  });
  await db.user.upsert({
    where: { loginIdentifier: "dosen1099" },
    update: { active: false },
    create: {
      loginIdentifier: "dosen1099",
      name: "Dr. Wahyono Kuncoro, M.Si. (nonaktif)",
      userTypeId: dosen.id,
      primaryUnitId: prodiFis.id,
      active: false,
    },
  });

  console.log("Seed Tahap 1 selesai.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
