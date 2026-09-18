import { atomic } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";
import type { ImportEntity } from "@/generated/prisma/enums";
import { kodeUnikDariNama, samakanNama } from "@/lib/kode-otomatis";
import { FORMAT_IMPOR } from "@/lib/impor-format";
import { safeCell } from "@/lib/services/exports";

export interface RowError {
  row: number;
  message: string;
}

export interface ImportPreview {
  entity: ImportEntity;
  totalRows: number;
  toCreate: number;
  toUpdate: number;
  errors: RowError[];
  // Baris yang sudah tervalidasi, siap diterapkan bila errors kosong.
  rows: Record<string, string>[];
}

// Bab 5.2/15.1: ID diperlakukan sebagai teks; exceljs mengetik sel angka-terlihat sebagai number,
// jadi setiap nilai dipaksa ke string agar nol awal (NIM/NIK/NIP) tidak pernah hilang.
// EDGE-21: sel formula ('result' in value) diambil hasil terhitungnya — bukan dieksekusi ulang di
// sini (ExcelJS tidak pernah mengevaluasi formula, hanya membaca nilai cache dari berkas), dan
// nilainya masuk sebagai TEKS biasa lewat validasi baris seperti kolom lain. Perlindungan terhadap
// "teks berawalan =/+/-/@ ditafsir ulang sebagai formula" ditegakkan di exports.ts (safeCell) saat
// data ini nanti ditulis ke berkas BARU — itu satu-satunya titik yang benar-benar membuka berkas
// di Excel; impor sendiri tidak pernah membukanya di aplikasi spreadsheet manapun.
function cellToText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "error" in value) return String((value as { error: unknown }).error ?? "").trim();
  if (typeof value === "object" && "text" in value) return String((value as { text: unknown }).text ?? "").trim();
  if (typeof value === "object" && "result" in value) return String((value as { result: unknown }).result ?? "").trim();
  return String(value).trim();
}

async function readSheetRows(buffer: ArrayBuffer): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new ServiceError("Berkas tidak memiliki sheet yang dapat dibaca.");

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = cellToText(cell.value).toLowerCase();
  });

  const rows: Record<string, string>[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (row.cellCount === 0) continue;
    const record: Record<string, string> = {};
    let hasAnyValue = false;
    for (let c = 1; c < headers.length; c++) {
      if (!headers[c]) continue;
      const text = cellToText(row.getCell(c).value);
      record[headers[c]] = text;
      if (text) hasAnyValue = true;
    }
    if (hasAnyValue) rows.push(record);
  }
  return { headers, rows };
}

// Nama kolom template ada di lib/impor-format.ts, satu tempat dengan keterangannya, karena daftar
// yang sama juga ditampilkan di halaman Impor. Template memakai NAMA unit dan jenis, karena kode
// tidak ditampilkan di aplikasi. Berkas lama yang masih memakai kolom kode (kode_unit, kode_induk,
// kode_jenis) tetap diterima: kolom kode diutamakan bila terisi, lalu nama dicocokkan ke kodenya
// sebelum validasi dan penerapan berjalan seperti biasa.

type RujukanNama = { code: string; name: string };

/** Peta nama (disamakan) → kode. Nama yang dipakai lebih dari satu data dicatat sebagai ambigu. */
function petaNama(data: RujukanNama[]) {
  const peta = new Map<string, string>();
  const ganda = new Set<string>();
  for (const d of data) {
    const k = samakanNama(d.name);
    if (peta.has(k) && peta.get(k) !== d.code) ganda.add(k);
    peta.set(k, d.code);
  }
  return { peta, ganda };
}

/**
 * Mengisi kolom kode dari kolom nama: `kolomKode` dipertahankan bila terisi; bila kosong dan
 * `kolomNama` terisi, nama dicocokkan ke data yang ada. Nama yang tidak dikenal atau ambigu
 * dilaporkan dengan nomor baris dan kodenya dibiarkan kosong.
 */
function isiKodeDariNama(
  rows: Record<string, string>[],
  kolomKode: string,
  kolomNama: string,
  label: string,
  data: RujukanNama[],
  errors: RowError[]
) {
  const { peta, ganda } = petaNama(data);
  rows.forEach((row, i) => {
    if (row[kolomKode] || !row[kolomNama]) return;
    const k = samakanNama(row[kolomNama]);
    if (ganda.has(k)) {
      errors.push({ row: i + 2, message: `${label} "${row[kolomNama]}" dipakai lebih dari satu data.` });
    } else if (peta.has(k)) {
      row[kolomKode] = peta.get(k)!;
    } else {
      errors.push({ row: i + 2, message: `${label} "${row[kolomNama]}" tidak dikenal.` });
    }
  });
}

export interface RujukanTemplate {
  unit: string[];
  jenis: string[];
}

/** Nama unit dan jenis pengguna yang sedang terdaftar, untuk daftar pilihan di berkas template. */
export async function rujukanTemplate(): Promise<RujukanTemplate> {
  const [units, types] = await Promise.all([
    prisma.unit.findMany({ where: { active: true }, select: { name: true }, orderBy: { name: "asc" } }),
    prisma.userType.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  return { unit: units.map((u) => u.name), jenis: types.map((t) => t.name) };
}

const HEAD_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE7DC" } };

function barisJudul(sheet: ExcelJS.Worksheet, judul: string[]) {
  const row = sheet.addRow(judul);
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = HEAD_FILL;
    cell.border = { bottom: { style: "thin", color: { argb: "FFBDB5A6" } } };
  });
  return row;
}

/**
 * Berkas template yang diunduh dari menu Impor. Sebelumnya isinya hanya satu baris judul kolom,
 * sehingga orang masih harus menebak mana kolom wajib, nilai apa yang boleh diisi, dan tanggal
 * ditulis bagaimana. Sekarang berkasnya membawa keterangannya sendiri:
 *
 *   1. "Template"  — lembar yang diisi dan diunggah kembali (hanya lembar pertama yang dibaca),
 *                    lengkap dengan catatan di tiap judul kolom dan daftar pilihan untuk kolom
 *                    yang nilainya terbatas;
 *   2. "Petunjuk"  — arti tiap kolom, wajib atau tidak, beserta contohnya;
 *   3. "Contoh"    — dua baris terisi sebagai perbandingan, terpisah supaya tidak ikut terimpor;
 *   4. "Referensi" — nama unit dan jenis pengguna yang ada sekarang, karena keduanya harus ditulis
 *                    persis sama.
 */
export function buildTemplateWorkbook(entity: ImportEntity, rujukan: RujukanTemplate = { unit: [], jenis: [] }): ExcelJS.Workbook {
  const format = FORMAT_IMPOR[entity];
  const kolom = format.kolom;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Survei Penilaian FSM UNDIP";
  workbook.created = new Date();

  const isian = workbook.addWorksheet("Template");
  barisJudul(isian, kolom.map((k) => k.nama)).eachCell((cell, i) => {
    cell.note = `${kolom[i - 1].wajib ? "Wajib diisi" : "Boleh dikosongkan"}. ${kolom[i - 1].ket}`;
  });
  isian.columns.forEach((col, i) => (col.width = kolom[i].lebar));
  isian.views = [{ state: "frozen", ySplit: 1 }];

  // Daftar pilihan dipasang untuk 200 baris pertama: cukup untuk satu berkas impor, dan tidak
  // membuat berkasnya besar. Nama unit/jenis diambil dari lembar Referensi karena daftar yang
  // ditulis langsung di dalam aturan validasi dibatasi 255 karakter oleh Excel.
  const BARIS_VALIDASI = 200;
  kolom.forEach((k, i) => {
    const daftar =
      k.pilihan === "status"
        ? '"aktif,nonaktif"'
        : k.pilihan === "unit" && rujukan.unit.length > 0
          ? `=Referensi!$A$2:$A$${rujukan.unit.length + 1}`
          : k.pilihan === "jenis" && rujukan.jenis.length > 0
            ? `=Referensi!$B$2:$B$${rujukan.jenis.length + 1}`
            : null;
    if (!daftar) return;
    for (let r = 2; r <= BARIS_VALIDASI; r++) {
      isian.getCell(r, i + 1).dataValidation = {
        type: "list",
        allowBlank: true,
        // Nama unit baru memang boleh belum ada di daftar, jadi isian di luar daftar tidak ditolak.
        showErrorMessage: false,
        formulae: [daftar],
      };
    }
  });

  const petunjuk = workbook.addWorksheet("Petunjuk");
  petunjuk.addRow([`Cara mengisi berkas impor ${format.label}`]).font = { bold: true, size: 13 };
  petunjuk.addRow([format.ringkas]);
  petunjuk.addRow([]);
  for (const c of format.catatan) petunjuk.addRow([`• ${safeCell(c)}`]);
  petunjuk.addRow([]);
  barisJudul(petunjuk, ["Kolom", "Wajib", "Isi", "Contoh"]);
  for (const k of kolom) {
    petunjuk.addRow([k.nama, k.wajib ? "Wajib" : "Opsional", safeCell(k.ket), safeCell(k.contoh)]);
  }
  petunjuk.columns[0].width = 18;
  petunjuk.columns[1].width = 10;
  petunjuk.columns[2].width = 74;
  petunjuk.columns[3].width = 28;
  petunjuk.eachRow((row) => row.eachCell((cell) => (cell.alignment = { vertical: "top", wrapText: true })));

  const contoh = workbook.addWorksheet("Contoh");
  barisJudul(contoh, kolom.map((k) => k.nama));
  contoh.addRow(kolom.map((k) => safeCell(k.contoh)));
  contoh.addRow(kolom.map((k) => safeCell(k.contoh2 ?? k.contoh)));
  contoh.columns.forEach((col, i) => (col.width = kolom[i].lebar));
  contoh.addRow([]);
  contoh.addRow([
    'Baris di atas hanya contoh: isinya karangan dan tidak ikut terbaca. Isilah lembar "Template", ' +
      "karena yang dibaca saat diunggah hanya lembar pertama.",
  ]);

  const perluUnit = kolom.some((k) => k.pilihan === "unit") && rujukan.unit.length > 0;
  const perluJenis = kolom.some((k) => k.pilihan === "jenis") && rujukan.jenis.length > 0;
  if (perluUnit || perluJenis) {
    const referensi = workbook.addWorksheet("Referensi");
    // Kolom A selalu unit dan kolom B selalu jenis, supaya rumus daftar pilihan di atas tetap sama
    // walau salah satunya tidak dipakai oleh jenis impor ini.
    barisJudul(referensi, [perluUnit ? "Nama unit" : "", perluJenis ? "Jenis pengguna" : ""]);
    const tinggi = Math.max(perluUnit ? rujukan.unit.length : 0, perluJenis ? rujukan.jenis.length : 0);
    for (let i = 0; i < tinggi; i++) {
      referensi.addRow([
        perluUnit ? safeCell(rujukan.unit[i] ?? "") : "",
        perluJenis ? safeCell(rujukan.jenis[i] ?? "") : "",
      ]);
    }
    referensi.columns[0].width = 40;
    referensi.columns[1].width = 26;
  }

  return workbook;
}

// Bab 15.1: "Referensi yang tidak dikenal, siklus unit, duplikasi ID, dan kolom wajib kosong
// dilaporkan dengan nomor baris." Validasi dijalankan atas SELURUH batch sekaligus (bukan
// per-baris independen) supaya siklus yang dibentuk antar-baris dalam satu berkas terdeteksi.
export async function previewUnitImport(buffer: ArrayBuffer): Promise<ImportPreview> {
  const { rows } = await readSheetRows(buffer);
  const errors: RowError[] = [];
  const seenCodes = new Set<string>();

  const existingUnits = await prisma.unit.findMany({ select: { id: true, code: true, name: true, parentId: true } });
  const existingByCode = new Map(existingUnits.map((u) => [u.code, u]));

  // Baris tanpa kode_unit dikenali dari nama_unit: unit yang sudah ada dengan nama itu diperbarui,
  // selain itu unit baru dibuat dengan kode dari namanya.
  const namaKeKode = petaNama(existingUnits).peta;
  const kodeTerpakai = new Set(existingUnits.map((u) => u.code));
  const namaBatch = new Map<string, string>();
  for (const row of rows) {
    if (row.kode_unit || !row.nama_unit) continue;
    const k = samakanNama(row.nama_unit);
    const kode =
      namaKeKode.get(k) ??
      namaBatch.get(k) ??
      (await kodeUnikDariNama(row.nama_unit, (c) => kodeTerpakai.has(c)));
    kodeTerpakai.add(kode);
    // Nama yang sama dua kali dalam berkas memakai kode yang sama, lalu tertangkap sebagai duplikat.
    if (!namaBatch.has(k)) namaBatch.set(k, kode);
    row.kode_unit = kode;
  }
  // nama_induk boleh merujuk unit yang ada atau unit lain dalam berkas yang sama.
  rows.forEach((row, i) => {
    if (row.kode_induk || !row.nama_induk) return;
    const k = samakanNama(row.nama_induk);
    const kode = namaBatch.get(k) ?? namaKeKode.get(k);
    if (kode) row.kode_induk = kode;
    else errors.push({ row: i + 2, message: `nama_induk "${row.nama_induk}" tidak dikenal.` });
  });

  // Graf gabungan (existing + batch) untuk deteksi siklus lintas file.
  const parentByCode = new Map<string, string | null>();
  for (const u of existingUnits) {
    const parentCode = u.parentId ? existingUnits.find((p) => p.id === u.parentId)?.code ?? null : null;
    parentByCode.set(u.code, parentCode);
  }

  rows.forEach((row, i) => {
    const rowNum = i + 2;
    const code = row.kode_unit;
    const name = row.nama_unit;
    const parentCode = row.kode_induk || null;
    const status = (row.status || "aktif").toLowerCase();

    if (!code && name) errors.push({ row: rowNum, message: "nama_unit wajib diisi." });
    if (!name) errors.push({ row: rowNum, message: "nama_unit wajib diisi." });
    if (status !== "aktif" && status !== "nonaktif") {
      errors.push({ row: rowNum, message: 'status harus "aktif" atau "nonaktif".' });
    }
    if (code) {
      if (seenCodes.has(code)) {
        errors.push({ row: rowNum, message: `Unit "${name || code}" duplikat dalam berkas ini.` });
      }
      seenCodes.add(code);
      if (parentCode === code) {
        errors.push({ row: rowNum, message: "Induk unit tidak boleh unit itu sendiri." });
      }
      parentByCode.set(code, parentCode);
    }
    if (parentCode && !existingByCode.has(parentCode) && !seenCodes.has(parentCode) && !rows.some((r) => r.kode_unit === parentCode)) {
      errors.push({ row: rowNum, message: `kode_induk "${parentCode}" tidak dikenal.` });
    }
  });

  // Deteksi siklus pada graf gabungan, hanya untuk unit yang benar-benar diubah/ditambah
  // oleh berkas ini (unit lama yang tidak disentuh sudah dijamin asiklik oleh createUnit/updateUnit).
  for (const code of seenCodes) {
    const visited = new Set<string>();
    let current: string | null = code;
    while (current) {
      if (visited.has(current)) {
        const rowNum = rows.findIndex((r) => r.kode_unit === code) + 2;
        const nama = rows.find((r) => r.kode_unit === code)?.nama_unit || code;
        errors.push({ row: rowNum, message: `Siklus hierarki terdeteksi melibatkan unit "${nama}".` });
        break;
      }
      visited.add(current);
      current = parentByCode.get(current) ?? null;
    }
  }

  const toCreate = rows.filter((r) => r.kode_unit && !existingByCode.has(r.kode_unit)).length;
  const toUpdate = rows.filter((r) => r.kode_unit && existingByCode.has(r.kode_unit)).length;

  return { entity: "UNIT", totalRows: rows.length, toCreate, toUpdate, errors, rows };
}

export async function previewUserImport(buffer: ArrayBuffer): Promise<ImportPreview> {
  const { rows } = await readSheetRows(buffer);
  const errors: RowError[] = [];
  const seenIds = new Set<string>();

  const [existingUsers, userTypes, units] = await Promise.all([
    prisma.user.findMany({ select: { loginIdentifier: true } }),
    prisma.userType.findMany({ select: { code: true, name: true } }),
    prisma.unit.findMany({ select: { code: true, name: true } }),
  ]);
  isiKodeDariNama(rows, "kode_jenis", "jenis", "jenis", userTypes, errors);
  isiKodeDariNama(rows, "kode_unit", "unit", "unit", units, errors);
  const existingIds = new Set(existingUsers.map((u) => u.loginIdentifier));
  const validTypeCodes = new Set(userTypes.map((t) => t.code));
  const validUnitCodes = new Set(units.map((u) => u.code));

  rows.forEach((row, i) => {
    const rowNum = i + 2;
    const id = row.id_login;
    const name = row.nama;
    const typeCode = row.kode_jenis;
    const unitCode = row.kode_unit;
    const status = (row.status || "aktif").toLowerCase();

    if (!id) errors.push({ row: rowNum, message: "id_login wajib diisi." });
    if (!name) errors.push({ row: rowNum, message: "nama wajib diisi." });
    if (!typeCode && !row.jenis) errors.push({ row: rowNum, message: "jenis wajib diisi." });
    else if (!validTypeCodes.has(typeCode)) errors.push({ row: rowNum, message: `kode_jenis "${typeCode}" tidak dikenal.` });
    if (unitCode && !validUnitCodes.has(unitCode)) errors.push({ row: rowNum, message: `kode_unit "${unitCode}" tidak dikenal.` });
    if (status !== "aktif" && status !== "nonaktif") {
      errors.push({ row: rowNum, message: 'status harus "aktif" atau "nonaktif".' });
    }
    if (id) {
      if (seenIds.has(id)) errors.push({ row: rowNum, message: `id_login "${id}" duplikat dalam berkas ini.` });
      seenIds.add(id);
    }
  });

  const toCreate = rows.filter((r) => r.id_login && !existingIds.has(r.id_login)).length;
  const toUpdate = rows.filter((r) => r.id_login && existingIds.has(r.id_login)).length;

  return { entity: "PENGGUNA", totalRows: rows.length, toCreate, toUpdate, errors, rows };
}

export async function previewLeadershipImport(buffer: ArrayBuffer): Promise<ImportPreview> {
  const { rows } = await readSheetRows(buffer);
  const errors: RowError[] = [];

  const [users, units] = await Promise.all([
    prisma.user.findMany({ select: { loginIdentifier: true, active: true } }),
    prisma.unit.findMany({ select: { code: true, name: true } }),
  ]);
  isiKodeDariNama(rows, "kode_unit", "unit", "unit", units, errors);
  const userByLogin = new Map(users.map((u) => [u.loginIdentifier, u]));
  const validUnitCodes = new Set(units.map((u) => u.code));

  rows.forEach((row, i) => {
    const rowNum = i + 2;
    const id = row.id_login;
    const unitCode = row.kode_unit;
    const title = row.nama_jabatan;
    const from = row.mulai_aktif;

    if (!id) errors.push({ row: rowNum, message: "id_login wajib diisi." });
    else if (!userByLogin.has(id)) errors.push({ row: rowNum, message: `id_login "${id}" tidak dikenal.` });
    else if (!userByLogin.get(id)!.active) errors.push({ row: rowNum, message: `Pengguna "${id}" nonaktif, tidak dapat ditetapkan sebagai pimpinan.` });

    if (!unitCode && !row.unit) errors.push({ row: rowNum, message: "unit wajib diisi." });
    else if (unitCode && !validUnitCodes.has(unitCode)) errors.push({ row: rowNum, message: `unit "${unitCode}" tidak dikenal.` });

    if (!title) errors.push({ row: rowNum, message: "nama_jabatan wajib diisi." });
    if (!from || Number.isNaN(Date.parse(from))) {
      errors.push({ row: rowNum, message: "mulai_aktif wajib diisi dengan tanggal yang valid (YYYY-MM-DD)." });
    }
    if (row.akhir_aktif && Number.isNaN(Date.parse(row.akhir_aktif))) {
      errors.push({ row: rowNum, message: "akhir_aktif harus tanggal yang valid bila diisi." });
    }
  });

  return { entity: "PIMPINAN", totalRows: rows.length, toCreate: rows.length, toUpdate: 0, errors, rows };
}

// Bab 15.1: "Default satu batch hanya diterapkan jika semua baris valid." Validasi diulang
// terhadap kondisi TERKINI database (bukan memakai hasil preview yang mungkin sudah usang,
// EDGE-23-setara) sebelum benar-benar menuliskan perubahan.
async function applyImportImpl(
  entity: ImportEntity,
  buffer: ArrayBuffer,
  fileName: string,
  actor: AuthContext
) {
  const preview =
    entity === "UNIT"
      ? await previewUnitImport(buffer)
      : entity === "PENGGUNA"
        ? await previewUserImport(buffer)
        : await previewLeadershipImport(buffer);

  if (preview.errors.length > 0) {
    await prisma.importBatch.create({
      data: {
        entity,
        fileName,
        status: "GAGAL",
        rowErrors: preview.errors as unknown as object,
        appliedById: actor.userId,
      },
    });
    throw new ServiceError(
      `Impor dibatalkan: ${preview.errors.length} baris tidak valid. Perbaiki berkas dan unggah ulang.`
    );
  }
  if (preview.totalRows === 0) {
    throw new ServiceError("Berkas tidak memiliki baris data.");
  }

  await prisma.$transaction(async (tx) => {
    if (entity === "UNIT") {
      // Urutkan agar induk dibuat/diperbarui sebelum anak (topological pass sederhana:
      // ulangi beberapa kali karena baris tidak dijamin berurutan dalam berkas).
      const byCode = new Map(preview.rows.map((r) => [r.kode_unit, r]));
      const processed = new Set<string>();
      let remaining = [...byCode.keys()];
      let guard = remaining.length + 1;
      while (remaining.length > 0 && guard-- > 0) {
        const nextRemaining: string[] = [];
        for (const code of remaining) {
          const row = byCode.get(code)!;
          const parentCode = row.kode_induk || null;
          if (parentCode && !processed.has(parentCode) && byCode.has(parentCode)) {
            nextRemaining.push(code); // induknya juga ada di batch ini tapi belum diproses
            continue;
          }
          const parent = parentCode ? await tx.unit.findUnique({ where: { code: parentCode } }) : null;
          await tx.unit.upsert({
            where: { code },
            update: { name: row.nama_unit, parentId: parent?.id ?? null, active: (row.status || "aktif").toLowerCase() === "aktif" },
            create: { code, name: row.nama_unit, parentId: parent?.id ?? null, active: (row.status || "aktif").toLowerCase() === "aktif" },
          });
          processed.add(code);
        }
        remaining = nextRemaining;
      }
    } else if (entity === "PENGGUNA") {
      for (const row of preview.rows) {
        const userType = await tx.userType.findUniqueOrThrow({ where: { code: row.kode_jenis } });
        const unit = row.kode_unit ? await tx.unit.findUnique({ where: { code: row.kode_unit } }) : null;
        await tx.user.upsert({
          where: { loginIdentifier: row.id_login },
          update: {
            name: row.nama,
            userTypeId: userType.id,
            primaryUnitId: unit?.id ?? null,
            active: (row.status || "aktif").toLowerCase() === "aktif",
          },
          create: {
            loginIdentifier: row.id_login,
            name: row.nama,
            userTypeId: userType.id,
            primaryUnitId: unit?.id ?? null,
            active: (row.status || "aktif").toLowerCase() === "aktif",
          },
        });
      }
    } else {
      for (const row of preview.rows) {
        const user = await tx.user.findUniqueOrThrow({ where: { loginIdentifier: row.id_login } });
        const unit = await tx.unit.findUniqueOrThrow({ where: { code: row.kode_unit } });
        await tx.leadership.create({
          data: {
            userId: user.id,
            unitId: unit.id,
            title: row.nama_jabatan,
            effectiveFrom: new Date(row.mulai_aktif),
            effectiveTo: row.akhir_aktif ? new Date(row.akhir_aktif) : null,
          },
        });
      }
    }

    await tx.importBatch.create({
      data: {
        entity,
        fileName,
        status: "DITERAPKAN",
        summary: { totalRows: preview.totalRows, toCreate: preview.toCreate, toUpdate: preview.toUpdate },
        appliedById: actor.userId,
      },
    });
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "IMPORT_APPLY",
    entity: "ImportBatch",
    after: { entity, fileName, totalRows: preview.totalRows },
  });

  return preview;
}

export async function listImportBatches() {
  return prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { appliedBy: { select: { name: true } } },
  });
}

export async function applyImport(...args: Parameters<typeof applyImportImpl>): Promise<Awaited<ReturnType<typeof applyImportImpl>>> {
  return atomic(() => applyImportImpl(...args));
}
