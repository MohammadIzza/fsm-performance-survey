import { atomic, prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import { samakanNama } from "@/lib/kode-otomatis";
import type { AuthContext } from "@/lib/authz";

/**
 * Penghapusan permanen data master dan konfigurasi.
 *
 * Aturannya satu: yang BELUM PERNAH DIPAKAI boleh dihapus; yang sudah punya jejak (tugas, jawaban,
 * jabatan, keikutsertaan di periode) ditolak dengan alasan yang menyebut apa yang memakainya, dan
 * admin diarahkan ke Nonaktifkan. Dengan begitu riwayat penilaian dan audit tidak pernah kehilangan
 * rujukan. Setiap penghapusan dicatat di audit beserta isi datanya sebelum dihapus.
 *
 * Periode dan kategori hanya boleh dihapus saat periode masih Draf — pada status itu belum ada
 * jawaban maupun hasil, jadi seluruh konfigurasinya (pertanyaan, aturan, peserta, tugas yang belum
 * diisi) ikut dihapus.
 */

function tolakKarenaDipakai(apa: string, pemakai: [number, string][], saran: string): never | void {
  const daftar = pemakai.filter(([n]) => n > 0).map(([n, label]) => `${n} ${label}`);
  if (daftar.length === 0) return;
  throw new ServiceError(`${apa} tidak bisa dihapus karena masih dipakai: ${daftar.join(", ")}. ${saran}`);
}

/** Pelanggaran kunci asing yang lolos dari pemeriksaan di atas tetap dijawab dengan kalimat, bukan galat. */
function kunciAsing(e: unknown, apa: string, saran: string): never {
  if (typeof e === "object" && e && "code" in e && (e as { code: string }).code === "P2003") {
    throw new ServiceError(`${apa} tidak bisa dihapus karena sudah dipakai data lain. ${saran}`);
  }
  throw e;
}

const audit = (actor: AuthContext, action: string, entity: string, entityId: string, before: unknown) =>
  writeAudit({ actorId: actor.userId, actorRole: "ADMIN", action, entity, entityId, before });

// ---------------------------------------------------------------------------------------------
// Unit

async function deleteUnitImpl(unitId: string, actor: AuthContext) {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: {
      _count: { select: { children: true, usersPrimary: true, ownedObjects: true, referencedByObjects: true, leaderships: true } },
    },
  });
  if (!unit) throw new ServiceError("Unit tidak ditemukan.");
  const c = unit._count;
  tolakKarenaDipakai(
    "Unit ini",
    [
      [c.children, "sub-unit"],
      [c.usersPrimary, "pengguna"],
      [c.ownedObjects + c.referencedByObjects, "objek penilaian"],
      [c.leaderships, "riwayat jabatan pimpinan"],
    ],
    "Pindahkan datanya ke unit lain lebih dulu, atau nonaktifkan unit ini."
  );
  const { _count, ...before } = unit;
  void _count;
  await prisma.unit.delete({ where: { id: unitId } }).catch((e) => kunciAsing(e, "Unit ini", "Nonaktifkan unit ini."));
  await audit(actor, "UNIT_DELETE", "Unit", unitId, before);
}

// ---------------------------------------------------------------------------------------------
// Pengguna

async function deleteUserImpl(userId: string, actor: AuthContext) {
  if (userId === actor.userId) throw new ServiceError("Anda tidak bisa menghapus akun Anda sendiri.");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roleGrants: true,
      _count: {
        select: {
          evaluatorAssignments: true,
          leaderships: true,
          objectContributions: true,
          referenceForObjects: true,
          responsibleForObjects: true,
          createdPeriods: true,
          editedResponseRevisions: true,
          finalizationsPerformed: true,
          importBatchesApplied: true,
        },
      },
    },
  });
  if (!user) throw new ServiceError("Pengguna tidak ditemukan.");
  const c = user._count;
  tolakKarenaDipakai(
    "Pengguna ini",
    [
      [c.evaluatorAssignments, "tugas penilaian"],
      [c.referenceForObjects + c.objectContributions + c.responsibleForObjects, "objek penilaian"],
      [c.leaderships, "riwayat jabatan pimpinan"],
      [c.createdPeriods, "periode yang dibuatnya"],
      [c.editedResponseRevisions, "jawaban atau koreksi"],
      [c.finalizationsPerformed, "finalisasi"],
      [c.importBatchesApplied, "impor data"],
    ],
    "Nonaktifkan pengguna ini agar tidak bisa masuk lagi; riwayatnya tetap tersimpan."
  );
  const { _count, ...before } = user;
  void _count;
  try {
    // Peran sistem melekat pada orangnya; ikut dihapus bersama akunnya.
    await prisma.roleGrant.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  } catch (e) {
    kunciAsing(e, "Pengguna ini", "Nonaktifkan pengguna ini.");
  }
  await audit(actor, "USER_DELETE", "User", userId, before);
}

// ---------------------------------------------------------------------------------------------
// Objek penilaian

async function deleteObjectImpl(objectId: string, actor: AuthContext) {
  const object = await prisma.assessmentObject.findUnique({
    where: { id: objectId },
    include: { contributors: true, _count: { select: { categoryObjects: true } } },
  });
  if (!object) throw new ServiceError("Objek tidak ditemukan.");
  tolakKarenaDipakai(
    "Objek ini",
    [[object._count.categoryObjects, "kategori penilaian"]],
    "Keluarkan dari kategorinya selama periode masih Draf, atau nonaktifkan objek ini."
  );
  const { _count, ...before } = object;
  void _count;
  try {
    await prisma.objectContributor.deleteMany({ where: { objectId } });
    await prisma.assessmentObject.delete({ where: { id: objectId } });
  } catch (e) {
    kunciAsing(e, "Objek ini", "Nonaktifkan objek ini.");
  }
  await audit(actor, "OBJECT_DELETE", "AssessmentObject", objectId, before);
}

// ---------------------------------------------------------------------------------------------
// Jenis pengguna dan jenis objek (ubah nama + hapus)

async function renameUserTypeImpl(id: string, name: string, actor: AuthContext) {
  const nama = name.trim();
  if (!nama) throw new ServiceError("Nama jenis pengguna wajib diisi.");
  const before = await prisma.userType.findUnique({ where: { id } });
  if (!before) throw new ServiceError("Jenis pengguna tidak ditemukan.");
  const lain = await prisma.userType.findMany({ where: { id: { not: id } }, select: { name: true } });
  if (lain.some((t) => samakanNama(t.name) === samakanNama(nama))) throw new ServiceError(`Jenis pengguna "${nama}" sudah ada.`);
  const after = await prisma.userType.update({ where: { id }, data: { name: nama } });
  await writeAudit({ actorId: actor.userId, actorRole: "ADMIN", action: "USER_TYPE_UPDATE", entity: "UserType", entityId: id, before, after });
}

async function deleteUserTypeImpl(id: string, actor: AuthContext) {
  const type = await prisma.userType.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!type) throw new ServiceError("Jenis pengguna tidak ditemukan.");
  tolakKarenaDipakai("Jenis pengguna ini", [[type._count.users, "pengguna"]], "Ganti jenis pengguna mereka lebih dulu.");
  // Aturan pembagian tugas menyimpan daftar jenis pengguna sebagai JSON (tanpa kunci asing);
  // jenis yang dihapus dikeluarkan dari daftar itu supaya aturannya tidak menunjuk data hantu.
  const aturan = await prisma.assignmentRule.findMany({ select: { id: true, userTypeIds: true } });
  for (const r of aturan) {
    const ids = (r.userTypeIds as string[] | null) ?? [];
    if (ids.includes(id)) {
      await prisma.assignmentRule.update({ where: { id: r.id }, data: { userTypeIds: ids.filter((x) => x !== id) } });
    }
  }
  const { _count, ...before } = type;
  void _count;
  await prisma.userType.delete({ where: { id } }).catch((e) => kunciAsing(e, "Jenis pengguna ini", ""));
  await audit(actor, "USER_TYPE_DELETE", "UserType", id, before);
}

async function renameObjectTypeImpl(id: string, name: string, actor: AuthContext) {
  const nama = name.trim();
  if (!nama) throw new ServiceError("Nama jenis objek wajib diisi.");
  const before = await prisma.objectType.findUnique({ where: { id } });
  if (!before) throw new ServiceError("Jenis objek tidak ditemukan.");
  const lain = await prisma.objectType.findMany({ where: { id: { not: id } }, select: { name: true } });
  if (lain.some((t) => samakanNama(t.name) === samakanNama(nama))) throw new ServiceError(`Jenis objek "${nama}" sudah ada.`);
  const after = await prisma.objectType.update({ where: { id }, data: { name: nama } });
  await writeAudit({ actorId: actor.userId, actorRole: "ADMIN", action: "OBJECT_TYPE_UPDATE", entity: "ObjectType", entityId: id, before, after });
}

async function deleteObjectTypeImpl(id: string, actor: AuthContext) {
  const type = await prisma.objectType.findUnique({ where: { id }, include: { _count: { select: { objects: true, categories: true } } } });
  if (!type) throw new ServiceError("Jenis objek tidak ditemukan.");
  // Empat jenis bawaan dipakai logika aplikasi (mis. pengecualian pembuat karya, urutan tampilan).
  if (["ORANG", "UNIT", "KARYA", "LAINNYA"].includes(type.code)) {
    throw new ServiceError("Jenis objek bawaan (Orang, Unit, Karya, Lainnya) tidak bisa dihapus.");
  }
  tolakKarenaDipakai(
    "Jenis objek ini",
    [
      [type._count.objects, "objek"],
      [type._count.categories, "kategori"],
    ],
    "Hapus atau ganti jenis objek dan kategori itu lebih dulu."
  );
  const { _count, ...before } = type;
  void _count;
  await prisma.objectType.delete({ where: { id } }).catch((e) => kunciAsing(e, "Jenis objek ini", ""));
  await audit(actor, "OBJECT_TYPE_DELETE", "ObjectType", id, before);
}

// ---------------------------------------------------------------------------------------------
// Periode dan kategori (hanya saat Draf)

/** Menghapus seluruh isi kategori-kategori ini. Hanya dipanggil untuk periode Draf. */
async function hapusIsiKategori(categoryIds: string[]) {
  const diKategori = { categoryObject: { categoryId: { in: categoryIds } } };
  const jawaban = await prisma.responseRevision.count({ where: { assignment: diKategori } });
  if (jawaban > 0) throw new ServiceError("Sudah ada jawaban penilaian; data ini tidak bisa dihapus.");
  await prisma.assignment.updateMany({ where: diKategori, data: { replacesId: null } });
  await prisma.assignment.deleteMany({ where: diKategori });
  await prisma.assignmentBatch.deleteMany({ where: { categoryId: { in: categoryIds } } });
  await prisma.categoryObject.deleteMany({ where: { categoryId: { in: categoryIds } } });
  await prisma.groupRule.deleteMany({ where: { categoryId: { in: categoryIds } } });
  await prisma.assignmentRule.deleteMany({ where: { categoryId: { in: categoryIds } } });
  await prisma.parameter.deleteMany({ where: { instrumentVersion: { categoryId: { in: categoryIds } } } });
  await prisma.instrumentVersion.deleteMany({ where: { categoryId: { in: categoryIds } } });
}

async function deleteCategoryImpl(categoryId: string, actor: AuthContext) {
  const category = await prisma.category.findUnique({ where: { id: categoryId }, include: { period: true } });
  if (!category) throw new ServiceError("Kategori tidak ditemukan.");
  if (category.period.status !== "DRAF") {
    throw new ServiceError("Kategori hanya bisa dihapus selama periode masih Draf, karena setelah dibuka kategori menyimpan riwayat penilaian.");
  }
  const { period, ...before } = category;
  void period;
  await hapusIsiKategori([categoryId]);
  await prisma.category.delete({ where: { id: categoryId } });
  await audit(actor, "CATEGORY_DELETE", "Category", categoryId, before);
  return category.periodId;
}

async function deletePeriodImpl(periodId: string, actor: AuthContext) {
  const period = await prisma.period.findUnique({ where: { id: periodId }, include: { categories: { select: { id: true, name: true } } } });
  if (!period) throw new ServiceError("Periode tidak ditemukan.");
  if (period.status !== "DRAF") {
    throw new ServiceError("Periode hanya bisa dihapus selama masih Draf. Periode yang sudah dibuka menyimpan riwayat penilaian.");
  }
  await hapusIsiKategori(period.categories.map((c) => c.id));
  await prisma.category.deleteMany({ where: { periodId } });
  await prisma.accessPolicy.deleteMany({ where: { periodId } });
  // Periode lain yang disalin dari periode ini tetap ada; tautan asal-usulnya saja yang dilepas.
  await prisma.period.updateMany({ where: { copiedFromId: periodId }, data: { copiedFromId: null } });
  await prisma.period.delete({ where: { id: periodId } });
  await audit(actor, "PERIOD_DELETE", "Period", periodId, period);
}

// ---------------------------------------------------------------------------------------------

export const deleteUnit = (...a: Parameters<typeof deleteUnitImpl>) => atomic(() => deleteUnitImpl(...a));
export const deleteUser = (...a: Parameters<typeof deleteUserImpl>) => atomic(() => deleteUserImpl(...a));
export const deleteObject = (...a: Parameters<typeof deleteObjectImpl>) => atomic(() => deleteObjectImpl(...a));
export const renameUserType = (...a: Parameters<typeof renameUserTypeImpl>) => atomic(() => renameUserTypeImpl(...a));
export const deleteUserType = (...a: Parameters<typeof deleteUserTypeImpl>) => atomic(() => deleteUserTypeImpl(...a));
export const renameObjectType = (...a: Parameters<typeof renameObjectTypeImpl>) => atomic(() => renameObjectTypeImpl(...a));
export const deleteObjectType = (...a: Parameters<typeof deleteObjectTypeImpl>) => atomic(() => deleteObjectTypeImpl(...a));
export const deleteCategory = (...a: Parameters<typeof deleteCategoryImpl>) => atomic(() => deleteCategoryImpl(...a));
export const deletePeriod = (...a: Parameters<typeof deletePeriodImpl>) => atomic(() => deletePeriodImpl(...a));
