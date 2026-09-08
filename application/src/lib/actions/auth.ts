"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

const loginSchema = z.object({
  loginIdentifier: z
    .string()
    .trim()
    .min(1, "ID wajib diisi.")
    .max(64, "ID terlalu panjang."),
});

export interface LoginState {
  error?: string;
}

// AUTH-01/AUTH-02: verifikasi ID terdaftar dan akun aktif; ID diperlakukan sebagai teks
// (normalisasi hanya memangkas spasi tepi, tidak mengubah nol awal atau kapitalisasi).
export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    loginIdentifier: formData.get("loginIdentifier"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ID tidak valid." };
  }

  const user = await prisma.user.findUnique({
    where: { loginIdentifier: parsed.data.loginIdentifier },
  });

  if (!user || !user.active) {
    return { error: "ID tidak terdaftar atau akun tidak aktif." };
  }

  const session = await getSession();
  session.userId = user.id;
  session.loginIdentifier = user.loginIdentifier;
  await session.save();

  redirect("/dashboard");
}

// AUTH-04: logout mengakhiri sesi dan menghapus data privat dari cache sesi.
export async function logoutAction(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
