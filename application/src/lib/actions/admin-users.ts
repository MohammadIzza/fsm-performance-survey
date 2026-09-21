"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActor } from "@/lib/authz";
import {
  createUser,
  updateUser,
  setUserActive,
  createUserType,
} from "@/lib/services/users";
import { ServiceError } from "@/lib/services/units";

export interface FormState {
  error?: string;
}

function readUserInput(formData: FormData) {
  const primaryUnitIdRaw = String(formData.get("primaryUnitId") ?? "");
  const emailRaw = String(formData.get("email") ?? "").trim();
  return {
    loginIdentifier: String(formData.get("loginIdentifier") ?? ""),
    name: String(formData.get("name") ?? ""),
    email: emailRaw === "" ? null : emailRaw,
    userTypeId: String(formData.get("userTypeId") ?? ""),
    primaryUnitId: primaryUnitIdRaw === "" ? null : primaryUnitIdRaw,
    kataSandi: String(formData.get("kataSandi") ?? ""),
    hapusKataSandi: formData.get("hapusKataSandi") === "on",
  };
}

export async function createUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  try {
    await createUser(readUserInput(formData), actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/pengguna");
  return {};
}

export async function updateUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const userId = String(formData.get("userId") ?? "");
  try {
    await updateUser(userId, readUserInput(formData), actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/pengguna");
  return {};
}

export async function createUserTypeAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  try {
    await createUserType(
      { code: String(formData.get("code") ?? ""), name: String(formData.get("name") ?? "") },
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin/pengguna");
  return {};
}

export async function setUserActiveAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const userId = String(formData.get("userId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  // Tombol nonaktifkan akun sendiri sudah disembunyikan di UI; ServiceError di sini
  // dibiarkan naik sebagai error tak terduga agar tidak gagal senyap.
  await setUserActive(userId, active, actor);
  revalidatePath("/admin/pengguna");
}
