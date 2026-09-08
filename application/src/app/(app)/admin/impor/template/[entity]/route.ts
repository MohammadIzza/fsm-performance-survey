import { NextResponse } from "next/server";
import { requireAdminActor } from "@/lib/authz";
import { buildTemplateWorkbook } from "@/lib/services/imports";
import type { ImportEntity } from "@/generated/prisma/enums";

const VALID_ENTITIES: ImportEntity[] = ["UNIT", "PENGGUNA", "PIMPINAN"];

// Bab 15.1: "Alur: unduh template → isi → unggah ..." — berkas template disajikan sebagai
// unduhan biner, karenanya lewat Route Handler alih-alih Server Action.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  try {
    await requireAdminActor();
  } catch {
    return NextResponse.json({ error: "Tidak berwenang." }, { status: 403 });
  }

  const { entity } = await params;
  const upper = entity.toUpperCase() as ImportEntity;
  if (!VALID_ENTITIES.includes(upper)) {
    return NextResponse.json({ error: "Jenis template tidak dikenal." }, { status: 404 });
  }

  const workbook = buildTemplateWorkbook(upper);
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="template-${entity.toLowerCase()}.xlsx"`,
    },
  });
}
