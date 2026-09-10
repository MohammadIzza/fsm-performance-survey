import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import Link from "next/link";
import { listAuditEvents, listDistinctAuditEntities } from "@/lib/services/audit";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/page-hero";

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; actorId?: string; from?: string; to?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;

  const [result, entities, actors] = await Promise.all([
    listAuditEvents({
      entity: sp.entity,
      actorId: sp.actorId,
      from: sp.from ? new Date(sp.from) : undefined,
      to: sp.to ? new Date(sp.to) : undefined,
      page,
    }),
    listDistinctAuditEntities(),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const fieldClass =
    "rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-[14px] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20";

  function buildHref(newParams: Record<string, string | undefined>) {
    const merged = { ...sp, ...newParams };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v) qs.set(k, v);
    }
    return `/admin/audit${qs.toString() ? `?${qs.toString()}` : ""}`;
  }

  return (
    <div className="space-y-8">
      <PageHero
        compact
        eyebrow="ADMIN · AUDIT"
        title="Audit"
        description={`Jejak seluruh tindakan administratif dan pengisian. ${result.total} peristiwa.`}
      />

      <form action="/admin/audit" method="GET" className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:grid-cols-4">
        <select name="entity" defaultValue={sp.entity ?? ""} className={fieldClass}>
          <option value="">Semua objek tindakan</option>
          {entities.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select name="actorId" defaultValue={sp.actorId ?? ""} className={fieldClass}>
          <option value="">Semua pelaku</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <input name="from" type="date" defaultValue={sp.from ?? ""} className={fieldClass} />
        <input name="to" type="date" defaultValue={sp.to ?? ""} className={fieldClass} />
        <div className="sm:col-span-4">
          <button
            type="submit"
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-[14px] font-medium text-white transition hover:bg-[var(--accent-hover)]"
          >
            Terapkan filter
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <table className="w-full min-w-[860px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
              <th className="px-4 py-3 font-medium">Waktu</th>
              <th className="px-4 py-3 font-medium">Pelaku</th>
              <th className="px-4 py-3 font-medium">Tindakan</th>
              <th className="px-4 py-3 font-medium">Objek</th>
              <th className="px-4 py-3 font-medium">Alasan</th>
            </tr>
          </thead>
          <tbody>
            {result.events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-[var(--muted)]">
                  Tidak ada peristiwa yang cocok dengan filter.
                </td>
              </tr>
            )}
            {result.events.map((e) => (
              <tr key={e.id} className="border-b border-[var(--border)] last:border-b-0">
                <td className="px-4 py-3 text-[var(--muted)]">{dateFmt.format(e.createdAt)}</td>
                <td className="px-4 py-3 text-[var(--foreground)]">{e.actorName}</td>
                <td className="px-4 py-3 font-mono text-[12px] text-[var(--foreground)]">{e.action}</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {e.entity}
                  {e.entityId && <span className="font-mono text-[11px]"> #{e.entityId.slice(0, 8)}</span>}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">{e.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-[13px]">
          {page > 1 && (
            <Link href={buildHref({ page: String(page - 1) })} className="text-[var(--accent)] hover:underline">
              ← Sebelumnya
            </Link>
          )}
          <span className="text-[var(--muted)]">
            Halaman {page} dari {result.totalPages}
          </span>
          {page < result.totalPages && (
            <Link href={buildHref({ page: String(page + 1) })} className="text-[var(--accent)] hover:underline">
              Berikutnya →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof AuditPage>) { await requirePageAdmin(); return AuditPage(...args); }
