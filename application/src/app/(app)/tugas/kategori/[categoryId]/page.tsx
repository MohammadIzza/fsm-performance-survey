import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/lib/authz";
import { getCategorySheetData, listMyCategories } from "@/lib/services/responses";
import { ServiceError } from "@/lib/services/units";
import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { LembarKategori } from "./lembar-kategori";
import type { AssessmentGroup } from "@/generated/prisma/enums";

/**
 * Lembar penilaian satu kategori — judulnya kategori, isinya seluruh objek yang ditugaskan kepada
 * penilai ini. Halaman per tugas (/tugas/[assignmentId]) tetap ada untuk tautan langsung dan alat
 * admin; halaman ini yang dipakai penilai sehari-hari.
 */

const groupLabel: Record<AssessmentGroup, string> = {
  PIMPINAN: "Pimpinan",
  SELAIN_PIMPINAN: "Selain pimpinan",
};

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function LembarKategoriPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{ kelompok?: string }>;
}) {
  const { categoryId } = await params;
  const { kelompok } = await searchParams;
  const ctx = await getCurrentAuthContext();
  if (!ctx) redirect("/login");

  // Satu penilai bisa menilai kategori yang sama di dua kelompok (mis. sebagai pimpinan unit dan
  // sebagai rekan sejawat). Aturan minimum dan agregasinya berbeda, jadi lembarnya dipisah.
  const kategoriSaya = (await listMyCategories(ctx.userId)).filter((k) => k.categoryId === categoryId);
  if (kategoriSaya.length === 0) notFound();
  const group = (
    kategoriSaya.find((k) => k.group === kelompok)?.group ?? kategoriSaya[0].group
  ) as AssessmentGroup;

  let data;
  try {
    data = await getCategorySheetData(categoryId, group, ctx);
  } catch (e) {
    if (e instanceof ServiceError) notFound();
    throw e;
  }

  const { category, period, lembar, jumlahObjek } = data;
  const baris = lembar.flatMap((l) => l.baris);
  const terkirim = baris.filter((b) => b.displayStatus === "TERKIRIM").length;
  const belum = jumlahObjek - terkirim;

  return (
    <div className="assignment-detail space-y-8">
      <PageIntro title={category.name} intro={`${period.name} · penilaian sebagai ${groupLabel[group].toLowerCase()}`}>
        <SummaryCard tone="kuning" label="Objek dinilai" value={jumlahObjek} note={category.objectType.name} />
        <SummaryCard tone="tosca" label="Sudah dikirim" value={terkirim} note="terkunci dan dihitung" />
        <SummaryCard
          tone={belum > 0 ? "biru" : "tosca"}
          label="Belum selesai"
          value={belum}
          note={`Tenggat ${dateFmt.format(period.endsAt)}`}
        />
      </PageIntro>

      {kategoriSaya.length > 1 && (
        <nav className="category-tabs" aria-label="Kelompok penilaian">
          {kategoriSaya.map((k) => (
            <Link
              key={k.group}
              href={`/tugas/kategori/${categoryId}?kelompok=${k.group}`}
              className="category-tabs__tab"
              aria-current={k.group === group ? "page" : undefined}
            >
              {groupLabel[k.group]} ({k.total})
            </Link>
          ))}
        </nav>
      )}

      {period.status !== "AKTIF" && (
        <div className="assignment-detail__notice app-note">
          Periode {period.name} tidak sedang aktif, jadi isian di bawah hanya dapat dibaca kecuali
          tugasnya sedang dibuka kembali oleh admin.
        </div>
      )}

      {/* Umumnya hanya satu lembar. Dua lembar muncul bila penugasan diterbitkan ulang setelah
          instrumennya direvisi — parameternya berbeda, jadi tidak boleh disatukan satu tabel. */}
      {lembar.map((l, i) => (
        <div key={l.instrumen.id} className="space-y-6">
          {lembar.length > 1 && (
            <p className="app-note app-note--perhatian app-text-sm">
              Kelompok objek {i + 1} memakai instrumen revisi {l.instrumen.revision}.
            </p>
          )}
          <LembarKategori
            parameters={l.instrumen.parameters}
            scale={{
              min: l.instrumen.scaleMin,
              max: l.instrumen.scaleMax,
              step: l.instrumen.scaleStep,
            }}
            guide={l.instrumen.guide}
            baris={l.baris}
          />
        </div>
      ))}
    </div>
  );
}
