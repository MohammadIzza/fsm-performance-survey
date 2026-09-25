import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAuthContext } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listMyAssignments, computeDisplayStatus } from "@/lib/services/responses";
import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { DataList, DataRow, RowTitle } from "@/components/theme/data-list";

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

  // Sapaan memakai nama lengkap, bukan identitas login: nomor induk yang panjang tidak memberi
  // tahu siapa yang sedang masuk, padahal itulah yang dicari saat memastikan akunnya benar.
  const scopeDescription = ctx.isAdmin
    ? "Akses penuh seluruh fakultas (Admin)."
    : ctx.isDekan
      ? "Akses seluruh fakultas sebagai pimpinan tertinggi (Dekan)."
      : ctx.leadershipUnitIds.length > 0
        ? "Akses unit yang dipimpin beserta subunitnya."
        : "Belum memiliki lingkup pengelolaan unit.";

  return (
    <div className="space-y-8">
      <PageIntro
        title={`Selamat datang, ${ctx.name.split(" ")[0]}`}
        intro={`Masuk sebagai ${ctx.name}. ${scopeDescription}`}
      >
        <SummaryCard
          tone="biru"
          label="Tugas penilaian"
          value={myAssignments.length}
          note="ditugaskan kepada Anda"
        />
        <SummaryCard
          tone="kuning"
          label="Belum selesai"
          value={pendingCount}
          note={pendingCount > 0 ? "menunggu diisi" : "semuanya sudah terkirim"}
        />
        <SummaryCard
          tone="tosca"
          label="Unit dalam lingkup"
          value={scopeUnits.length}
          note="unit yang hasilnya dapat Anda baca"
        />
      </PageIntro>

      {scopeUnits.length > 0 && (
        <DataList
            title="Unit dalam lingkup"
            intro="Unit yang hasilnya dapat Anda baca."
            columns={[["title", "Unit"]]}
          >
          {scopeUnits.map((u, i) => (
            <DataRow key={u.code} href="/hasil">
              <RowTitle>{u.name}</RowTitle>
            </DataRow>
          ))}
        </DataList>
      )}
    </div>
  );
}
