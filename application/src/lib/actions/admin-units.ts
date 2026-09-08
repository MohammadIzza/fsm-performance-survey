"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActor } from "@/lib/authz";
import { createUnit, updateUnit, setUnitActive, ServiceError } from "@/lib/services/units";

export interface FormState {
  error?: string;
}

function readUnitInput(formData: FormData) {
  const parentIdRaw = String(formData.get("parentId") ?? "");
  return {
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
    parentId: parentIdRaw === "" ? null : parentIdRaw,
  };
}

export async function createUnitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  try {
    await createUnit(readUnitInput(formData), actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/organisasi");
  return {};
}

export async function updateUnitAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const unitId = String(formData.get("unitId") ?? "");
  try {
    await updateUnit(unitId, readUnitInput(formData), actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/organisasi");
  return {};
}

export async function setUnitActiveAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const unitId = String(formData.get("unitId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  await setUnitActive(unitId, active, actor);
  revalidatePath("/admin/organisasi");
}
