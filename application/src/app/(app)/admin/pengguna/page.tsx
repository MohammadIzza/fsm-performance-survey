import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listUsersWithMeta } from "@/lib/services/users";
import { UserManager } from "./user-manager";
import { PageHero } from "@/components/page-hero";

async function PenggunaPage() {
  const [users, userTypes, units] = await Promise.all([
    listUsersWithMeta(),
    prisma.userType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.unit.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="space-y-8">
      <PageHero
        compact
        eyebrow="ADMIN · PENGGUNA"
        title="Pengguna"
        description="Kelola identitas, jenis pengguna, unit utama, dan peran sistem."
      />

      <UserManager users={users} userTypes={userTypes} units={units} />
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof PenggunaPage>) { await requirePageAdmin(); return PenggunaPage(...args); }
