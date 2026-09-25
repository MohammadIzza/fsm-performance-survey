/**
 * Menghapus unit yang dibuat untuk keperluan uji coba, beserta sisa riwayat jabatan di dalamnya.
 *
 * Bawaannya HANYA MENCETAK RENCANA. Tidak ada yang dihapus sampai ditambahkan `--terapkan`.
 *
 *   npx tsx --env-file=.env scripts/hapus-unit-uji.ts
 *   npx tsx --env-file=.env scripts/hapus-unit-uji.ts --terapkan
 *
 * Aplikasi menolak menghapus unit yang masih punya riwayat jabatan pimpinan, dan memang tidak
 * menyediakan cara menghapus riwayat itu — jabatan hanya bisa diakhiri, supaya rekam jejaknya
 * tetap utuh. Untuk unit uji yang memang hendak dilenyapkan, riwayatnya dihapus di sini lebih
 * dulu, dan penghapusannya sendiri tercatat di jejak audit.
 *
 * Unit yang masih punya sub-unit, pengguna, atau objek penilaian tetap ditolak: kalau itu terjadi,
 * datanya harus dipindahkan dulu, bukan dipaksa hilang.
 */
import { atomic, prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authz";
import { writeAudit } from "@/lib/services/audit";
import { deleteUnit } from "@/lib/services/penghapusan";

const TERAPKAN = process.argv.includes("--terapkan");

/** Kode unit yang hendak dihapus. Sengaja ditulis tetap, bukan dari argumen baris perintah. */
const KODE = ["TES", "UNIT-KOSONG"];

async function jalankan() {
  console.log(`\nMODE: ${TERAPKAN ? "TERAPKAN" : "RENCANA (tidak menghapus apa pun)"}`);

  const unit = await prisma.unit.findMany({
    where: { code: { in: KODE } },
    include: {
      _count: { select: { children: true, usersPrimary: true, ownedObjects: true, referencedByObjects: true } },
      leaderships: { include: { user: { select: { name: true } } } },
    },
  });

  const tidakAda = KODE.filter((k) => !unit.some((u) => u.code === k));
  for (const k of tidakAda) console.log(`  ${k}: tidak ada (mungkin sudah terhapus).`);

  const aman: typeof unit = [];
  for (const u of unit) {
    const c = u._count;
    const isi = c.children + c.usersPrimary + c.ownedObjects + c.referencedByObjects;
    console.log(`\n  ${u.code} — ${u.name}`);
    console.log(
      `    sub-unit ${c.children}, pengguna ${c.usersPrimary}, objek ${c.ownedObjects + c.referencedByObjects}, riwayat jabatan ${u.leaderships.length}`
    );
    for (const l of u.leaderships) {
      console.log(`    riwayat jabatan ikut dihapus: ${l.user.name} sebagai ${l.title}`);
    }
    if (isi > 0) {
      console.log(`    DITOLAK: masih ada isinya, pindahkan dulu.`);
      continue;
    }
    aman.push(u);
  }

  if (!TERAPKAN || aman.length === 0) return;

  const admin = await prisma.user.findFirst({ where: { ssoRole: "superadmin" }, select: { id: true } });
  const aktor = admin ? await getAuthContext(admin.id) : null;
  if (!aktor) throw new Error("Akun admin tidak ditemukan; jejak audit butuh pelakunya.");

  await atomic(async () => {
    for (const u of aman) {
      for (const l of u.leaderships) {
        await prisma.leadership.delete({ where: { id: l.id } });
        await writeAudit({
          actorId: aktor.userId,
          actorRole: "ADMIN",
          action: "LEADERSHIP_DELETE",
          entity: "Leadership",
          entityId: l.id,
          before: l,
          reason: `Unit uji ${u.code} dihapus.`,
        });
      }
      await deleteUnit(u.id, aktor);
      console.log(`  dihapus: ${u.code} — ${u.name}`);
    }
  });
}

jalankan()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
