"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActor } from "@/lib/authz";
import { finalizePeriod, openRevision } from "@/lib/services/finalization";
import { ServiceError } from "@/lib/services/units";

export interface FormState {
  error?: string;
}

export async function finalizePeriodAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const periodId = String(formData.get("periodId") ?? "");
  const note = String(formData.get("note") ?? "");
  try {
    await finalizePeriod(periodId, note, actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/periode/${periodId}`);
  revalidatePath("/admin/periode");
  return {};
}

export async function openRevisionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const periodId = String(formData.get("periodId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  try {
    await openRevision(periodId, reason, actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/periode/${periodId}`);
  revalidatePath("/admin/periode");
  return {};
}
