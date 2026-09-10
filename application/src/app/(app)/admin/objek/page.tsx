import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listObjects } from "@/lib/services/objects";
import { listObjectTypes } from "@/lib/services/objectTypes";
import { ObjectManager } from "./object-manager";
import { PageHero } from "@/components/page-hero";

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
      <PageHero
        compact
        eyebrow="ADMIN · OBJEK"
        title="Objek Penilaian"
        description="Master objek yang dapat dinilai — Orang, Unit, Karya, atau jenis lain. Objek ini kemudian dipilih sebagai peserta di masing-masing kategori."
      />

      <ObjectManager objects={objects} objectTypes={objectTypes} units={units} users={users} />
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof ObjekPage>) { await requirePageAdmin(); return ObjekPage(...args); }
