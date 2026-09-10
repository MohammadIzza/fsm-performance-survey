import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listObjects } from "@/lib/services/objects";
import { listObjectTypes } from "@/lib/services/objectTypes";
import { ObjectManager } from "./object-manager";
import { PageIntro, SummaryCard } from "@/components/theme/summary";

async function ObjekPage() {
  const [objects, objectTypes, units, users] = await Promise.all([
    listObjects(),
    listObjectTypes(),
    prisma.unit.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, loginIdentifier: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageIntro
        title="Objek Penilaian"
        intro="Master objek yang dapat dinilai, lalu dipilih sebagai peserta kategori."
      >
        <SummaryCard tone="kuning" label="Terdaftar" value={objects.length} note="objek tersedia" />
        <SummaryCard
          tone="tosca"
          label="Aktif"
          value={objects.filter((o) => o.active).length}
          note={`dari ${objects.length} objek`}
        />
        <SummaryCard
          tone="merah"
          label="Jenis objek"
          value={objectTypes.length}
          note="mis. Orang, Unit, atau Karya"
        />
      </PageIntro>

      <ObjectManager objects={objects} objectTypes={objectTypes} units={units} users={users} />
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof ObjekPage>) { await requirePageAdmin(); return ObjekPage(...args); }
