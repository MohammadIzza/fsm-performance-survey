import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchSsoIdentity, loginIdentifierFromEmail, signHandoffToken, SsoError } from "@/lib/sso";

// Dipanggil server-ke-server oleh SSO FSM, bukan dari peramban pengguna — belum ada sesi apa pun
// di sini, jadi rute ini sengaja publik (di luar (app), tidak ada guard sesi).
//
// Tidak pernah memberi peran dari data SSO (Bab 4.2: "Login tidak boleh menerima peran ... yang
// diklaim sendiri") — hanya menautkan sso_id ke akun yang sudah diimpor admin, lalu meneruskan
// peran yang memang sudah ada di database ini.
export async function GET(req: NextRequest) {
  const rawToken = req.headers.get("authorization");
  if (!rawToken) {
    return NextResponse.json({ message: "Token missing" }, { status: 400 });
  }

  let identity;
  try {
    identity = await fetchSsoIdentity(rawToken);
  } catch (err) {
    const message = err instanceof SsoError ? err.message : "Token SSO tidak valid.";
    return NextResponse.json({ message }, { status: 401 });
  }

  let user = await prisma.user.findUnique({ where: { ssoId: identity.id } });

  if (!user) {
    const candidate = loginIdentifierFromEmail(identity.username);
    if (candidate) {
      const match = await prisma.user.findUnique({ where: { loginIdentifier: candidate } });
      if (match?.ssoId === identity.id) {
        user = match;
      } else if (match && !match.ssoId) {
        user = await prisma.user.update({ where: { id: match.id }, data: { ssoId: identity.id } });
      }
      // match dengan sso_id lain yang sudah tertaut: bukan orang yang sama, jangan diloloskan.
    }
  }

  if (!user || !user.active) {
    return NextResponse.json(
      { message: "Akun ini belum terdaftar di Survei Penilaian FSM. Hubungi admin aplikasi." },
      { status: 403 }
    );
  }

  const token = signHandoffToken(user.id);
  return NextResponse.json({ callback_url: `/sso/callback?token=${token}` });
}
