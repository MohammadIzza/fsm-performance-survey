/**
 * Menyamakan kata sandi setiap akun non-SSO dengan ID login-nya, supaya akun demonstrasi bisa
 * dipakai masuk lewat formulir, lalu mengekspor seluruh akun ke Excel beserta kata sandinya.
 *
 * Bawaannya HANYA MENCETAK RENCANA. Tidak ada yang diubah sampai ditambahkan `--terapkan`.
 *
 *   npx tsx --env-file=.env scripts/sandi-sama-id.ts [berkas.xlsx]
 *   npx tsx --env-file=.env scripts/sandi-sama-id.ts [berkas.xlsx] --terapkan
 *
 * Akun yang tertaut SSO dilewati: kata sandinya tidak diubah dan tidak diketahui. ID yang lebih
 * pendek dari batas minimum kata sandi juga dilewati.
 */
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { hashKataSandi, PANJANG_MINIMUM } from "@/lib/password";

const TERAPKAN = process.argv.includes("--terapkan");
const BERKAS = process.argv.slice(2).find((a) => !a.startsWith("--"));

async function jalankan() {
  const users = await prisma.user.findMany({
    include: { userType: true, primaryUnit: true, leaderships: { where: { active: true }, include: { unit: true } } },
    orderBy: { loginIdentifier: "asc" },
  });
  const diubah = users.filter((u) => !u.ssoId && u.loginIdentifier.length >= PANJANG_MINIMUM);
  const pendek = users.filter((u) => !u.ssoId && u.loginIdentifier.length < PANJANG_MINIMUM);
  const sso = users.filter((u) => u.ssoId);

  console.log(`\nMODE: ${TERAPKAN ? "TERAPKAN" : "RENCANA (tidak menulis apa pun)"}`);
  console.log(`   total akun          : ${users.length}`);
  console.log(`   sandi = ID login    : ${diubah.length}`);
  console.log(`   dilewati (SSO)      : ${sso.length}`);
  console.log(`   dilewati (ID < ${PANJANG_MINIMUM})  : ${pendek.length}${pendek.length ? " — " + pendek.map((u) => u.loginIdentifier).join(", ") : ""}`);
  if (!TERAPKAN) return;

  let i = 0;
  for (const u of diubah) {
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashKataSandi(u.loginIdentifier) } });
    if (++i % 100 === 0) console.log(`   ${i}/${diubah.length}`);
  }
  console.log(`   selesai: ${i} kata sandi diperbarui.`);

  if (!BERKAS) return;
  const ok = new Set(diubah.map((u) => u.id));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Akun");
  ws.columns = [
    { header: "No", key: "no", width: 6 },
    { header: "Username (ID login)", key: "id", width: 28 },
    { header: "Kata sandi", key: "sandi", width: 28 },
    { header: "Nama", key: "nama", width: 42 },
    { header: "Jenis", key: "jenis", width: 20 },
    { header: "Unit utama", key: "unit", width: 34 },
    { header: "Jabatan pimpinan", key: "jabatan", width: 44 },
    { header: "Email", key: "email", width: 34 },
    { header: "Cara masuk", key: "cara", width: 22 },
    { header: "Status", key: "status", width: 10 },
  ];
  users.forEach((u, n) =>
    ws.addRow({
      no: n + 1,
      id: u.loginIdentifier,
      sandi: ok.has(u.id) ? u.loginIdentifier : u.ssoId ? "— (akun SSO, tidak diubah)" : "— (ID terlalu pendek)",
      nama: u.name,
      jenis: u.userType?.name ?? "",
      unit: u.primaryUnit?.name ?? "",
      jabatan: u.leaderships.map((l) => `${l.title ?? "Pimpinan"} — ${l.unit.name}`).join("; "),
      email: u.email ?? "",
      cara: u.ssoId ? "SSO" : "ID + kata sandi",
      status: u.active ? "Aktif" : "Nonaktif",
    })
  );
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF383030" } };
  ws.autoFilter = { from: "A1", to: "J1" };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  await wb.xlsx.writeFile(BERKAS);
  console.log(`   ekspor: ${BERKAS} (${users.length} baris)`);
}

jalankan()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
