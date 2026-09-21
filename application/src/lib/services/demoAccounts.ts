import { prisma } from "@/lib/prisma";

/**
 * Daftar akun demo di halaman masuk, dikelompokkan per unit.
 *
 * Login prototipe ini tanpa kata sandi, jadi penguji UAT perlu tahu ID siapa yang mewakili peran
 * apa — pimpinan prodi mana, dosen mana yang punya tugas, mahasiswa mana yang bisa dicoba.
 * Empat ID contoh tidak cukup untuk menguji lingkup unit dan pembagian tugas.
 *
 * Daftar ini hanya dimuat bila DAFTAR_AKUN_DEMO=1 (lihat halaman masuk). Di lingkungan dengan
 * pengguna sungguhan, membeberkan seluruh ID di halaman publik jelas tidak boleh.
 */

export interface AkunDemo {
  login: string;
  name: string;
  /** Tugas penilaian yang belum dibatalkan — penanda akun yang punya sesuatu untuk dikerjakan. */
  tugas: number;
}

export interface PimpinanDemo extends AkunDemo {
  title: string;
}

export interface UnitDemo {
  id: string;
  name: string;
  /** Kedalaman di pohon unit: 0 fakultas, 1 departemen/unit langsung, 2 program studi. */
  depth: number;
  pimpinan: PimpinanDemo[];
  /** Anggota menurut jenis pengguna, urutan Dosen → Tenaga Kependidikan → Mahasiswa → lainnya. */
  anggota: { jenis: string; akun: AkunDemo[] }[];
  total: number;
}

export interface DirektoriAkunDemo {
  khusus: { peran: string; login: string; name: string }[];
  units: UnitDemo[];
  totalAkun: number;
}

const URUTAN_JENIS = ["Dosen", "Tenaga Kependidikan", "Mahasiswa"];
const urutJenis = (j: string) => {
  const i = URUTAN_JENIS.indexOf(j);
  return i === -1 ? URUTAN_JENIS.length : i;
};

export async function getDemoAccountDirectory(): Promise<DirektoriAkunDemo> {
  const now = new Date();
  const [units, users, tugas] = await Promise.all([
    prisma.unit.findMany({ where: { active: true }, select: { id: true, name: true, parentId: true } }),
    prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        loginIdentifier: true,
        name: true,
        primaryUnitId: true,
        userType: { select: { name: true } },
        roleGrants: { where: { active: true }, select: { role: true } },
        leaderships: {
          where: { active: true, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
          select: { title: true, unitId: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.assignment.groupBy({
      by: ["evaluatorId"],
      where: { status: { not: "DIBATALKAN" } },
      _count: { _all: true },
    }),
  ]);

  const jumlahTugas = new Map(tugas.map((t) => [t.evaluatorId, t._count._all]));
  const akun = (u: (typeof users)[number]): AkunDemo => ({
    login: u.loginIdentifier,
    name: u.name,
    tugas: jumlahTugas.get(u.id) ?? 0,
  });

  // Susun pohon: departemen beserta program studinya berurutan, lalu unit lain di bawah fakultas.
  // Unit yang memiliki anak diletakkan lebih dulu supaya departemen tidak tercecer di antara
  // unit-unit pendukung seperti Tata Usaha atau kepanitiaan.
  const anak = new Map<string | null, typeof units>();
  for (const u of units) anak.set(u.parentId, [...(anak.get(u.parentId) ?? []), u]);
  const punyaAnak = (id: string) => (anak.get(id)?.length ?? 0) > 0;
  const urut: { unit: (typeof units)[number]; depth: number }[] = [];
  const jelajah = (parentId: string | null, depth: number) => {
    const daftar = [...(anak.get(parentId) ?? [])].sort(
      (a, b) => Number(punyaAnak(b.id)) - Number(punyaAnak(a.id)) || a.name.localeCompare(b.name, "id")
    );
    for (const u of daftar) {
      urut.push({ unit: u, depth });
      jelajah(u.id, depth + 1);
    }
  };
  jelajah(null, 0);

  const hasil: UnitDemo[] = [];
  for (const { unit, depth } of urut) {
    const pimpinan = users.flatMap((u) =>
      u.leaderships.filter((l) => l.unitId === unit.id).map((l) => ({ ...akun(u), title: l.title }))
    );
    const perJenis = new Map<string, AkunDemo[]>();
    for (const u of users) {
      if (u.primaryUnitId !== unit.id) continue;
      perJenis.set(u.userType.name, [...(perJenis.get(u.userType.name) ?? []), akun(u)]);
    }
    const anggota = [...perJenis.entries()]
      .sort(([a], [b]) => urutJenis(a) - urutJenis(b) || a.localeCompare(b, "id"))
      .map(([jenis, daftar]) => ({ jenis, akun: daftar }));
    const total = anggota.reduce((s, g) => s + g.akun.length, 0);
    // Unit tanpa penghuni maupun pimpinan tidak memberi ID apa pun untuk dicoba.
    if (total === 0 && pimpinan.length === 0) continue;
    hasil.push({ id: unit.id, name: unit.name, depth, pimpinan, anggota, total });
  }

  const khusus = users.flatMap((u) =>
    u.roleGrants.map((r) => ({ peran: r.role === "ADMIN" ? "Admin" : "Dekan", login: u.loginIdentifier, name: u.name }))
  );
  khusus.sort((a, b) => a.peran.localeCompare(b.peran, "id"));

  return { khusus, units: hasil, totalAkun: users.length };
}
