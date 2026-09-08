"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActor, getCurrentAuthContext } from "@/lib/authz";
import {
  createPeriod,
  updatePeriodSettings,
  setAccessPolicy,
  transitionPeriodStatus,
  copyPeriod,
} from "@/lib/services/periods";
import { ServiceError } from "@/lib/services/units";
import type { AccessMode, PeriodStatus } from "@/generated/prisma/enums";

export interface FormState {
  error?: string;
}

function readPeriodInput(formData: FormData) {
  return {
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: (formData.get("description") as string) || null,
    timezone: String(formData.get("timezone") ?? "Asia/Jakarta"),
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
  };
}

export async function createPeriodAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  try {
    await createPeriod(readPeriodInput(formData), actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/periode");
  return {};
}

export async function updatePeriodSettingsAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const periodId = String(formData.get("periodId") ?? "");
  try {
    await updatePeriodSettings(periodId, readPeriodInput(formData), actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/periode/${periodId}`);
  return {};
}

// Bab 4.1/4.3: Admin atau Dekan yang dapat mengatur waktu akses hasil.
export async function setAccessPolicyAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const ctx = await getCurrentAuthContext();
  if (!ctx || (!ctx.isAdmin && !ctx.isDekan)) {
    return { error: "Tidak berwenang." };
  }
  const periodId = String(formData.get("periodId") ?? "");
  const availableAtRaw = String(formData.get("availableAt") ?? "");
  try {
    await setAccessPolicy(
      periodId,
      {
        mode: String(formData.get("mode") ?? "") as AccessMode,
        availableAt: availableAtRaw || null,
        expectedVersion: Number(formData.get("expectedVersion") ?? 0),
      },
      ctx
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/periode/${periodId}`);
  return {};
}

export async function transitionPeriodStatusAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const periodId = String(formData.get("periodId") ?? "");
  const targetStatus = String(formData.get("targetStatus") ?? "") as PeriodStatus;
  const reason = (formData.get("reason") as string) || undefined;
  try {
    await transitionPeriodStatus(periodId, targetStatus, actor, reason);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/periode/${periodId}`);
  revalidatePath("/admin/periode");
  return {};
}

export async function copyPeriodAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const sourcePeriodId = String(formData.get("sourcePeriodId") ?? "");
  try {
    await copyPeriod(
      sourcePeriodId,
      {
        code: String(formData.get("code") ?? ""),
        name: String(formData.get("name") ?? ""),
        startsAt: String(formData.get("startsAt") ?? ""),
        endsAt: String(formData.get("endsAt") ?? ""),
      },
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/periode");
  return {};
}
