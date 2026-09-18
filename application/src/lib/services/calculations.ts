import Decimal from "decimal.js";
import { atomic, isNested, rawClient } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";
import type { AssessmentGroup, AggregationMethod } from "@/generated/prisma/enums";

// Bab 12.5: "gunakan aritmetika desimal ... perbandingan ranking memakai hasil yang dikuantisasi
// enam desimal secara konsisten." JS float sudah IEEE-754 double (~15-17 digit desimal), yang
// jauh melebihi presisi enam desimal yang disyaratkan; pembulatan eksplisit di sini menghindari
// noise representasi biner saat MEMBANDINGKAN dua nilai, bukan mengurangi presisi hitung itu sendiri.
function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

interface EffectiveResponse {
  assignmentId: string;
  scores: Map<string, number>;
  revisionId: string;
  evaluatorName: string;
  evaluatorLogin: string;
  submittedAt: string | null; // parameterId -> score
}

// Bab 3/11.5: "respons berlaku" = revisi SUBMITTED dengan nomor tertinggi yang belum voided,
// per tugas. Dihitung di sini secara konsisten dengan responses.ts (bukan disalin logikanya),
// supaya definisi "jawaban mana yang dihitung" hanya ada di satu tempat secara konseptual.
async function loadEffectiveResponses(categoryObjectId: string, group: AssessmentGroup): Promise<EffectiveResponse[]> {
  const assignments = await prisma.assignment.findMany({
    where: { categoryObjectId, group, status: { not: "DIBATALKAN" } },
    include: {
      evaluator: true,
      responseRevisions: {
        where: { state: "SUBMITTED", voided: false },
        orderBy: { revision: "desc" },
        take: 1,
        include: { scores: true },
      },
    },
  });

  const effective: EffectiveResponse[] = [];
  for (const a of assignments) {
    const rev = a.responseRevisions[0];
    if (!rev) continue;
    effective.push({
      assignmentId: a.id,
      revisionId: rev.id,
      evaluatorName: a.evaluatorNameSnapshot ?? a.evaluator.name,
      evaluatorLogin: a.evaluatorLoginSnapshot ?? a.evaluator.loginIdentifier,
      submittedAt: rev.submittedAt?.toISOString() ?? null,
      scores: new Map(rev.scores.map((s) => [s.parameterId, s.score])),
    });
  }
  return effective;
}

interface ParameterAggregate {
  parameterId: string;
  weight: number;
  aggregate: number;
  contribution: number;
  /** Agregat sebelum dinormalisasi; null untuk parameter biasa. */
  rawAggregate: number | null;
}

// Bab 12.2: rumus rata-rata/total, sebelum diberi bobot. n=0 ditangani pemanggil (tidak pernah
// sampai ke sini dengan responses kosong). Bobot baru diberikan di computeAndPersist, karena
// parameter bernilai mentah harus lebih dulu dibagi agregat tertinggi semua objek.
function rawAggregate(scores: number[], method: AggregationMethod): Decimal {
  if (!scores.length) throw new ServiceError("Versi instrumen tidak sebanding. Selesaikan pengisian ulang sebelum perhitungan.");
  const sum = scores.reduce((s, v) => s.plus(v), new Decimal(0));
  return method === "TOTAL" ? sum : sum.div(scores.length);
}

function computeEligibility(responseCount: number, minimum: number): "BELUM_ADA_PENILAIAN" | "BELUM_MEMENUHI_MINIMUM" | "MEMENUHI_SYARAT" {
  if (responseCount === 0) return "BELUM_ADA_PENILAIAN";
  if (responseCount < minimum) return "BELUM_MEMENUHI_MINIMUM";
  return "MEMENUHI_SYARAT";
}

type CategoryForCalc = NonNullable<Awaited<ReturnType<typeof loadCategoryForCalc>>>;

async function loadCategoryForCalc(categoryId: string) {
  return prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      groupRules: true,
      period: true,
      categoryObjects: true,
      instrumentVersions: { orderBy: { revision: "desc" }, take: 1, include: { parameters: true } },
    },
  });
}

// Isi yang sebenarnya menghitung dan menulis hasil ke run yang SUDAH ada (dibuat oleh pemanggil —
// lihat calculateResults). Dipisah dari pembuatan/penandaan run supaya durabilitasnya bisa
// diperlakukan berbeda tergantung konteks transaksi pemanggil (lihat komentar di calculateResults).
async function computeAndPersist(
  category: CategoryForCalc,
  instrument: CategoryForCalc["instrumentVersions"][number],
  runId: string,
  actor: AuthContext
) {
  const responseSnapshot: Record<string, {revisionId:string;evaluatorName:string;evaluatorLogin:string;submittedAt:string|null;scores:{parameterName:string;score:number}[]}[]> = {};
  await prisma.$transaction(async (tx) => {
    for (const rule of category.groupRules) {
      // Tahap 1 — agregat mentah tiap objek pada kelompok ini.
      const perObjek: { categoryObjectId: string; n: number; mentah: Map<string, Decimal> }[] = [];
      for (const co of category.categoryObjects) {
        const responses = await loadEffectiveResponses(co.id, rule.group);
        const n = responses.length;
        responseSnapshot[`${co.id}|${rule.group}`] = responses.map(r=>({revisionId:r.revisionId,evaluatorName:r.evaluatorName,evaluatorLogin:r.evaluatorLogin,submittedAt:r.submittedAt,scores:instrument.parameters.map(p=>({parameterName:p.name,score:r.scores.get(p.id)!}))}));
        const mentah = new Map<string, Decimal>();
        if (n > 0) {
          for (const param of instrument.parameters) {
            // Bab 11: parameter wajib terisi saat kirim, jadi setiap respons berlaku dijamin
            // punya skor untuk setiap parameter instrumen — tidak ada nilai hilang di sini.
            const scores = responses.map((r) => r.scores.get(param.id)).filter((s): s is number => s !== undefined);
            if (scores.length !== n) throw new ServiceError("Respons menggunakan instrumen tidak sebanding. Lakukan pengisian ulang sebelum menghitung/finalisasi.");
            mentah.set(param.id, rawAggregate(scores, rule.aggregation));
          }
        }
        perObjek.push({ categoryObjectId: co.id, n, mentah });
      }

      // Tahap 2 — untuk parameter bernilai mentah, agregat tertinggi di antara objek yang punya
      // respons dalam kelompok yang sama. Objek dengan agregat itu mendapat 100.
      const tertinggi = new Map<string, Decimal>();
      for (const param of instrument.parameters) {
        if (!param.normalized) continue;
        let maks = new Decimal(0);
        for (const o of perObjek) {
          const v = o.mentah.get(param.id);
          if (v && v.gt(maks)) maks = v;
        }
        tertinggi.set(param.id, maks);
      }

      // Tahap 3 — normalisasi, sumbangan berbobot, lalu simpan.
      for (const o of perObjek) {
        let score: number | null = null;
        const paramAggregates: ParameterAggregate[] = [];
        if (o.n > 0) {
          for (const param of instrument.parameters) {
            const raw = o.mentah.get(param.id)!;
            const maks = tertinggi.get(param.id);
            // Semua objek bernilai 0 → tidak ada pembanding; semuanya 0, bukan pembagian nol.
            const agregat = param.normalized ? (maks && maks.gt(0) ? raw.div(maks).mul(100) : new Decimal(0)) : raw;
            paramAggregates.push({
              parameterId: param.id,
              weight: param.weight,
              aggregate: agregat.toNumber(),
              contribution: agregat.mul(param.weight).div(100).toNumber(),
              rawAggregate: param.normalized ? raw.toNumber() : null,
            });
          }
          score = paramAggregates.reduce((sum,p)=>sum.plus(p.contribution),new Decimal(0)).toDecimalPlaces(6).toNumber();
        }

        const result = await tx.objectGroupResult.create({
          data: {
            runId,
            categoryObjectId: o.categoryObjectId,
            group: rule.group,
            responseCount: o.n,
            score,
            eligibility: computeEligibility(o.n, rule.minimum),
          },
        });

        if (paramAggregates.length > 0) {
          await tx.parameterResult.createMany({
            data: paramAggregates.map((p) => ({
              resultId: result.id,
              parameterId: p.parameterId,
              aggregate: round6(p.aggregate),
              contribution: round6(p.contribution),
              rawAggregate: p.rawAggregate === null ? null : round6(p.rawAggregate),
            })),
          });
        }
      }
    }
  });

  const completed = await prisma.calculationRun.update({
    where: { id: runId },
    data: { status: "BERHASIL", completedAt: new Date(), responseSnapshot },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "CALCULATION_RUN",
    entity: "CalculationRun",
    entityId: runId,
    after: { categoryId: category.id, status: "BERHASIL" },
  });

  return completed;
}

export async function getLatestRun(categoryId: string) {
  const category = await prisma.category.findUnique({where:{id:categoryId},include:{period:true,instrumentVersions:{include:{parameters:true}},groupRules:true,categoryObjects:{include:{assignments:true}}}});
  if(!category) return null;
  const run = await prisma.calculationRun.findFirst({where:{categoryId,status:"BERHASIL",...(category.period.status==="FINAL"?{finalizationId:{not:null}}:{})},orderBy:{createdAt:"desc"}});
  if(category.period.status==="FINAL") return run;
  if(!category.instrumentVersions.some(i=>i.parameters.length)) return run;
  const changed = [category.updatedAt,...category.groupRules.map(r=>r.updatedAt),...category.instrumentVersions.flatMap(i=>[i.updatedAt,...i.parameters.map(p=>p.updatedAt)]),...category.categoryObjects.flatMap(o=>o.assignments.map(a=>a.updatedAt))].some(d=>!run?.completedAt || d>run.completedAt);
  if(changed) return calculateResults(categoryId,{userId:category.period.createdById,loginIdentifier:"",name:"Perhitungan otomatis",active:true,isAdmin:true,isDekan:false,leadershipUnitIds:[],scopeUnitIds:[]});
  return run;
}

export async function listRunsForCategory(categoryId: string) {
  return prisma.calculationRun.findMany({
    where: { categoryId },
    orderBy: { createdAt: "desc" },
    include: { triggeredBy: { select: { name: true } } },
  });
}

// Bab 13.4/13.5: rincian seluruh objek untuk satu kategori+kelompok sekaligus (bukan per-objek,
// untuk menghindari N+1 query) — agregasi per parameter dan "identitas serta jawaban setiap
// penilai yang berkontribusi." Otorisasi lingkup diperiksa pemanggil berdasarkan unit objek.
export async function getGroupDetailBulk(categoryId: string, group: AssessmentGroup) {
  const run = await getLatestRun(categoryId);
  if (!run) return null;

  const results = await prisma.objectGroupResult.findMany({
    where: { runId: run.id, group },
    include: {
      categoryObject: true,
      parameterResults: { include: { parameter: true }, orderBy: { parameter: { order: "asc" } } },
    },
  });

  const assignments = await prisma.assignment.findMany({
    where: { categoryObject: { categoryId }, group, status: { not: "DIBATALKAN" } },
    include: {
      evaluator: { select: { name: true, loginIdentifier: true } },
      responseRevisions: {
        where: { state: "SUBMITTED", voided: false },
        orderBy: { revision: "desc" },
        take: 1,
        include: { scores: { include: { parameter: true } } },
      },
    },
  });

  const respondentsByObject = new Map<string, { evaluatorName: string; evaluatorLogin: string; submittedAt: Date | null; scores: { parameterName: string; score: number }[] }[]>();
  for (const a of assignments) {
    const rev = a.responseRevisions[0];
    if (!rev) continue;
    const list = respondentsByObject.get(a.categoryObjectId) ?? [];
    list.push({
      evaluatorName: a.evaluatorNameSnapshot ?? a.evaluator.name,
      evaluatorLogin: a.evaluatorLoginSnapshot ?? a.evaluator.loginIdentifier,
      submittedAt: rev.submittedAt,
      scores: rev.scores.map((s) => ({ parameterName: s.parameter.name, score: s.score })),
    });
    respondentsByObject.set(a.categoryObjectId, list);
  }

  if (run.responseSnapshot) {
    respondentsByObject.clear();
    const snapshot = run.responseSnapshot as unknown as Record<string, {evaluatorName:string;evaluatorLogin:string;submittedAt:string|null;scores:{parameterName:string;score:number}[]}[]>;
    for (const r of results) respondentsByObject.set(r.categoryObjectId,(snapshot[`${r.categoryObjectId}|${group}`]??[]).map(s=>({...s,submittedAt:s.submittedAt?new Date(s.submittedAt):null})));
  }
  return {
    run,
    byObject: new Map(
      results.map((r) => [
        r.categoryObjectId,
        { result: r, respondents: respondentsByObject.get(r.categoryObjectId) ?? [] },
      ])
    ),
  };
}

// Bab 12.7/18: menjalankan perhitungan penuh untuk satu kategori dan menyimpannya sebagai
// CalculationRun baru (bukan menimpa yang lama) — riwayat perhitungan tetap tertelusuri.
//
// Bab 21.2/21.4: sebuah percobaan yang GAGAL harus tetap terlihat (status GAGAL), bukan hilang
// seolah tak pernah terjadi. Tapi atomic() membungkus seluruh isi dalam SATU transaksi — bila kode
// di dalamnya melempar, Postgres membatalkan semuanya, termasuk baris run yang baru dibuat maupun
// tulisan "tandai GAGAL" pada baris itu sendiri di blok catch (keduanya sama-sama lewat proxy yang
// terikat ke transaksi yang sama). Cara membuat GAGAL benar-benar tersimpan tergantung KONTEKS:
//
// - Dipanggil BERDIRI SENDIRI (tombol "Hitung" admin, atau auto-recalc getLatestRun): run dibuat
//   dan ditandai GAGAL lewat rawClient (di luar proxy/atomic), sehingga bertahan walau perhitungan
//   di dalamnya di-rollback.
// - Dipanggil BERSARANG di dalam atomic() milik pemanggil lain (mis. finalizePeriod, yang mem-
//   branding tiap run ke satu Finalization setelah kembali): run HARUS ikut transaksi pemanggil
//   itu, bukan rawClient — bila finalisasi gagal di kategori berikutnya, run "berhasil" dari
//   kategori sebelumnya wajib ikut batal juga, supaya tidak ada run yatim yang mengklaim berhasil
//   untuk sebuah Finalization yang sebenarnya tidak pernah rampung (Bab 19.1).
export async function calculateResults(categoryId: string, actor: AuthContext) {
  const category = await loadCategoryForCalc(categoryId);
  if (!category) throw new ServiceError("Kategori tidak ditemukan.");

  if (category.period.status === "FINAL") {
    const frozen = await prisma.calculationRun.findFirst({where:{categoryId,finalizationId:{not:null},status:"BERHASIL"},orderBy:{createdAt:"desc"}});
    if (frozen) return frozen;
  }
  const instrument = category.instrumentVersions[0];
  if (!instrument || instrument.parameters.length === 0) {
    throw new ServiceError("Kategori belum memiliki parameter instrumen untuk dihitung.");
  }

  // Bobot nilai gabungan ikut dipatri, supaya peringkat gabungan dari run lama (mis. yang sudah
  // difinalkan) tidak berubah bila bobot kategori diganti kemudian.
  const groupRuleSnapshot = {
    ...Object.fromEntries(
      category.groupRules.map((g) => [
        g.group,
        { aggregation: g.aggregation, target: g.target, minimum: g.minimum, revision:g.revision, tieBreakParameterIds:g.tieBreakParameterIds },
      ])
    ),
    GABUNGAN: { pimpinanWeight: category.pimpinanWeight },
  };
  const runData = { categoryId, instrumentVersionId: instrument.id, groupRuleSnapshot, status: "BERJALAN" as const, triggeredById: actor.userId };

  if (isNested()) {
    const run = await prisma.calculationRun.create({ data: runData });
    try {
      return await computeAndPersist(category, instrument, run.id, actor);
    } catch (e) {
      await prisma.calculationRun.update({
        where: { id: run.id },
        data: { status: "GAGAL", completedAt: new Date(), errorMessage: e instanceof Error ? e.message : String(e) },
      });
      throw e;
    }
  }

  const run = await rawClient.calculationRun.create({ data: runData });
  try {
    return await atomic(() => computeAndPersist(category, instrument, run.id, actor));
  } catch (e) {
    await rawClient.calculationRun.update({
      where: { id: run.id },
      data: { status: "GAGAL", completedAt: new Date(), errorMessage: e instanceof Error ? e.message : String(e) },
    });
    throw e;
  }
}
