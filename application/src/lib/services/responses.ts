import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";
import type { AssignmentStatus, AssessmentGroup } from "@/generated/prisma/enums";

export interface ScoreInput {
  parameterId: string;
  score: number;
}

function isValidScore(score: number, min: number, max: number, step: number): boolean {
  if (!Number.isFinite(score)) return false;
  if (score < min - 1e-9 || score > max + 1e-9) return false;
  if (step > 0) {
    const stepsFromMin = (score - min) / step;
    if (Math.abs(stepsFromMin - Math.round(stepsFromMin)) > 1e-6) return false;
  }
  return true;
}

async function loadAssignmentContext(assignmentId: string) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      categoryObject: {
        include: { category: { include: { period: true } }, object: true },
      },
      instrumentVersion: { include: { parameters: { orderBy: { order: "asc" } } } },
    },
  });
  if (!assignment) throw new ServiceError("Tugas tidak ditemukan.");
  return assignment;
}

type AssignmentContext = Awaited<ReturnType<typeof loadAssignmentContext>>;

function assertOwnership(assignment: AssignmentContext, actor: AuthContext) {
  if (assignment.evaluatorId !== actor.userId) {
    throw new ServiceError("Tugas ini bukan milik Anda.");
  }
}

// Bab 7.4/11.5: jendela pengisian normal mengikuti periode Aktif & tenggat; tugas yang dibuka
// kembali admin (Bab 11.5) memakai jendela koreksi eksplisit dan tidak terikat tenggat normal.
function assertFillable(assignment: AssignmentContext) {
  if (assignment.status === "DIBATALKAN") {
    throw new ServiceError("Tugas ini telah dibatalkan oleh admin.");
  }
  if (assignment.status === "TERKIRIM") {
    throw new ServiceError("Jawaban sudah dikirim dan dikunci.");
  }
  if (assignment.status === "DIBUKA_KEMBALI") {
    const period = assignment.categoryObject.category.period;
    if (period.status === "FINAL") throw new ServiceError("Buka revisi periode sebelum mengoreksi hasil final.");
    if (period.status === "REVISI" && assignment.correctionEndsAt && new Date() < assignment.correctionEndsAt) return;
    if (period.status === "AKTIF" && new Date() < period.endsAt) return;
    throw new ServiceError("Jendela koreksi telah ditutup.");
  }

  const period = assignment.categoryObject.category.period;
  if (period.status !== "AKTIF") {
    throw new ServiceError("Survei telah ditutup. Jawaban belum dikirim.");
  }
  if (new Date() < period.startsAt) throw new ServiceError("Survei belum dibuka.");
  if (new Date() >= period.endsAt) {
    throw new ServiceError("Tenggat pengisian telah lewat.");
  }
}

function validateScores(assignment: AssignmentContext, scores: ScoreInput[], requireComplete: boolean) {
  const { parameters, scaleMin, scaleMax, scaleStep } = assignment.instrumentVersion;
  const validIds = new Set(parameters.map((p) => p.id));
  const provided = new Map(scores.map((s) => [s.parameterId, s.score]));
  if (provided.size !== scores.length) throw new ServiceError("Parameter duplikat tidak diizinkan.");

  const mentah = new Set(parameters.filter((p) => p.normalized).map((p) => p.id));
  for (const s of scores) {
    if (!validIds.has(s.parameterId)) {
      throw new ServiceError("Salah satu parameter tidak dikenal pada instrumen tugas ini.");
    }
    // Parameter bernilai mentah (mis. jumlah publikasi) tidak dibatasi maksimum skala: angkanya
    // baru dibandingkan dengan objek lain saat perhitungan.
    if (mentah.has(s.parameterId)) {
      if (!isValidScore(s.score, scaleMin, Number.POSITIVE_INFINITY, scaleStep)) {
        throw new ServiceError(
          `Angka mentah minimal ${scaleMin}${scaleStep ? `, kelipatan ${scaleStep}` : ""}.`
        );
      }
      continue;
    }
    if (!isValidScore(s.score, scaleMin, scaleMax, scaleStep)) {
      throw new ServiceError(
        `Skor harus di antara ${scaleMin} dan ${scaleMax}${scaleStep ? `, kelipatan ${scaleStep}` : ""}.`
      );
    }
  }

  if (requireComplete) {
    for (const p of parameters) {
      if (!provided.has(p.id)) {
        throw new ServiceError("Lengkapi seluruh parameter sebelum mengirim.");
      }
    }
  }
}

// Mengembalikan juga `wasCreated` agar pemanggil dapat membedakan "draf baru saja dibuat oleh
// permintaan ini sendiri" (tidak mungkin ada konflik versi) dari "draf sudah ada sebelumnya"
// (EDGE-12: klien wajib menyertakan versi yang cocok, termasuk saat klien mengira tugas ini
// masih kosong padahal tab lain sudah lebih dulu membuat draf pertamanya).
async function getOrCreateDraftRevision(
  assignmentId: string,
  actor: AuthContext,
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
) {
  const latest = await tx.responseRevision.findFirst({
    where: { assignmentId },
    orderBy: { revision: "desc" },
  });
  if (latest && latest.state === "DRAFT") return { rev: latest, wasCreated: false };
  const nextRevision = (latest?.revision ?? 0) + 1;
  try {
    const created = await tx.responseRevision.create({
      data: { assignmentId, revision: nextRevision, state: "DRAFT", editedById: actor.userId },
    });
    return { rev: created, wasCreated: true };
  } catch (e) {
    // P2002: dua permintaan bersamaan sama-sama mencoba membuat draf pertama untuk tugas yang
    // sama (lolos findFirst di atas karena belum ada baris sama sekali saat itu). Constraint unik
    // (assignmentId, revision) menjamin hanya satu yang berhasil; sisi yang kalah diberi tahu
    // untuk mencoba lagi alih-alih gagal dengan galat teknis mentah.
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      throw new ServiceError("Data berubah sejak terakhir dibuka. Muat ulang sebelum menyimpan.");
    }
    throw e;
  }
}

async function upsertScores(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  responseRevisionId: string,
  scores: ScoreInput[]
) {
  await tx.responseScore.deleteMany({ where: { responseRevisionId, parameterId: { notIn: scores.map(s => s.parameterId) } } });
  for (const s of scores) {
    await tx.responseScore.upsert({
      where: {
        responseRevisionId_parameterId: { responseRevisionId, parameterId: s.parameterId },
      },
      update: { score: s.score },
      create: { responseRevisionId, parameterId: s.parameterId, score: s.score },
    });
  }
}

// Bab 11.3: draf boleh tidak lengkap; disimpan pada revisi yang sama sampai terkirim.
// Bab 6.2/19.1/EDGE-12: expectedVersion adalah optimistic lock. null HANYA dianggap bebas
// konflik bila draf memang baru dibuat oleh panggilan ini sendiri (wasCreated) — jika draf
// TERNYATA sudah ada (dibuat tab/percobaan lain sesaat sebelumnya) walau klien mengira kosong,
// tetap ditolak; permintaan tidak pernah menimpa draf yang sudah ada secara diam-diam.
async function saveDraftImpl(
  assignmentId: string,
  scores: ScoreInput[],
  expectedVersion: number | null,
  actor: AuthContext
) {
  if (!actor.active || !(await prisma.user.findUnique({ where: { id: actor.userId } }))?.active) throw new ServiceError("Akun tidak aktif.");
  const assignment = await loadAssignmentContext(assignmentId);
  assertOwnership(assignment, actor);
  assertFillable(assignment);
  validateScores(assignment, scores, false);

  const revision = await prisma.$transaction(async (tx) => {
    const { rev, wasCreated } = await getOrCreateDraftRevision(assignmentId, actor, tx);
    if (!wasCreated && (expectedVersion === null || rev.version !== expectedVersion)) {
      throw new ServiceError("Data berubah sejak terakhir dibuka. Muat ulang sebelum menyimpan.");
    }

    await upsertScores(tx, rev.id, scores);
    if (assignment.status === "BELUM_MULAI") {
      await tx.assignment.update({ where: { id: assignmentId }, data: { status: "DRAF" } });
    }

    // Update bersyarat pada versi yang sama: menutup celah antara pemeriksaan di atas dan
    // penulisan ini bila dua permintaan lolos pemeriksaan pada saat hampir bersamaan.
    const updated = await tx.responseRevision.updateMany({
      where: { id: rev.id, version: rev.version },
      data: { editedById: actor.userId, version: { increment: 1 } },
    });
    if (updated.count === 0) {
      throw new ServiceError("Data berubah sejak terakhir dibuka. Muat ulang sebelum menyimpan.");
    }

    return tx.responseRevision.findUniqueOrThrow({ where: { id: rev.id }, include: { scores: true } });
  });

  return revision;
}

// Bab 11.4: verifikasi kepemilikan, akun aktif, periode terbuka, kelengkapan, dan transaksi atomik.
// IdempotencyKey mencegah klik ganda/retry jaringan menghasilkan dua respons aktif (EDGE-11).
// expectedVersion (lihat saveDraft) mencegah pengiriman berbasis tampilan draf yang sudah usang
// (mis. tab lain sempat menyimpan draf baru) menimpa perubahan itu secara diam-diam saat submit.
async function submitResponseImpl(
  assignmentId: string,
  scores: ScoreInput[],
  idempotencyKey: string,
  expectedVersion: number | null,
  actor: AuthContext
) {
  if (!actor.active) throw new ServiceError("Akun tidak aktif.");

  const replayAssignment = await loadAssignmentContext(assignmentId);
  assertOwnership(replayAssignment, actor);
  if (!(await prisma.user.findUnique({ where: { id: actor.userId } }))?.active) throw new ServiceError("Akun tidak aktif.");
  if (idempotencyKey) {
    const existingByKey = await prisma.responseRevision.findUnique({
      where: { idempotencyKey },
      include: { scores: true },
    });
    if (existingByKey) {
      if (existingByKey.assignmentId !== assignmentId) {
        throw new ServiceError("Permintaan tidak valid.");
      }
      return existingByKey; // replay idempoten — sudah tersimpan dari percobaan sebelumnya
    }
  }

  if (!actor.active || !(await prisma.user.findUnique({ where: { id: actor.userId } }))?.active) throw new ServiceError("Akun tidak aktif.");
  const assignment = await loadAssignmentContext(assignmentId);
  assertOwnership(assignment, actor);
  assertFillable(assignment);
  if (assignment.categoryObject.category.period.status === "FINAL") throw new ServiceError("Buka revisi periode sebelum mengoreksi hasil final.");
  validateScores(assignment, scores, true);

  const revision = await prisma.$transaction(async (tx) => {
    const { rev, wasCreated } = await getOrCreateDraftRevision(assignmentId, actor, tx);
    if (!wasCreated && (expectedVersion === null || rev.version !== expectedVersion)) {
      throw new ServiceError("Data berubah sejak terakhir dibuka. Muat ulang sebelum menyimpan.");
    }

    await upsertScores(tx, rev.id, scores);

    // Update bersyarat: hanya berhasil bila revisi ini MASIH berstatus draf DAN versinya belum
    // berubah saat dieksekusi. Bila 0 baris (tersubmit atau tersimpan ulang oleh permintaan lain
    // lebih dulu), tolak dengan pesan konflik alih-alih membuat respons kedua (EDGE-11/EDGE-12).
    const updated = await tx.responseRevision.updateMany({
      where: { id: rev.id, state: "DRAFT", version: rev.version },
      data: {
        state: "SUBMITTED",
        submittedAt: new Date(),
        editedById: actor.userId,
        idempotencyKey: idempotencyKey || null,
        version: { increment: 1 },
      },
    });
    if (updated.count === 0) {
      throw new ServiceError("Data berubah sejak terakhir dibuka. Muat ulang sebelum menyimpan.");
    }
    await tx.assignment.update({ where: { id: assignmentId }, data: { status: "TERKIRIM" } });
    return tx.responseRevision.findUniqueOrThrow({ where: { id: rev.id }, include: { scores: true } });
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "PENGGUNA",
    action: "RESPONSE_SUBMIT",
    entity: "ResponseRevision",
    entityId: revision.id,
    after: { assignmentId, revision: revision.revision },
  });

  return revision;
}

// Bab 11.5/UC-07: admin memberi kesempatan pengisi memperbaiki jawaban terkirim. Pada periode
// Revisi, jalur yang sama juga dipakai untuk memberi kesempatan terlambat kepada tugas yang belum
// pernah dikirim; jendelanya tetap eksplisit, sehingga Revisi tidak berubah menjadi pembukaan
// survei untuk semua tugas secara otomatis.
async function reopenAssignmentImpl(assignmentId: string, reason: string, actor: AuthContext, correctionEndsAt?: string) {
  if (!reason.trim()) throw new ServiceError("Alasan pembukaan kembali wajib diisi.");
  const assignment = await loadAssignmentContext(assignmentId);
  const sudahTerkirim = assignment.status === "TERKIRIM";
  const belumTerkirim = assignment.status === "BELUM_MULAI" || assignment.status === "DRAF";
  if (!sudahTerkirim && !belumTerkirim) {
    throw new ServiceError("Tugas ini tidak dapat dibuka untuk pengisian.");
  }

  const period = assignment.categoryObject.category.period;
  if (period.status === "FINAL") throw new ServiceError("Buka revisi periode sebelum mengoreksi hasil final.");
  const correctionEnd = correctionEndsAt ? new Date(correctionEndsAt) : period.endsAt;
  if (!Number.isFinite(correctionEnd.getTime()) || correctionEnd <= new Date()) throw new ServiceError("Tentukan tenggat koreksi yang masih akan datang.");
  if (period.status !== "AKTIF" && period.status !== "REVISI") throw new ServiceError("Buka status Revisi sebelum membuka koreksi periode tertutup.");
  if (belumTerkirim && period.status !== "REVISI") {
    throw new ServiceError("Pengisian terlambat hanya dapat dibuka saat periode berstatus Revisi.");
  }

  const revision = await prisma.$transaction(async (tx) => {
    if (!sudahTerkirim) {
      // Draf yang pernah dibuat penilai dibiarkan utuh. Untuk tugas yang belum mulai, siapkan
      // draf kosong agar jalur simpan/kirim berikutnya memakai kontrak revisi yang sama.
      const latestRevision = await tx.responseRevision.findFirst({
        where: { assignmentId },
        orderBy: { revision: "desc" },
        include: { scores: true },
      });
      const draft = latestRevision?.state === "DRAFT"
        ? latestRevision
        : await tx.responseRevision.create({
            data: {
              assignmentId,
              revision: (latestRevision?.revision ?? 0) + 1,
              state: "DRAFT",
              editedById: actor.userId,
              reason,
            },
            include: { scores: true },
          });
      await tx.assignment.update({
        where: { id: assignmentId },
        data: { status: "DIBUKA_KEMBALI", correctionEndsAt: correctionEnd },
      });
      return draft;
    }

    const latestSubmitted = await tx.responseRevision.findFirst({
      where: { assignmentId, state: "SUBMITTED" },
      orderBy: { revision: "desc" },
      include: { scores: true },
    });
    const nextRevision = (latestSubmitted?.revision ?? 0) + 1;
    const newRev = await tx.responseRevision.create({
      data: { assignmentId, revision: nextRevision, state: "DRAFT", editedById: actor.userId, reason },
    });
    if (latestSubmitted) {
      for (const s of latestSubmitted.scores) {
        await tx.responseScore.create({
          data: { responseRevisionId: newRev.id, parameterId: s.parameterId, score: s.score },
        });
      }
    }
    await tx.assignment.update({ where: { id: assignmentId }, data: { status: "DIBUKA_KEMBALI", correctionEndsAt: correctionEnd } });
    return tx.responseRevision.findUniqueOrThrow({ where: { id: newRev.id }, include: { scores: true } });
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: sudahTerkirim ? "ASSIGNMENT_REOPEN" : "ASSIGNMENT_LATE_OPEN",
    entity: "Assignment",
    entityId: assignmentId,
    reason,
  });

  return revision;
}

/** Membuka beberapa tugas yang belum terkirim sekaligus, khusus saat periode sedang Revisi. */
async function openLateAssignmentsImpl(
  assignmentIds: string[],
  reason: string,
  actor: AuthContext,
  correctionEndsAt?: string
) {
  const ids = [...new Set(assignmentIds.filter(Boolean))];
  if (ids.length === 0) throw new ServiceError("Pilih setidaknya satu tugas.");
  if (!reason.trim()) throw new ServiceError("Alasan pembukaan pengisian wajib diisi.");

  const correctionEnd = correctionEndsAt ? new Date(correctionEndsAt) : null;
  if (!correctionEnd || !Number.isFinite(correctionEnd.getTime()) || correctionEnd <= new Date()) {
    throw new ServiceError("Tentukan tenggat pengisian yang masih akan datang.");
  }

  const assignments = await prisma.assignment.findMany({
    where: { id: { in: ids } },
    include: { categoryObject: { include: { category: { include: { period: true } } } } },
  });
  if (assignments.length !== ids.length) throw new ServiceError("Salah satu tugas tidak ditemukan.");

  for (const assignment of assignments) {
    if (assignment.status !== "BELUM_MULAI" && assignment.status !== "DRAF") {
      throw new ServiceError("Semua tugas yang dipilih harus masih Belum mulai atau Draf.");
    }
    if (assignment.categoryObject.category.period.status !== "REVISI") {
      throw new ServiceError("Pengisian terlambat massal hanya dapat dibuka saat periode berstatus Revisi.");
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const assignment of assignments) {
      const latestRevision = await tx.responseRevision.findFirst({
        where: { assignmentId: assignment.id },
        orderBy: { revision: "desc" },
      });
      if (latestRevision?.state !== "DRAFT") {
        await tx.responseRevision.create({
          data: {
            assignmentId: assignment.id,
            revision: (latestRevision?.revision ?? 0) + 1,
            state: "DRAFT",
            editedById: actor.userId,
            reason,
          },
        });
      }
      await tx.assignment.update({
        where: { id: assignment.id },
        data: { status: "DIBUKA_KEMBALI", correctionEndsAt: correctionEnd },
      });
    }
  });

  await Promise.all(
    assignments.map((assignment) =>
      writeAudit({
        actorId: actor.userId,
        actorRole: "ADMIN",
        action: "ASSIGNMENT_LATE_OPEN",
        entity: "Assignment",
        entityId: assignment.id,
        reason,
      })
    )
  );
  return { openedCount: assignments.length, assignmentIds: ids };
}

// Bab 2.1/UC-07: admin mengedit lengkap dan langsung mengirim ulang (bukan menunggu pengisi).
async function adminEditResponseImpl(
  assignmentId: string,
  scores: ScoreInput[],
  reason: string,
  actor: AuthContext
) {
  if (!reason.trim()) throw new ServiceError("Alasan koreksi wajib diisi.");
  const assignment = await loadAssignmentContext(assignmentId);
  if (assignment.status === "DIBATALKAN") {
    throw new ServiceError("Tugas ini telah dibatalkan.");
  }
  if (assignment.categoryObject.category.period.status === "FINAL") throw new ServiceError("Buka revisi periode sebelum mengoreksi hasil final.");
  validateScores(assignment, scores, true);

  const revision = await prisma.$transaction(async (tx) => {
    const latest = await tx.responseRevision.findFirst({
      where: { assignmentId },
      orderBy: { revision: "desc" },
    });
    const nextRevision = (latest?.revision ?? 0) + 1;
    const rev = await tx.responseRevision.create({
      data: {
        assignmentId,
        revision: nextRevision,
        state: "SUBMITTED",
        submittedAt: new Date(),
        editedById: actor.userId,
        reason,
      },
    });
    await upsertScores(tx, rev.id, scores);
    await tx.assignment.update({ where: { id: assignmentId }, data: { status: "TERKIRIM" } });
    return tx.responseRevision.findUniqueOrThrow({ where: { id: rev.id }, include: { scores: true } });
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "RESPONSE_ADMIN_EDIT",
    entity: "ResponseRevision",
    entityId: revision.id,
    reason,
  });

  return revision;
}

// Bab 10.6: "admin membatalkan respons dengan alasan; data historis tidak dihapus." Hanya
// respons berlaku saat ini (revisi SUBMITTED terbaru yang belum voided) yang dapat dibatalkan
// lewat jalur ini agar riwayat sebelumnya tidak ambigu.
async function voidResponseImpl(responseRevisionId: string, reason: string, actor: AuthContext) {
  if (!reason.trim()) throw new ServiceError("Alasan pembatalan wajib diisi.");
  const before = await prisma.responseRevision.findUnique({ where: { id: responseRevisionId } });
  if (!before) throw new ServiceError("Revisi jawaban tidak ditemukan.");
  if (before.state !== "SUBMITTED") throw new ServiceError("Hanya jawaban terkirim yang dapat dibatalkan.");
  const assignment = await loadAssignmentContext(before.assignmentId);
  if (assignment.categoryObject.category.period.status === "FINAL") throw new ServiceError("Buka revisi periode sebelum membatalkan respons final.");
  if (before.voided) throw new ServiceError("Jawaban ini sudah dibatalkan sebelumnya.");

  const latestEffective = await prisma.responseRevision.findFirst({
    where: { assignmentId: before.assignmentId, state: "SUBMITTED", voided: false },
    orderBy: { revision: "desc" },
  });
  if (!latestEffective || latestEffective.id !== before.id) {
    throw new ServiceError("Hanya jawaban terkirim yang sedang berlaku yang dapat dibatalkan dari sini.");
  }

  const revision = await prisma.$transaction(async (tx) => {
    const rev = await tx.responseRevision.update({
      where: { id: responseRevisionId },
      data: { voided: true, voidedAt: new Date(), voidedReason: reason, voidedById: actor.userId },
    });
    await tx.responseRevision.updateMany({ where: { assignmentId: before.assignmentId, state: "SUBMITTED", voided: false }, data: { voided: true, voidedAt: new Date(), voidedReason: reason, voidedById: actor.userId } });
    await tx.assignment.update({
      where: { id: before.assignmentId },
      data: { status: "DIBUKA_KEMBALI" },
    });
    return rev;
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "RESPONSE_VOID",
    entity: "ResponseRevision",
    entityId: revision.id,
    before,
    reason,
  });

  return revision;
}

export async function getAssignmentFormData(assignmentId: string, actor: AuthContext) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      categoryObject: {
        include: {
          category: { include: { period: true, objectType: true } },
          object: { include: { ownerUnit: true } },
        },
      },
      instrumentVersion: { include: { parameters: { orderBy: { order: "asc" } } } },
      evaluator: { select: { id: true, name: true, loginIdentifier: true } },
      responseRevisions: {
        orderBy: { revision: "desc" },
        include: { scores: true, editedBy: { select: { name: true } } },
      },
    },
  });
  if (!assignment) throw new ServiceError("Tugas tidak ditemukan.");

  const isOwner = assignment.evaluatorId === actor.userId;
  if (!isOwner && !actor.isAdmin) {
    throw new ServiceError("Tidak berwenang melihat tugas ini.");
  }

  const latestRevision = assignment.responseRevisions[0] ?? null;
  const effectiveRevision =
    assignment.responseRevisions.find((r) => r.state === "SUBMITTED" && !r.voided) ?? null;
  const editableRevision = latestRevision && latestRevision.state === "DRAFT" ? latestRevision : null;

  return { assignment, isOwner, latestRevision, effectiveRevision, editableRevision };
}

export async function listMyAssignments(userId: string) {
  const assignments = await prisma.assignment.findMany({
    where: { evaluatorId: userId, status: { not: "DIBATALKAN" } },
    include: {
      categoryObject: {
        include: { category: { include: { period: true } } },
      },
    },
  });
  return assignments.sort(
    (a, b) =>
      a.categoryObject.category.period.endsAt.getTime() -
      b.categoryObject.category.period.endsAt.getTime()
  );
}

// Bab 11.2: "Lewat tenggat" adalah status TAMPILAN turunan, bukan nilai yang tersimpan
// (menghindari skor nol tersembunyi) — dihitung dari status Assignment + tenggat periode.
export function computeDisplayStatus(
  status: AssignmentStatus,
  periodStatus: string,
  periodEndsAt: Date
): AssignmentStatus | "LEWAT_TENGGAT" {
  if ((status === "BELUM_MULAI" || status === "DRAF") && periodStatus === "AKTIF") {
    if (new Date() >= periodEndsAt) return "LEWAT_TENGGAT";
  }
  return status;
}

export async function saveDraft(...args: Parameters<typeof saveDraftImpl>): Promise<Awaited<ReturnType<typeof saveDraftImpl>>> {
  return atomic(() => saveDraftImpl(...args));
}

export async function submitResponse(...args: Parameters<typeof submitResponseImpl>): Promise<Awaited<ReturnType<typeof submitResponseImpl>>> {
  return atomic(() => submitResponseImpl(...args));
}

export async function reopenAssignment(...args: Parameters<typeof reopenAssignmentImpl>): Promise<Awaited<ReturnType<typeof reopenAssignmentImpl>>> {
  return atomic(() => reopenAssignmentImpl(...args));
}

export async function openLateAssignments(...args: Parameters<typeof openLateAssignmentsImpl>): Promise<Awaited<ReturnType<typeof openLateAssignmentsImpl>>> {
  return atomic(() => openLateAssignmentsImpl(...args));
}

export async function adminEditResponse(...args: Parameters<typeof adminEditResponseImpl>): Promise<Awaited<ReturnType<typeof adminEditResponseImpl>>> {
  return atomic(() => adminEditResponseImpl(...args));
}

export async function voidResponse(...args: Parameters<typeof voidResponseImpl>): Promise<Awaited<ReturnType<typeof voidResponseImpl>>> {
  return atomic(() => voidResponseImpl(...args));
}

/**
 * Satu lembar penilaian untuk SATU kategori: seluruh objek yang ditugaskan kepada penilai ini di
 * kategori tersebut, bukan satu objek per halaman.
 *
 * Sebelumnya tiap objek berdiri sebagai halaman sendiri, sehingga penilai yang kebagian enam orang
 * dalam satu kategori membuka enam halaman yang instrumennya sama persis — yang berulang justru
 * bagian yang seragam, sedangkan yang berbeda hanya nama objeknya. Di sini instrumen dibaca sekali,
 * lalu tiap objek cukup sebaris isian.
 *
 * Tugasnya sendiri TIDAK digabung: status, draf, riwayat revisi, dan pembatalan tetap melekat pada
 * masing-masing tugas, karena perhitungan dan syarat minimum penilai dihitung per objek.
 *
 * Baris dikelompokkan per versi instrumen. Biasanya hanya ada satu; dua versi baru muncul bila
 * penugasan diterbitkan ulang setelah instrumennya direvisi, dan kolom kedua kelompok itu memang
 * berbeda sehingga tidak boleh disatukan dalam satu tabel.
 */
export async function getCategorySheetData(
  categoryId: string,
  group: AssessmentGroup,
  actor: AuthContext
) {
  const assignments = await prisma.assignment.findMany({
    where: {
      evaluatorId: actor.userId,
      group,
      status: { not: "DIBATALKAN" },
      categoryObject: { categoryId },
    },
    include: {
      categoryObject: { include: { object: { select: { id: true } } } },
      instrumentVersion: { include: { parameters: { orderBy: { order: "asc" } } } },
      responseRevisions: { orderBy: { revision: "desc" }, include: { scores: true } },
    },
  });
  if (assignments.length === 0) throw new ServiceError("Tidak ada tugas Anda pada kategori ini.");

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { period: true, objectType: true },
  });
  if (!category) throw new ServiceError("Kategori tidak ditemukan.");

  const period = category.period;
  const now = new Date();
  const baris = assignments
    .map((a) => {
      const latest = a.responseRevisions[0] ?? null;
      const berlaku = a.responseRevisions.find((r) => r.state === "SUBMITTED" && !r.voided) ?? null;
      const draf = latest && latest.state === "DRAFT" ? latest : null;
      const displayStatus = computeDisplayStatus(a.status, period.status, period.endsAt);
      // Cerminan assertFillable() di atas — sumber kebenarannya tetap di sana, diperiksa ulang
      // saat menyimpan. Tugas yang dibuka kembali saat Revisi hanya boleh diketik sampai tenggat
      // khususnya, bukan semata-mata karena status tugasnya DIBUKA_KEMBALI.
      const statusBolehDiisi = a.status === "BELUM_MULAI" || a.status === "DRAF" || a.status === "DIBUKA_KEMBALI";
      const dalamJendelaNormal =
        period.status === "AKTIF" && now >= period.startsAt && now < period.endsAt;
      const dalamJendelaBukaKembali =
        a.status === "DIBUKA_KEMBALI" &&
        ((period.status === "REVISI" && !!a.correctionEndsAt && now < a.correctionEndsAt) ||
          (period.status === "AKTIF" && now < period.endsAt));
      return {
        assignmentId: a.id,
        instrumentVersionId: a.instrumentVersionId,
        objectName: a.categoryObject.nameSnapshot,
        unitName: a.categoryObject.unitSnapshot,
        status: a.status,
        displayStatus,
        bolehDiisi: statusBolehDiisi && (dalamJendelaBukaKembali || (a.status !== "DIBUKA_KEMBALI" && dalamJendelaNormal)),
        scores: Object.fromEntries(
          ((draf ?? berlaku)?.scores ?? []).map((s) => [s.parameterId, s.score])
        ) as Record<string, number>,
        version: draf?.version ?? null,
        submittedAt: berlaku?.submittedAt ?? null,
        revision: berlaku?.revision ?? null,
      };
    })
    .sort((a, b) => a.objectName.localeCompare(b.objectName, "id"));

  // Satu lembar per versi instrumen, versi terbaru (yang dipakai terbanyak) lebih dulu.
  const lembar = [...new Set(baris.map((b) => b.instrumentVersionId))]
    .map((id) => {
      const instrumen = assignments.find((a) => a.instrumentVersionId === id)!.instrumentVersion;
      return { instrumen, baris: baris.filter((b) => b.instrumentVersionId === id) };
    })
    .sort((a, b) => b.baris.length - a.baris.length);

  return { category, period, group, lembar, jumlahObjek: baris.length };
}

/** Kategori yang ditugaskan kepada satu penilai, satu baris per kategori+kelompok. */
export async function listMyCategories(userId: string) {
  const assignments = await listMyAssignments(userId);
  const peta = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      group: AssessmentGroup;
      periodId: string;
      periodName: string;
      periodStatus: string;
      deadline: Date;
      objectTypeName: string;
      total: number;
      terkirim: number;
      draf: number;
      belum: number;
      lewat: number;
    }
  >();
  for (const a of assignments) {
    const kategori = a.categoryObject.category;
    const kunci = `${kategori.id}|${a.group}`;
    const status = computeDisplayStatus(a.status, kategori.period.status, kategori.period.endsAt);
    const baris =
      peta.get(kunci) ??
      {
        categoryId: kategori.id,
        categoryName: kategori.name,
        group: a.group,
        periodId: kategori.period.id,
        periodName: kategori.period.name,
        periodStatus: kategori.period.status,
        deadline: kategori.period.endsAt,
        objectTypeName: "",
        total: 0,
        terkirim: 0,
        draf: 0,
        belum: 0,
        lewat: 0,
      };
    baris.total += 1;
    if (status === "TERKIRIM") baris.terkirim += 1;
    else if (status === "DRAF" || status === "DIBUKA_KEMBALI") baris.draf += 1;
    else if (status === "LEWAT_TENGGAT") baris.lewat += 1;
    else baris.belum += 1;
    peta.set(kunci, baris);
  }
  const hasil = [...peta.values()];
  // Jenis objek dipakai untuk menyebut isinya dengan kata yang tepat ("13 orang", "7 karya"),
  // dan tidak ikut terbawa listMyAssignments — diambil sekali di sini untuk seluruh kategori.
  const jenis = await prisma.category.findMany({
    where: { id: { in: [...new Set(hasil.map((h) => h.categoryId))] } },
    select: { id: true, objectType: { select: { name: true } } },
  });
  const namaJenis = new Map(jenis.map((j) => [j.id, j.objectType.name]));
  for (const h of hasil) h.objectTypeName = namaJenis.get(h.categoryId) ?? "objek";
  return hasil.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
}

/**
 * Satu baris lembar kategori: dikirim bila seluruh parameternya terisi, selebihnya disimpan
 * sebagai draf. Kelengkapan diputuskan di sini, bukan dari penanda yang dikirim peramban —
 * halaman boleh saja keliru, tetapi yang menentukan terkunci atau tidaknya sebuah jawaban harus
 * tetap server.
 */
export async function submitOrSaveDraft(
  assignmentId: string,
  scores: ScoreInput[],
  idempotencyKey: string,
  expectedVersion: number | null,
  actor: AuthContext
): Promise<{ hasil: "terkirim" | "draf"; version: number | null }> {
  const parameters = await prisma.parameter.findMany({
    where: { instrumentVersion: { assignments: { some: { id: assignmentId } } } },
    select: { id: true },
  });
  const terisi = new Set(scores.map((s) => s.parameterId));
  const lengkap = parameters.length > 0 && parameters.every((p) => terisi.has(p.id));
  if (lengkap) {
    await submitResponse(assignmentId, scores, idempotencyKey, expectedVersion, actor);
    return { hasil: "terkirim", version: null };
  }
  const draf = await saveDraft(assignmentId, scores, expectedVersion, actor);
  return { hasil: "draf", version: draf.version };
}
