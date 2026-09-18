"use server";
import { beginInstrumentRevision } from "@/lib/services/instruments";

import { revalidatePath } from "next/cache";
import { requireAdminActor } from "@/lib/authz";
import {
  addParameter,
  updateParameter,
  deleteParameter,
  updateInstrumentScale,
  duplicateInstrumentFrom,
} from "@/lib/services/instruments";
import { updateCombinedWeight, updateGroupRule } from "@/lib/services/groupRules";
import { ServiceError } from "@/lib/services/units";
import type { AggregationMethod } from "@/generated/prisma/enums";

export interface FormState {
  error?: string;
}

function revalidateCategory(periodId: string, categoryId: string) {
  revalidatePath(`/admin/periode/${periodId}`);
  revalidatePath(`/admin/periode/${periodId}/kategori/${categoryId}`);
}

export async function addParameterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const instrumentVersionId = String(formData.get("instrumentVersionId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  try {
    await addParameter(
      instrumentVersionId,
      {
        name: String(formData.get("name") ?? ""),
        indicator: (formData.get("indicator") as string) || null,
        weight: Number(formData.get("weight") ?? 0),
        normalized: formData.get("normalized") === "on",
      },
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidateCategory(periodId, categoryId);
  return {};
}

export async function updateParameterAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const parameterId = String(formData.get("parameterId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  try {
    await updateParameter(
      parameterId,
      {
        name: String(formData.get("name") ?? ""),
        indicator: (formData.get("indicator") as string) || null,
        weight: Number(formData.get("weight") ?? 0),
        normalized: formData.get("normalized") === "on",
      },
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidateCategory(periodId, categoryId);
  return {};
}

export async function deleteParameterAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const parameterId = String(formData.get("parameterId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  await deleteParameter(parameterId, actor);
  revalidateCategory(periodId, categoryId);
}

export async function updateInstrumentScaleAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const instrumentVersionId = String(formData.get("instrumentVersionId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  try {
    await updateInstrumentScale(
      instrumentVersionId,
      {
        scaleMin: Number(formData.get("scaleMin") ?? 0),
        scaleMax: Number(formData.get("scaleMax") ?? 100),
        scaleStep: Number(formData.get("scaleStep") ?? 1),
        guide: (formData.get("guide") as string) || null,
      },
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidateCategory(periodId, categoryId);
  return {};
}

export async function duplicateInstrumentAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const instrumentVersionId = String(formData.get("instrumentVersionId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const sourceCategoryId = String(formData.get("sourceCategoryId") ?? "");
  if (!sourceCategoryId) return { error: "Pilih kategori sumber." };
  try {
    await duplicateInstrumentFrom(instrumentVersionId, sourceCategoryId, actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidateCategory(periodId, categoryId);
  return {};
}

export async function updateGroupRuleAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const groupRuleId = String(formData.get("groupRuleId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  try {
    await updateGroupRule(
      groupRuleId,
      {
        aggregation: String(formData.get("aggregation") ?? "RATA_RATA") as AggregationMethod,
        target: Number(formData.get("target") ?? 0),
        minimum: Number(formData.get("minimum") ?? 1),
        expectedRevision:Number(formData.get("expectedRevision")??0),
        tieBreakParameterIds:formData.getAll("tieBreakParameterIds").map(String),
      },
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidateCategory(periodId, categoryId);
  return {};
}

export async function updateCombinedWeightAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const aktif = formData.get("gabung") === "on";
  const bobot = Number(formData.get("pimpinanWeight") ?? "");
  try {
    await updateCombinedWeight(categoryId, aktif ? bobot : null, actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidateCategory(periodId, categoryId);
  return {};
}

export async function beginInstrumentRevisionAction(_prev:FormState,form:FormData):Promise<FormState>{
 const actor=await requireAdminActor();
 const categoryId=String(form.get("categoryId")??"");const periodId=String(form.get("periodId")??"");
 try{await beginInstrumentRevision(categoryId,String(form.get("reason")??""),String(form.get("correctionEndsAt")??"")+"+07:00",actor)}catch(e){if(e instanceof ServiceError)return {error:e.message};throw e}
 revalidateCategory(periodId,categoryId);return {};
}
