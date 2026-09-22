"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActor } from "@/lib/authz";
import { grantRole, revokeRole } from "@/lib/services/roleGrants";
import { ServiceError } from "@/lib/services/units";
import type { SystemRole } from "@/generated/prisma/enums";

export interface FormState {
  error?: string;
}

export async function grantRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as SystemRole;
  try {
    await grantRole(userId, role, actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/pengguna");
  return {};
}

export async function revokeRoleAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const grantId = String(formData.get("grantId") ?? "");
  try {
    await revokeRole(grantId, actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/pengguna");
  return {};
}
