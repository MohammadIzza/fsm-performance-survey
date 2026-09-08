"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActor } from "@/lib/authz";
import { calculateResults } from "@/lib/services/calculations";
import { ServiceError } from "@/lib/services/units";

export interface FormState {
  error?: string;
}

export async function calculateResultsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const categoryId = String(formData.get("categoryId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  try {
    await calculateResults(categoryId, actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/periode/${periodId}/kategori/${categoryId}/hasil`);
  return {};
}
