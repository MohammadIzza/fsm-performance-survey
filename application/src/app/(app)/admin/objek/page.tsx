import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listObjects } from "@/lib/services/objects";
import { listObjectTypes } from "@/lib/services/objectTypes";
import { ObjectManager } from "./object-manager";
import { PageIntro, SummaryCard } from "@/components/theme/summary";

async function ObjekPage() {
  const [objects, objectTypes, units, users, pemakaianJenis] = await Promise.all([
    listObjects(),
    listObjectTypes(),
    prisma.unit.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, loginIdentifier: true, primaryUnitId: true },
      orderBy: { name: "asc" },
    }),
    prisma.objectType.findMany({ select: { id: true, _count: { select: { objects: true, categories: true } } } }),
  ]);
  const daftarJenis = objectTypes.map((t) => {
    const c = pemakaianJenis.find((p) => p.id === t.id)?._count ?? { objects: 0, categories: 0 };
    const bagian = [c.objects && `${c.objects} objek`, c.categories && `${c.categories} kategori`].filter(Boolean);
    return {
      id: t.id,
      name: t.name,
      dipakai: bagian.length ? bagian.join(" · ") : "Belum dipakai",
      bawaan: ["ORANG", "UNIT", "KARYA", "LAINNYA"].includes(t.code),
    };
  });

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

      <ObjectManager objects={objects} objectTypes={objectTypes} units={units} users={users} daftarJenis={daftarJenis} />
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof ObjekPage>) { await requirePageAdmin(); return ObjekPage(...args); }
