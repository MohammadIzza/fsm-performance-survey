import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listUnitsWithMeta } from "@/lib/services/units";
import { OrgTree } from "./org-tree";
import { UnitManager } from "./unit-manager";
import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { Paginasi } from "@/components/theme/paginasi";
import { bacaHalaman, cocokCari, potongHalaman } from "@/lib/paginasi";

async function OrganisasiPage({ searchParams }: { searchParams: Promise<{ cari?: string; halaman?: string; induk?: string; status?: string }> }) {
  const sp = await searchParams;
  const cari = (sp.cari ?? "").trim();
  const [units, activeUsers] = await Promise.all([
    listUnitsWithMeta(),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, loginIdentifier: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Pohon organisasi tetap utuh. Daftar kelola unit — tiap barisnya membawa panel sunting dan
  // pilihan seluruh pengguna aktif untuk penetapan pimpinan — dirender satu halaman saja.
  const namaUnit = new Map(units.map((u) => [u.id, u.name]));
  const saring = { induk: sp.induk, status: sp.status };
  const cocok = units.filter(
    (u) =>
      cocokCari(cari, u.name, u.code, u.parentId ? namaUnit.get(u.parentId) : null) &&
      (!saring.induk || (saring.induk === "akar" ? !u.parentId : u.parentId === saring.induk)) &&
      (!saring.status || u.active === (saring.status === "aktif"))
  );
  const hal = potongHalaman(cocok, bacaHalaman(sp.halaman), 10);

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
        <UnitManager
          units={units}
          unitHalaman={hal.isi}
          cari={cari}
          saring={saring}
          paginasi={<Paginasi path="/admin/organisasi" params={{ cari, ...saring }} satuan="unit" {...hal} />}
          activeUsers={activeUsers}
        />
      </div>
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof OrganisasiPage>) { await requirePageAdmin(); return OrganisasiPage(...args); }
