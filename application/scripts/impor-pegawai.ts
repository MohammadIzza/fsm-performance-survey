/**
 * Mengimpor data pegawai FSM (sheet "Dosen" dan "Tendik" dari berkas kepegawaian) ke aplikasi
 * lewat jalur Impor yang sama dengan menu Impor, supaya tervalidasi dan tercatat di riwayat Impor.
 *
 * Bawaannya HANYA MENCETAK RENCANA. Tidak ada yang diubah sampai ditambahkan `--terapkan`.
 *
 *   npx tsx --env-file=.env scripts/impor-pegawai.ts /home/survey/unggahan/data_pegawai_september_2026.xlsx
 *   npx tsx --env-file=.env scripts/impor-pegawai.ts <berkas.xlsx> --terapkan
 *
 * Pemetaan:
 *   id_login = NIP (tanda kutip di depan dibuang); bila email sudah dipakai akun lain, akun itu
 *              yang diperbarui (id_login-nya dipakai) supaya tidak terbentuk akun ganda.
 *   nama     = NAMA LENGKAP;  email = EMAIL SSO;  status = aktif (termasuk tugas belajar).
 *   unit     = Dosen: UNIT ES IV (program studi); Tendik: UNIT ES IV (subbagian), Manager → Tata Usaha FSM.
 * Unit yang belum ada dibuat lebih dulu: dua subbagian di bawah Tata Usaha FSM dan S1 Informatika
 * Kampus Rembang di bawah Departemen Informatika.
 */
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authz";
import { createUnit } from "@/lib/services/units";
import { previewUserImport, applyImport } from "@/lib/services/imports";

const TERAPKAN = process.argv.includes("--terapkan");
const BERKAS = process.argv.slice(2).find((a) => !a.startsWith("--"));

const UNIT_BARU = [
  { name: "Subbagian Akademik dan Kemahasiswaan FSM", induk: "TU-FSM" },
  { name: "Subbagian Sumberdaya FSM", induk: "TU-FSM" },
  { name: "Sarjana Informatika Kampus Rembang", induk: "DEP-INFOR" },
];

const PETA_UNIT: Record<string, string> = {
  "S1 - Matematika": "Sarjana Matematika",
  "S1 - Informatika": "Sarjana Informatika",
  "S1 - Informatika Kampus Rembang": "Sarjana Informatika Kampus Rembang",
  "S1 - Statistika": "Sarjana Statistika",
  "S1 - Biologi": "Sarjana Biologi",
  "S1 - Bioteknologi": "Sarjana Bioteknologi",
  "S1 - Kimia": "Sarjana Kimia",
  "S1 - Fisika": "Sarjana Fisika",
  "S2 - Kimia": "Magister Kimia",
  "S2 - Fisika": "Magister Fisika",
  "S2 - Matematika": "Magister Matematika",
  "S2 - Biologi": "Magister Biologi",
  "Profesi - Fisikawan Medik": "Profesi Fisikawan Medik",
  "S3 - Sains dan Matematika": "Doktor Sains dan Matematika",
  "Subbagian Akademik dan Kemahasiswaan FSM": "Subbagian Akademik dan Kemahasiswaan FSM",
  "Subbagian Sumberdaya FSM": "Subbagian Sumberdaya FSM",
  Manager: "Tata Usaha FSM",
};

const teks = (v: ExcelJS.CellValue): string => {
  if (v && typeof v === "object") {
    const o = v as { text?: string; result?: unknown };
    return String(o.text ?? o.result ?? "").trim();
  }
  return String(v ?? "").trim();
};

async function jalankan() {
  if (!BERKAS) throw new Error("Sebutkan berkas .xlsx.");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(BERKAS);

  const baris: { id_login: string; nama: string; email: string; jenis: string; unit: string; status: string; asal: string }[] = [];
  const tanpaPeta = new Map<string, number>();
  for (const [sheet, jenis] of [["Dosen", "Dosen"], ["Tendik", "Tenaga Kependidikan"]] as const) {
    const ws = wb.getWorksheet(sheet);
    if (!ws) throw new Error(`Sheet "${sheet}" tidak ada.`);
    const kepala = (ws.getRow(1).values as ExcelJS.CellValue[]).map(teks);
    const kol = (n: string) => {
      const i = kepala.indexOf(n);
      if (i < 0) throw new Error(`Kolom "${n}" tidak ada di sheet ${sheet}.`);
      return i;
    };
    const [kNama, kUnit, kNip, kEmail] = [kol("NAMA LENGKAP"), kol("UNIT ES IV"), kol("NIP"), kol("EMAIL SSO")];
    for (let r = 2; r <= ws.rowCount; r++) {
      const v = (ws.getRow(r).values as ExcelJS.CellValue[]).map(teks);
      if (!v.some(Boolean)) continue;
      const unitAsal = v[kUnit];
      const unit = PETA_UNIT[unitAsal];
      if (!unit) tanpaPeta.set(unitAsal, (tanpaPeta.get(unitAsal) ?? 0) + 1);
      baris.push({
        id_login: v[kNip].replace(/^'/, ""),
        nama: v[kNama],
        email: v[kEmail].toLowerCase(),
        jenis,
        unit: unit ?? "",
        status: "aktif",
        asal: `${sheet} baris ${r}`,
      });
    }
  }

  // Email yang sudah dipakai akun lain: perbarui akun itu (pakai id_login-nya), jangan buat akun baru.
  const ada = await prisma.user.findMany({
    where: { email: { in: baris.map((b) => b.email) } },
    select: { email: true, loginIdentifier: true, name: true },
  });
  const petaEmail = new Map(ada.map((u) => [u.email!, u]));
  for (const b of baris) {
    const u = petaEmail.get(b.email);
    if (u && u.loginIdentifier !== b.id_login) b.id_login = u.loginIdentifier;
  }

  const unitAda = await prisma.unit.findMany({ select: { id: true, code: true, name: true } });
  const perluDibuat = UNIT_BARU.filter((u) => !unitAda.some((a) => a.name === u.name));

  console.log(`\nMODE: ${TERAPKAN ? "TERAPKAN" : "RENCANA (tidak menulis apa pun)"}`);
  console.log(`   baris di berkas         : ${baris.length} (Dosen ${baris.filter((b) => b.jenis === "Dosen").length}, Tendik ${baris.filter((b) => b.jenis !== "Dosen").length})`);
  console.log(`   memperbarui akun lama   : ${ada.length} (email sudah terdaftar)`);
  console.log(`   unit baru               : ${perluDibuat.map((u) => u.name).join("; ") || "-"}`);
  console.log(`   unit tanpa pemetaan     : ${[...tanpaPeta].map(([k, n]) => `${k || "(kosong)"} (${n})`).join("; ") || "-"}`);
  const perUnit = new Map<string, number>();
  for (const b of baris) perUnit.set(b.unit, (perUnit.get(b.unit) ?? 0) + 1);
  console.log(`   sebaran unit            : ${[...perUnit].map(([k, n]) => `${k} ${n}`).join(" · ")}`);
  if (tanpaPeta.size) throw new Error("Ada unit yang belum dipetakan; berhenti.");
  if (!TERAPKAN) return;

  const admin = await prisma.user.findFirst({ where: { ssoRole: "superadmin" }, select: { id: true } });
  const aktor = admin && (await getAuthContext(admin.id));
  if (!aktor) throw new Error("Konteks admin tidak terbentuk.");

  for (const u of perluDibuat) {
    const induk = unitAda.find((a) => a.code === u.induk);
    if (!induk) throw new Error(`Unit induk ${u.induk} tidak ada.`);
    await createUnit({ code: "", name: u.name, parentId: induk.id }, aktor);
    console.log(`   unit dibuat: ${u.name}`);
  }

  // Berkas dalam format template Impor Pengguna.
  const keluar = new ExcelJS.Workbook();
  const ws = keluar.addWorksheet("Isian");
  ws.addRow(["id_login", "nama", "email", "kata_sandi", "jenis", "unit", "status"]);
  for (const b of baris) ws.addRow([b.id_login, b.nama, b.email, "", b.jenis, b.unit, b.status]);
  ws.getColumn(1).numFmt = "@";
  const buf = (await keluar.xlsx.writeBuffer()) as ArrayBuffer;

  const pratinjau = await previewUserImport(buf);
  console.log(`   pratinjau: ${pratinjau.toCreate} dibuat, ${pratinjau.toUpdate} diperbarui, ${pratinjau.errors.length} galat`);
  for (const e of pratinjau.errors.slice(0, 15)) console.log(`     baris ${e.row}: ${e.message}`);
  if (pratinjau.errors.length) throw new Error("Pratinjau berisi galat; tidak diterapkan.");

  await applyImport("PENGGUNA", buf, basename(BERKAS), aktor);
  console.log("   impor diterapkan.");
}

jalankan()
  .catch((e) => { console.error("GAGAL:", e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
