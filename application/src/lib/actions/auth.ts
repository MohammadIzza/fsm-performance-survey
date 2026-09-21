"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { LOGIN_ID_AKTIF } from "@/lib/login-id";
import { cocokKataSandi, hashPengecoh } from "@/lib/password";

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
  // Penjagaan sesungguhnya ada di sini, bukan di halaman: menyembunyikan formulir tidak menutup
  // Server Action-nya — alamatnya tetap bisa dipanggil langsung tanpa membuka halaman login.
  if (!LOGIN_ID_AKTIF) {
    return { error: "Masuk dengan ID sudah ditutup. Gunakan tombol Login dengan SSO FSM." };
  }

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

// ---------------------------------------------------------------------------------------------
// Masuk dengan email/ID dan kata sandi — untuk akun yang dibuatkan admin bagi orang tanpa akun
// UNDIP. Akun tanpa kata sandi (semua akun SSO) tidak bisa masuk lewat jalur ini sama sekali.

const loginSandiSchema = z.object({
  identitas: z.string().trim().min(1, "Email atau ID wajib diisi.").max(254),
  kataSandi: z.string().min(1, "Kata sandi wajib diisi.").max(256),
});

// Batas percobaan per email/ID: 5 kali gagal dalam 15 menit, lalu dikunci sampai jendelanya habis.
// Disimpan di memori proses — cukup untuk satu layanan, dan hilang saat layanan dimulai ulang.
const BATAS_GAGAL = 5;
const JENDELA_MS = 15 * 60 * 1000;
const percobaan = new Map<string, { gagal: number; sejak: number }>();

function terkunci(kunci: string): boolean {
  const c = percobaan.get(kunci);
  if (!c) return false;
  if (Date.now() - c.sejak > JENDELA_MS) {
    percobaan.delete(kunci);
    return false;
  }
  return c.gagal >= BATAS_GAGAL;
}

function catatGagal(kunci: string) {
  const c = percobaan.get(kunci);
  if (!c || Date.now() - c.sejak > JENDELA_MS) percobaan.set(kunci, { gagal: 1, sejak: Date.now() });
  else c.gagal += 1;
}

export async function loginSandiAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSandiSchema.safeParse({
    identitas: formData.get("identitas"),
    kataSandi: formData.get("kataSandi"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Isian tidak valid." };

  const identitas = parsed.data.identitas;
  const kunci = identitas.toLowerCase();
  if (terkunci(kunci)) {
    return { error: "Terlalu banyak percobaan gagal. Coba lagi 15 menit lagi." };
  }

  // Email dicocokkan tanpa membedakan huruf besar; ID apa adanya (nol di depan tetap berarti).
  const user = await prisma.user.findFirst({
    where: identitas.includes("@") ? { email: kunci } : { loginIdentifier: identitas },
    omit: { passwordHash: false },
  });

  const hash = user?.passwordHash ?? (await hashPengecoh());
  const cocok = await cocokKataSandi(parsed.data.kataSandi, hash);

  // Satu pesan untuk semua kegagalan: email/ID tak dikenal, akun tanpa kata sandi, dan kata sandi
  // salah tampak sama bagi yang mencoba, supaya jalur ini tidak bisa dipakai menebak akun mana ada.
  if (!user || !user.passwordHash || !cocok) {
    catatGagal(kunci);
    return { error: "Email/ID atau kata sandi salah." };
  }
  if (!user.active) return { error: "Akun ini dinonaktifkan. Hubungi admin aplikasi." };

  percobaan.delete(kunci);
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
