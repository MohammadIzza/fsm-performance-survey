import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { loadUnitTree, collectDescendants } from "@/lib/units";

export interface AuthContext {
  userId: string;
  loginIdentifier: string;
  name: string;
  active: boolean;
  isAdmin: boolean;
  isDekan: boolean;
  /** Unit tempat pengguna menjabat pimpinan saat ini (Bab 4.2: gabungan bila >1 jabatan). */
  leadershipUnitIds: string[];
  /**
   * Seluruh unit yang boleh diakses pengguna sebagai pimpinan/dekan/admin, yaitu unit tempat
   * menjabat beserta subunitnya (Bab 2.1: "Pimpinan melihat unit sendiri dan unit di bawahnya saja").
   * Admin dan Dekan mendapat seluruh unit fakultas.
   */
  scopeUnitIds: string[];
}

/** Membangun konteks otorisasi lengkap seorang pengguna: peran gabungan dan lingkup unit yang sah. */
export async function getAuthContext(userId: string): Promise<AuthContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roleGrants: { where: { active: true } },
      leaderships: { where: { active: true } },
    },
  });
  if (!user) return null;

  const now = new Date();
  const activeLeaderships = user.leaderships.filter(
    (l) => l.effectiveFrom <= now && (!l.effectiveTo || l.effectiveTo >= now)
  );
  const leadershipUnitIds = activeLeaderships.map((l) => l.unitId);

  const isAdmin = user.roleGrants.some((r) => r.role === "ADMIN");
  const isDekan = user.roleGrants.some((r) => r.role === "DEKAN");

  let scopeUnitIds: string[];
  if (isAdmin || isDekan) {
    const { allUnitIds } = await loadUnitTree();
    scopeUnitIds = allUnitIds;
  } else if (leadershipUnitIds.length > 0) {
    const { childrenByParent } = await loadUnitTree();
    const scopeSet = new Set<string>();
    for (const unitId of leadershipUnitIds) {
      for (const id of collectDescendants(unitId, childrenByParent)) {
        scopeSet.add(id);
      }
    }
    scopeUnitIds = Array.from(scopeSet);
  } else {
    scopeUnitIds = [];
  }

  return {
    userId: user.id,
    loginIdentifier: user.loginIdentifier,
    name: user.name,
    active: user.active,
    isAdmin,
    isDekan,
    leadershipUnitIds,
    scopeUnitIds,
  };
}

/** Pemeriksaan lingkup untuk otorisasi baca hasil/objek berbasis unit (Bab 13.5, EDGE-19). */
export function isUnitInScope(ctx: AuthContext, unitId: string): boolean {
  if (ctx.isAdmin || ctx.isDekan) return true;
  return ctx.scopeUnitIds.includes(unitId);
}

/**
 * Konteks sesi berjalan, untuk dipakai di layout/page halaman terproteksi.
 * Mengembalikan null (tanpa redirect) bila tidak ada sesi sah, sehingga pemanggil
 * dapat memilih perilaku (redirect ke /login, atau halaman 403).
 */
export async function getCurrentAuthContext(): Promise<AuthContext | null> {
  const session = await getSession();
  if (!session.userId) return null;
  const ctx = await getAuthContext(session.userId);
  if (!ctx || !ctx.active) return null;
  return ctx;
}

/**
 * Guard untuk Server Action Bab 4.1: seluruh operasi kelola master hanya milik Admin.
 * Selalu menurunkan ulang konteks dari sesi server, tidak pernah mempercayai peran
 * yang dikirim klien (Bab 4.2: "Login tidak boleh menerima peran ... yang diklaim sendiri").
 */
export async function requireAdminActor(): Promise<AuthContext> {
  const ctx = await getCurrentAuthContext();
  if (!ctx) redirect("/login");
  if (!ctx.isAdmin) {
    throw new Error("Tidak berwenang: aksi ini khusus Admin.");
  }
  return ctx;
}

/**
 * Guard untuk Server Action milik semua pengguna terautentikasi (mis. mengisi/mengirim
 * jawaban tugas sendiri, Bab 11). Kepemilikan tugas tetap diperiksa ulang di lapisan
 * service (Bab 6.2: "Permintaan simpan/kirim memeriksa ulang pengguna, kepemilikan tugas...").
 */
export async function requireActiveActor(): Promise<AuthContext> {
  const ctx = await getCurrentAuthContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** Current leaders traverse the period's frozen organization, so reparenting cannot widen historical access. */
export async function getPeriodScope(ctx: AuthContext, periodId: string): Promise<string[]|undefined> {
 if(ctx.isAdmin || ctx.isDekan) return undefined;
 const period=await prisma.period.findUnique({where:{id:periodId},select:{unitTreeSnapshot:true}});
 if(!period?.unitTreeSnapshot) return ctx.scopeUnitIds;
 const tree=period.unitTreeSnapshot as {id:string;parentId:string|null}[];
 const visible=new Set(ctx.leadershipUnitIds);
 let changed=true;
 while(changed){changed=false;for(const u of tree) if(u.parentId&&visible.has(u.parentId)&&!visible.has(u.id)){visible.add(u.id);changed=true}}
 return [...visible];
}
