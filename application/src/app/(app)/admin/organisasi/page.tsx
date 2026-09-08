import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listUnitsWithMeta } from "@/lib/services/units";
import { OrgTree } from "./org-tree";
import { UnitManager } from "./unit-manager";

async function OrganisasiPage() {
  const [units, activeUsers] = await Promise.all([
    listUnitsWithMeta(),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, loginIdentifier: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title text-[24px] sm:text-[28px] text-[var(--foreground)]">
          Organisasi
        </h1>
        <p className="mt-1 text-[15px] text-[var(--muted)]">
          Kelola pohon unit dan penetapan pimpinan (Bab 5, ORG-01–ORG-07).
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Struktur organisasi
        </h2>
        <OrgTree units={units} />
      </div>

      <div>
        <h2 className="mb-3 text-[13px] font-medium uppercase tracking-wide text-[var(--muted)]">
          Kelola unit
        </h2>
        <UnitManager units={units} activeUsers={activeUsers} />
      </div>
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof OrganisasiPage>) { await requirePageAdmin(); return OrganisasiPage(...args); }
