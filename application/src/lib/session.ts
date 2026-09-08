import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";

export interface SessionData {
  userId?: string;
  loginIdentifier?: string;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "survei_fsm_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
