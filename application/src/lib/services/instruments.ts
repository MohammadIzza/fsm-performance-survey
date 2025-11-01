import { atomic } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { ServiceError } from "@/lib/services/units";
import type { AuthContext } from "@/lib/authz";

async function assertDraftInstrument(instrumentVersionId: string) {
  const instrument = await prisma.instrumentVersion.findUnique({
    where: { id: instrumentVersionId },
    include: { category: { include: { period: true } } },
  });
  if (!instrument) throw new ServiceError("Instrumen tidak ditemukan.");
  // INS-08: versi lama tidak ditimpa setelah dipakai jawaban. Sebelum Tahap 4 (jawaban) ada,
  // pembatasan yang berlaku adalah instrumen hanya dapat diubah selama periode masih Draf.
  if (instrument.category.period.status !== "DRAF" && instrument.category.period.status !== "REVISI") {
    throw new ServiceError("Instrumen hanya dapat diubah selama periode berstatus Draf.");
  }
  const used=await prisma.responseScore.count({where:{parameter:{instrumentVersionId},responseRevision:{state:"SUBMITTED"}}});
  if(used) throw new ServiceError("Versi instrumen sudah dipakai. Buat versi revisi baru sebelum mengubahnya.");
  return instrument;
}

export interface ParameterInput {
  name: string;
  indicator: string | null;
  weight: number;
  /** Dipertahankan opsional untuk pemanggil lama; urutan baru selalu ditentukan oleh server. */
  order?: number;
}

// INS-02: bobot parameter persentase nonnegatif.
function validateWeight(weight: number) {
  if (!Number.isFinite(weight) || weight < 0 || weight > 100) {
    throw new ServiceError("Bobot harus berupa angka antara 0 dan 100.");
  }
}

async function validateTotalWeight(
  instrumentVersionId: string,
  weight: number,
  excludedParameterId?: string
) {
  const current = await prisma.parameter.aggregate({
    where: {
      instrumentVersionId,
      ...(excludedParameterId ? { id: { not: excludedParameterId } } : {}),
    },
    _sum: { weight: true },
  });
  const used = current._sum.weight ?? 0;
  if (used + weight > 100 + 0.000001) {
    const remaining = Math.max(0, 100 - used);
    throw new ServiceError(
      `Total bobot tidak boleh lebih dari 100%. Bobot yang masih tersedia ${remaining}%.`
    );
  }
}

async function addParameterImpl(
  instrumentVersionId: string,
  input: ParameterInput,
  actor: AuthContext
) {
  await assertDraftInstrument(instrumentVersionId);

  const name = input.name.trim();
  if (!name) throw new ServiceError("Nama parameter wajib diisi.");
  validateWeight(input.weight);
  await validateTotalWeight(instrumentVersionId, input.weight);

  const lastParameter = await prisma.parameter.findFirst({
    where: { instrumentVersionId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const parameter = await prisma.parameter.create({
    data: {
      instrumentVersionId,
      name,
      indicator: input.indicator?.trim() || null,
      weight: input.weight,
      order: (lastParameter?.order ?? 0) + 1,
    },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "PARAMETER_CREATE",
    entity: "Parameter",
    entityId: parameter.id,
    after: parameter,
  });

  return parameter;
}

async function updateParameterImpl(
  parameterId: string,
  input: ParameterInput,
  actor: AuthContext
) {
  const before = await prisma.parameter.findUnique({ where: { id: parameterId } });
  if (!before) throw new ServiceError("Parameter tidak ditemukan.");
  await assertDraftInstrument(before.instrumentVersionId);

  const name = input.name.trim();
  if (!name) throw new ServiceError("Nama parameter wajib diisi.");
  validateWeight(input.weight);
  await validateTotalWeight(before.instrumentVersionId, input.weight, parameterId);

  const parameter = await prisma.parameter.update({
    where: { id: parameterId },
    data: {
      name,
      indicator: input.indicator?.trim() || null,
      weight: input.weight,
    },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "PARAMETER_UPDATE",
    entity: "Parameter",
    entityId: parameter.id,
    before,
    after: parameter,
  });

  return parameter;
}

async function deleteParameterImpl(parameterId: string, actor: AuthContext) {
  const before = await prisma.parameter.findUnique({ where: { id: parameterId } });
  if (!before) throw new ServiceError("Parameter tidak ditemukan.");
  await assertDraftInstrument(before.instrumentVersionId);

  await prisma.parameter.delete({ where: { id: parameterId } });

  const remaining = await prisma.parameter.findMany({
    where: { instrumentVersionId: before.instrumentVersionId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true, order: true },
  });
  for (const [index, parameter] of remaining.entries()) {
    const nextOrder = index + 1;
    if (parameter.order !== nextOrder) {
      await prisma.parameter.update({ where: { id: parameter.id }, data: { order: nextOrder } });
    }
  }

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "PARAMETER_DELETE",
    entity: "Parameter",
    entityId: parameterId,
    before,
  });
}

// Menyalin instrumen (skala + seluruh parameter) dari kategori lain — dipakai admin agar tidak
// perlu mengetik ulang parameter dari nol tiap kali membuat kategori baru yang serupa dengan
// periode sebelumnya. Mengganti (bukan menggabung) parameter yang sudah ada di instrumen tujuan.
async function duplicateInstrumentFromImpl(
  targetInstrumentVersionId: string,
  sourceCategoryId: string,
  actor: AuthContext
) {
  await assertDraftInstrument(targetInstrumentVersionId);

  const source = await prisma.instrumentVersion.findFirst({
    where: { categoryId: sourceCategoryId },
    orderBy: { revision: "desc" },
    include: { parameters: { orderBy: { order: "asc" } } },
  });
  if (!source) throw new ServiceError("Kategori sumber tidak memiliki instrumen.");
  if (source.id === targetInstrumentVersionId) {
    throw new ServiceError("Tidak dapat menyalin dari kategori yang sama.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.instrumentVersion.update({
      where: { id: targetInstrumentVersionId },
      data: {
        scaleMin: source.scaleMin,
        scaleMax: source.scaleMax,
        scaleStep: source.scaleStep,
        guide: source.guide,
      },
    });
    await tx.parameter.deleteMany({ where: { instrumentVersionId: targetInstrumentVersionId } });
    if (source.parameters.length > 0) {
      await tx.parameter.createMany({
        data: source.parameters.map((p) => ({
          instrumentVersionId: targetInstrumentVersionId,
          name: p.name,
          indicator: p.indicator,
          weight: p.weight,
          order: p.order,
        })),
      });
    }
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "INSTRUMENT_DUPLICATE",
    entity: "InstrumentVersion",
    entityId: targetInstrumentVersionId,
    after: { sourceCategoryId, parameterCount: source.parameters.length },
  });
}

export interface ScaleInput {
  scaleMin: number;
  scaleMax: number;
  scaleStep: number;
  guide: string | null;
}

// Bab 9.2: skala default 0–100 langkah 1; admin dapat memilih rentang lain (mis. 1–5).
async function updateInstrumentScaleImpl(
  instrumentVersionId: string,
  input: ScaleInput,
  actor: AuthContext
) {
  const before = await assertDraftInstrument(instrumentVersionId);

  if (!Number.isFinite(input.scaleMin) || !Number.isFinite(input.scaleMax)) {
    throw new ServiceError("Rentang skala harus berupa angka.");
  }
  if (input.scaleMin >= input.scaleMax) {
    throw new ServiceError("Skala minimum harus lebih kecil dari maksimum.");
  }
  if (!Number.isFinite(input.scaleStep) || input.scaleStep <= 0) {
    throw new ServiceError("Langkah skala harus lebih besar dari nol.");
  }

  const instrument = await prisma.instrumentVersion.update({
    where: { id: instrumentVersionId },
    data: {
      scaleMin: input.scaleMin,
      scaleMax: input.scaleMax,
      scaleStep: input.scaleStep,
      guide: input.guide?.trim() || null,
    },
  });

  await writeAudit({
    actorId: actor.userId,
    actorRole: "ADMIN",
    action: "INSTRUMENT_SCALE_UPDATE",
    entity: "InstrumentVersion",
    entityId: instrument.id,
    before,
    after: instrument,
  });

  return instrument;
}

export async function addParameter(...args: Parameters<typeof addParameterImpl>): Promise<Awaited<ReturnType<typeof addParameterImpl>>> {
  return atomic(() => addParameterImpl(...args));
}

export async function updateParameter(...args: Parameters<typeof updateParameterImpl>): Promise<Awaited<ReturnType<typeof updateParameterImpl>>> {
  return atomic(() => updateParameterImpl(...args));
}

export async function deleteParameter(...args: Parameters<typeof deleteParameterImpl>): Promise<Awaited<ReturnType<typeof deleteParameterImpl>>> {
  return atomic(() => deleteParameterImpl(...args));
}

export async function duplicateInstrumentFrom(...args: Parameters<typeof duplicateInstrumentFromImpl>): Promise<Awaited<ReturnType<typeof duplicateInstrumentFromImpl>>> {
  return atomic(() => duplicateInstrumentFromImpl(...args));
}

export async function updateInstrumentScale(...args: Parameters<typeof updateInstrumentScaleImpl>): Promise<Awaited<ReturnType<typeof updateInstrumentScaleImpl>>> {
  return atomic(() => updateInstrumentScaleImpl(...args));
}

export async function beginInstrumentRevision(categoryId:string,reason:string,correctionEndsAt:string,actor:AuthContext){
 return atomic(async()=>{
  if(!actor.isAdmin||!reason.trim()) throw new ServiceError("Admin dan alasan revisi diperlukan.");
  const category=await prisma.category.findUniqueOrThrow({where:{id:categoryId},include:{period:true,instrumentVersions:{orderBy:{revision:"desc"},take:1,include:{parameters:true}},categoryObjects:{include:{assignments:{where:{status:{not:"DIBATALKAN"}}}}}}});
  if(category.period.status!=="REVISI") throw new ServiceError("Buka revisi periode terlebih dahulu.");
  const end=new Date(correctionEndsAt);
  if(!Number.isFinite(end.getTime())||end<=new Date()) throw new ServiceError("Tenggat pengisian ulang harus di masa mendatang.");
  const previous=category.instrumentVersions[0];
  if(!previous) throw new ServiceError("Instrumen tidak ditemukan.");
  const version=await prisma.instrumentVersion.create({data:{categoryId,revision:previous.revision+1,scaleMin:previous.scaleMin,scaleMax:previous.scaleMax,scaleStep:previous.scaleStep,guide:previous.guide}});
  const idMap=new Map<string,string>();
  for(const param of previous.parameters){const next=await prisma.parameter.create({data:{instrumentVersionId:version.id,name:param.name,indicator:param.indicator,weight:param.weight,order:param.order}});idMap.set(param.id,next.id)}
  const rules=await prisma.groupRule.findMany({where:{categoryId}});
  for(const rule of rules) await prisma.groupRule.update({where:{id:rule.id},data:{revision:{increment:1},tieBreakParameterIds:((rule.tieBreakParameterIds as string[]|null)??[]).map(id=>idMap.get(id)).filter((id):id is string=>!!id)}});
  for(const co of category.categoryObjects) for(const a of co.assignments){
   const last=await prisma.responseRevision.findFirst({where:{assignmentId:a.id},orderBy:{revision:"desc"}});
   await prisma.responseRevision.create({data:{assignmentId:a.id,revision:(last?.revision??0)+1,state:"DRAFT",editedById:actor.userId,reason}});
   await prisma.assignment.update({where:{id:a.id},data:{instrumentVersionId:version.id,status:"DIBUKA_KEMBALI",correctionEndsAt:end}});
  }
  await writeAudit({actorId:actor.userId,actorRole:"ADMIN",action:"INSTRUMENT_NEW_REVISION",entity:"InstrumentVersion",entityId:version.id,reason,after:{previousId:previous.id,revision:version.revision,correctionEndsAt:end.toISOString()}});
  return version;
 });
}
