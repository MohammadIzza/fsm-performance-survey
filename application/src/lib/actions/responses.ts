"use server";

import { revalidatePath } from "next/cache";
import { requireActiveActor, requireAdminActor } from "@/lib/authz";
import {
  saveDraft,
  submitResponse,
  reopenAssignment,
  adminEditResponse,
  voidResponse,
  type ScoreInput,
} from "@/lib/services/responses";
import { ServiceError } from "@/lib/services/units";

export interface FormState {
  error?: string;
  savedAt?: string;
  version?: number;
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
  return {};
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
