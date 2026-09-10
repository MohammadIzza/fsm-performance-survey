import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listUsersWithMeta } from "@/lib/services/users";
import { UserManager } from "./user-manager";
import { UspGrid, UspCard } from "@/components/theme/usp-grid";

async function PenggunaPage() {
  const [users, userTypes, units] = await Promise.all([
    listUsersWithMeta(),
    prisma.userType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.unit.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="space-y-8">
      <UspGrid as="h1" compact title="Pengguna" intro="Kelola identitas, jenis pengguna, unit utama, dan peran sistem.">
        <UspCard title="Pengguna terdaftar" tone="kuning">
          {users.length} orang tercatat di sistem.
        </UspCard>
        <UspCard title="Aktif" tone="tosca">
          {users.filter((u) => u.active).length} dapat masuk dan menerima tugas.
        </UspCard>
        <UspCard title="Memegang peran" tone="biru">
          {users.filter((u) => u.roleGrants.length > 0 || u.leaderships.length > 0).length} orang
          memegang peran sistem atau jabatan pimpinan.
        </UspCard>
      </UspGrid>

      <UserManager users={users} userTypes={userTypes} units={units} />
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof PenggunaPage>) { await requirePageAdmin(); return PenggunaPage(...args); }
