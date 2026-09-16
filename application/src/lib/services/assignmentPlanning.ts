import { createHash } from "node:crypto";
import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import { getUnitAndDescendantIds } from "@/lib/units";
import { createRng, seededShuffle } from "@/lib/prng";
import type { AuthContext } from "@/lib/authz";
import type { AssessmentGroup } from "@/generated/prisma/enums";
import { periksaPenambahan } from "@/lib/services/penambahan-berjalan";

export interface PlanCandidate {
  userId: string;
  name: string;
  loginIdentifier: string;
}

export interface PlanEntry {
  categoryObjectId: string;
  objectName: string;
  group: AssessmentGroup;
  target: number;
  alreadyAssigned: PlanCandidate[];
  eligibleCount: number;
  picked: PlanCandidate[];
  shortage: number;
}

export interface AssignmentPlan {
  categoryId: string;
  seed: string;
  entries: PlanEntry[];
  totalNewAssignments: number;
  fingerprint?:string;
}

async function resolveScopeUnitIds(ownerUnitId: string, scope: "UNIT_OBJEK" | "UNIT_DAN_SUBUNIT") {
  if (scope === "UNIT_DAN_SUBUNIT") {
    return getUnitAndDescendantIds(ownerUnitId);
  }
  return [ownerUnitId];
}

// Bab 10.4: algoritme pengacakan merata. Dipakai baik untuk pratinjau (tanpa efek samping)
// maupun penerapan (dipanggil ulang dengan seed yang sama di dalam transaksi commit).
export async function computePlan(categoryId: string, seed: string): Promise<AssignmentPlan> {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      period: true,
      groupRules: true,
      assignmentRules: true,
      categoryObjects: {
        include: {
          object: { include: { contributors: true } },
        },
      },
    },
  });
  if (!category) throw new ServiceError("Kategori tidak ditemukan.");

  const rng = createRng(seed);

  // Beban dihitung SELURUH PERIODE (Bab 10.4 langkah 4: "beban penugasan paling rendah dalam
  // periode"), bukan hanya kategori ini, agar penyebaran tugas merata lintas kategori.
  const periodAssignments = await prisma.assignment.findMany({
    where: {
      status: { not: "DIBATALKAN" },
      categoryObject: { category: { periodId: category.periodId } },
    },
    select: { evaluatorId: true, categoryObjectId: true, group: true },
  });
  const loadByUser = new Map<string, number>();
  for (const a of periodAssignments) {
    loadByUser.set(a.evaluatorId, (loadByUser.get(a.evaluatorId) ?? 0) + 1);
  }

  const assignedByObjectGroup = new Map<string, Set<string>>(); // key: categoryObjectId|group -> evaluatorIds
  for (const a of periodAssignments) {
    const key = `${a.categoryObjectId}|${a.group}`;
    const set = assignedByObjectGroup.get(key) ?? new Set();
    set.add(a.evaluatorId);
    assignedByObjectGroup.set(key, set);
  }
  // Penilai yang sudah punya tugas apa pun (kelompok manapun) pada objek yang sama tidak boleh
  // dipilih ulang untuk objek itu (DEF-09: satu kelompok per pasangan penilai-objek-kategori).
  const assignedEvaluatorsByObject = new Map<string, Set<string>>();
  for (const a of periodAssignments) {
    const set = assignedEvaluatorsByObject.get(a.categoryObjectId) ?? new Set();
    set.add(a.evaluatorId);
    assignedEvaluatorsByObject.set(a.categoryObjectId, set);
  }

  const entries: PlanEntry[] = [];
  // Dipilih dalam proses ini (belum tersimpan) — dicegah agar tidak dipilih dua kali untuk objek yang sama.
  const reservedByObject = new Map<string, Set<string>>();

  const groupOrder: AssessmentGroup[] = ["PIMPINAN", "SELAIN_PIMPINAN"];

  for (const group of groupOrder) {
    const rule = category.assignmentRules.find((r) => r.group === group);
    const groupRule = category.groupRules.find((r) => r.group === group);
    if (!rule || !groupRule) continue;

    const userTypeIds = (rule.userTypeIds as string[] | null) ?? null;

    type Candidate = { categoryObjectId: string; objectName: string; candidates: PlanCandidate[] };
    const perObject: Candidate[] = [];

    for (const co of category.categoryObjects) {
      const scopeUnitIds = group === "PIMPINAN" ? [co.ownerUnitIdSnapshot ?? co.object.ownerUnitId] : await resolveScopeUnitIds(co.ownerUnitIdSnapshot ?? co.object.ownerUnitId, rule.scope);

      let poolUserIds: string[];
      if (group === "PIMPINAN") {
        const leaderships = await prisma.leadership.findMany({
          where: {
            unitId: { in: scopeUnitIds },
            active: true,
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
          },
          select: { userId: true },
        });
        poolUserIds = [...new Set(leaderships.map((l) => l.userId))];
      } else {
        const members = await prisma.user.findMany({
          where: { primaryUnitId: { in: scopeUnitIds }, active: true },
          select: { id: true },
        });
        poolUserIds = members.map((m) => m.id);
      }

      const contributorIds = new Set(co.object.contributors.map((c) => c.userId));
      const alreadyOnObject = assignedEvaluatorsByObject.get(co.id) ?? new Set();
      const reserved = reservedByObject.get(co.id) ?? new Set();

      let eligibleIds = poolUserIds.filter((uid) => {
        if (co.object.referenceUserId && uid === co.object.referenceUserId) return false; // DEF-17
        if (category.excludeContributors && contributorIds.has(uid)) return false;
        if (alreadyOnObject.has(uid)) return false;
        if (reserved.has(uid)) return false;
        return true;
      });

      if (userTypeIds && userTypeIds.length > 0) {
        const filtered = await prisma.user.findMany({
          where: { id: { in: eligibleIds }, userTypeId: { in: userTypeIds } },
          select: { id: true },
        });
        const allowed = new Set(filtered.map((f) => f.id));
        eligibleIds = eligibleIds.filter((id) => allowed.has(id));
      }

      const users = await prisma.user.findMany({
        where: { id: { in: eligibleIds } },
        select: { id: true, name: true, loginIdentifier: true },
      });

      perObject.push({
        categoryObjectId: co.id,
        objectName: co.nameSnapshot,
        candidates: users.map((u) => ({ userId: u.id, name: u.name, loginIdentifier: u.loginIdentifier })),
      });
    }

    // Bab 10.4 langkah 2: proses objek dengan calon paling terbatas lebih dulu.
    perObject.sort((a, b) => a.candidates.length - b.candidates.length);

    for (const obj of perObject) {
      const co = category.categoryObjects.find((c) => c.id === obj.categoryObjectId)!;
      const alreadyIds = assignedByObjectGroup.get(`${obj.categoryObjectId}|${group}`) ?? new Set();
      const alreadyAssigned: PlanCandidate[] = [];
      if (alreadyIds.size > 0) {
        const already = await prisma.user.findMany({
          where: { id: { in: [...alreadyIds] } },
          select: { id: true, name: true, loginIdentifier: true },
        });
        alreadyAssigned.push(
          ...already.map((u) => ({ userId: u.id, name: u.name, loginIdentifier: u.loginIdentifier }))
        );
      }

      const needed = Math.max(0, groupRule.target - alreadyIds.size);
      const picked: PlanCandidate[] = [];

      if (needed > 0 && obj.candidates.length > 0) {
        // Bab 10.4 langkah 3-5: acak urutan kandidat berbeban setara, lalu pilih beban terendah.
        const shuffled = seededShuffle(obj.candidates, rng);
        shuffled.sort((a, b) => (loadByUser.get(a.userId) ?? 0) - (loadByUser.get(b.userId) ?? 0));

        for (const cand of shuffled) {
          if (picked.length >= needed) break;
          picked.push(cand);
          loadByUser.set(cand.userId, (loadByUser.get(cand.userId) ?? 0) + 1);
          const reserved = reservedByObject.get(obj.categoryObjectId) ?? new Set();
          reserved.add(cand.userId);
          reservedByObject.set(obj.categoryObjectId, reserved);
        }
      }

      entries.push({
        categoryObjectId: obj.categoryObjectId,
        objectName: co.nameSnapshot,
        group,
        target: groupRule.target,
        alreadyAssigned,
        eligibleCount: obj.candidates.length,
        picked,
        shortage: needed - picked.length,
      });
    }
  }

  return {
    fingerprint:createHash("sha256").update(JSON.stringify({entries,rules:category.groupRules,assignmentRules:category.assignmentRules})).digest("hex"),
    categoryId,
    seed,
    entries,
    totalNewAssignments: entries.reduce((s, e) => s + e.picked.length, 0),
  };
}

// Bab 10.4: menerapkan pratinjau menjadi tugas nyata. Menghitung ulang rencana dengan seed yang
// sama di dalam transaksi (menangkap perubahan data sejak pratinjau terakhir) lalu menyimpan
// batch + tugas sekaligus untuk keterlacakan (Bab 10.4 penutup, Bab 18 AssignmentBatch).
async function commitPlanImpl(categoryId: string, seed: string, actor: AuthContext, fingerprint?:string, alasan?: string | null) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      period: true,
      assignmentRules: true,
      instrumentVersions: { orderBy: { revision: "desc" }, take: 1 },
    },
  });
  if (!category) throw new ServiceError("Kategori tidak ditemukan.");
  // Pembagian otomatis hanya menambah tugas untuk slot yang belum terisi, jadi aman dijalankan
  // ulang saat periode berjalan — mis. setelah objek baru ditambahkan.
  const reason = periksaPenambahan(category.period, alasan, "Pembagian tugas");
  const instrumentVersion = category.instrumentVersions[0];
  if (!instrumentVersion) throw new ServiceError("Kategori belum memiliki versi instrumen.");

  const plan = await computePlan(categoryId, seed);
  if(fingerprint && fingerprint!==plan.fingerprint) throw new ServiceError("Calon atau konfigurasi berubah. Jalankan pratinjau ulang sebelum menerapkan.");
  if (plan.totalNewAssignments === 0) {
    throw new ServiceError(
      "Tidak ada tugas baru untuk diterbitkan (semua objek sudah terisi atau tidak ada calon sah)."
    );
  }

  const ruleRevisionSnapshot = Object.fromEntries(
    category.assignmentRules.map((r) => [r.group, r.revision])
  );

  const batch = await prisma.$transaction(async (tx) => {
    const createdBatch = await tx.assignmentBatch.create({
      data: {
        categoryId,
        ruleRevisionSnapshot,
        candidateSnapshot: plan.entries.map((e) => ({
          categoryObjectId: e.categoryObjectId,
          group: e.group,
          eligibleCount: e.eligibleCount,
          picked: e.picked.map((p) => p.userId),
          shortage: e.shortage,
        })),
        seed,
        resultSummary: {
          totalNewAssignments: plan.totalNewAssignments,
          totalShortage: plan.entries.reduce((s, e) => s + e.shortage, 0),
        },
        createdById: actor.userId,
      },
    });

    for (const entry of plan.entries) {
      for (const candidate of entry.picked) {
        // Mengisi slot yang sebelumnya dibatalkan memakai baris yang sama (constraint unik
        // objek+penilai), bukan baris baru — riwayat pembatalan tetap tersimpan di baris itu.
        const existingCancelled = await tx.assignment.findUnique({
          where: {
            categoryObjectId_evaluatorId: {
              categoryObjectId: entry.categoryObjectId,
              evaluatorId: candidate.userId,
            },
          },
        });
        if (existingCancelled && existingCancelled.status === "DIBATALKAN") {
          await tx.assignment.update({
            where: { id: existingCancelled.id },
            data: {
              status: "BELUM_MULAI",
              group: entry.group,
              batchId: createdBatch.id,
              instrumentVersionId: instrumentVersion.id,
              reason: reason ? `Pengacakan otomatis saat periode berjalan: ${reason}` : "Pengacakan otomatis (mengisi ulang slot dibatalkan)",
              cancelledAt: null,
              cancelReason: null,
            },
          });
        } else {
          await tx.assignment.create({
            data: {
              categoryObjectId: entry.categoryObjectId,
              evaluatorId: candidate.userId,
              evaluatorNameSnapshot: candidate.name,
              evaluatorLoginSnapshot: candidate.loginIdentifier,
              group: entry.group,
              batchId: createdBatch.id,
              instrumentVersionId: instrumentVersion.id,
              reason: reason ? `Pengacakan otomatis saat periode berjalan: ${reason}` : "Pengacakan otomatis",
            },
          });
        }
      }
    }

    return createdBatch;
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "ASSIGNMENT_BATCH_COMMIT",
    entity: "AssignmentBatch",
    entityId: batch.id,
    after: { categoryId, totalNewAssignments: plan.totalNewAssignments, seed, periodStatus: category.period.status },
    reason: reason ?? undefined,
  });

  return { batch, plan };
}

export async function commitPlan(...args: Parameters<typeof commitPlanImpl>): Promise<Awaited<ReturnType<typeof commitPlanImpl>>> {
  return atomic(() => commitPlanImpl(...args));
}
