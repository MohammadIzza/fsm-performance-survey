import { getPeriodScope } from "@/lib/authz";
import { getCombinedRanking, getRanking } from "@/lib/services/rankings";
import { ServiceError } from "@/lib/services/units";
import { isResultAccessOpenForNonAdmin } from "@/lib/services/resultAccess";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getGroupDetailBulk } from "@/lib/services/calculations";
import type { RankedEntry } from "@/lib/services/rankings";
import type { AuthContext } from "@/lib/authz";
import type { AssessmentGroup } from "@/generated/prisma/enums";

// Bab 15.2: "Teks dari pengguna tidak boleh dieksekusi sebagai formula spreadsheet." ExcelJS
// menulis sel bertipe string murni (bukan CSV), yang oleh spesifikasi OOXML tidak ditafsir ulang
// sebagai formula oleh Excel — tapi ini tetap dijaga eksplisit sebagai pertahanan berlapis, dan
// agar konsisten pada pembuka lain (mis. Google Sheets/LibreOffice saat mengimpor ulang).
export function safeCell(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

const groupLabel: Record<AssessmentGroup, string> = {
  PIMPINAN: "Pimpinan",
  SELAIN_PIMPINAN: "Selain Pimpinan",
};

const eligibilityLabel: Record<RankedEntry["eligibility"], string> = {
  BELUM_ADA_PENILAIAN: "Belum ada penilaian",
  BELUM_MEMENUHI_MINIMUM: "Belum memenuhi minimum",
  MEMENUHI_SYARAT: "Memenuhi syarat",
};

// Bab 15.2: "File hanya memuat objek yang boleh dilihat pengguna pembuat ekspor." Ekspor
// memakai jalur otorisasi yang SAMA dengan halaman Hasil (lingkup unit + waktu akses) —
// dipanggil pemanggil (route handler) sebelum fungsi ini, tapi entries di sini SUDAH dipangkas.
export async function buildResultsExport(categoryId: string, scopedEntries: {
  pimpinan: RankedEntry[];
  selain: RankedEntry[];
}, actor: AuthContext) {
  const category = await prisma.category.findUniqueOrThrow({
    where: { id: categoryId },
    include: { period: {include:{accessPolicy:true}}, objectType: true, groupRules: true },
  });

  if(!actor.active || (!actor.isAdmin&&!actor.isDekan&&!actor.leadershipUnitIds.length)) throw new ServiceError("Tidak berwenang mengekspor hasil.");
  const policy=category.period.accessPolicy;
  if(!actor.isAdmin&&(!policy||!isResultAccessOpenForNonAdmin({mode:policy.mode,availableAt:policy.availableAt,periodStatus:category.period.status}))) throw new ServiceError("Hasil belum dapat diakses.");
  const unitIds=await getPeriodScope(actor,category.periodId);
  scopedEntries={pimpinan:await getRanking({categoryId,group:"PIMPINAN",unitIds}),selain:await getRanking({categoryId,group:"SELAIN_PIMPINAN",unitIds})};
  const gabungan = await getCombinedRanking({ categoryId, unitIds });
  const visibleIds = new Set(
    [...scopedEntries.pimpinan, ...scopedEntries.selain].map((e) => e.categoryObjectId)
  );

  const [pimpinanBulk, selainBulk] = await Promise.all([
    getGroupDetailBulk(categoryId, "PIMPINAN"),
    getGroupDetailBulk(categoryId, "SELAIN_PIMPINAN"),
  ]);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Survei Penilaian FSM UNDIP";
  workbook.created = new Date();

  function addRekapSheet(name: string, entries: RankedEntry[], minimum: number) {
    const sheet = workbook.addWorksheet(name);
    sheet.columns = [
      { header: "Peringkat", key: "rank", width: 10 },
      { header: "Objek", key: "objek", width: 30 },
      { header: "Unit", key: "unit", width: 24 },
      { header: "Jumlah Respons", key: "responses", width: 16 },
      { header: "Minimum", key: "minimum", width: 10 },
      { header: "Nilai", key: "score", width: 12 },
      { header: "Status", key: "status", width: 22 },
      { header: "Seri", key: "seri", width: 8 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const e of entries) {
      sheet.addRow({
        rank: e.rank ?? "",
        objek: safeCell(e.objectName),
        unit: safeCell(e.unitName),
        responses: e.responseCount,
        minimum,
        score: e.score, // tetap numerik (bukan string) sesuai Bab 15.2
        status: eligibilityLabel[e.eligibility],
        seri: e.tied ? "Ya" : "",
      });
    }
  }

  const pimpinanRule = category.groupRules.find((r) => r.group === "PIMPINAN");
  const selainRule = category.groupRules.find((r) => r.group === "SELAIN_PIMPINAN");
  addRekapSheet("Rekap Pimpinan", scopedEntries.pimpinan, pimpinanRule?.minimum ?? 0);
  addRekapSheet("Rekap Selain Pimpinan", scopedEntries.selain, selainRule?.minimum ?? 0);
  if (gabungan) {
    addRekapSheet(
      `Rekap Gabungan ${gabungan.pimpinanWeight}-${100 - gabungan.pimpinanWeight}`,
      gabungan.entries,
      (pimpinanRule?.minimum ?? 0) + (selainRule?.minimum ?? 0)
    );
  }

  // Rincian per parameter (kedua kelompok digabung, dibedakan kolom Kelompok).
  const detailSheet = workbook.addWorksheet("Rincian Parameter");
  detailSheet.columns = [
    { header: "Objek", key: "objek", width: 28 },
    { header: "Kelompok", key: "kelompok", width: 16 },
    { header: "Parameter", key: "parameter", width: 22 },
    { header: "Bobot (%)", key: "bobot", width: 10 },
    { header: "Angka mentah", key: "raw", width: 14 },
    { header: "Rata-rata/Total", key: "aggregate", width: 16 },
    { header: "Kontribusi", key: "contribution", width: 12 },
  ];
  detailSheet.getRow(1).font = { bold: true };
  for (const [group, bulk] of [["PIMPINAN", pimpinanBulk], ["SELAIN_PIMPINAN", selainBulk]] as const) {
    if (!bulk) continue;
    for (const [objId, data] of bulk.byObject) {
      if (!visibleIds.has(objId)) continue;
      for (const pr of data.result.parameterResults) {
        detailSheet.addRow({
          objek: safeCell(data.result.categoryObject.nameSnapshot),
          kelompok: groupLabel[group],
          parameter: safeCell(pr.parameter.name),
          bobot: pr.parameter.weight,
          raw: pr.rawAggregate ?? "",
          aggregate: pr.aggregate,
          contribution: pr.contribution,
        });
      }
    }
  }

  // Jawaban penilai — hanya untuk peran berwenang (pemanggil sudah memastikan actor Admin/
  // Dekan/Pimpinan sebelum fungsi ini dipanggil; identitas tetap dipangkas ke objek dalam lingkup).
  const answersSheet = workbook.addWorksheet("Jawaban Penilai");
  answersSheet.columns = [
    { header: "Objek", key: "objek", width: 28 },
    { header: "Kelompok", key: "kelompok", width: 16 },
    { header: "Penilai", key: "penilai", width: 24 },
    { header: "ID Penilai", key: "idPenilai", width: 16 },
    { header: "Parameter", key: "parameter", width: 22 },
    { header: "Skor", key: "skor", width: 10 },
    { header: "Waktu Kirim", key: "waktu", width: 20 },
  ];
  answersSheet.getRow(1).font = { bold: true };
  for (const [group, bulk] of [["PIMPINAN", pimpinanBulk], ["SELAIN_PIMPINAN", selainBulk]] as const) {
    if (!bulk) continue;
    for (const [objId, data] of bulk.byObject) {
      if (!visibleIds.has(objId)) continue;
      for (const respondent of data.respondents) {
        for (const s of respondent.scores) {
          answersSheet.addRow({
            objek: safeCell(data.result.categoryObject.nameSnapshot),
            kelompok: groupLabel[group],
            penilai: safeCell(respondent.evaluatorName),
            idPenilai: String(respondent.evaluatorLogin), // ID tetap teks (Bab 15.2)
            parameter: safeCell(s.parameterName),
            skor: s.score,
            waktu: respondent.submittedAt ? respondent.submittedAt.toISOString() : "",
          });
        }
      }
    }
  }
  answersSheet.getColumn("idPenilai").numFmt = "@"; // paksa format teks agar nol awal tak hilang

  // Progress tugas & objek belum memenuhi minimum.
  const progressSheet = workbook.addWorksheet("Progress Tugas");
  progressSheet.columns = [
    { header: "Objek", key: "objek", width: 28 },
    { header: "Kelompok", key: "kelompok", width: 16 },
    { header: "Target", key: "target", width: 10 },
    { header: "Respons Terkirim", key: "respons", width: 16 },
    { header: "Minimum", key: "minimum", width: 10 },
    { header: "Status", key: "status", width: 22 },
  ];
  progressSheet.getRow(1).font = { bold: true };
  for (const entries of [scopedEntries.pimpinan, scopedEntries.selain]) {
    const rule = entries === scopedEntries.pimpinan ? pimpinanRule : selainRule;
    for (const e of entries) {
      progressSheet.addRow({
        objek: safeCell(e.objectName),
        kelompok: groupLabel[e.group],
        target: rule?.target ?? 0,
        respons: e.responseCount,
        minimum: rule?.minimum ?? 0,
        status: eligibilityLabel[e.eligibility],
      });
    }
  }

  // Metadata (Bab 15.2).
  const metaSheet = workbook.addWorksheet("Metadata");
  metaSheet.columns = [
    { header: "Kunci", key: "k", width: 24 },
    { header: "Nilai", key: "v", width: 50 },
  ];
  metaSheet.getRow(1).font = { bold: true };
  const scopeLabel =
    actor.isAdmin || actor.isDekan ? "Seluruh fakultas" : "Unit yang dipimpin dan subunitnya";
  metaSheet.addRows([
    { k: "Versi perhitungan", v: pimpinanBulk?.run.id ?? selainBulk?.run.id ?? "" },
    { k: "Versi finalisasi", v: pimpinanBulk?.run.finalizationId ?? "Sementara" },
    { k: "Periode", v: safeCell(category.period.name) },
    { k: "Kode periode", v: category.period.code },
    { k: "Kategori", v: safeCell(category.name) },
    { k: "Jenis objek", v: category.objectType.name },
    { k: "Status periode", v: category.period.status },
    { k: "Metode agregasi Pimpinan", v: pimpinanRule?.aggregation ?? "-" },
    { k: "Metode agregasi Selain Pimpinan", v: selainRule?.aggregation ?? "-" },
    { k: "Lingkup pengekspor", v: scopeLabel },
    { k: "Diekspor oleh", v: safeCell(actor.name) },
    { k: "Waktu ekspor", v: new Date().toISOString() },
  ]);

  return workbook;
}
