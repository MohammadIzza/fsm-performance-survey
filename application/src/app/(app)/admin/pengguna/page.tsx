import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listUsersWithMeta } from "@/lib/services/users";
import { UserManager } from "./user-manager";

async function PenggunaPage() {
  const [users, userTypes, units] = await Promise.all([
    listUsersWithMeta(),
    prisma.userType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.unit.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title text-[24px] sm:text-[28px] text-[var(--foreground)]">
          Pengguna
        </h1>
        <p className="mt-1 text-[15px] text-[var(--muted)]">
          Kelola identitas, jenis pengguna, unit utama, dan peran sistem (Bab 5.2, 4.1).
        </p>
      </div>

      <UserManager users={users} userTypes={userTypes} units={units} />
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof PenggunaPage>) { await requirePageAdmin(); return PenggunaPage(...args); }
