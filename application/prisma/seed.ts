import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient();

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

  const fsm = await db.unit.upsert({
    where: { code: "FSM" },
    update: {},
    create: { code: "FSM", name: "Fakultas Sains dan Matematika" },
  });

  const depMat = await db.unit.upsert({
    where: { code: "DEP-MAT" },
    update: {},
    create: { code: "DEP-MAT", name: "Departemen Matematika", parentId: fsm.id },
  });
  const depFis = await db.unit.upsert({
    where: { code: "DEP-FIS" },
    update: {},
    create: { code: "DEP-FIS", name: "Departemen Fisika", parentId: fsm.id },
  });

  const prodiMat = await db.unit.upsert({
    where: { code: "PS-MAT" },
    update: {},
    create: { code: "PS-MAT", name: "S1 Matematika", parentId: depMat.id },
  });
  const prodiStat = await db.unit.upsert({
    where: { code: "PS-STAT" },
    update: {},
    create: { code: "PS-STAT", name: "S1 Statistika", parentId: depMat.id },
  });
  const prodiFis = await db.unit.upsert({
    where: { code: "PS-FIS" },
    update: {},
    create: { code: "PS-FIS", name: "S1 Fisika", parentId: depFis.id },
  });

  const unitAdmin = await db.unit.upsert({
    where: { code: "TU-FSM" },
    update: {},
    create: { code: "TU-FSM", name: "Tata Usaha FSM", parentId: fsm.id },
  });

  const admin = await db.user.upsert({
    where: { loginIdentifier: "admin01" },
    update: {},
    create: {
      loginIdentifier: "admin01",
      name: "Admin Sistem (Dummy)",
      userTypeId: tendik.id,
      primaryUnitId: unitAdmin.id,
    },
  });
  await db.roleGrant.upsert({
    where: { id: `${admin.id}-ADMIN` },
    update: {},
    create: { id: `${admin.id}-ADMIN`, userId: admin.id, role: "ADMIN" },
  });

  const dekan = await db.user.upsert({
    where: { loginIdentifier: "dekan01" },
    update: {},
    create: {
      loginIdentifier: "dekan01",
      name: "Prof. Dekan Fiktif",
      userTypeId: dosen.id,
      primaryUnitId: fsm.id,
    },
  });
  await db.roleGrant.upsert({
    where: { id: `${dekan.id}-DEKAN` },
    update: {},
    create: { id: `${dekan.id}-DEKAN`, userId: dekan.id, role: "DEKAN" },
  });
  await db.leadership.create({
    data: {
      userId: dekan.id,
      unitId: fsm.id,
      title: "Dekan",
      effectiveFrom: new Date("2026-01-01"),
    },
  });

  // Unit dengan satu pimpinan.
  const kaMat = await db.user.upsert({
    where: { loginIdentifier: "dosen1001" },
    update: {},
    create: {
      loginIdentifier: "dosen1001",
      name: "Dr. Ketua Departemen Matematika",
      userTypeId: dosen.id,
      primaryUnitId: depMat.id,
    },
  });
  await db.leadership.create({
    data: {
      userId: kaMat.id,
      unitId: depMat.id,
      title: "Ketua Departemen",
      effectiveFrom: new Date("2026-01-01"),
    },
  });

  // Unit dengan dua pimpinan (Departemen Fisika: ketua + sekretaris).
  const kaFis = await db.user.upsert({
    where: { loginIdentifier: "dosen1002" },
    update: {},
    create: {
      loginIdentifier: "dosen1002",
      name: "Dr. Ketua Departemen Fisika",
      userTypeId: dosen.id,
      primaryUnitId: depFis.id,
    },
  });
  const sekFis = await db.user.upsert({
    where: { loginIdentifier: "dosen1003" },
    update: {},
    create: {
      loginIdentifier: "dosen1003",
      name: "Dr. Sekretaris Departemen Fisika",
      userTypeId: dosen.id,
      primaryUnitId: depFis.id,
    },
  });
  await db.leadership.create({
    data: {
      userId: kaFis.id,
      unitId: depFis.id,
      title: "Ketua Departemen",
      effectiveFrom: new Date("2026-01-01"),
    },
  });
  await db.leadership.create({
    data: {
      userId: sekFis.id,
      unitId: depFis.id,
      title: "Sekretaris Departemen",
      effectiveFrom: new Date("2026-01-01"),
    },
  });

  // Dosen, tendik, mahasiswa fiktif tambahan tersebar di beberapa unit.
  const extraUsers: Array<{ id: string; name: string; typeId: string; unitId: string }> = [
    { id: "dosen1004", name: "Dr. Dosen Matematika A", typeId: dosen.id, unitId: prodiMat.id },
    { id: "dosen1005", name: "Dr. Dosen Matematika B", typeId: dosen.id, unitId: prodiMat.id },
    { id: "dosen1006", name: "Dr. Dosen Statistika A", typeId: dosen.id, unitId: prodiStat.id },
    { id: "dosen1007", name: "Dr. Dosen Fisika A", typeId: dosen.id, unitId: prodiFis.id },
    { id: "tendik2001", name: "Tendik TU FSM A", typeId: tendik.id, unitId: unitAdmin.id },
    { id: "tendik2002", name: "Tendik TU FSM B", typeId: tendik.id, unitId: unitAdmin.id },
    { id: "2311100001", name: "Mahasiswa Matematika A", typeId: mahasiswa.id, unitId: prodiMat.id },
    { id: "2311100002", name: "Mahasiswa Matematika B", typeId: mahasiswa.id, unitId: prodiMat.id },
    { id: "2311200001", name: "Mahasiswa Statistika A", typeId: mahasiswa.id, unitId: prodiStat.id },
    // Bab 23: "Satu unit memiliki >10 calon" — PS-FIS ditambah 8 dosen agar DEP-FIS+PS-FIS
    // (lingkup unit+subunit) memiliki 11 calon aktif (dosen1002, dosen1003, dosen1007, + 8 ini).
    { id: "dosen1010", name: "Dr. Dosen Fisika B", typeId: dosen.id, unitId: prodiFis.id },
    { id: "dosen1011", name: "Dr. Dosen Fisika C", typeId: dosen.id, unitId: prodiFis.id },
    { id: "dosen1012", name: "Dr. Dosen Fisika D", typeId: dosen.id, unitId: prodiFis.id },
    { id: "dosen1013", name: "Dr. Dosen Fisika E", typeId: dosen.id, unitId: prodiFis.id },
    { id: "dosen1014", name: "Dr. Dosen Fisika F", typeId: dosen.id, unitId: prodiFis.id },
    { id: "dosen1015", name: "Dr. Dosen Fisika G", typeId: dosen.id, unitId: prodiFis.id },
    { id: "dosen1016", name: "Dr. Dosen Fisika H", typeId: dosen.id, unitId: prodiFis.id },
    { id: "dosen1017", name: "Dr. Dosen Fisika I", typeId: dosen.id, unitId: prodiFis.id },
  ];

  for (const u of extraUsers) {
    await db.user.upsert({
      where: { loginIdentifier: u.id },
      update: {},
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
      name: "Dr. Dosen Nonaktif (Dummy)",
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
