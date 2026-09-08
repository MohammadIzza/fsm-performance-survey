"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActor } from "@/lib/authz";
import { createObject, updateObject, setObjectActive, type ObjectInput } from "@/lib/services/objects";
import { createObjectType } from "@/lib/services/objectTypes";
import { ServiceError } from "@/lib/services/units";

export interface FormState {
  error?: string;
}

function readObjectInput(formData: FormData): ObjectInput {
  const referenceUserId = String(formData.get("referenceUserId") ?? "");
  const referenceUnitId = String(formData.get("referenceUnitId") ?? "");
  const responsibleUserId = String(formData.get("responsibleUserId") ?? "");
  return {
    typeId: String(formData.get("typeId") ?? ""),
    name: String(formData.get("name") ?? ""),
    ownerUnitId: String(formData.get("ownerUnitId") ?? ""),
    referenceUserId: referenceUserId || null,
    referenceUnitId: referenceUnitId || null,
    responsibleUserId: responsibleUserId || null,
    url: (formData.get("url") as string) || null,
    description: (formData.get("description") as string) || null,
    contributorUserIds: formData.getAll("contributorUserIds").map(String).filter(Boolean),
  };
}

export async function createObjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  try {
    await createObject(readObjectInput(formData), actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/objek");
  return {};
}

export async function updateObjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const objectId = String(formData.get("objectId") ?? "");
  try {
    await updateObject(objectId, readObjectInput(formData), actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/objek");
  return {};
}

export async function setObjectActiveAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const objectId = String(formData.get("objectId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  await setObjectActive(objectId, active, actor);
  revalidatePath("/admin/objek");
}

export async function createObjectTypeAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  try {
    await createObjectType(
      { code: String(formData.get("code") ?? ""), name: String(formData.get("name") ?? "") },
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/objek");
  return {};
}
