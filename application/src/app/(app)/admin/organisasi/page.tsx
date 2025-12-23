import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listUnitsWithMeta } from "@/lib/services/units";
import { OrgTree } from "./org-tree";
import { UnitManager } from "./unit-manager";
import { PageIntro, SummaryCard } from "@/components/theme/summary";

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
      <PageIntro title="Organisasi" intro="Kelola pohon unit dan penetapan pimpinan.">
        <SummaryCard tone="kuning" label="Unit" value={units.length} note="dalam pohon organisasi" />
        <SummaryCard
          tone="tosca"
          label="Aktif"
          value={units.filter((u) => u.active).length}
          note={`dari ${units.length} unit`}
        />
        <SummaryCard
          tone="merah"
          label="Tanpa pimpinan"
          value={units.filter((u) => u.currentLeaders.length === 0).length}
          note="belum punya pimpinan berjalan"
        />
      </PageIntro>

      <div>
        <h2 className="app-panel__label">
          Struktur organisasi
        </h2>
        <OrgTree units={units} />
      </div>

      <div>
        <h2 className="app-panel__label">
          Kelola unit
        </h2>
        <UnitManager units={units} activeUsers={activeUsers} />
      </div>
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof OrganisasiPage>) { await requirePageAdmin(); return OrganisasiPage(...args); }
