"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActor } from "@/lib/authz";
import {
  createObjectGroup,
  updateObjectGroup,
  deleteObjectGroup,
  type ObjectGroupInput,
} from "@/lib/services/objectGroups";
import { ServiceError } from "@/lib/services/units";

export interface FormState {
  error?: string;
}

function baca(formData: FormData): ObjectGroupInput {
  return {
    name: String(formData.get("name") ?? ""),
    description: (formData.get("description") as string) || null,
    objectIds: formData.getAll("objectIds").map(String).filter(Boolean),
  };
}

export async function createObjectGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  try {
    await createObjectGroup(baca(formData), actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/objek");
  return {};
}

export async function updateObjectGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const groupId = String(formData.get("groupId") ?? "");
  try {
    await updateObjectGroup(groupId, baca(formData), actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/objek");
  return {};
}

export async function deleteObjectGroupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  try {
    // TombolHapus mengirim id lewat medan bernama "id".
    await deleteObjectGroup(String(formData.get("id") ?? ""), actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/objek");
  return {};
}
