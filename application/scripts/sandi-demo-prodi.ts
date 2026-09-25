/**
 * Memberi kata sandi seragam kepada akun dummy satu program studi, supaya bisa dipakai masuk
 * lewat formulir (tanpa SSO) saat demonstrasi, perekaman panduan, dan UAT.
 *
 * Bawaannya HANYA MENCETAK RENCANA. Tidak ada yang diubah sampai ditambahkan `--terapkan`.
 *
 *   npx tsx --env-file=.env scripts/sandi-demo-prodi.ts PS-INFOR
 *   npx tsx --env-file=.env scripts/sandi-demo-prodi.ts PS-INFOR --terapkan
 *
 * Akun SSO dilewati: kata sandi tidak dipakai di sana dan tidak perlu ditambahkan.
 */
import { prisma } from "@/lib/prisma";
import { hashKataSandi } from "@/lib/password";

const TERAPKAN = process.argv.includes("--terapkan");
const KODE_UNIT = process.argv[2];
/** Sengaja seragam dan sepele: ini akun fiktif di lingkungan demonstrasi. */
const SANDI = "penilai2026";

async function jalankan() {
  if (!KODE_UNIT || KODE_UNIT.startsWith("--")) throw new Error("Sebutkan kode unit, mis. PS-INFOR.");
  const unit = await prisma.unit.findUnique({ where: { code: KODE_UNIT }, select: { id: true, name: true } });
  if (!unit) throw new Error(`Unit ${KODE_UNIT} tidak ada.`);

  const pengguna = await prisma.user.findMany({
    where: { primaryUnitId: unit.id, ssoId: null, active: true },
    select: { id: true, name: true, loginIdentifier: true },
    orderBy: { loginIdentifier: "asc" },
  });

  console.log(`\nMODE: ${TERAPKAN ? "TERAPKAN" : "RENCANA (tidak menulis apa pun)"}`);
  console.log(`\n== ${unit.name} (${KODE_UNIT}): ${pengguna.length} akun ==`);
  console.log(`   kata sandi: ${SANDI}`);
  for (const u of pengguna.slice(0, 5)) console.log(`   ${u.loginIdentifier} / ${u.name}`);
  if (pengguna.length > 5) console.log(`   … dan ${pengguna.length - 5} lainnya`);

  if (!TERAPKAN) return;
  // Satu hash dipakai ulang: scrypt mahal, dan semua akun ini memang berkata sandi sama.
  const hash = await hashKataSandi(SANDI);
  await prisma.user.updateMany({ where: { id: { in: pengguna.map((u) => u.id) } }, data: { passwordHash: hash } });
  console.log(`   diterapkan: ${pengguna.length} akun kini punya kata sandi.`);
}

jalankan()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
