import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAuthContext } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listMyAssignments, computeDisplayStatus } from "@/lib/services/responses";
import { ThemeMotion } from "@/components/theme-motion";

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
      <section className="survey-hero">
        <div>
          <p className="eyebrow">RUANG PENILAIAN &middot; {roleLabel}</p>
          <h2>
            Setiap penilaian,
            <br />
            langkah untuk bertumbuh.
          </h2>
          <p>Kelola tugas, berikan penilaian, dan ikuti perkembangan sesuai peran Anda.</p>
        </div>
        <ThemeMotion />
      </section>

      <div>
        <h1 className="page-title text-[24px] sm:text-[28px] text-[var(--foreground)]">
          Selamat datang, {ctx.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-[15px] text-[var(--muted)]">
          ID: {ctx.loginIdentifier} &middot; Peran: {roleLabel}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Lingkup akses
          </h2>
          <p className="mt-2 text-[15px] text-[var(--foreground)]">{scopeDescription}</p>
        </div>
        <Link
          href="/tugas"
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm transition hover:border-[var(--border-strong)] active:bg-black/[0.01]"
        >
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Tugas penilaian
          </h2>
          {myAssignments.length === 0 ? (
            <p className="mt-2 text-[15px] text-[var(--foreground)]">
              Belum ada tugas penilaian untuk Anda.
            </p>
          ) : pendingCount > 0 ? (
            <p className="mt-2 text-[15px] text-[var(--foreground)]">
              <span className="font-semibold text-[var(--accent)]">{pendingCount}</span> dari{" "}
              {myAssignments.length} tugas belum selesai diisi.
            </p>
          ) : (
            <p className="mt-2 text-[15px] text-[var(--success)]">
              Semua {myAssignments.length} tugas sudah terkirim.
            </p>
          )}
        </Link>
      </div>

      {scopeUnits.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
          <h2 className="mb-4 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
            Unit dalam lingkup ({scopeUnits.length})
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {scopeUnits.map((u) => (
              <li
                key={u.code}
                className="flex items-center justify-between rounded-lg bg-black/[0.02] px-3 py-2 text-[14px]"
              >
                <span className="text-[var(--foreground)]">{u.name}</span>
                <span className="font-mono text-[12px] text-[var(--muted)]">{u.code}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
