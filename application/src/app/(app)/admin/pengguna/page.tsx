import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listUsersWithMeta } from "@/lib/services/users";
import { UserManager } from "./user-manager";
import { PageIntro, SummaryCard } from "@/components/theme/summary";

async function PenggunaPage() {
  const [users, userTypes, units, semuaJenis] = await Promise.all([
    listUsersWithMeta(),
    prisma.userType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.unit.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.userType.findMany({ include: { _count: { select: { users: true } } }, orderBy: { name: "asc" } }),
  ]);
  const daftarJenis = semuaJenis.map((t) => ({
    id: t.id,
    name: t.name,
    dipakai: t._count.users ? `${t._count.users} pengguna` : "Belum dipakai",
  }));

  return (
    <div className="space-y-8">
      <PageIntro
        title="Pengguna"
        intro="Kelola identitas, jenis pengguna, unit utama, dan peran sistem."
      >
        <SummaryCard tone="kuning" label="Terdaftar" value={users.length} note="orang di sistem" />
        <SummaryCard
          tone="tosca"
          label="Aktif"
          value={users.filter((u) => u.active).length}
          note="dapat masuk dan menerima tugas"
        />
        <SummaryCard
          tone="biru"
          label="Memegang peran"
          value={users.filter((u) => u.roleGrants.length > 0 || u.leaderships.length > 0).length}
          note="peran sistem atau jabatan pimpinan"
        />
      </PageIntro>

      <UserManager users={users} userTypes={userTypes} units={units} daftarJenis={daftarJenis} />
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof PenggunaPage>) { await requirePageAdmin(); return PenggunaPage(...args); }
