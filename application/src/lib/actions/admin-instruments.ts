"use server";
import { beginInstrumentRevision } from "@/lib/services/instruments";

import { revalidatePath } from "next/cache";
import { requireAdminActor } from "@/lib/authz";
import {
  addParameter,
  updateParameter,
  deleteParameter,
  updateInstrumentScale,
  duplicateInstrumentFrom,
} from "@/lib/services/instruments";
import { updateCombinedWeight, updateGroupRule } from "@/lib/services/groupRules";
import { updateAssignmentRule } from "@/lib/services/assignmentRules";
import { updateGradeBands } from "@/lib/services/categories";
import { ServiceError } from "@/lib/services/units";
import { atomic, prisma } from "@/lib/prisma";
import type { AmbangPredikat } from "@/lib/predikat";
import type { AggregationMethod, AssignmentScope } from "@/generated/prisma/enums";

export interface FormState {
  error?: string;
}

function revalidateCategory(periodId: string, categoryId: string) {
  revalidatePath(`/admin/periode/${periodId}`);
  revalidatePath(`/admin/periode/${periodId}/kategori/${categoryId}`);
}

export async function addParameterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const instrumentVersionId = String(formData.get("instrumentVersionId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  try {
    await addParameter(
      instrumentVersionId,
      {
        name: String(formData.get("name") ?? ""),
        indicator: (formData.get("indicator") as string) || null,
        weight: Number(formData.get("weight") ?? 0),
        normalized: formData.get("normalized") === "on",
      },
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidateCategory(periodId, categoryId);
  return {};
}

export async function updateParameterAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const parameterId = String(formData.get("parameterId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  try {
    await updateParameter(
      parameterId,
      {
        name: String(formData.get("name") ?? ""),
        indicator: (formData.get("indicator") as string) || null,
        weight: Number(formData.get("weight") ?? 0),
        normalized: formData.get("normalized") === "on",
      },
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidateCategory(periodId, categoryId);
  return {};
}

export async function deleteParameterAction(formData: FormData): Promise<void> {
  const actor = await requireAdminActor();
  const parameterId = String(formData.get("parameterId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  await deleteParameter(parameterId, actor);
  revalidateCategory(periodId, categoryId);
}

export async function updateInstrumentScaleAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const instrumentVersionId = String(formData.get("instrumentVersionId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  try {
    await updateInstrumentScale(
      instrumentVersionId,
      {
        scaleMin: Number(formData.get("scaleMin") ?? 0),
        scaleMax: Number(formData.get("scaleMax") ?? 100),
        scaleStep: Number(formData.get("scaleStep") ?? 1),
        guide: (formData.get("guide") as string) || null,
      },
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidateCategory(periodId, categoryId);
  return {};
}

export async function duplicateInstrumentAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const instrumentVersionId = String(formData.get("instrumentVersionId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const sourceCategoryId = String(formData.get("sourceCategoryId") ?? "");
  if (!sourceCategoryId) return { error: "Pilih kategori sumber." };
  try {
    await duplicateInstrumentFrom(instrumentVersionId, sourceCategoryId, actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidateCategory(periodId, categoryId);
  return {};
}

export async function updateGroupRuleAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const groupRuleId = String(formData.get("groupRuleId") ?? "");
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  try {
    await updateGroupRule(
      groupRuleId,
      {
        aggregation: String(formData.get("aggregation") ?? "RATA_RATA") as AggregationMethod,
        target: Number(formData.get("target") ?? 0),
        minimum: Number(formData.get("minimum") ?? 1),
        expectedRevision:Number(formData.get("expectedRevision")??0),
        tieBreakParameterIds:formData.getAll("tieBreakParameterIds").map(String),
      },
      actor
    );
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidateCategory(periodId, categoryId);
  return {};
}

export async function updateCombinedWeightAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const aktif = formData.get("gabung") === "on";
  const bobot = Number(formData.get("pimpinanWeight") ?? "");
  try {
    await updateCombinedWeight(categoryId, aktif ? bobot : null, actor);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidateCategory(periodId, categoryId);
  return {};
}

export async function beginInstrumentRevisionAction(_prev:FormState,form:FormData):Promise<FormState>{
 const actor=await requireAdminActor();
 const categoryId=String(form.get("categoryId")??"");const periodId=String(form.get("periodId")??"");
 try{await beginInstrumentRevision(categoryId,String(form.get("reason")??""),String(form.get("correctionEndsAt")??"")+"+07:00",actor)}catch(e){if(e instanceof ServiceError)return {error:e.message};throw e}
 revalidateCategory(periodId,categoryId);return {};
}

/**
 * Menyimpan seluruh bagian "Aturan penilai" sekaligus: jumlah penilai kedua kelompok, bobot nilai
 * gabungan, ambang predikat, dan syarat calon kedua kelompok.
 *
 * Satu tombol, satu transaksi. Sebelumnya tiap bagian punya tombol Simpan sendiri, dan perubahan
 * di bagian yang tidak ditekan tombolnya hilang tanpa peringatan.
 *
 * Bagian mana yang boleh ikut tersimpan ditentukan di sini dari status periode, bukan dari isian
 * yang dikirim peramban: pada status selain Draf, isian jumlah penilai dan syarat calon memang
 * ditampilkan terkunci, dan service-nya pun akan menolaknya — mengirimnya hanya akan menggagalkan
 * penyimpanan bagian lain yang sebenarnya masih boleh diubah.
 */
export async function simpanAturanPenilaiAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const actor = await requireAdminActor();
  const periodId = String(formData.get("periodId") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const teks = (nama: string) => String(formData.get(nama) ?? "");

  const kategori = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { period: { select: { status: true } } },
  });
  if (!kategori) return { error: "Kategori tidak ditemukan." };
  const status = kategori.period.status;
  const bolehAturan = status === "DRAF";
  const bolehGabungan = ["DRAF", "SIAP", "AKTIF"].includes(status);
  const bolehPredikat = status !== "FINAL";

  try {
    await atomic(async () => {
      if (bolehAturan) {
        for (const id of formData.getAll("groupRuleIds").map(String)) {
          await updateGroupRule(
            id,
            {
              aggregation: (teks(`gr__${id}__aggregation`) || "RATA_RATA") as AggregationMethod,
              target: Number(teks(`gr__${id}__target`) || 0),
              minimum: Number(teks(`gr__${id}__minimum`) || 1),
              expectedRevision: Number(teks(`gr__${id}__revision`) || 0),
              tieBreakParameterIds: formData.getAll(`gr__${id}__tieBreakParameterIds`).map(String),
            },
            actor
          );
        }
        for (const id of formData.getAll("assignmentRuleIds").map(String)) {
          await updateAssignmentRule(
            id,
            {
              scope: (teks(`ar__${id}__scope`) || "UNIT_OBJEK") as AssignmentScope,
              userTypeIds: formData.getAll(`ar__${id}__userTypeIds`).map(String),
            },
            actor
          );
        }
      }

      if (bolehGabungan && formData.has("adaGabungan")) {
        const aktif = formData.get("gabung") === "on";
        await updateCombinedWeight(categoryId, aktif ? Number(teks("pimpinanWeight")) : null, actor);
      }

      if (bolehPredikat && formData.has("adaPredikat")) {
        let bands: AmbangPredikat[] | null = null;
        if (formData.get("pakai") === "on") {
          const label = formData.getAll("bandLabel").map(String);
          const batas = formData.getAll("bandMin").map(String);
          bands = label
            .map((teksLabel, i) => ({ label: teksLabel.trim(), min: Number(batas[i]) }))
            .filter((b) => b.label !== "");
        }
        await updateGradeBands(categoryId, bands, actor);
      }
    });
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }

  revalidateCategory(periodId, categoryId);
  revalidatePath(`/hasil/${categoryId}`);
  return {};
}
