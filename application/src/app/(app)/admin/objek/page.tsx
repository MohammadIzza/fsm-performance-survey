import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listObjects } from "@/lib/services/objects";
import { listObjectTypes } from "@/lib/services/objectTypes";
import { ObjectManager } from "./object-manager";

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
      <div>
        <h1 className="page-title text-[24px] sm:text-[28px] text-[var(--foreground)]">
          Objek Penilaian
        </h1>
        <p className="mt-1 text-[15px] text-[var(--muted)]">
          Master objek yang dapat dinilai — Orang, Unit, Karya, atau jenis lain (Bab 8.3).
          Objek ini kemudian dipilih sebagai peserta di masing-masing kategori.
        </p>
      </div>

      <ObjectManager objects={objects} objectTypes={objectTypes} units={units} users={users} />
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof ObjekPage>) { await requirePageAdmin(); return ObjekPage(...args); }
