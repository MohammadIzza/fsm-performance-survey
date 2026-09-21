"use server";

import { revalidatePath } from "next/cache";
import { requireAdminActor } from "@/lib/authz";
import {
  previewUnitImport,
  previewUserImport,
  previewLeadershipImport,
  applyImport,
  type ImportPreview,
} from "@/lib/services/imports";
import { ServiceError } from "@/lib/services/units";
import type { ImportEntity } from "@/generated/prisma/enums";

export interface PreviewState {
  error?: string;
  preview?: ImportPreview;
  fileName?: string;
}

export interface ApplyState {
  error?: string;
  success?: boolean;
  summary?: { totalRows: number; toCreate: number; toUpdate: number };
}

async function readFile(formData: FormData): Promise<{ buffer: ArrayBuffer; name: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new ServiceError("Pilih berkas Excel (.xlsx) untuk diunggah.");
  }
  return { buffer: await file.arrayBuffer(), name: file.name };
}

export async function previewImportAction(_prev: PreviewState, formData: FormData): Promise<PreviewState> {
  await requireAdminActor();
  const entity = String(formData.get("entity") ?? "") as ImportEntity;
  try {
    const { buffer, name } = await readFile(formData);
    const preview =
      entity === "UNIT"
        ? await previewUnitImport(buffer)
        : entity === "PENGGUNA"
          ? await previewUserImport(buffer)
          : await previewLeadershipImport(buffer);
    // Isi barisnya tidak dikirim ke peramban: halaman hanya menampilkan jumlah dan galat, penerapan
    // membaca ulang berkasnya sendiri, dan berkas Pengguna dapat memuat kata sandi terbaca.
    return { preview: { ...preview, rows: [] }, fileName: name };
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    return { error: "Berkas tidak dapat dibaca. Pastikan formatnya .xlsx yang valid." };
  }
}

export async function applyImportAction(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const actor = await requireAdminActor();
  const entity = String(formData.get("entity") ?? "") as ImportEntity;
  try {
    const { buffer, name } = await readFile(formData);
    const preview = await applyImport(entity, buffer, name, actor);
    revalidatePath("/admin/impor");
    revalidatePath("/admin/organisasi");
    revalidatePath("/admin/pengguna");
    return {
      success: true,
      summary: { totalRows: preview.totalRows, toCreate: preview.toCreate, toUpdate: preview.toUpdate },
    };
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
}
