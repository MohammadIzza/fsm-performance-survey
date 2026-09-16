"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActor } from "@/lib/authz";
import { updateAssignmentRule } from "@/lib/services/assignmentRules";
import { computePlan, commitPlan, type AssignmentPlan } from "@/lib/services/assignmentPlanning";
import { manualAssignEvaluator, cancelAssignment } from "@/lib/services/assignments";
import { createSeed } from "@/lib/prng";
import { ServiceError } from "@/lib/services/units";
import type { AssessmentGroup, AssignmentScope } from "@/generated/prisma/enums";

export interface FormState {
  error?: string;
}

export interface PreviewState {
  error?: string;
  plan?: AssignmentPlan;
  committed?: boolean;
}

export async function updateAssignmentRuleAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const ruleId = String(formData.get("ruleId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const userTypeIds = formData.getAll("userTypeIds").map(String).filter(Boolean);
  try {
    await updateAssignmentRule(
      ruleId,
      { scope: String(formData.get("scope") ?? "UNIT_OBJEK") as AssignmentScope, userTypeIds },
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/periode/${periodId}/kategori/${categoryId}`);
  return {};
}

export async function previewAssignmentPlanAction(
  _prev: PreviewState,
  formData: FormData
): Promise<PreviewState> {
  await requireAdminActor();
  const categoryId = String(formData.get("categoryId") ?? "");
  try {
    const seed = createSeed();
    const plan = await computePlan(categoryId, seed);
    return { plan };
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
}

export async function commitAssignmentPlanAction(
  _prev: PreviewState,
  formData: FormData
): Promise<PreviewState> {
  const actor = await requireAdminActor();
  const categoryId = String(formData.get("categoryId") ?? "");
  const seed = String(formData.get("seed") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  try {
    const fingerprint=String(formData.get("fingerprint")??"");
    if(!fingerprint) throw new ServiceError("Jalankan pratinjau sebelum menerapkan.");
    await commitPlan(categoryId, seed, actor, fingerprint, String(formData.get("reason") ?? ""));
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/periode/${periodId}/kategori/${categoryId}`);
  revalidatePath(`/admin/periode/${periodId}`);
  return { committed: true };
}

export async function manualAssignEvaluatorAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  try {
    await manualAssignEvaluator(
      {
        categoryObjectId: String(formData.get("categoryObjectId") ?? ""),
        group: String(formData.get("group") ?? "") as AssessmentGroup,
        evaluatorId: String(formData.get("evaluatorId") ?? ""),
        reason: String(formData.get("reason") ?? ""),
      },
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/periode/${periodId}/kategori/${categoryId}`);
  return {};
}

export async function cancelAssignmentAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  try {
    await cancelAssignment(assignmentId, reason, actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/periode/${periodId}/kategori/${categoryId}`);
  return {};
}
