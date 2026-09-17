"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminActor } from "@/lib/authz";
import { ServiceError } from "@/lib/services/units";
import {
  deleteCategory,
  deleteObject,
  deleteObjectType,
  deletePeriod,
  deleteUnit,
  deleteUser,
  deleteUserType,
  renameObjectType,
  renameUserType,
} from "@/lib/services/penghapusan";

export interface FormState {
  error?: string;
}

const id = (fd: FormData) => String(fd.get("id") ?? "");

async function jalankan(kerja: () => Promise<unknown>, jalur: string[]): Promise<FormState> {
  try {
    await kerja();
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  for (const j of jalur) revalidatePath(j);
  return {};
}

export async function deleteUnitAction(_p: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  return jalankan(() => deleteUnit(id(fd), actor), ["/admin/organisasi"]);
}

export async function deleteUserAction(_p: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  return jalankan(() => deleteUser(id(fd), actor), ["/admin/pengguna"]);
}

export async function deleteObjectAction(_p: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  return jalankan(() => deleteObject(id(fd), actor), ["/admin/objek"]);
}

export async function renameUserTypeAction(_p: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  return jalankan(() => renameUserType(id(fd), String(fd.get("name") ?? ""), actor), ["/admin/pengguna"]);
}

export async function deleteUserTypeAction(_p: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  return jalankan(() => deleteUserType(id(fd), actor), ["/admin/pengguna"]);
}

export async function renameObjectTypeAction(_p: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  return jalankan(() => renameObjectType(id(fd), String(fd.get("name") ?? ""), actor), ["/admin/objek"]);
}

export async function deleteObjectTypeAction(_p: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  return jalankan(() => deleteObjectType(id(fd), actor), ["/admin/objek"]);
}

export async function deleteCategoryAction(_p: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  let periodId = "";
  const hasil = await jalankan(async () => {
    periodId = await deleteCategory(id(fd), actor);
  }, []);
  if (hasil.error) return hasil;
  revalidatePath(`/admin/periode/${periodId}`);
  redirect(`/admin/periode/${periodId}`);
}

export async function deletePeriodAction(_p: FormState, fd: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const hasil = await jalankan(() => deletePeriod(id(fd), actor), ["/admin/periode"]);
  if (hasil.error) return hasil;
  redirect("/admin/periode");
}
