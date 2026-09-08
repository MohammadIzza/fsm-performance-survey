import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import {
  createUnit,
  updateUnit,
  setUnitActive,
  ServiceError,
} from "../src/lib/services/units";
import {
  createUser,
  updateUser,
  setUserActive,
  createUserType,
} from "../src/lib/services/users";
import { assignLeadership, endLeadership } from "../src/lib/services/leadership";
import { grantRole, revokeRole } from "../src/lib/services/roleGrants";
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
    ok(`${label} (${e instanceof ServiceError ? e.message : "unexpected error type"})`, e instanceof ServiceError);
  }
}

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "admin01" } });
  const adminGrant = await prisma.roleGrant.findFirstOrThrow({
    where: { userId: admin.id, role: "ADMIN", active: true },
  });
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

  const fsm = await prisma.unit.findUniqueOrThrow({ where: { code: "FSM" } });
  const depMat = await prisma.unit.findUniqueOrThrow({ where: { code: "DEP-MAT" } });
  const psMat = await prisma.unit.findUniqueOrThrow({ where: { code: "PS-MAT" } });

  console.log("== Unit: cycle & uniqueness ==");
  await expectServiceError("Unit tidak boleh jadi induk dirinya sendiri", () =>
    updateUnit(depMat.id, { code: depMat.code, name: depMat.name, parentId: depMat.id }, actor)
  );
  await expectServiceError("Memindah DEP-MAT ke bawah anaknya sendiri (PS-MAT) ditolak (siklus)", () =>
    updateUnit(depMat.id, { code: depMat.code, name: depMat.name, parentId: psMat.id }, actor)
  );
  await expectServiceError("Kode unit duplikat ditolak", () =>
    createUnit({ code: "FSM", name: "Duplikat", parentId: null }, actor)
  );

  const testUnit = await createUnit(
    { code: "TEST-UNIT-1", name: "Unit Uji Sementara", parentId: fsm.id },
    actor
  );
  ok("Unit baru berhasil dibuat", testUnit.code === "TEST-UNIT-1");

  const renamed = await updateUnit(
    testUnit.id,
    { code: "TEST-UNIT-1", name: "Unit Uji (Diubah)", parentId: fsm.id },
    actor
  );
  ok("Unit berhasil diubah namanya", renamed.name === "Unit Uji (Diubah)");

  const deactivated = await setUnitActive(testUnit.id, false, actor);
  ok("Unit berhasil dinonaktifkan", deactivated.active === false);
  const reactivated = await setUnitActive(testUnit.id, true, actor);
  ok("Unit berhasil diaktifkan kembali", reactivated.active === true);

  console.log("== User: uniqueness & self-deactivation ==");
  await expectServiceError("ID pengguna duplikat ditolak", () =>
    createUser(
      { loginIdentifier: "admin01", name: "Duplikat", userTypeId: admin.userTypeId, primaryUnitId: null },
      actor
    )
  );
  await expectServiceError("Admin tidak dapat menonaktifkan akun sendiri", () =>
    setUserActive(admin.id, false, actor)
  );

  const dosenType = await prisma.userType.findUniqueOrThrow({ where: { code: "DOSEN" } });
  const testUser = await createUser(
    {
      loginIdentifier: "test-user-001",
      name: "Pengguna Uji",
      userTypeId: dosenType.id,
      primaryUnitId: depMat.id,
    },
    actor
  );
  ok("Pengguna baru berhasil dibuat", testUser.loginIdentifier === "test-user-001");

  const renamedUser = await updateUser(
    testUser.id,
    {
      loginIdentifier: "test-user-001",
      name: "Pengguna Uji (Diubah)",
      userTypeId: dosenType.id,
      primaryUnitId: depMat.id,
    },
    actor
  );
  ok("Pengguna berhasil diubah namanya", renamedUser.name === "Pengguna Uji (Diubah)");

  const deactivatedUser = await setUserActive(testUser.id, false, actor);
  ok("Pengguna berhasil dinonaktifkan", deactivatedUser.active === false);

  console.log("== UserType ==");
  await expectServiceError("Kode jenis pengguna duplikat ditolak", () =>
    createUserType({ code: "DOSEN", name: "Duplikat" }, actor)
  );
  const newType = await createUserType({ code: "LABORAN-TEST", name: "Laboran (Uji)" }, actor);
  ok("Jenis pengguna baru berhasil dibuat", newType.code === "LABORAN-TEST");

  console.log("== Leadership ==");
  await setUserActive(testUser.id, true, actor); // aktifkan lagi agar bisa jadi pimpinan
  const leadership = await assignLeadership(
    { userId: testUser.id, unitId: testUnit.id, title: "Koordinator Uji", effectiveFrom: "2026-01-01" },
    actor
  );
  ok("Kepemimpinan berhasil ditetapkan", leadership.title === "Koordinator Uji");

  await expectServiceError("Pengguna nonaktif tidak dapat ditetapkan sebagai pimpinan", async () => {
    await setUserActive(testUser.id, false, actor);
    await assignLeadership(
      { userId: testUser.id, unitId: testUnit.id, title: "Coba Lagi", effectiveFrom: "2026-01-01" },
      actor
    );
  });
  await setUserActive(testUser.id, true, actor);

  const ended = await endLeadership(leadership.id, actor, "Uji otomatis selesai");
  ok("Kepemimpinan berhasil diakhiri (effectiveTo terisi)", ended.effectiveTo !== null);

  console.log("== RoleGrant: guard admin terakhir ==");
  const onlyAdminGrants = await prisma.roleGrant.count({ where: { role: "ADMIN", active: true } });
  ok(`Prasyarat: hanya ada ${onlyAdminGrants} admin aktif sebelum uji`, onlyAdminGrants === 1);

  await expectServiceError("Tidak dapat mencabut Admin satu-satunya", () =>
    revokeRole(adminGrant.id, actor)
  );

  const dekanUser = await prisma.user.findUniqueOrThrow({ where: { loginIdentifier: "dekan01" } });
  await expectServiceError("Tidak dapat memberi peran ganda yang sama", () =>
    grantRole(dekanUser.id, "DEKAN", actor)
  );

  const secondAdminGrant = await grantRole(testUser.id, "ADMIN", actor);
  ok("Admin kedua berhasil ditetapkan", secondAdminGrant.role === "ADMIN");
  const revokedFirst = await revokeRole(adminGrant.id, actor);
  ok("Admin pertama kini bisa dicabut karena ada admin lain", revokedFirst.active === false);
  // kembalikan agar state semula tidak berubah untuk pengujian berikutnya
  await grantRole(admin.id, "ADMIN", actor);
  await revokeRole(secondAdminGrant.id, actor);

  console.log("== Audit trail ==");
  const auditCount = await prisma.auditEvent.count();
  ok(`Audit event tercatat (${auditCount} total)`, auditCount > 10);

  console.log("\n=== Ringkasan ===");
  console.log(`Lulus: ${pass}  Gagal: ${fail}`);
  if (fail > 0) process.exitCode = 1;

  console.log("\n== Membersihkan data uji ==");
  // Bab 24.2 (Regresi): skrip ini sebelumnya tidak membersihkan data sendiri, sehingga
  // "test-user-001"/"TEST-UNIT-1"/"LABORAN-TEST" mencemari pool kandidat skrip uji tahap
  // lain saat dijalankan ulang (ditemukan saat verifikasi Tahap 7).
  await prisma.leadership.deleteMany({ where: { userId: testUser.id } });
  await prisma.roleGrant.deleteMany({ where: { userId: testUser.id } });
  await prisma.user.deleteMany({ where: { loginIdentifier: "test-user-001" } });
  await prisma.unit.deleteMany({ where: { code: "TEST-UNIT-1" } });
  await prisma.userType.deleteMany({ where: { code: "LABORAN-TEST" } });
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
