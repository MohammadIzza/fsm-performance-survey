import { requireAdminActor as requirePageAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { listUsersPage } from "@/lib/services/users";
import { UserManager } from "./user-manager";
import { PageIntro, SummaryCard } from "@/components/theme/summary";
import { Paginasi } from "@/components/theme/paginasi";
import { bacaHalaman, hitungHalaman, PER_HALAMAN } from "@/lib/paginasi";

async function PenggunaPage({ searchParams }: { searchParams: Promise<{ cari?: string; halaman?: string; jenis?: string; unit?: string; peran?: string; status?: string }> }) {
  const sp = await searchParams;
  const cari = (sp.cari ?? "").trim();
  const diminta = bacaHalaman(sp.halaman);
  const saring = { jenis: sp.jenis, unit: sp.unit, peran: sp.peran, status: sp.status };

  // Kartu ringkasan dihitung di basis data; daftar hanya memuat satu halaman.
  const [jumlahSemua, jumlahAktif, jumlahBerperan, userTypes, units, semuaJenis, hasilAwal] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { active: true } }),
    prisma.user.count({
      where: { OR: [{ roleGrants: { some: { active: true } } }, { leaderships: { some: { active: true } } }] },
    }),
    prisma.userType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.unit.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.userType.findMany({ include: { _count: { select: { users: true } } }, orderBy: { name: "asc" } }),
    listUsersPage({ cari, saring, lewati: (diminta - 1) * PER_HALAMAN, ambil: PER_HALAMAN }),
  ]);
  // Halaman di luar jangkauan (mis. setelah pencarian mempersempit hasil) dijepit ke halaman terakhir.
  const info = hitungHalaman(hasilAwal.total, diminta);
  const hasil =
    info.halaman === diminta ? hasilAwal : await listUsersPage({ cari, saring, lewati: info.lewati, ambil: PER_HALAMAN });

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
        <SummaryCard tone="kuning" label="Terdaftar" value={jumlahSemua} note="orang di sistem" />
        <SummaryCard tone="tosca" label="Aktif" value={jumlahAktif} note="dapat masuk dan menerima tugas" />
        <SummaryCard tone="biru" label="Memegang peran" value={jumlahBerperan} note="peran sistem atau jabatan pimpinan" />
      </PageIntro>

      <UserManager
        users={hasil.users}
        userTypes={userTypes}
        units={units}
        daftarJenis={daftarJenis}
        cari={cari}
        saring={saring}
        paginasi={
          <Paginasi path="/admin/pengguna" params={{ cari, ...saring }} satuan="pengguna" {...info} />
        }
      />
    </div>
  );
}

export default async function AuthorizedPage(...args:Parameters<typeof PenggunaPage>) { await requirePageAdmin(); return PenggunaPage(...args); }
