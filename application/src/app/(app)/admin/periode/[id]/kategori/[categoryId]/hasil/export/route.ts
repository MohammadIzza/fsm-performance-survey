import { NextResponse } from "next/server";
import { requireAdminActor } from "@/lib/authz";
import { getRanking } from "@/lib/services/rankings";
import { buildResultsExport } from "@/lib/services/exports";
import { prisma } from "@/lib/prisma";

// Bab 15.2/19: exportResults — hanya Admin di jalur ini (jalur pimpinan/Dekan ada di
// /hasil/[categoryId]/export dengan pemangkasan lingkup). Route Handler dipakai (bukan Server
// Action) karena hasilnya berkas biner untuk diunduh, bukan data yang diserialisasi ke klien.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; categoryId: string }> }
) {
  let actor;
  try {
    actor = await requireAdminActor();
  } catch {
    // Bab 19.2: bedakan "tidak berwenang" dari kegagalan sistem — bukan redirect() (itu
    // sudah ditangani requireAdminActor sendiri untuk kasus belum login).
    return NextResponse.json({ error: "Tidak berwenang." }, { status: 403 });
  }

  const { categoryId } = await params;
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return NextResponse.json({ error: "Kategori tidak ditemukan." }, { status: 404 });
  }

  const [pimpinan, selain] = await Promise.all([
    getRanking({ categoryId, group: "PIMPINAN" }),
    getRanking({ categoryId, group: "SELAIN_PIMPINAN" }),
  ]);

  const workbook = await buildResultsExport(categoryId, { pimpinan, selain }, actor);
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="hasil-${category.code}.xlsx"`,
    },
  });
}
