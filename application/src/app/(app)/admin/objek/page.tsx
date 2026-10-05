import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listObjects } from "@/lib/services/objects";
import { listObjectTypes } from "@/lib/services/objectTypes";
import { ObjectManager } from "./object-manager";
import { listObjectGroups } from "@/lib/services/objectGroups";
import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { Paginasi } from "@/components/theme/paginasi";
import { bacaHalaman, cocokCari, potongHalaman } from "@/lib/paginasi";

async function ObjekPage({ searchParams }: { searchParams: Promise<{ cari?: string; halaman?: string; jenis?: string; unit?: string; status?: string }> }) {
  const sp = await searchParams;
  const cari = (sp.cari ?? "").trim();
  const [objects, objectTypes, units, users, pemakaianJenis, objectGroups] = await Promise.all([
    listObjects(),
    listObjectTypes(),
    prisma.unit.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, loginIdentifier: true, primaryUnitId: true },
      orderBy: { name: "asc" },
    }),
    prisma.objectType.findMany({ select: { id: true, _count: { select: { objects: true, categories: true } } } }),
    listObjectGroups(),
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

  // Daftar lengkap tetap dipakai kelompok objek dan kartu ringkasan; yang dirender sebagai baris
  // (masing-masing dengan panel sunting) hanya satu halaman hasil pencarian.
  const saring = { jenis: sp.jenis, unit: sp.unit, status: sp.status };
  const cocok = objects.filter(
    (o) =>
      cocokCari(cari, o.name, o.type.name, o.ownerUnit?.name, o.responsibleUser?.name) &&
      (!saring.jenis || o.typeId === saring.jenis) &&
      (!saring.unit || o.ownerUnitId === saring.unit) &&
      (!saring.status || o.active === (saring.status === "aktif"))
  );
  const hal = potongHalaman(cocok, bacaHalaman(sp.halaman));

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

      <ObjectManager
        objects={objects}
        objekHalaman={hal.isi}
        cari={cari}
        saring={saring}
        paginasi={<Paginasi path="/admin/objek" params={{ cari, ...saring }} satuan="objek" {...hal} />}
        objectTypes={objectTypes}
        units={units}
        users={users}
        daftarJenis={daftarJenis}
        objectGroups={objectGroups}
      />
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof ObjekPage>) { await requirePageAdmin(); return ObjekPage(...args); }
