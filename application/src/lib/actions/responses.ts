"use server";

import { revalidatePath } from "next/cache";
import { requireActiveActor, requireAdminActor } from "@/lib/authz";
import {
  saveDraft,
  submitResponse,
  reopenAssignment,
  adminEditResponse,
  voidResponse,
  listMyAssignments,
  computeDisplayStatus,
  submitOrSaveDraft,
  type ScoreInput,
} from "@/lib/services/responses";
import { ServiceError } from "@/lib/services/units";

export interface FormState {
  error?: string;
  savedAt?: string;
  version?: number;
  /** Diisi setelah kirim berhasil — memicu dialog "Penilaian terkirim" di lembar penilaian. */
  submittedAt?: string;
  /** Tugas berikutnya yang masih bisa diisi, supaya penilai bisa langsung lanjut. */
  nextAssignmentId?: string | null;
  remainingCount?: number;
}

function readExpectedVersion(formData: FormData): number | null {
  const raw = String(formData.get("expectedVersion") ?? "");
  if (raw === "") return null; // belum ada draf sebelumnya di sisi klien
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function readScores(formData: FormData): ScoreInput[] {
  const parameterIds = formData.getAll("parameterId").map(String);
  const values = formData.getAll("scoreValue").map(String);
  const scores: ScoreInput[] = [];
  for (let i = 0; i < parameterIds.length; i++) {
    const raw = values[i];
    if (raw === undefined || raw === "") continue; // draf boleh kosong (Bab 11.3)
    const num = Number(raw);
    if (Number.isNaN(num)) continue;
    scores.push({ parameterId: parameterIds[i], score: num });
  }
  return scores;
}

export async function saveDraftAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActiveActor();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  let saved;
  try {
    saved = await saveDraft(assignmentId, readScores(formData), readExpectedVersion(formData), actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/tugas/${assignmentId}`);
  revalidatePath("/tugas");
  return { savedAt: new Date().toISOString(), version: saved.version };
}

export async function submitResponseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireActiveActor();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  try {
    await submitResponse(
      assignmentId,
      readScores(formData),
      idempotencyKey,
      readExpectedVersion(formData),
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/tugas/${assignmentId}`);
  revalidatePath("/tugas");
  const sisa = (await listMyAssignments(actor.userId)).filter(
    (a) =>
      a.id !== assignmentId &&
      (a.status === "BELUM_MULAI" || a.status === "DRAF" || a.status === "DIBUKA_KEMBALI") &&
      computeDisplayStatus(a.status, a.categoryObject.category.period.status, a.categoryObject.category.period.endsAt) !==
        "LEWAT_TENGGAT" &&
      a.categoryObject.category.period.status !== "DITUTUP" &&
      a.categoryObject.category.period.status !== "FINAL"
  );
  return {
    submittedAt: new Date().toISOString(),
    nextAssignmentId: sisa[0]?.id ?? null,
    remainingCount: sisa.length,
  };
}

export async function reopenAssignmentAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  try {
    await reopenAssignment(assignmentId, reason, actor, formData.get("correctionEndsAt") ? String(formData.get("correctionEndsAt"))+"+07:00" : undefined);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/tugas/${assignmentId}`);
  return {};
}

export async function adminEditResponseAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  try {
    await adminEditResponse(assignmentId, readScores(formData), reason, actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/tugas/${assignmentId}`);
  return {};
}

export async function voidResponseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const responseRevisionId = String(formData.get("responseRevisionId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  try {
    await voidResponse(responseRevisionId, reason, actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/tugas/${assignmentId}`);
  return {};
}

export interface KategoriFormState {
  error?: string;
  savedAt?: string;
  /** Versi draf terbaru per tugas, dipakai sebagai expectedVersion kiriman berikutnya. */
  versions?: Record<string, number>;
  ringkasan?: {
    terkirim: number;
    draf: number;
    gagal: { assignmentId: string; nama: string; pesan: string }[];
  };
  submittedAt?: string;
}

/** Membaca isian lembar kategori: satu daftar tugas, skornya bernama `skor.<tugas>.<parameter>`. */
function bacaLembar(formData: FormData) {
  const tugas = formData.getAll("tugas").map(String);
  return tugas.map((assignmentId) => {
    const scores: ScoreInput[] = [];
    for (const [nama, nilai] of formData.entries()) {
      const awalan = `skor.${assignmentId}.`;
      if (!nama.startsWith(awalan)) continue;
      const mentah = String(nilai);
      if (mentah === "") continue;
      const angka = Number(mentah);
      if (Number.isNaN(angka)) continue;
      scores.push({ parameterId: nama.slice(awalan.length), score: angka });
    }
    const versi = String(formData.get(`versi.${assignmentId}`) ?? "");
    return {
      assignmentId,
      nama: String(formData.get(`nama.${assignmentId}`) ?? "Objek"),
      scores,
      expectedVersion: versi === "" ? null : Number(versi),
      idempotencyKey: String(formData.get(`kunci.${assignmentId}`) ?? ""),
    };
  });
}

/**
 * Simpan draf seluruh objek pada satu lembar kategori sekaligus.
 *
 * Tiap tugas tetap disimpan sendiri-sendiri lewat saveDraft, jadi satu baris yang bentrok versinya
 * tidak membatalkan baris lain; yang gagal dilaporkan dengan nama objeknya.
 */
export async function saveCategoryDraftAction(
  _prev: KategoriFormState,
  formData: FormData
): Promise<KategoriFormState> {
  const actor = await requireActiveActor();
  const baris = bacaLembar(formData);
  const versions: Record<string, number> = {};
  const gagal: { assignmentId: string; nama: string; pesan: string }[] = [];
  let tersimpan = 0;
  for (const b of baris) {
    // Baris yang belum pernah disentuh dilewati: menyimpan draf kosong akan mengubah statusnya
    // dari "Belum mulai" menjadi "Draf", sehingga pemantauan mengira pengisian sudah dimulai.
    if (b.scores.length === 0 && b.expectedVersion === null) continue;
    try {
      const saved = await saveDraft(b.assignmentId, b.scores, b.expectedVersion, actor);
      versions[b.assignmentId] = saved.version;
      tersimpan += 1;
    } catch (e) {
      if (!(e instanceof ServiceError)) throw e;
      gagal.push({ assignmentId: b.assignmentId, nama: b.nama, pesan: e.message });
    }
  }
  revalidatePath("/tugas");
  if (tersimpan === 0 && gagal.length > 0) return { error: gagal[0].pesan, ringkasan: { terkirim: 0, draf: 0, gagal } };
  return {
    savedAt: new Date().toISOString(),
    versions,
    ringkasan: { terkirim: 0, draf: tersimpan, gagal },
  };
}

/**
 * Kirim seluruh objek yang isiannya sudah lengkap; yang belum lengkap disimpan sebagai draf.
 * Objek yang sudah terkirim sebelumnya tidak ikut dikirim ulang — barisnya memang tidak lagi
 * dikirimkan oleh halaman.
 */
export async function submitCategoryAction(
  _prev: KategoriFormState,
  formData: FormData
): Promise<KategoriFormState> {
  const actor = await requireActiveActor();
  const baris = bacaLembar(formData);
  const versions: Record<string, number> = {};
  const gagal: { assignmentId: string; nama: string; pesan: string }[] = [];
  let terkirim = 0;
  let draf = 0;
  for (const b of baris) {
    // Sama seperti simpan draf: objek yang dibiarkan kosong tidak diapa-apakan, bukan disimpan
    // sebagai draf kosong.
    if (b.scores.length === 0 && b.expectedVersion === null) continue;
    try {
      const hasil = await submitOrSaveDraft(
        b.assignmentId,
        b.scores,
        b.idempotencyKey,
        b.expectedVersion,
        actor
      );
      if (hasil.hasil === "terkirim") terkirim += 1;
      else {
        draf += 1;
        if (hasil.version != null) versions[b.assignmentId] = hasil.version;
      }
    } catch (e) {
      if (!(e instanceof ServiceError)) throw e;
      gagal.push({ assignmentId: b.assignmentId, nama: b.nama, pesan: e.message });
    }
  }
  revalidatePath("/tugas");
  for (const b of baris) revalidatePath(`/tugas/${b.assignmentId}`);
  if (terkirim === 0 && draf === 0 && gagal.length > 0) {
    return { error: gagal[0].pesan, ringkasan: { terkirim, draf, gagal } };
  }
  return {
    submittedAt: new Date().toISOString(),
    versions,
    ringkasan: { terkirim, draf, gagal },
  };
}
