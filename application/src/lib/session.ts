import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { BASE_PATH } from "@/lib/base-path";

export interface SessionData {
  userId?: string;
  loginIdentifier?: string;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  // Domain gateway (apps-fsm.undip.ac.id) dipakai bersama aplikasi lain, jadi cookie sesi dibatasi ke
  // awalan aplikasi ini dan bernama khas. Namanya sengaja baru, bukan survei_fsm_session: cookie lama
  // ber-path "/" masih tersimpan di peramban pengguna fsm.heyizza.my.id dan akan ikut terkirim ke
  // /survey — dengan nama yang sama, keluar (logout) hanya menghapus salah satunya.
  cookieName: "survey_fsm_session",
  cookieOptions: {
    path: BASE_PATH || "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
