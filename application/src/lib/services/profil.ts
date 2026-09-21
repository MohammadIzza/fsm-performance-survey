import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";

/**
 * Yang boleh diubah sendiri oleh pemilik akun — sengaja hanya dua.
 *
 * Unit tidak ikut: unit utama menentukan siapa yang terjaring sebagai calon penilai objek sebuah
 * unit (lihat pemilihan `poolUserIds` di services/assignmentPlanning.ts), jadi memilihnya sendiri
 * sama dengan memasukkan diri ke kolam penilai unit mana pun. Email dan jenis pengguna juga tidak:
 * keduanya datang dari SSO dan dipakai mencocokkan akun, bukan data yang diisi orang.
 */
export interface ProfilInput {
  name: string;
  loginIdentifier: string;
}

export async function perbaruiProfil(userId: string, input: ProfilInput) {
  const before = await prisma.user.findUnique({ where: { id: userId } });
  if (!before) throw new ServiceError("Pengguna tidak ditemukan.");

  const name = input.name.trim();
  // Bab 5.2: nomor induk disimpan sebagai teks — nol di depan tidak boleh hilang, jadi hanya
  // spasi tepinya yang dipangkas.
  const loginIdentifier = input.loginIdentifier.trim();

  if (!name) throw new ServiceError("Nama wajib diisi.");
  if (!loginIdentifier) throw new ServiceError("NIM atau NIP wajib diisi.");
  if (loginIdentifier.length > 64) throw new ServiceError("NIM atau NIP terlalu panjang.");

  if (loginIdentifier !== before.loginIdentifier) {
    const dipakai = await prisma.user.findUnique({ where: { loginIdentifier } });
    if (dipakai) {
      throw new ServiceError(
        "NIM atau NIP itu sudah tercatat pada akun lain. Periksa kembali, atau hubungi admin bila itu memang milik Anda."
      );
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name, loginIdentifier },
  });

  await writeAudit({
    actorId: userId,
    actorRole: "PENGGUNA",
    action: "USER_PROFILE_UPDATE",
    entity: "User",
    entityId: userId,
    before,
    after: user,
    reason: "Diisi sendiri oleh pemilik akun lewat halaman Profil.",
  });

  return user;
}

/** Data profil beserta bagian yang hanya bisa diubah admin, untuk ditampilkan apa adanya. */
export async function ambilProfil(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { userType: true, primaryUnit: true },
  });
}
