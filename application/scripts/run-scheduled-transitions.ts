// Bab 7.2: dipanggil berkala (lihat systemd timer di docs/deployment.md) untuk membuka periode
// yang sudah berstatus Siap begitu tanggal mulainya tiba — bukan bagian dari proses Next.js yang
// melayani request, supaya jadwalnya tidak bergantung pada satu proses long-running.
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runScheduledOpenings } from "../src/lib/services/periods";

async function main() {
  const { opened, failed } = await runScheduledOpenings();

  if (opened.length === 0 && failed.length === 0) {
    console.log("Tidak ada periode Siap yang jatuh tempo dibuka saat ini.");
  }
  for (const p of opened) {
    console.log(`Dibuka: ${p.code} (${p.periodId})`);
  }
  for (const p of failed) {
    console.error(`GAGAL membuka ${p.code} (${p.periodId}): ${p.error}`);
  }

  if (failed.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("Skrip penjadwal gagal dijalankan:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
