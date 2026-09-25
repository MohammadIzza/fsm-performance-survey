/**
 * Menyiapkan objek penilaian "Orang" untuk seluruh dosen satu program studi, lalu mengumpulkannya
 * dalam satu kelompok objek, supaya kategori seperti Dosen Favorit FSM bisa diisi sekaligus lewat
 * "Pilih cepat → Dari kelompok objek" (dipakai untuk perekaman panduan).
 *
 * Bawaannya HANYA MENCETAK RENCANA. Tidak ada yang diubah sampai ditambahkan `--terapkan`.
 *
 *   npx tsx --env-file=.env scripts/siapkan-objek-dosen-prodi.ts PS-INFOR
 *   npx tsx --env-file=.env scripts/siapkan-objek-dosen-prodi.ts PS-INFOR --terapkan
 *
 * Objek yang sudah menautkan akun dosen dengan nama yang sama dengan akunnya dipakai ulang.
 */
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authz";
import { createObject } from "@/lib/services/objects";
import { createObjectGroup, updateObjectGroup } from "@/lib/services/objectGroups";

const TERAPKAN = process.argv.includes("--terapkan");
const KODE_UNIT = process.argv[2];

async function jalankan() {
  if (!KODE_UNIT || KODE_UNIT.startsWith("--")) throw new Error("Sebutkan kode unit, mis. PS-INFOR.");
  const unit = await prisma.unit.findUnique({ where: { code: KODE_UNIT }, select: { id: true, name: true } });
  if (!unit) throw new Error(`Unit ${KODE_UNIT} tidak ada.`);
  const jenis = await prisma.objectType.findFirst({ where: { name: "Orang" }, select: { id: true } });
  if (!jenis) throw new Error("Jenis objek Orang tidak ada.");
  const admin = await prisma.user.findFirst({ where: { ssoRole: "superadmin" }, select: { id: true } });
  if (!admin) throw new Error("Akun admin tidak ada.");

  const dosen = await prisma.user.findMany({
    where: { primaryUnitId: unit.id, active: true, userType: { name: "Dosen" }, loginIdentifier: { startsWith: "dosen_" } },
    select: { id: true, name: true, loginIdentifier: true },
  });
  const urut = (s: string) => Number(/(\d+)$/.exec(s)?.[1] ?? 0);
  dosen.sort((a, b) => urut(a.loginIdentifier) - urut(b.loginIdentifier));

  const ada = await prisma.assessmentObject.findMany({
    where: { typeId: jenis.id, referenceUserId: { in: dosen.map((d) => d.id) } },
    select: { id: true, name: true, referenceUserId: true },
  });
  const namaKelompok = `Dosen ${unit.name}`;
  const kelompok = await prisma.objectGroup.findFirst({ where: { name: namaKelompok }, select: { id: true } });

  const rencana = dosen.map((d) => ({ d, objek: ada.find((o) => o.referenceUserId === d.id && o.name === d.name) }));
  console.log(`\nMODE: ${TERAPKAN ? "TERAPKAN" : "RENCANA (tidak menulis apa pun)"}`);
  console.log(`\n== ${unit.name}: ${dosen.length} dosen ==`);
  console.log(`   sudah punya objek: ${rencana.filter((r) => r.objek).length}`);
  console.log(`   objek baru       : ${rencana.filter((r) => !r.objek).length}`);
  console.log(`   kelompok objek   : "${namaKelompok}" (${kelompok ? "diperbarui" : "dibuat"})`);

  if (!TERAPKAN) return;
  const aktor = await getAuthContext(admin.id);
  if (!aktor) throw new Error("Konteks admin tidak terbentuk.");
  const ids: string[] = [];
  for (const { d, objek } of rencana) {
    if (objek) { ids.push(objek.id); continue; }
    const baru = await createObject(
      { typeId: jenis.id, name: d.name, ownerUnitId: unit.id, referenceUserId: d.id, referenceUnitId: null,
        responsibleUserId: null, url: null, description: null, contributorUserIds: [] },
      aktor
    );
    ids.push(baru.id);
  }
  const masukan = { name: namaKelompok, description: `Seluruh dosen ${unit.name}.`, objectIds: ids };
  if (kelompok) await updateObjectGroup(kelompok.id, masukan, aktor);
  else await createObjectGroup(masukan, aktor);
  console.log(`\nSelesai: ${ids.length} objek di kelompok "${namaKelompok}".`);
}

jalankan()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
