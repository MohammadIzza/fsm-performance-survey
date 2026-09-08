"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActor } from "@/lib/authz";
import { assignLeadership, endLeadership } from "@/lib/services/leadership";
import { ServiceError } from "@/lib/services/units";

export interface FormState {
  error?: string;
}

export async function assignLeadershipAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  try {
    await assignLeadership(
      {
        userId: String(formData.get("userId") ?? ""),
        unitId: String(formData.get("unitId") ?? ""),
        title: String(formData.get("title") ?? ""),
        effectiveFrom: String(formData.get("effectiveFrom") ?? ""),
      },
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/organisasi");
  return {};
}

export async function endLeadershipAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const leadershipId = String(formData.get("leadershipId") ?? "");
  await endLeadership(leadershipId, actor);
  revalidatePath("/admin/organisasi");
}
