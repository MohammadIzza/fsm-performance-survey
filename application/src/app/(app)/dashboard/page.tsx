import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAuthContext } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listMyAssignments, computeDisplayStatus } from "@/lib/services/responses";
import { PageHero } from "@/components/page-hero";
import { UspGrid, UspCard } from "@/components/theme/usp-grid";
import { DataList, DataRow, RowTitle, RowField } from "@/components/theme/data-list";

export default async function HomePage() {
  const session = await getSession();
  if (!session.userId) redirect("/login");

  const ctx = await getAuthContext(session.userId);
  if (!ctx) redirect("/login");

  const [scopeUnits, myAssignments] = await Promise.all([
    ctx.scopeUnitIds.length
      ? prisma.unit.findMany({
          where: { id: { in: ctx.scopeUnitIds } },
          select: { code: true, name: true },
          orderBy: { code: "asc" },
        })
      : Promise.resolve([]),
    listMyAssignments(ctx.userId),
  ]);

  const pendingCount = myAssignments.filter((a) => {
    const status = computeDisplayStatus(a.status, a.categoryObject.category.period.status, a.categoryObject.category.period.endsAt);
    return status === "BELUM_MULAI" || status === "DRAF" || status === "DIBUKA_KEMBALI";
  }).length;

  // Pengguna biasa (bukan Admin/Dekan/Pimpinan Unit) yang masih punya tugas penilaian belum
  // selesai diarahkan langsung ke daftar tugasnya, bukan ke beranda — mencegah tanggungan survei
  // terlewat karena tersembunyi di balik satu klik lagi. Admin/Dekan/Pimpinan Unit tidak digerbang
  // karena mereka butuh akses penuh untuk mengelola sistem terlepas dari tugas penilaian pribadi
  // mereka sendiri; halaman lain (Hasil, seluruh /admin) sudah punya penjagaan perannya sendiri,
  // jadi bagi pengguna biasa beranda ini memang satu-satunya halaman "lain" yang bisa dicapai.
  const isPlainUser = !ctx.isAdmin && !ctx.isDekan && ctx.leadershipUnitIds.length === 0;
  if (isPlainUser && pendingCount > 0) {
    redirect("/tugas");
  }

  const roleLabel = ctx.isAdmin
    ? "Admin"
    : ctx.isDekan
      ? "Dekan"
      : ctx.leadershipUnitIds.length > 0
        ? "Pimpinan Unit"
        : "Pengguna";

  const scopeDescription = ctx.isAdmin
    ? "Akses penuh seluruh fakultas (Admin)."
    : ctx.isDekan
      ? "Akses seluruh fakultas sebagai pimpinan tertinggi (Dekan)."
      : ctx.leadershipUnitIds.length > 0
        ? "Akses unit yang dipimpin beserta subunitnya."
        : "Belum memiliki lingkup pengelolaan unit.";

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow={`RUANG PENILAIAN · ${roleLabel}`}
        title={
          <>
            Selamat datang,
            <br />
            {ctx.name.split(" ")[0]}.
          </>
        }
        description="Kelola tugas, berikan penilaian, dan ikuti perkembangan sesuai peran Anda."
      />

      <UspGrid
        title="Ringkasan Anda"
        intro={`Masuk sebagai ${ctx.loginIdentifier}, dengan peran ${roleLabel}.`}
      >
        <UspCard title="Tugas penilaian" tone={pendingCount > 0 ? "kuning" : "tosca"}>
          {myAssignments.length === 0
            ? "Belum ada tugas penilaian untuk Anda."
            : pendingCount > 0
              ? `${pendingCount} dari ${myAssignments.length} tugas belum selesai diisi.`
              : `Semua ${myAssignments.length} tugas sudah terkirim.`}
        </UspCard>
        <UspCard title="Lingkup akses" tone="biru">
          {scopeDescription}
        </UspCard>
      </UspGrid>

      {scopeUnits.length > 0 && (
        <DataList
            title="Unit dalam lingkup"
            intro="Unit yang hasilnya dapat Anda baca."
            columns={[
              ["title", "Unit"],
              ["price", "Kode"],
            ]}
          >
          {scopeUnits.map((u, i) => (
            <DataRow key={u.code} href="/hasil" accent={i % 2 === 0 ? "green" : "pink"}>
              <RowTitle accent={i % 2 === 0 ? "green" : "pink"}>{u.name}</RowTitle>
              <RowField kind="price" icon={false}>{u.code}</RowField>
            </DataRow>
          ))}
        </DataList>
      )}
    </div>
  );
}
