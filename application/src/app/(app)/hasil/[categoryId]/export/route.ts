import { getPeriodScope } from "@/lib/authz";
import { NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/authz";
import { getRanking } from "@/lib/services/rankings";
import { isResultAccessOpenForNonAdmin } from "@/lib/services/resultAccess";
import { buildResultsExport } from "@/lib/services/exports";
import { prisma } from "@/lib/prisma";

// Bab 15.2/19: exportResults untuk Dekan/Pimpinan Unit — memakai gerbang otorisasi yang PERSIS
// sama dengan halaman /hasil/[categoryId] (lingkup + waktu akses) sebelum data disusun.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const ctx = await getCurrentAuthContext();
  if (!ctx || (!ctx.isAdmin && !ctx.isDekan && ctx.leadershipUnitIds.length === 0)) {
    return NextResponse.json({ error: "Tidak berwenang." }, { status: 403 });
  }

  const { categoryId } = await params;
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { period: { include: { accessPolicy: true } } },
  });
  if (!category) {
    return NextResponse.json({ error: "Kategori tidak ditemukan." }, { status: 404 });
  }

  const accessOpen =
    ctx.isAdmin ||
    (category.period.accessPolicy
      ? isResultAccessOpenForNonAdmin({
          mode: category.period.accessPolicy.mode,
          availableAt: category.period.accessPolicy.availableAt,
          periodStatus: category.period.status,
        })
      : false);
  if (!accessOpen) {
    return NextResponse.json({ error: "Hasil belum dapat diakses." }, { status: 403 });
  }

  const [pAll, sAll] = await Promise.all([
    getRanking({ categoryId, group: "PIMPINAN", unitIds: await getPeriodScope(ctx, category.periodId) }),
    getRanking({ categoryId, group: "SELAIN_PIMPINAN", unitIds: await getPeriodScope(ctx, category.periodId) }),
  ]);
  const pimpinan = pAll;
  const selain = sAll;

  const workbook = await buildResultsExport(categoryId, { pimpinan, selain }, ctx);
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="hasil-${category.code}.xlsx"`,
    },
  });
}
