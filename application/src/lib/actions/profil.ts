"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/authz";
import { perbaruiProfil } from "@/lib/services/profil";
import { ServiceError } from "@/lib/services/units";

export interface ProfilState {
  error?: string;
}

// Yang diubah selalu akun milik sesi yang sedang berjalan — id pengguna tidak pernah diambil dari
// formulir, supaya tidak ada cara mengirimkan id orang lain.
export async function perbaruiProfilAction(
  _prev: ProfilState,
  formData: FormData
): Promise<ProfilState> {
  const ctx = await getCurrentAuthContext();
  if (!ctx) redirect("/login");

  try {
    await perbaruiProfil(ctx.userId, {
      name: String(formData.get("name") ?? ""),
      loginIdentifier: String(formData.get("loginIdentifier") ?? ""),
    });
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }

  revalidatePath("/profil");
  return {};
}
