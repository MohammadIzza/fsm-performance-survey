import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listUnitsWithMeta } from "@/lib/services/units";
import { OrgTree } from "./org-tree";
import { UnitManager } from "./unit-manager";
import { UspGrid, UspCard } from "@/components/theme/usp-grid";

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
      <UspGrid as="h1" compact title="Organisasi" intro="Kelola pohon unit dan penetapan pimpinan.">
        <UspCard title="Unit terdaftar" tone="kuning">
          {units.length} unit dalam pohon organisasi.
        </UspCard>
        <UspCard title="Unit aktif" tone="tosca">
          {units.filter((u) => u.active).length} dari {units.length} unit sedang aktif.
        </UspCard>
        <UspCard title="Belum ada pimpinan" tone="merah">
          {units.filter((u) => u.currentLeaders.length === 0).length} unit belum punya pimpinan
          berjalan.
        </UspCard>
      </UspGrid>

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
