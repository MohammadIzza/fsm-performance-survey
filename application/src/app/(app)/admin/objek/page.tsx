import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listObjects } from "@/lib/services/objects";
import { listObjectTypes } from "@/lib/services/objectTypes";
import { ObjectManager } from "./object-manager";
import { UspGrid, UspCard } from "@/components/theme/usp-grid";

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
      <UspGrid as="h1" compact title="Objek Penilaian" intro="Master objek yang dapat dinilai, lalu dipilih sebagai peserta kategori.">
        <UspCard title="Objek terdaftar" tone="kuning">
          {objects.length} objek siap dipilih jadi peserta kategori.
        </UspCard>
        <UspCard title="Aktif" tone="tosca">
          {objects.filter((o) => o.active).length} dari {objects.length} objek sedang aktif.
        </UspCard>
        <UspCard title="Jenis objek" tone="merah">
          {objectTypes.length} jenis, mis. Orang, Unit, atau Karya.
        </UspCard>
      </UspGrid>

      <ObjectManager objects={objects} objectTypes={objectTypes} units={units} users={users} />
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof ObjekPage>) { await requirePageAdmin(); return ObjekPage(...args); }
