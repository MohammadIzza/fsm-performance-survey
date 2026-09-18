import { getLatestRun } from "@/lib/services/calculations";
import { prisma } from "@/lib/prisma";
import type { AssessmentGroup } from "@/generated/prisma/enums";
import type { AuthContext } from "@/lib/authz";
import { isUnitInScope } from "@/lib/authz";

export interface RankedEntry {
  categoryObjectId: string;
  objectName: string;
  unitName: string;
  ownerUnitId: string;
  group: AssessmentGroup;
  score: number | null;
  responseCount: number;
  eligibility: "BELUM_ADA_PENILAIAN" | "BELUM_MEMENUHI_MINIMUM" | "MEMENUHI_SYARAT";
  rank: number | null; // null bila tidak layak peringkat
  /** Masih berbagi peringkat dengan objek lain setelah parameter pembeda dipakai. */
  tied: boolean;
}

// Bab 13.3: peringkat kompetisi (1,2,2,4) — dua nilai sama mendapat peringkat sama, dan
// peringkat berikutnya melompati sejumlah entri yang terikat. Dibandingkan pada nilai
// terkuantisasi 6 desimal (sudah dilakukan di calculations.ts), bukan 2 desimal tampilan.
function assignCompetitionRanks(
  sorted: RankedEntry[],
  tieBreakParamsByObject: Map<string, number[]>
): void {
  let rank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const prevTie = tieBreakParamsByObject.get(prev.categoryObjectId) ?? [];
      const currTie = tieBreakParamsByObject.get(curr.categoryObjectId) ?? [];
      const sameScore = prev.score === curr.score;
      const sameTieBreak =
        prevTie.length === currTie.length && prevTie.every((v, idx) => v === currTie[idx]);
      if (!(sameScore && sameTieBreak)) {
        rank = i + 1;
      }
    }
    sorted[i].rank = rank;
  }
  // Nilai yang tetap sama setelah dibedakan ditandai seri, supaya terbaca sebagai keputusan yang
  // masih terbuka — bukan urutan nama yang kebetulan menaruh satu objek di atas yang lain.
  for (let i = 0; i < sorted.length; i++) {
    sorted[i].tied =
      (i > 0 && sorted[i - 1].rank === sorted[i].rank) ||
      (i < sorted.length - 1 && sorted[i + 1].rank === sorted[i].rank);
  }
}

export interface RankingOptions {
  categoryId: string;
  group: AssessmentGroup;
  /** Batasi ke unit-unit ini (mis. lingkup pimpinan); null/undefined = tanpa filter unit. */
  unitIds?: string[] | null;
}

// Bab 13.2/13.3: ranking dalam satu kategori+kelompok, dibatasi lingkup unit opsional.
// Objek tidak layak (belum memenuhi minimum) tetap muncul di rekap (rank=null), sesuai Bab 13.1.
export async function getRanking(options: RankingOptions): Promise<RankedEntry[]> {
  const run = await getLatestRun(options.categoryId);
  if (!run) return [];
  const rules = run.groupRuleSnapshot as Record<string,{tieBreakParameterIds?:string[]|null}>;
  const tieBreakParameterIds = rules[options.group]?.tieBreakParameterIds ?? [];

  const results = await prisma.objectGroupResult.findMany({
    where: { runId: run.id, group: options.group },
    include: {
      categoryObject: { include: { object: { include: { ownerUnit: true } } } },
      parameterResults: true,
    },
  });

  const filtered = options.unitIds
    ? results.filter((r) => options.unitIds!.includes((r.categoryObject.ownerUnitIdSnapshot ?? r.categoryObject.object.ownerUnitId)))
    : results;

  const entries: RankedEntry[] = filtered.map((r) => ({
    categoryObjectId: r.categoryObjectId,
    objectName: r.categoryObject.nameSnapshot,
    unitName: r.categoryObject.unitSnapshot,
    ownerUnitId: (r.categoryObject.ownerUnitIdSnapshot ?? r.categoryObject.object.ownerUnitId),
    group: r.group,
    score: r.score,
    responseCount: r.responseCount,
    eligibility: r.eligibility,
    rank: null,
    tied: false,
  }));

  const tieBreakByObject = new Map<string, number[]>();
  if (tieBreakParameterIds.length > 0) {
    for (const r of filtered) {
      const values = tieBreakParameterIds.map(
        (pid) => r.parameterResults.find((pr) => pr.parameterId === pid)?.aggregate ?? -Infinity
      );
      tieBreakByObject.set(r.categoryObjectId, values);
    }
  }

  // Bab 13.1: hanya yang MEMENUHI_SYARAT yang diperingkat; sisanya tampil di rekap tanpa rank.
  const eligible = entries.filter((e) => e.eligibility === "MEMENUHI_SYARAT");
  const notEligible = entries.filter((e) => e.eligibility !== "MEMENUHI_SYARAT");

  eligible.sort((a, b) => {
    if (b.score !== a.score) return (b.score ?? 0) - (a.score ?? 0);
    const aTie = tieBreakByObject.get(a.categoryObjectId) ?? [];
    const bTie = tieBreakByObject.get(b.categoryObjectId) ?? [];
    for (let i = 0; i < Math.max(aTie.length, bTie.length); i++) {
      const diff = (bTie[i] ?? -Infinity) - (aTie[i] ?? -Infinity);
      if (diff !== 0) return diff;
    }
    // Bab 13.3: "Nama atau ID hanya boleh mengurutkan tampilan dalam ikatan, bukan menetapkan
    // pemenang" — dipakai semata agar urutan tampilan stabil, bukan sebagai penentu peringkat.
    return a.objectName.localeCompare(b.objectName);
  });
  assignCompetitionRanks(eligible, tieBreakByObject);

  notEligible.sort((a, b) => a.objectName.localeCompare(b.objectName));

  return [...eligible, ...notEligible];
}

export interface CombinedRanking {
  pimpinanWeight: number;
  entries: RankedEntry[];
}

/**
 * Peringkat gabungan kedua kelompok: nilai Pimpinan × bobot + nilai Selain Pimpinan × sisanya
 * (mis. atasan 60% + sejawat 40% pada kategori tendik). Hanya ada bila kategori menetapkan bobot
 * gabungan; bobotnya dibaca dari snapshot run, bukan dari kategori saat ini, supaya peringkat dari
 * run yang sudah difinalkan tidak ikut berubah.
 *
 * Sebuah objek baru layak peringkat gabungan bila KEDUA kelompoknya memenuhi syarat — nilai yang
 * separuhnya belum ada tidak boleh dibandingkan dengan nilai yang lengkap. Parameter pembeda
 * memakai urutan milik aturan kelompok Pimpinan (bila kosong, milik Selain Pimpinan), dengan nilai
 * per parameter yang digabung memakai bobot yang sama.
 */
export async function getCombinedRanking(options: {
  categoryId: string;
  unitIds?: string[] | null;
}): Promise<CombinedRanking | null> {
  const run = await getLatestRun(options.categoryId);
  if (!run) return null;
  const snapshot = run.groupRuleSnapshot as Record<
    string,
    { tieBreakParameterIds?: string[] | null; pimpinanWeight?: number | null } | undefined
  >;
  const bobot = snapshot.GABUNGAN?.pimpinanWeight;
  if (bobot == null) return null;
  const wP = bobot / 100;
  const wS = 1 - wP;

  const tieBreakParameterIds =
    (snapshot.PIMPINAN?.tieBreakParameterIds?.length
      ? snapshot.PIMPINAN.tieBreakParameterIds
      : snapshot.SELAIN_PIMPINAN?.tieBreakParameterIds) ?? [];

  const results = await prisma.objectGroupResult.findMany({
    where: { runId: run.id },
    include: {
      categoryObject: { include: { object: true } },
      parameterResults: true,
    },
  });

  const perObjek = new Map<string, { pimpinan?: (typeof results)[number]; selain?: (typeof results)[number] }>();
  for (const r of results) {
    const e = perObjek.get(r.categoryObjectId) ?? {};
    if (r.group === "PIMPINAN") e.pimpinan = r;
    else e.selain = r;
    perObjek.set(r.categoryObjectId, e);
  }

  const entries: RankedEntry[] = [];
  const tieBreakByObject = new Map<string, number[]>();
  for (const [categoryObjectId, { pimpinan, selain }] of perObjek) {
    const contoh = pimpinan ?? selain!;
    const ownerUnitId = contoh.categoryObject.ownerUnitIdSnapshot ?? contoh.categoryObject.object.ownerUnitId;
    if (options.unitIds && !options.unitIds.includes(ownerUnitId)) continue;

    const layak = pimpinan?.eligibility === "MEMENUHI_SYARAT" && selain?.eligibility === "MEMENUHI_SYARAT";
    const kosong = (pimpinan?.responseCount ?? 0) + (selain?.responseCount ?? 0) === 0;
    const score =
      pimpinan?.score != null && selain?.score != null
        ? Math.round((pimpinan.score * wP + selain.score * wS) * 1e6) / 1e6
        : null;

    entries.push({
      categoryObjectId,
      objectName: contoh.categoryObject.nameSnapshot,
      unitName: contoh.categoryObject.unitSnapshot,
      ownerUnitId,
      group: "PIMPINAN",
      score,
      responseCount: (pimpinan?.responseCount ?? 0) + (selain?.responseCount ?? 0),
      eligibility: layak ? "MEMENUHI_SYARAT" : kosong ? "BELUM_ADA_PENILAIAN" : "BELUM_MEMENUHI_MINIMUM",
      rank: null,
      tied: false,
    });

    if (tieBreakParameterIds.length > 0) {
      tieBreakByObject.set(
        categoryObjectId,
        tieBreakParameterIds.map((pid) => {
          const p = pimpinan?.parameterResults.find((x) => x.parameterId === pid)?.aggregate;
          const s = selain?.parameterResults.find((x) => x.parameterId === pid)?.aggregate;
          return p == null || s == null ? -Infinity : Math.round((p * wP + s * wS) * 1e6) / 1e6;
        })
      );
    }
  }

  const eligible = entries.filter((e) => e.eligibility === "MEMENUHI_SYARAT");
  const notEligible = entries.filter((e) => e.eligibility !== "MEMENUHI_SYARAT");
  eligible.sort((a, b) => {
    if (b.score !== a.score) return (b.score ?? 0) - (a.score ?? 0);
    const aTie = tieBreakByObject.get(a.categoryObjectId) ?? [];
    const bTie = tieBreakByObject.get(b.categoryObjectId) ?? [];
    for (let i = 0; i < Math.max(aTie.length, bTie.length); i++) {
      const diff = (bTie[i] ?? -Infinity) - (aTie[i] ?? -Infinity);
      if (diff !== 0) return diff;
    }
    return a.objectName.localeCompare(b.objectName);
  });
  assignCompetitionRanks(eligible, tieBreakByObject);
  notEligible.sort((a, b) => a.objectName.localeCompare(b.objectName));

  return { pimpinanWeight: bobot, entries: [...eligible, ...notEligible] };
}

// Bab 13.5/EDGE-19: memangkas hasil ke unit yang boleh dilihat aktor, berdasarkan unit OBJEK
// (bukan unit penilai).
//
// TIDAK dipakai oleh halaman/ekspor hasil saat ini — keduanya memangkas lebih awal lewat parameter
// `unitIds` pada getRanking() di atas, diisi dari getPeriodScope() (Bab 5.3: lingkup berdasarkan
// unitTreeSnapshot PERIODE saat itu, bukan pohon organisasi yang mungkin sudah berubah). Fungsi ini
// memakai pohon organisasi LIVE lewat isUnitInScope(), yang berbeda semantik untuk kasus reorganisasi
// — jangan gabungkan keduanya pada alur yang sama. Dibiarkan tersedia (dan diuji tersendiri) untuk
// pemakaian di luar konteks periode, bukan sebagai lapisan kedua yang mubazir pada alur hasil/ekspor.
export function filterRankingByScope(entries: RankedEntry[], actor: AuthContext): RankedEntry[] {
  if (actor.isAdmin || actor.isDekan) return entries;
  return entries.filter((e) => isUnitInScope(actor, e.ownerUnitId));
}
