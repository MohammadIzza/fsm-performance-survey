import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import Link from "next/link";
import { listAuditEvents, listDistinctAuditEntities } from "@/lib/services/audit";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/page-hero";
import { DataList, DataRow, RowTitle, RowField } from "@/components/theme/data-list";
import { FilterBar, FilterField } from "@/components/theme/filter-bar";
import { Select, TextInput } from "@/components/theme/form-field";

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

      <FilterBar action="/admin/audit" method="GET" submitLabel="Terapkan filter">
        <FilterField label="Objek tindakan" htmlFor="f-entity">
          <Select id="f-entity" name="entity" defaultValue={sp.entity ?? ""}>
            <option value="">Semua objek tindakan</option>
            {entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Pelaku" htmlFor="f-actor">
          <Select id="f-actor" name="actorId" defaultValue={sp.actorId ?? ""}>
            <option value="">Semua pelaku</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Dari tanggal" htmlFor="f-from">
          <TextInput id="f-from" name="from" type="date" defaultValue={sp.from ?? ""} />
        </FilterField>
        <FilterField label="Sampai tanggal" htmlFor="f-to">
          <TextInput id="f-to" name="to" type="date" defaultValue={sp.to ?? ""} />
        </FilterField>
      </FilterBar>

      {result.events.length === 0 ? (
        <p className="t-t-md" style={{ color: "var(--color-text)" }}>
          Tidak ada peristiwa yang cocok dengan filter.
        </p>
      ) : (
        <DataList
          columns={[
            ["title", "Tindakan"],
            ["dates", "Waktu"],
            ["duration", "Pelaku"],
            ["location", "Alasan"],
          ]}
        >
          {result.events.map((e) => (
            <DataRow key={e.id}>
              <RowTitle>
                {e.action}
                <span className="sb__subtitle">
                  {e.entity}
                  {e.entityId && ` #${e.entityId.slice(0, 8)}`}
                </span>
              </RowTitle>
              <RowField kind="dates" icon={false}>
                <span className="date-range__part">{dateFmt.format(e.createdAt)}</span>
              </RowField>
              <RowField kind="duration" icon={false}>
                {e.actorName}
              </RowField>
              <RowField kind="location" icon={false}>
                {e.reason ?? "—"}
              </RowField>
            </DataRow>
          ))}
        </DataList>
      )}

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
