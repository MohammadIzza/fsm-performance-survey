import { NextRequest, NextResponse } from "next/server";
import { fetchSsoIdentity, signHandoffToken, SsoError } from "@/lib/sso";
import { resolveSsoUser } from "@/lib/services/ssoUsers";

// Dipanggil server-ke-server oleh SSO FSM, bukan dari peramban pengguna — belum ada sesi apa pun
// di sini, jadi rute ini sengaja publik (di luar (app), tidak ada guard sesi).
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

  const user = await resolveSsoUser(identity);

  // Akun yang dinonaktifkan admin tetap tertutup, walau identitas SSO-nya sah.
  if (!user.active) {
    return NextResponse.json({ message: "Akun ini dinonaktifkan. Hubungi admin aplikasi." }, { status: 403 });
  }

  const token = signHandoffToken(user.id);
  return NextResponse.json({ callback_url: `/sso/callback?token=${token}` });
}
