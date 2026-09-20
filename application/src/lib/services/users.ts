import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";
import { kodeUnikDariNama, samakanNama } from "@/lib/kode-otomatis";

export interface UserInput {
  loginIdentifier: string;
  name: string;
  /** Opsional: kosong untuk akun yang belum pernah masuk lewat SSO. */
  email?: string | null;
  userTypeId: string;
  primaryUnitId: string | null;
}

// Bab 5.2: ID disimpan sebagai teks; normalisasi hanya memangkas spasi tepi
// agar nol awal dan format non-numerik (NIM/NIK/NIP) tidak berubah.
function normalizeIdentifier(id: string): string {
  return id.trim();
}

// Email dicocokkan dengan alamat dari SSO, yang selalu huruf kecil.
function normalizeEmail(email: string | null | undefined): string | null {
  const bersih = (email ?? "").trim().toLowerCase();
  return bersih === "" ? null : bersih;
}

async function pastikanEmailBelumDipakai(email: string | null, kecualiUserId?: string) {
  if (!email) return;
  const pemilik = await prisma.user.findUnique({ where: { email } });
  if (pemilik && pemilik.id !== kecualiUserId) {
    throw new ServiceError(`Email "${email}" sudah dipakai pengguna lain.`);
  }
}

async function createUserTypeImpl(input: { code: string; name: string }, actor: AuthContext) {
  const name = input.name.trim();
  if (!name) throw new ServiceError("Nama jenis pengguna wajib diisi.");
  const semua = await prisma.userType.findMany({ select: { name: true } });
  if (semua.some((t) => samakanNama(t.name) === samakanNama(name))) {
    throw new ServiceError(`Jenis pengguna "${name}" sudah ada.`);
  }
  const code =
    input.code.trim().toUpperCase() ||
    (await kodeUnikDariNama(name, async (k) => !!(await prisma.userType.findUnique({ where: { code: k } }))));

  const existing = await prisma.userType.findUnique({ where: { code } });
  if (existing) throw new ServiceError("Kode jenis pengguna sudah dipakai.");

  const userType = await prisma.userType.create({ data: { code, name } });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "USER_TYPE_CREATE",
    entity: "UserType",
    entityId: userType.id,
    after: userType,
  });

  return userType;
}

export async function listUsersWithMeta() {
  return prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      userType: true,
      primaryUnit: true,
      roleGrants: { where: { active: true } },
      leaderships: { where: { active: true }, include: { unit: true } },
    },
  });
}

async function createUserImpl(input: UserInput, actor: AuthContext) {
  const loginIdentifier = normalizeIdentifier(input.loginIdentifier);
  const name = input.name.trim();
  if (!loginIdentifier) throw new ServiceError("ID pengguna wajib diisi.");
  if (!name) throw new ServiceError("Nama wajib diisi.");
  if (!input.userTypeId) throw new ServiceError("Jenis pengguna wajib dipilih.");

  const userType = await prisma.userType.findUnique({ where: { id: input.userTypeId } });
  if (!userType) throw new ServiceError("Jenis pengguna tidak ditemukan.");

  if (input.primaryUnitId) {
    const unit = await prisma.unit.findUnique({ where: { id: input.primaryUnitId } });
    if (!unit) throw new ServiceError("Unit utama tidak ditemukan.");
  }

  const existing = await prisma.user.findUnique({ where: { loginIdentifier } });
  if (existing) throw new ServiceError("ID pengguna sudah terdaftar.");

  const email = normalizeEmail(input.email);
  await pastikanEmailBelumDipakai(email);

  const user = await prisma.user.create({
    data: {
      loginIdentifier,
      name,
      email,
      userTypeId: input.userTypeId,
      primaryUnitId: input.primaryUnitId,
    },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "USER_CREATE",
    entity: "User",
    entityId: user.id,
    after: user,
  });

  return user;
}

async function updateUserImpl(userId: string, input: UserInput, actor: AuthContext) {
  const before = await prisma.user.findUnique({ where: { id: userId } });
  if (!before) throw new ServiceError("Pengguna tidak ditemukan.");

  const loginIdentifier = normalizeIdentifier(input.loginIdentifier);
  const name = input.name.trim();
  if (!loginIdentifier) throw new ServiceError("ID pengguna wajib diisi.");
  if (!name) throw new ServiceError("Nama wajib diisi.");

  const userType = await prisma.userType.findUnique({ where: { id: input.userTypeId } });
  if (!userType) throw new ServiceError("Jenis pengguna tidak ditemukan.");

  if (input.primaryUnitId) {
    const unit = await prisma.unit.findUnique({ where: { id: input.primaryUnitId } });
    if (!unit) throw new ServiceError("Unit utama tidak ditemukan.");
  }

  if (loginIdentifier !== before.loginIdentifier) {
    const existing = await prisma.user.findUnique({ where: { loginIdentifier } });
    if (existing) throw new ServiceError("ID pengguna sudah terdaftar.");
  }

  const email = normalizeEmail(input.email);
  await pastikanEmailBelumDipakai(email, userId);

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      loginIdentifier,
      name,
      email,
      userTypeId: input.userTypeId,
      primaryUnitId: input.primaryUnitId,
    },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "USER_UPDATE",
    entity: "User",
    entityId: user.id,
    before,
    after: user,
  });

  return user;
}

// Bab 5.2: status nonaktif mencegah login dan penugasan baru; jawaban lama tetap tersimpan.
async function setUserActiveImpl(userId: string, active: boolean, actor: AuthContext) {
  const before = await prisma.user.findUnique({ where: { id: userId } });
  if (!before) throw new ServiceError("Pengguna tidak ditemukan.");

  if (before.id === actor.userId && !active) {
    throw new ServiceError("Tidak dapat menonaktifkan akun sendiri yang sedang digunakan.");
  }

  const user = await prisma.user.update({ where: { id: userId }, data: { active } });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: active ? "USER_ACTIVATE" : "USER_DEACTIVATE",
    entity: "User",
    entityId: user.id,
    before,
    after: user,
  });

  return user;
}

export async function createUserType(...args: Parameters<typeof createUserTypeImpl>): Promise<Awaited<ReturnType<typeof createUserTypeImpl>>> {
  return atomic(() => createUserTypeImpl(...args));
}

export async function createUser(...args: Parameters<typeof createUserImpl>): Promise<Awaited<ReturnType<typeof createUserImpl>>> {
  return atomic(() => createUserImpl(...args));
}

export async function updateUser(...args: Parameters<typeof updateUserImpl>): Promise<Awaited<ReturnType<typeof updateUserImpl>>> {
  return atomic(() => updateUserImpl(...args));
}

export async function setUserActive(...args: Parameters<typeof setUserActiveImpl>): Promise<Awaited<ReturnType<typeof setUserActiveImpl>>> {
  return atomic(() => setUserActiveImpl(...args));
}
