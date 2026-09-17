import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { ServiceError, createUnit } from "../src/lib/services/units";
import { createUser, createUserType } from "../src/lib/services/users";
import { createObject } from "../src/lib/services/objects";
import { createObjectType } from "../src/lib/services/objectTypes";
import { createPeriod } from "../src/lib/services/periods";
import { createCategory, addCategoryObjects } from "../src/lib/services/categories";
import {
  deleteCategory,
  deleteObject,
  deleteObjectType,
  deletePeriod,
  deleteUnit,
  deleteUser,
  deleteUserType,
  renameObjectType,
  renameUserType,
} from "../src/lib/services/penghapusan";
import type { AuthContext } from "../src/lib/authz";

let pass = 0;
let fail = 0;
function ok(label: string, cond: boolean) {
  if (cond) { pass++; console.log(`  OK  ${label}`); } else { fail++; console.log(`  GAGAL  ${label}`); }
}
async function ditolak(label: string, fn: () => Promise<unknown>, harus?: RegExp) {
  try { await fn(); ok(label, false); } catch (e) {
    const benar = e instanceof ServiceError && (!harus || harus.test(e.message));
    ok(`${label} (${e instanceof Error ? e.message.split("\n")[0] : e})`, benar);
  }
}

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "admin01" } });
  const actor: AuthContext = { userId: admin.id, loginIdentifier: admin.loginIdentifier, name: admin.name, active: true, isAdmin: true, isDekan: false, leadershipUnitIds: [], scopeUnitIds: [] };
  const tanda = Date.now().toString(36).toUpperCase();
  const orang = await prisma.objectType.findUniqueOrThrow({ where: { code: "ORANG" } });
  const unitTerpakai = await prisma.unit.findFirstOrThrow({ where: { usersPrimary: { some: {} } } });
  const bersih: (() => Promise<unknown>)[] = [];

  try {
    console.log("== Unit ==");
    const unit = await createUnit({ code: "", name: `Unit Uji Hapus ${tanda}`, parentId: null }, actor);
    await deleteUnit(unit.id, actor);
    ok("Unit yang belum dipakai terhapus", !(await prisma.unit.findUnique({ where: { id: unit.id } })));
    await ditolak("Unit yang punya pengguna ditolak dengan alasan", () => deleteUnit(unitTerpakai.id, actor), /pengguna/);
    ok("Penghapusan unit tercatat di audit", !!(await prisma.auditEvent.findFirst({ where: { action: "UNIT_DELETE", entityId: unit.id } })));

    console.log("== Jenis pengguna ==");
    const jenis = await createUserType({ code: "", name: `Jenis Uji ${tanda}` }, actor);
    await renameUserType(jenis.id, `Jenis Uji Baru ${tanda}`, actor);
    ok("Nama jenis pengguna bisa diubah", (await prisma.userType.findUniqueOrThrow({ where: { id: jenis.id } })).name === `Jenis Uji Baru ${tanda}`);
    const jenisTerpakai = await prisma.userType.findFirstOrThrow({ where: { users: { some: {} } } });
    await ditolak("Nama jenis pengguna kembar ditolak", () => renameUserType(jenis.id, jenisTerpakai.name, actor));
    await ditolak("Jenis pengguna yang punya pengguna ditolak", () => deleteUserType(jenisTerpakai.id, actor), /pengguna/);

    console.log("== Pengguna ==");
    const user = await createUser({ loginIdentifier: `ujihapus${tanda}`.toLowerCase(), name: `Uji Hapus ${tanda}`, userTypeId: jenis.id, primaryUnitId: null } as never, actor);
    await ditolak("Jenis pengguna yang masih dipakai 1 pengguna ditolak", () => deleteUserType(jenis.id, actor), /1 pengguna/);
    await deleteUser(user.id, actor);
    ok("Pengguna yang belum dipakai terhapus", !(await prisma.user.findUnique({ where: { id: user.id } })));
    await deleteUserType(jenis.id, actor);
    ok("Jenis pengguna yang sudah kosong terhapus", !(await prisma.userType.findUnique({ where: { id: jenis.id } })));
    const penilai = await prisma.user.findFirstOrThrow({ where: { evaluatorAssignments: { some: {} } } });
    await ditolak("Pengguna yang punya tugas penilaian ditolak", () => deleteUser(penilai.id, actor), /tugas penilaian/);
    await ditolak("Admin tidak bisa menghapus akunnya sendiri", () => deleteUser(admin.id, actor), /sendiri/);

    console.log("== Jenis objek ==");
    const jenisObjek = await createObjectType({ code: "", name: `Jenis Objek Uji ${tanda}` }, actor);
    await renameObjectType(jenisObjek.id, `Jenis Objek Uji Baru ${tanda}`, actor);
    await deleteObjectType(jenisObjek.id, actor);
    ok("Jenis objek yang belum dipakai bisa diubah lalu dihapus", !(await prisma.objectType.findUnique({ where: { id: jenisObjek.id } })));
    await ditolak("Jenis objek bawaan tidak bisa dihapus", () => deleteObjectType(orang.id, actor), /bawaan/);

    console.log("== Objek, kategori, periode ==");
    const objek = await createObject(
      { typeId: orang.id, name: `Objek Uji Hapus ${tanda}`, ownerUnitId: unitTerpakai.id, referenceUserId: admin.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
      actor
    );
    const objekLepas = await createObject(
      { typeId: orang.id, name: `Objek Uji Lepas ${tanda}`, ownerUnitId: unitTerpakai.id, referenceUserId: admin.id, referenceUnitId: null, responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
      actor
    );
    await deleteObject(objekLepas.id, actor);
    ok("Objek yang belum masuk kategori terhapus", !(await prisma.assessmentObject.findUnique({ where: { id: objekLepas.id } })));
    bersih.push(() => prisma.assessmentObject.deleteMany({ where: { id: objek.id } }));

    const periode = await createPeriod({ code: "", name: `Periode Uji Hapus ${tanda}`, description: null, timezone: "Asia/Jakarta", startsAt: "2030-01-01", endsAt: "2030-01-31" }, actor);
    const kat1 = await createCategory(periode.id, { code: "", name: "Kategori Satu", description: null, objectTypeId: orang.id, excludeContributors: false }, actor);
    const kat2 = await createCategory(periode.id, { code: "", name: "Kategori Dua", description: null, objectTypeId: orang.id, excludeContributors: false }, actor);
    await addCategoryObjects(kat1.id, [objek.id], actor);
    await ditolak("Objek yang sudah masuk kategori ditolak", () => deleteObject(objek.id, actor), /kategori/);

    await deleteCategory(kat2.id, actor);
    ok("Kategori pada periode Draf terhapus beserta instrumen dan aturannya",
      !(await prisma.category.findUnique({ where: { id: kat2.id } })) &&
      (await prisma.instrumentVersion.count({ where: { categoryId: kat2.id } })) === 0 &&
      (await prisma.groupRule.count({ where: { categoryId: kat2.id } })) === 0);

    await deletePeriod(periode.id, actor);
    ok("Periode Draf terhapus beserta kategori dan objek pesertanya",
      !(await prisma.period.findUnique({ where: { id: periode.id } })) &&
      (await prisma.category.count({ where: { periodId: periode.id } })) === 0 &&
      (await prisma.categoryObject.count({ where: { categoryId: kat1.id } })) === 0);
    await deleteObject(objek.id, actor);
    ok("Setelah periodenya dihapus, objek bisa dihapus", !(await prisma.assessmentObject.findUnique({ where: { id: objek.id } })));

    const aktif = await prisma.period.findFirst({ where: { status: { not: "DRAF" } }, include: { categories: { take: 1 } } });
    if (aktif) {
      await ditolak("Periode yang sudah dibuka tidak bisa dihapus", () => deletePeriod(aktif.id, actor), /Draf/);
      if (aktif.categories[0]) await ditolak("Kategori pada periode yang sudah dibuka tidak bisa dihapus", () => deleteCategory(aktif.categories[0].id, actor), /Draf/);
    }
  } finally {
    for (const f of bersih) await f().catch(() => {});
  }

  console.log(`\nLulus: ${pass}  Gagal: ${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
