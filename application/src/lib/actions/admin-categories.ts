"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActor } from "@/lib/authz";
import {
  createCategory,
  createCategoryFrom,
  updateCategory,
  setCategoryActive,
  addCategoryObjects,
  removeCategoryObject,
  type CategoryInput,
} from "@/lib/services/categories";
import { ServiceError } from "@/lib/services/units";

export interface FormState {
  error?: string;
}

function readCategoryInput(formData: FormData): CategoryInput {
  return {
    code: String(formData.get("code") ?? ""),
    name: String(formData.get("name") ?? ""),
    description: (formData.get("description") as string) || null,
    objectTypeId: String(formData.get("objectTypeId") ?? ""),
    excludeContributors: formData.get("excludeContributors") === "on",
  };
}

export async function createCategoryAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const periodId = String(formData.get("periodId") ?? "");
  const sourceCategoryId = String(formData.get("sourceCategoryId") ?? "");
  try {
    if (sourceCategoryId) {
      // Menyalin kategori lain: jenis objek, pertanyaan, dan aturannya ikut dari sumber, jadi
      // formulirnya hanya perlu nama (dan pilihan apakah objek pesertanya ikut disalin).
      await createCategoryFrom(
        periodId,
        sourceCategoryId,
        {
          code: String(formData.get("code") ?? ""),
          name: String(formData.get("name") ?? ""),
          description: (formData.get("description") as string) || null,
          includeObjects: formData.get("includeObjects") === "on",
        },
        actor
      );
    } else {
      await createCategory(periodId, readCategoryInput(formData), actor);
    }
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/periode/${periodId}`);
  return {};
}

export async function updateCategoryAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const categoryId = String(formData.get("categoryId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  try {
    await updateCategory(categoryId, readCategoryInput(formData), actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/periode/${periodId}/kategori/${categoryId}`);
  return {};
}

export async function setCategoryActiveAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const categoryId = String(formData.get("categoryId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  await setCategoryActive(categoryId, active, actor);
  revalidatePath(`/admin/periode/${periodId}`);
}

export async function addCategoryObjectsAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const categoryId = String(formData.get("categoryId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const objectIds = formData.getAll("objectIds").map(String).filter(Boolean);
  try {
    await addCategoryObjects(categoryId, objectIds, actor, String(formData.get("reason") ?? ""));
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath(`/admin/periode/${periodId}/kategori/${categoryId}`);
  return {};
}

export async function removeCategoryObjectAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const categoryObjectId = String(formData.get("categoryObjectId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  await removeCategoryObject(categoryObjectId, actor);
  revalidatePath(`/admin/periode/${periodId}/kategori/${categoryId}`);
}
