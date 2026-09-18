import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";
import type { AccessMode, PeriodStatus } from "@/generated/prisma/enums";
import { kodeUnikDariNama } from "@/lib/kode-otomatis";

export interface PeriodInput {
  code: string;
  name: string;
  description: string | null;
  timezone: string;
  startsAt: string; // yyyy-mm-dd
  endsAt: string; // yyyy-mm-dd
}

function parseDate(label: string, value: string): Date {
  const d = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? value+"+07:00" : value);
  if (Number.isNaN(d.getTime())) throw new ServiceError(`${label} tidak valid.`);
  return d;
}

export async function listPeriods() {
  return prisma.period.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { name: true } },
      accessPolicy: true,
      _count: { select: { categories: true } },
    },
  });
}

export async function getPeriodDetail(periodId: string) {
  return prisma.period.findUnique({
    where: { id: periodId },
    include: {
      createdBy: { select: { name: true } },
      accessPolicy: { include: { changedBy: { select: { name: true } } } },
      categories: {
        orderBy: { code: "asc" },
        include: {
          objectType: true,
          _count: { select: { categoryObjects: true, assignmentBatches: true } },
          categoryObjects: {
            orderBy: { createdAt: "asc" },
            include: { object: { include: { type: true } } },
          },
          instrumentVersions: { orderBy: { revision: "desc" }, take: 1, include: { parameters: true } },
          groupRules: true,
          assignmentRules: true,
        },
      },
    },
  });
}

// Bab 7.1: nama wajib, kode unik dibuat dari nama bila tidak diberikan; tenggat harus setelah mulai (dicek ulang saat "Siap", Bab 7.3).
async function createPeriodImpl(input: PeriodInput, actor: AuthContext) {
  const name = input.name.trim();
  if (!name) throw new ServiceError("Nama periode wajib diisi.");
  // Kode dibuat dari nama bila tidak diberikan (formulir admin hanya meminta nama).
  const code =
    input.code.trim() ||
    (await kodeUnikDariNama(name, async (k) => !!(await prisma.period.findUnique({ where: { code: k } }))));

  const startsAt = parseDate("Tanggal mulai", input.startsAt);
  const endsAt = parseDate("Tenggat", input.endsAt);
  if (startsAt >= endsAt) {
    throw new ServiceError("Tanggal mulai harus lebih awal dari tenggat.");
  }

  const existing = await prisma.period.findUnique({ where: { code } });
  if (existing) throw new ServiceError("Kode periode sudah dipakai.");

  const period = await prisma.$transaction(async (tx) => {
    const p = await tx.period.create({
      data: {
        code,
        name,
        description: input.description?.trim() || null,
        timezone: input.timezone || "Asia/Jakarta",
        startsAt,
        endsAt,
        createdById: actor.userId,
        unitTreeSnapshot: await tx.unit.findMany({select:{id:true,parentId:true}}),
      },
    });
    await tx.accessPolicy.create({
      data: { periodId: p.id, mode: "SETELAH_FINAL", changedById: actor.userId },
    });
    return p;
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "PERIOD_CREATE",
    entity: "Period",
    entityId: period.id,
    after: period,
  });

  return period;
}

async function updatePeriodSettingsImpl(
  periodId: string,
  input: PeriodInput,
  actor: AuthContext
) {
  const before = await prisma.period.findUnique({ where: { id: periodId } });
  if (!before) throw new ServiceError("Periode tidak ditemukan.");
  if (before.status !== "DRAF") {
    throw new ServiceError("Pengaturan dasar hanya dapat diubah selama status Draf.");
  }

  // Kode tidak ikut berubah saat nama diganti; tanpa kode baru yang eksplisit, kode lama dipertahankan.
  const code = input.code.trim() || before.code;
  const name = input.name.trim();
  if (!name) throw new ServiceError("Nama periode wajib diisi.");

  const startsAt = parseDate("Tanggal mulai", input.startsAt);
  const endsAt = parseDate("Tenggat", input.endsAt);
  if (startsAt >= endsAt) {
    throw new ServiceError("Tanggal mulai harus lebih awal dari tenggat.");
  }

  if (code !== before.code) {
    const existing = await prisma.period.findUnique({ where: { code } });
    if (existing) throw new ServiceError("Kode periode sudah dipakai.");
  }

  const period = await prisma.period.update({
    where: { id: periodId },
    data: {
      code,
      name,
      description: input.description?.trim() || null,
      timezone: input.timezone || "Asia/Jakarta",
      startsAt,
      endsAt,
    },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "PERIOD_UPDATE",
    entity: "Period",
    entityId: period.id,
    before,
    after: period,
  });

  return period;
}

async function setAccessPolicyImpl(
  periodId: string,
  input: { mode: AccessMode; availableAt: string | null; expectedVersion: number },
  actor: AuthContext
) {
  const before = await prisma.accessPolicy.findUnique({ where: { periodId } });
  if (!before) throw new ServiceError("Kebijakan akses tidak ditemukan.");
  if (before.version !== input.expectedVersion) {
    throw new ServiceError(
      "Kebijakan akses sudah diubah pihak lain. Muat ulang halaman sebelum menyimpan."
    );
  }
  if (input.mode === "WAKTU_TERTENTU" && !input.availableAt) {
    throw new ServiceError("Waktu tertentu wajib diisi untuk mode ini.");
  }

  if (!["SELAMA_AKTIF","SETELAH_DITUTUP","SETELAH_FINAL","WAKTU_TERTENTU"].includes(input.mode)) throw new ServiceError("Mode akses tidak valid.");
  if(input.availableAt && !Number.isFinite(new Date(input.availableAt).getTime())) throw new ServiceError("Waktu akses tidak valid.");
  const policy = await prisma.accessPolicy.update({
    where: { periodId, version: input.expectedVersion },
    data: {
      mode: input.mode,
      availableAt: input.availableAt ? new Date(input.availableAt) : null,
      version: { increment: 1 },
      changedById: actor.userId,
    },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: actor.isAdmin ? "ADMIN" : "DEKAN",
    action: "ACCESS_POLICY_UPDATE",
    entity: "AccessPolicy",
    entityId: policy.id,
    before,
    after: policy,
  });

  return policy;
}

const TRANSITIONS: Record<PeriodStatus, PeriodStatus[]> = {
  DRAF: ["SIAP"],
  SIAP: ["DRAF", "AKTIF"],
  AKTIF: ["DITUTUP"],
  DITUTUP: ["FINAL", "REVISI"],
  FINAL: ["REVISI"],
  REVISI: ["DITUTUP"],
};

// Bab 7.3: syarat sebelum berstatus Siap.
export async function checkReadiness(periodId: string): Promise<string[]> {
  const problems: string[] = [];
  const period = await prisma.period.findUnique({
    where: { id: periodId },
    include: {
      categories: {
        where: { active: true },
        include: {
          instrumentVersions: { orderBy: { revision: "desc" }, take: 1, include: { parameters: true } },
          groupRules: true,
          objectType: true,
          categoryObjects: { include: { object: { select: { responsibleUserId: true, name: true } } } },
          _count: { select: { categoryObjects: true, assignmentBatches: true } },
        },
      },
    },
  });
  if (!period) {
    problems.push("Periode tidak ditemukan.");
    return problems;
  }

  if (period.startsAt >= period.endsAt) {
    problems.push("Tanggal mulai harus lebih awal dari tenggat.");
  }

  const activeCategories = period.categories;
  if (activeCategories.length === 0) {
    problems.push("Minimal harus ada satu kategori aktif.");
    return problems;
  }

  for (const cat of activeCategories) {
    const label = `Kategori "${cat.name}"`;

    if (cat._count.categoryObjects === 0) {
      problems.push(`${label}: belum ada objek peserta yang dipilih.`);
    }

    const instrument = cat.instrumentVersions[0];
    if (!instrument || instrument.parameters.length === 0) {
      problems.push(`${label}: instrumen belum memiliki parameter.`);
    } else {
      const totalWeight = instrument.parameters.reduce((s, p) => s + p.weight, 0);
      if (Math.abs(totalWeight - 100) > 0.001) {
        problems.push(`${label}: total bobot parameter ${totalWeight}%, harus tepat 100%.`);
      }
      if (instrument.scaleMin >= instrument.scaleMax) {
        problems.push(`${label}: rentang skala tidak valid (minimum harus lebih kecil dari maksimum).`);
      }
      if (instrument.scaleStep <= 0) {
        problems.push(`${label}: kelipatan skor harus lebih besar dari nol.`);
      }
    }

    const groups = new Set(cat.groupRules.map((g) => g.group));
    if (!groups.has("PIMPINAN") || !groups.has("SELAIN_PIMPINAN")) {
      problems.push(`${label}: aturan kedua kelompok (Pimpinan & Selain Pimpinan) wajib ditetapkan.`);
    }
    for (const g of cat.groupRules) {
      if (g.target > 0 && g.minimum > g.target) {
        problems.push(
          `${label}: minimum respons kelompok ${g.group === "PIMPINAN" ? "Pimpinan" : "Selain Pimpinan"} (${g.minimum}) melebihi target (${g.target}).`
        );
      }
    }

    // EDGE-25/Bab 8.3: "Karya tanpa penanggung jawab: Tidak dapat siap." Berlaku untuk seluruh
    // jenis objek NON-Orang (Unit/Karya/Lainnya) yang di tabel Bab 8.3 mewajibkan penanggung jawab.
    if (cat.objectType.code !== "ORANG") {
      const missing = cat.categoryObjects.filter((co) => !co.object.responsibleUserId);
      if (missing.length > 0) {
        problems.push(
          `${label}: ${missing.length} objek belum memiliki penanggung jawab (${missing.map((m) => m.object.name).join(", ")}).`
        );
      }
    }

    // Bab 7.3: "Daftar penugasan sudah dipreview dan masalah kekurangan ditangani secara eksplisit."
    // Kekurangan (shortage > 0) itu sendiri BUKAN penghalang — Bab 10.5 secara sah mengizinkan
    // menerbitkan lebih sedikit dari target. Yang wajib adalah penugasan sudah pernah dijalankan
    // sama sekali (bukan terlewat begitu saja) ketika ada target penilai yang perlu diisi.
    const hasTarget = cat.groupRules.some((g) => g.target > 0);
    if (hasTarget && cat._count.assignmentBatches === 0) {
      problems.push(`${label}: penugasan penilai belum pernah diterapkan.`);
    }
  }

  return problems;
}

async function transitionPeriodStatusImpl(
  periodId: string,
  targetStatus: PeriodStatus,
  actor: AuthContext,
  reason?: string
) {
  const before = await prisma.period.findUnique({ where: { id: periodId } });
  if (!before) throw new ServiceError("Periode tidak ditemukan.");

  if(targetStatus === "FINAL" || targetStatus === "REVISI") throw new ServiceError("Gunakan tindakan finalisasi atau buka revisi dengan alasan.");
  const allowed = TRANSITIONS[before.status] ?? [];
  if (!allowed.includes(targetStatus)) {
    throw new ServiceError(
      `Tidak dapat berpindah dari status ${before.status} ke ${targetStatus}.`
    );
  }

  if (targetStatus === "SIAP") {
    const problems = await checkReadiness(periodId);
    if (problems.length > 0) {
      throw new ServiceError(`Validasi belum lulus:\n${problems.join("\n")}`);
    }
  }

  // Transisi FINAL/REVISI sudah ditolak di atas; finalizedAt hanya diubah oleh
  // alur finalisasi (finalization.ts) dan pembukaan revisi, bukan di sini.
  const period = await prisma.period.update({
    where: { id: periodId },
    data: {
      status: targetStatus,
      version: { increment: 1 },
    },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: `PERIOD_STATUS_${targetStatus}`,
    entity: "Period",
    entityId: period.id,
    before,
    after: period,
    reason,
  });

  return period;
}

// Bab 7.5: menyalin konfigurasi (kategori, instrumen, aturan kelompok) ke draf periode baru.
// Jawaban, hasil final, dan penugasan lama sengaja tidak disalin.
async function copyPeriodImpl(
  sourcePeriodId: string,
  input: { code: string; name: string; startsAt: string; endsAt: string },
  actor: AuthContext
) {
  const source = await prisma.period.findUnique({
    where: { id: sourcePeriodId },
    include: {
      categories: {
        include: {
          instrumentVersions: { orderBy: { revision: "desc" }, take: 1, include: { parameters: true } },
          groupRules: true,
          assignmentRules: true,
          categoryObjects: {include:{object:{include:{ownerUnit:true}}}},
        },
      },
    },
  });
  if (!source) throw new ServiceError("Periode sumber tidak ditemukan.");

  const name = input.name.trim();
  if (!name) throw new ServiceError("Nama periode baru wajib diisi.");
  const code =
    input.code.trim() ||
    (await kodeUnikDariNama(name, async (k) => !!(await prisma.period.findUnique({ where: { code: k } }))));

  const startsAt = parseDate("Tanggal mulai", input.startsAt);
  const endsAt = parseDate("Tenggat", input.endsAt);
  if (startsAt >= endsAt) throw new ServiceError("Tanggal mulai harus lebih awal dari tenggat.");

  const existing = await prisma.period.findUnique({ where: { code } });
  if (existing) throw new ServiceError("Kode periode sudah dipakai.");

  const newPeriod = await prisma.$transaction(async (tx) => {
    const p = await tx.period.create({
      data: {
        code,
        name,
        description: source.description,
        timezone: source.timezone,
        startsAt,
        endsAt,
        createdById: actor.userId,
        copiedFromId: source.id,
        unitTreeSnapshot: await tx.unit.findMany({select:{id:true,parentId:true}}),
      },
    });
    await tx.accessPolicy.create({
      data: { periodId: p.id, mode: "SETELAH_FINAL", changedById: actor.userId },
    });

    for (const cat of source.categories) {
      const newCat = await tx.category.create({
        data: {
          periodId: p.id,
          code: cat.code,
          name: cat.name,
          description: cat.description,
          objectTypeId: cat.objectTypeId,
          excludeContributors: cat.excludeContributors,
          pimpinanWeight: cat.pimpinanWeight,
        },
      });

      const parameterIdMap = new Map<string,string>();
      const srcInstrument = cat.instrumentVersions[0];
      if (srcInstrument) {
        const newInstrument = await tx.instrumentVersion.create({
          data: {
            categoryId: newCat.id,
            scaleMin: srcInstrument.scaleMin,
            scaleMax: srcInstrument.scaleMax,
            scaleStep: srcInstrument.scaleStep,
            guide: srcInstrument.guide,
          },
        });
        for (const param of srcInstrument.parameters) {
          const copiedParameter = await tx.parameter.create({
            data: {
              instrumentVersionId: newInstrument.id,
              name: param.name,
              indicator: param.indicator,
              weight: param.weight,
              order: param.order,
              normalized: param.normalized,
            },
          });
          parameterIdMap.set(param.id,copiedParameter.id);
        }
      }

      for (const g of cat.groupRules) {
        await tx.groupRule.create({
          data: {
            categoryId: newCat.id,
            group: g.group,
            aggregation: g.aggregation,
            target: g.target,
            minimum: g.minimum,
            tieBreakParameterIds: ((g.tieBreakParameterIds as string[]|null)??[]).map(id=>parameterIdMap.get(id)).filter((id):id is string=>!!id),
          },
        });
      }
      for (const r of cat.assignmentRules) {
        await tx.assignmentRule.create({
          data: {
            categoryId: newCat.id,
            group: r.group,
            scope: r.scope,
            userTypeIds: r.userTypeIds ?? undefined,
          },
        });
      }
      // Bab 7.5/UC-10: "admin ... memeriksa organisasi dan objek TERKINI" — peserta (CategoryObject)
      // DISALIN sebagai titik awal yang bisa ditinjau/dihapus admin (hanya objek yang masih aktif
      // ikut disalin; snapshot nama/unit diambil ulang dari objek saat INI, bukan dari snapshot
      // lama), bukan diketik ulang dari nol. Yang SENGAJA TIDAK disalin (harus dievaluasi ulang
      // penuh, sesuai "Tidak ada jawaban lama yang ikut dihitung"): Assignment (penugasan/calon
      // penilai) dan seluruh Response (jawaban) — periode baru selalu mulai dari nol penugasan.
      await tx.categoryObject.createMany({data:cat.categoryObjects.filter(co=>co.object.active).map(co=>({categoryId:newCat.id,objectId:co.objectId,nameSnapshot:co.object.name,unitSnapshot:co.object.ownerUnit.name,ownerUnitIdSnapshot:co.object.ownerUnitId}))});
    }

    return p;
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "PERIOD_COPY",
    entity: "Period",
    entityId: newPeriod.id,
    after: { copiedFrom: source.code },
  });

  return newPeriod;
}

export async function createPeriod(...args: Parameters<typeof createPeriodImpl>): Promise<Awaited<ReturnType<typeof createPeriodImpl>>> {
  return atomic(() => createPeriodImpl(...args));
}

export async function updatePeriodSettings(...args: Parameters<typeof updatePeriodSettingsImpl>): Promise<Awaited<ReturnType<typeof updatePeriodSettingsImpl>>> {
  return atomic(() => updatePeriodSettingsImpl(...args));
}

export async function setAccessPolicy(...args: Parameters<typeof setAccessPolicyImpl>): Promise<Awaited<ReturnType<typeof setAccessPolicyImpl>>> {
  return atomic(() => setAccessPolicyImpl(...args));
}

export async function transitionPeriodStatus(...args: Parameters<typeof transitionPeriodStatusImpl>): Promise<Awaited<ReturnType<typeof transitionPeriodStatusImpl>>> {
  return atomic(() => transitionPeriodStatusImpl(...args));
}

export async function copyPeriod(...args: Parameters<typeof copyPeriodImpl>): Promise<Awaited<ReturnType<typeof copyPeriodImpl>>> {
  return atomic(() => copyPeriodImpl(...args));
}

// Bab 7.2: "Jadwal pembukaan otomatis hanya dijalankan jika periode sudah siap; kegagalan
// validasi dilaporkan kepada admin." Dipanggil oleh scripts/run-scheduled-transitions.ts lewat
// systemd timer (lihat docs/deployment.md) — bukan dari dalam proses Next.js itu sendiri, supaya
// tidak bergantung pada satu proses long-running yang mungkin di-restart/di-scale.
//
// Hanya SIAP -> AKTIF yang diotomatiskan di sini. SIAP berarti checkReadiness sudah lulus saat
// admin menetapkannya, jadi tidak perlu divalidasi ulang. Penutupan (AKTIF -> DITUTUP) SENGAJA
// TIDAK diotomatiskan: penegakan tenggat pengiriman sudah berjalan lewat assertFillable
// (di responses.ts — pengiriman baru ditolak begitu waktu server melewati endsAt) terlepas dari
// status Period yang tersimpan, dan TRANSITIONS di atas tidak punya jalan balik dari DITUTUP ke
// AKTIF — mengubah status pada titik yang tidak bisa dibatalkan bertentangan dengan Bab 14.1
// ("[finalisasi] tidak berubah diam-diam saat tenggat lewat"); menutup periode tetap tindakan
// admin yang disengaja.
export async function runScheduledOpenings(): Promise<{
  opened: { periodId: string; code: string }[];
  failed: { periodId: string; code: string; error: string }[];
}> {
  const due = await prisma.period.findMany({
    where: { status: "SIAP", startsAt: { lte: new Date() } },
  });

  const systemActor: AuthContext = {
    userId: "system-scheduler",
    loginIdentifier: "system-scheduler",
    name: "Penjadwal Otomatis",
    active: true,
    isAdmin: true,
    isDekan: false,
    leadershipUnitIds: [],
    scopeUnitIds: [],
  };

  const opened: { periodId: string; code: string }[] = [];
  const failed: { periodId: string; code: string; error: string }[] = [];
  for (const period of due) {
    try {
      await transitionPeriodStatus(period.id, "AKTIF", systemActor, "Dibuka otomatis sesuai jadwal (Bab 7.2).");
      opened.push({ periodId: period.id, code: period.code });
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      failed.push({ periodId: period.id, code: period.code, error });
      // "Kegagalan validasi dilaporkan kepada admin": tanpa kanal notifikasi (di luar lingkup,
      // Bab 2.4), jejak Audit adalah tempat admin benar-benar bisa melihatnya.
      await writeAudit({
        actorId: systemActor.userId,
        actorRole: "ADMIN",
        action: "PERIOD_SCHEDULED_OPEN_FAILED",
        entity: "Period",
        entityId: period.id,
        reason: error,
      });
    }
  }
  return { opened, failed };
}
