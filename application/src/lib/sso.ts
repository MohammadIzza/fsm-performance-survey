import crypto from "node:crypto";

const SSO_API_URL = process.env.SSO_API_URL ?? "https://apps-fsm.undip.ac.id/sso_api";
const JWT_SECRET = process.env.JWT_SECRET as string;

// Tautan tombol "Login dengan SSO": client_id sudah terdaftar di sisi SSO khusus untuk
// redirect_uri ini (tanpa garis miring di akhir — lihat docs/pindah-server.md).
export const SSO_LOGIN_URL =
  "https://apps-fsm.undip.ac.id/sso?client_id=d52e4bb1-b345-478d-81cb-ce2b6256a335&redirect_uri=https://apps-fsm.undip.ac.id/survey";

export interface SsoIdentity {
  id: string;
  name: string;
  username: string; // email SSO, mis. "24060121130001@students.undip.ac.id"
  role: string;
}

export class SsoError extends Error {}

/** Memvalidasi token SSO ke /users/me. "Bearer " ditambahkan di sini — SSO mengirim token mentah. */
export async function fetchSsoIdentity(rawToken: string): Promise<SsoIdentity> {
  let res: Response;
  try {
    res = await fetch(`${SSO_API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${rawToken}` },
      cache: "no-store",
    });
  } catch {
    throw new SsoError("Tidak dapat menghubungi SSO.");
  }
  if (!res.ok) throw new SsoError("Token SSO tidak valid.");

  let body: { status?: boolean; data?: SsoIdentity };
  try {
    body = await res.json();
  } catch {
    throw new SsoError("Respons SSO tidak terduga.");
  }
  if (!body?.status || !body.data?.id) throw new SsoError("Respons SSO tidak terduga.");
  return body.data;
}

/** Bagian sebelum "@" pada email SSO — dicocokkan ke id_login (NIP/NIM/nama pengguna, Bab 5.2). */
export function loginIdentifierFromEmail(email: string): string | null {
  const at = email.indexOf("@");
  if (at <= 0) return null;
  return email.slice(0, at);
}

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Token antar-server berumur pendek (5 menit): dari endpoint SSO ke halaman callback, lewat
 * peramban pengguna sebagai query string. Format JWT HS256 ditulis tangan (tanpa pustaka
 * `jsonwebtoken`) karena hanya dipakai dan diverifikasi oleh aplikasi ini sendiri.
 */
export function signHandoffToken(userId: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 300 }));
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/** Mengembalikan userId bila token sah dan belum kedaluwarsa, selain itu null. */
export function verifyHandoffToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;

  const expected = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
  const sigBuf = Buffer.from(signature, "base64url");
  const expBuf = Buffer.from(expected, "base64url");
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  let data: { sub?: string; exp?: number };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!data.sub || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
  return data.sub;
}
