// Menyelaraskan daftar unit akademik di basis data dengan struktur resmi fakultas
// (src/lib/data/fsm-org.ts): enam departemen dan tiga belas program studi.
//
// Aman dijalankan berulang: unit dicocokkan berdasarkan kode, lalu nama dan induknya diperbarui
// bila berbeda. Tidak ada unit yang dihapus atau dinonaktifkan — unit di luar daftar (tata usaha,
// unit uji, sisa data lama) hanya dilaporkan di akhir agar bisa ditangani lewat halaman Organisasi.
//
// Jalankan dengan `npm run seed:units`.
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { FSM_UNITS } from "../src/lib/data/fsm-org";

const db = new PrismaClient();

async function main() {
  const idByCode = new Map<string, string>();
  const dibuat: string[] = [];
  const diperbarui: string[] = [];
  let tetap = 0;

  // Daftarnya sudah urut induk-dulu, jadi parentId selalu sudah dikenal saat anaknya diproses.
  for (const unit of FSM_UNITS) {
    const parentId = unit.parentCode ? idByCode.get(unit.parentCode) ?? null : null;
    if (unit.parentCode && !parentId) {
      throw new Error(`Induk ${unit.parentCode} belum ada saat memproses ${unit.code}.`);
    }

    const lama = await db.unit.findUnique({ where: { code: unit.code } });
    if (!lama) {
      const baru = await db.unit.create({
        data: { code: unit.code, name: unit.name, parentId },
      });
      idByCode.set(unit.code, baru.id);
      dibuat.push(`${unit.code} — ${unit.name}`);
      continue;
    }

    idByCode.set(unit.code, lama.id);
    const perubahan: string[] = [];
    if (lama.name !== unit.name) perubahan.push(`nama "${lama.name}" → "${unit.name}"`);
    if (lama.parentId !== parentId) {
      const indukLama = lama.parentId
        ? (await db.unit.findUnique({ where: { id: lama.parentId } }))?.code ?? "?"
        : "-";
      perubahan.push(`induk ${indukLama} → ${unit.parentCode ?? "-"}`);
    }
    // Unit yang pernah dinonaktifkan dihidupkan lagi: keberadaannya di daftar resmi berarti
    // program studinya memang berjalan.
    if (!lama.active) perubahan.push("nonaktif → aktif");

    if (perubahan.length === 0) {
      tetap++;
      continue;
    }
    await db.unit.update({
      where: { id: lama.id },
      data: { name: unit.name, parentId, active: true },
    });
    diperbarui.push(`${unit.code} — ${perubahan.join(", ")}`);
  }

  const lain = await db.unit.findMany({
    where: { code: { notIn: FSM_UNITS.map((u) => u.code) } },
    orderBy: { code: "asc" },
  });

  console.log(`Dibuat (${dibuat.length}):`);
  for (const baris of dibuat) console.log(`  + ${baris}`);
  console.log(`Diperbarui (${diperbarui.length}):`);
  for (const baris of diperbarui) console.log(`  ~ ${baris}`);
  console.log(`Sudah sesuai: ${tetap}`);
  console.log(`Di luar daftar resmi (dibiarkan apa adanya) (${lain.length}):`);
  for (const u of lain) console.log(`  . ${u.code} — ${u.name}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
