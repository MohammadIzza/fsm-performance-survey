import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { loginIdentifierFromEmail, type SsoIdentity } from "@/lib/sso";

/**
 * Domain email → kode jenis pengguna.
 *
 * Domain dipakai, bukan field `role`, karena domain itulah satu-satunya penentu yang dipakai SSO
 * sendiri saat membuat akun — sedangkan `role` bisa ditimpa menjadi "superadmin" (peran platform
 * SSO) sehingga jenis aslinya hilang. Domain di luar daftar ini bernilai "unknown" di SSO dan
 * tetap boleh masuk sebagai pengguna biasa, bukan sebagai kesalahan.
 *
 * Peran istimewa aplikasi (Admin, Dekan) TIDAK PERNAH diberikan dari data SSO — hanya lewat
 * role_grants yang diatur admin (Bab 4.2: "Login tidak boleh menerima peran ... yang diklaim
 * sendiri").
 */
const JENIS_DARI_DOMAIN: Record<string, string> = {
  "students.undip.ac.id": "MAHASISWA",
  "lecturer.undip.ac.id": "DOSEN",
  "staff.undip.ac.id": "TENDIK",
};

const JENIS_LAIN = "LAINNYA";

export class SsoUserError extends Error {}

function domainDariEmail(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 0 ? "" : email.slice(at + 1).toLowerCase();
}

/**
 * Menemukan — atau membuat — akun Survei milik sebuah identitas SSO.
 *
 * Urutan pencarian penting: akun yang sudah diimpor admin selalu didahulukan daripada membuat akun
 * baru, supaya penugasan penilaian yang sudah melekat pada orang itu tidak tertinggal di akun lama.
 */
export async function resolveSsoUser(identity: SsoIdentity): Promise<User> {
  // `username` dari SSO tidak selalu alamat email, walau dokumennya menyebut begitu: akun
  // "adminfakultas" mengirimkannya tanpa @ sama sekali. Yang tanpa @ tidak boleh mendarat di kolom
  // email — kolom itu dipakai mencocokkan akun dan harus berisi alamat sungguhan.
  const username = identity.username.trim().toLowerCase();
  const email = username.includes("@") ? username : null;

  const linked = await prisma.user.findUnique({ where: { ssoId: identity.id } });
  if (linked) return sinkronkanEmail(linked, email);

  // Email yang sudah diisi admin (satu-satunya cara mencocokkan dosen dan tendik, karena NIP
  // mereka tidak ada di SSO).
  const lewatEmail = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (lewatEmail && !lewatEmail.ssoId) {
    return prisma.user.update({ where: { id: lewatEmail.id }, data: { ssoId: identity.id } });
  }

  // Bagian sebelum @ kadang berupa NIM sehingga cocok dengan id_login hasil impor — tetapi tidak
  // selalu: akun mahasiswa sungguhan pun ada yang beralamat nama@students.undip.ac.id. Karena itu
  // pencocokan ini percobaan, bukan andalan; nomor induk yang benar diisi pemiliknya di Profil.
  const candidate = email ? loginIdentifierFromEmail(email) : null;
  if (candidate) {
    const lewatId = await prisma.user.findUnique({ where: { loginIdentifier: candidate } });
    if (lewatId && !lewatId.ssoId) {
      return prisma.user.update({
        where: { id: lewatId.id },
        data: { ssoId: identity.id, email: lewatId.email ?? email },
      });
    }
    // Bila id_login itu sudah tertaut ke identitas SSO lain, ini orang yang berbeda — akun baru
    // di bawah memakai nama pengguna dari SSO sebagai id_login supaya tidak bertabrakan.
  }

  return buatDariSso(identity, username, email, candidate);
}

/** Email SSO adalah sumber yang lebih baru daripada isian admin; disimpan bila berubah. */
async function sinkronkanEmail(user: User, email: string | null): Promise<User> {
  if (!email || user.email === email) return user;
  return prisma.user.update({ where: { id: user.id }, data: { email } });
}

async function buatDariSso(
  identity: SsoIdentity,
  username: string,
  email: string | null,
  candidate: string | null
): Promise<User> {
  const code = email ? (JENIS_DARI_DOMAIN[domainDariEmail(email)] ?? JENIS_LAIN) : JENIS_LAIN;
  const userType = await prisma.userType.findUnique({ where: { code } });
  if (!userType) throw new SsoUserError(`Jenis pengguna "${code}" belum ada di database.`);

  const terpakai = candidate
    ? await prisma.user.findUnique({ where: { loginIdentifier: candidate } })
    : null;
  // Nomor induk yang sebenarnya belum diketahui di sini — SSO tidak memberikannya. Nama pengguna
  // dipakai sementara sebagai id_login supaya barisnya punya kunci yang unik; pemiliknya yang
  // menggantinya dengan NIM/NIP lewat halaman Profil.
  const loginIdentifier = candidate && !terpakai ? candidate : username;

  const user = await prisma.user.create({
    data: {
      loginIdentifier,
      name: identity.name,
      email: email || null,
      userTypeId: userType.id,
      ssoId: identity.id,
      // Unit sengaja kosong: SSO tidak menyimpan program studi maupun departemen (NULL untuk
      // seluruh akunnya). Admin menetapkannya lewat halaman Pengguna sebelum orang ini bisa
      // ditugaskan menilai.
      primaryUnitId: null,
    },
  });

  await writeAudit({
    actorId: user.id,
    actorRole: "SSO",
    action: "USER_CREATE",
    entity: "User",
    entityId: user.id,
    after: { loginIdentifier, name: user.name, email: user.email, jenis: code, ssoId: identity.id },
    reason: "Pendaftaran otomatis saat login SSO pertama.",
  });

  return user;
}
