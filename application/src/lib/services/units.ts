import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import type { AuthContext } from "@/lib/authz";

export class ServiceError extends Error {}

export interface UnitInput {
  code: string;
  name: string;
  parentId: string | null;
}

function normalizeCode(code: string): string {
  return code.trim();
}

// ORG-02: setiap unit selain akar memiliki satu induk; siklus dan induk diri sendiri dilarang.
async function assertNoCycle(unitId: string | null, parentId: string | null) {
  if (!parentId) return;
  if (unitId && parentId === unitId) {
    throw new ServiceError("Unit tidak boleh menjadi induk dirinya sendiri.");
  }
  let current: string | null = parentId;
  const guardMax = 500; // batas wajar kedalaman pohon organisasi
  for (let i = 0; i < guardMax && current; i++) {
    if (unitId && current === unitId) {
      throw new ServiceError("Perubahan ini akan membuat siklus pada hierarki unit.");
    }
    const parent: { parentId: string | null } | null = await prisma.unit.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = parent?.parentId ?? null;
  }
}

export async function listUnitsWithMeta() {
  const units = await prisma.unit.findMany({
    orderBy: [{ active: "desc" }, { code: "asc" }],
    include: {
      leaderships: {
        where: { active: true },
        include: { user: { select: { name: true, loginIdentifier: true } } },
      },
      _count: { select: { children: true, usersPrimary: true } },
    },
  });
  const now = new Date();
  return units.map((u) => ({
    ...u,
    currentLeaders: u.leaderships.filter(
      (l) => l.effectiveFrom <= now && (!l.effectiveTo || l.effectiveTo >= now)
    ),
  }));
}

async function createUnitImpl(input: UnitInput, actor: AuthContext) {
  const code = normalizeCode(input.code);
  const name = input.name.trim();
  if (!code) throw new ServiceError("Kode unit wajib diisi.");
  if (!name) throw new ServiceError("Nama unit wajib diisi.");

  if (input.parentId) {
    const parent = await prisma.unit.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new ServiceError("Unit induk tidak ditemukan.");
  }

  await assertNoCycle(null, input.parentId);

  const existing = await prisma.unit.findUnique({ where: { code } });
  if (existing) throw new ServiceError("Kode unit sudah dipakai.");

  const unit = await prisma.unit.create({
    data: { code, name, parentId: input.parentId },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.isAdmin ? "ADMIN" : "SYSTEM",
    action: "UNIT_CREATE",
    entity: "Unit",
    entityId: unit.id,
    after: unit,
  });

  return unit;
}

async function updateUnitImpl(
  unitId: string,
  input: UnitInput,
  actor: AuthContext
) {
  const before = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!before) throw new ServiceError("Unit tidak ditemukan.");

  const code = normalizeCode(input.code);
  const name = input.name.trim();
  if (!code) throw new ServiceError("Kode unit wajib diisi.");
  if (!name) throw new ServiceError("Nama unit wajib diisi.");

  if (input.parentId) {
    const parent = await prisma.unit.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new ServiceError("Unit induk tidak ditemukan.");
  }
  await assertNoCycle(unitId, input.parentId);

  if (code !== before.code) {
    const existing = await prisma.unit.findUnique({ where: { code } });
    if (existing) throw new ServiceError("Kode unit sudah dipakai.");
  }

  const unit = await prisma.unit.update({
    where: { id: unitId },
    data: { code, name, parentId: input.parentId },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "UNIT_UPDATE",
    entity: "Unit",
    entityId: unit.id,
    before,
    after: unit,
  });

  return unit;
}

// ORG-06: penghapusan keras dilarang untuk unit yang sudah dipakai; gunakan nonaktif.
// Pada tahap ini (belum ada periode/objek) status nonaktif tetap dipakai secara konsisten
// agar perilaku tidak berubah saat entitas periode ditambahkan pada tahap berikutnya.
async function setUnitActiveImpl(unitId: string, active: boolean, actor: AuthContext) {
  const before = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!before) throw new ServiceError("Unit tidak ditemukan.");

  const unit = await prisma.unit.update({ where: { id: unitId }, data: { active } });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: active ? "UNIT_ACTIVATE" : "UNIT_DEACTIVATE",
    entity: "Unit",
    entityId: unit.id,
    before,
    after: unit,
  });

  return unit;
}

export async function createUnit(...args: Parameters<typeof createUnitImpl>): Promise<Awaited<ReturnType<typeof createUnitImpl>>> {
  return atomic(() => createUnitImpl(...args));
}

export async function updateUnit(...args: Parameters<typeof updateUnitImpl>): Promise<Awaited<ReturnType<typeof updateUnitImpl>>> {
  return atomic(() => updateUnitImpl(...args));
}

export async function setUnitActive(...args: Parameters<typeof setUnitActiveImpl>): Promise<Awaited<ReturnType<typeof setUnitActiveImpl>>> {
  return atomic(() => setUnitActiveImpl(...args));
}
