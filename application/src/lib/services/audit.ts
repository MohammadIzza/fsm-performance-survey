import { prisma } from "@/lib/prisma";

export interface AuditInput {
  actorId: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

// Jejak audit append-only (Bab 21.1). Tidak ada operasi update/delete yang diekspos untuk tabel ini.
export async function writeAudit(input: AuditInput): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before === undefined ? undefined : (input.before as object),
      after: input.after === undefined ? undefined : (input.after as object),
      reason: input.reason,
    },
  });
}

export interface AuditFilter {
  entity?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

// Bab 16.1: halaman Audit — "Filter objek tindakan, pelaku, waktu."
export async function listAuditEvents(filter: AuditFilter) {
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 50;

  const where = {
    entity: filter.entity || undefined,
    actorId: filter.actorId || undefined,
    createdAt:
      filter.from || filter.to
        ? { gte: filter.from, lte: filter.to }
        : undefined,
  };

  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditEvent.count({ where }),
  ]);

  const actorIds = [...new Set(events.map((e) => e.actorId).filter((id): id is string => !!id))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } })
    : [];
  const actorNameById = new Map(actors.map((a) => [a.id, a.name]));

  return {
    events: events.map((e) => ({ ...e, actorName: e.actorId ? actorNameById.get(e.actorId) ?? "—" : "Sistem" })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listDistinctAuditEntities(): Promise<string[]> {
  const rows = await prisma.auditEvent.findMany({
    select: { entity: true },
    distinct: ["entity"],
    orderBy: { entity: "asc" },
  });
  return rows.map((r) => r.entity);
}
