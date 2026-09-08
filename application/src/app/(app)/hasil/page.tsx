import Link from "next/link";
import { getCurrentAuthContext } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function HasilListPage() {
  const ctx = await getCurrentAuthContext();

  // Bab 4.1: hanya Admin, Dekan, dan Pimpinan Unit yang berwenang melihat rekap/leaderboard.
  if (!ctx || (!ctx.isAdmin && !ctx.isDekan && ctx.leadershipUnitIds.length === 0)) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
        <p className="text-[15px] font-medium text-[var(--foreground)]">Tidak berwenang</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Halaman ini hanya untuk Admin, Dekan, dan Pimpinan Unit.
        </p>
      </div>
    );
  }

  const categories = ctx.isAdmin || ctx.isDekan
    ? await prisma.category.findMany({
        where: { active: true },
        include: { period: true, _count: { select: { categoryObjects: true } } },
        orderBy: [{ period: { createdAt: "desc" } }, { code: "asc" }],
      })
    : await prisma.category.findMany({
        where: {
          active: true,
          categoryObjects: { some: { object: { ownerUnitId: { in: ctx.scopeUnitIds } } } },
        },
        include: { period: true, _count: { select: { categoryObjects: true } } },
        orderBy: [{ period: { createdAt: "desc" } }, { code: "asc" }],
      });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title text-[24px] sm:text-[28px] text-[var(--foreground)]">
          Hasil &amp; Leaderboard
        </h1>
        <p className="mt-1 text-[15px] text-[var(--muted)]">
          {ctx.isAdmin || ctx.isDekan
            ? "Rekap hasil penilaian seluruh fakultas."
            : "Rekap hasil penilaian pada unit yang Anda pimpin dan subunitnya."}
        </p>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
          <p className="text-[15px] text-[var(--muted)]">Belum ada kategori dalam lingkup Anda.</p>
        </div>
      ) : (
        <>
          {/* Mobile (<md): kartu klikabel penuh. */}
          <ul className="flex flex-col gap-3 md:hidden">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/hasil/${c.id}`}
                  className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition active:bg-black/[0.02]"
                >
                  <p className="text-[15px] font-medium text-[var(--foreground)]">{c.name}</p>
                  <p className="mt-1 text-[13px] text-[var(--muted)]">{c.period.name}</p>
                  <div className="mt-2 flex items-center gap-3 text-[12px] text-[var(--muted-2)]">
                    <span>{c.period.status}</span>
                    <span>·</span>
                    <span>{c._count.categoryObjects} peserta</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop (≥md): tabel padat. */}
          <div className="hidden overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm md:block">
            <table className="w-full min-w-[640px] text-left text-[14px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-[12px] uppercase tracking-wide text-[var(--muted)]">
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium">Periode</th>
                  <th className="px-4 py-3 font-medium">Status periode</th>
                  <th className="px-4 py-3 font-medium">Peserta</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3">
                      <Link
                        href={`/hasil/${c.id}`}
                        className="font-medium text-[var(--accent)] hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{c.period.name}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{c.period.status}</td>
                    <td className="px-4 py-3 text-[var(--muted)]">{c._count.categoryObjects}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
