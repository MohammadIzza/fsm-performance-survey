import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { verifyHandoffToken } from "@/lib/sso";
import { withBase } from "@/lib/base-path";

// Tujuan window.location.replace(redirect_uri + callback_url) dari SSO — di sinilah sesi lokal
// (cookie httpOnly survey_fsm_session, sama seperti loginAction) benar-benar diterbitkan, karena
// respons /api/auth/sso tadi tidak pernah sampai ke peramban pengguna.
//
// withBase() dipakai eksplisit: berbeda dari redirect() di Server Component/Action, redirect() di
// Route Handler TIDAK memprefiks basePath sendiri (diverifikasi: tanpa ini Location jadi
// "/login", bukan "/survey/login" — lolos lewat penampung nginx tapi salah di gateway UNDIP yang
// hanya meneruskan awalan /survey/).
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const userId = token ? verifyHandoffToken(token) : null;
  if (!userId) redirect(withBase("/login?error=sso"));

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) redirect(withBase("/login?error=sso"));

  const session = await getSession();
  session.userId = user.id;
  session.loginIdentifier = user.loginIdentifier;
  await session.save();

  redirect(withBase("/dashboard"));
}
