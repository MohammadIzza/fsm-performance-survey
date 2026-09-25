/**
 * Melengkapi jumlah anggota tiap unit sampai target, dengan menambah akun dummy seperlunya.
 *
 * Targetnya berbeda per jenis unit (lihat KELOMPOK di bawah):
 *   - program studi : 2 pimpinan, 20 dosen, 40 mahasiswa
 *   - departemen    : 2 pimpinan (jumlah dosen dan mahasiswanya dibiarkan apa adanya)
 *
 * Bawaannya HANYA MENCETAK RENCANA (uji coba kering). Tidak ada satu pun tulisan ke basis data
 * sampai ditambahkan `--terapkan`.
 *
 *   npx tsx --env-file=.env scripts/lengkapi-anggota-unit.ts
 *   npx tsx --env-file=.env scripts/lengkapi-anggota-unit.ts --csv rencana.csv
 *   npx tsx --env-file=.env scripts/lengkapi-anggota-unit.ts --terapkan
 *
 * Sifatnya hanya menambah: akun yang sudah ada tidak diubah, tidak dinonaktifkan, dan tidak
 * dihapus. Bila suatu unit sudah melebihi target, kelebihannya dibiarkan dan dilaporkan.
 *
 * Unit di luar KELOMPOK tidak disentuh sama sekali: fakultas, Tata Usaha, dan panitia sudah punya
 * pimpinannya sendiri, dan unit uji yang sengaja dikosongkan memang harus tetap kosong.
 *
 * Nama dan ID mengikuti pola yang dipakai seluruh pengguna dummy (lihat seed-dies-2026-lomba.ts):
 * nama "Dosen Sarjana Fisika16", ID masuk "dosen_ps-fis_16", email "<id>@contoh.ac.id". Nomornya
 * melanjutkan nomor tertinggi yang sudah ada di unit itu, jadi skrip ini aman dijalankan berulang:
 * yang kurang saja yang ditambah.
 *
 * Ambil cadangan basis data dulu: pg_dump -Fc "$DATABASE_URL" -f sebelum-lengkapi.dump
 */
import { writeFileSync } from "node:fs";
import { atomic, prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/authz";
import { createUser } from "@/lib/services/users";
import { assignLeadership } from "@/lib/services/leadership";

const TERAPKAN = process.argv.includes("--terapkan");
const CSV = (() => {
  const i = process.argv.indexOf("--csv");
  return i >= 0 ? process.argv[i + 1] : null;
})();

type Peran = "pimpinan" | "dosen" | "mahasiswa";
const PERAN: Peran[] = ["pimpinan", "dosen", "mahasiswa"];

/**
 * Unit dikenali dari awalan kode. `target` yang tidak disebut berarti "biarkan apa adanya", dan
 * `jabatan` adalah nama jabatan untuk pimpinan baru, urut. Unit yang sudah punya Ketua hanya akan
 * mendapat Sekretaris, dan sebaliknya — jabatan yang sudah terisi tidak dibuat dua kali.
 */
const KELOMPOK = [
  {
    awalan: "PS-",
    label: "program studi",
    jabatan: ["Ketua Program Studi", "Sekretaris Program Studi"],
    target: { pimpinan: 2, dosen: 20, mahasiswa: 40 } as Partial<Record<Peran, number>>,
  },
  {
    awalan: "DEP-",
    label: "departemen",
    jabatan: ["Ketua Departemen", "Sekretaris Departemen"],
    target: { pimpinan: 2 } as Partial<Record<Peran, number>>,
  },
];

/** Nama dummy: "Dosen Sarjana Fisika16". Nomor menempel, kecuali bila nama unit berakhir angka. */
function namaDummy(peran: Peran, unitNama: string, urut: number) {
  const kata = peran === "mahasiswa" ? "Pengguna" : peran === "dosen" ? "Dosen" : "Pimpinan";
  return `${kata} ${unitNama}${/\d$/.test(unitNama) ? " " : ""}${urut}`;
}

/** ID masuk: "dosen_ps-fis_16". Mahasiswa memakai awalan "pengguna_", sama seperti data yang ada. */
function idDummy(peran: Peran, unitKode: string, urut: number) {
  const kata = peran === "mahasiswa" ? "pengguna" : peran;
  return `${kata}_${unitKode.toLowerCase()}_${urut}`;
}

interface Tambahan {
  unitKode: string;
  unitNama: string;
  peran: Peran;
  idLogin: string;
  nama: string;
  email: string;
  jabatan: string;
}

async function rencana() {
  const [semuaUnit, jenis, jabatanAktif] = await Promise.all([
    prisma.unit.findMany({
      where: { active: true },
      include: {
        usersPrimary: {
          select: { id: true, loginIdentifier: true, userType: { select: { name: true } } },
        },
      },
      orderBy: { code: "asc" },
    }),
    prisma.userType.findMany({ select: { id: true, name: true } }),
    prisma.leadership.findMany({
      where: { active: true, OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] },
      select: { userId: true, unitId: true, title: true },
    }),
  ]);

  const idJenis = new Map(jenis.map((j) => [j.name, j.id]));
  const jenisDosen = idJenis.get("Dosen");
  const jenisMahasiswa = idJenis.get("Mahasiswa");
  if (!jenisDosen || !jenisMahasiswa) throw new Error("Jenis pengguna Dosen/Mahasiswa tidak ada.");

  const tambahan: Tambahan[] = [];
  const ringkasan: {
    label: string;
    unitKode: string;
    unitNama: string;
    ada: Record<Peran, number>;
    tambah: Record<Peran, number>;
    target: Partial<Record<Peran, number>>;
  }[] = [];
  // Jabatan pimpinan baru dicatat terpisah: pembuatan akun dan penetapan jabatannya dua langkah.
  const jabatanBaru: { unitId: string; unitKode: string; idLogin: string; title: string }[] = [];

  for (const unit of semuaUnit) {
    const kelompok = KELOMPOK.find((k) => unit.code.startsWith(k.awalan));
    if (!kelompok) continue;

    const memimpin = jabatanAktif.filter((j) => j.unitId === unit.id);
    const idPimpinan = new Set(memimpin.map((j) => j.userId));

    const ada: Record<Peran, number> = {
      pimpinan: idPimpinan.size,
      // Pimpinan tidak ikut dihitung sebagai dosen: targetnya memang 2 pimpinan DI LUAR 20 dosen.
      dosen: unit.usersPrimary.filter((u) => u.userType.name === "Dosen" && !idPimpinan.has(u.id)).length,
      mahasiswa: unit.usersPrimary.filter((u) => u.userType.name === "Mahasiswa").length,
    };

    // Nomor terakhir yang dipakai pada ID masuk unit ini, per awalan peran. Menghitung dari ID
    // (bukan dari jumlah orang) supaya penomoran tidak pernah bertabrakan dengan yang sudah ada,
    // termasuk bila ada akun yang pernah dipindah atau dinonaktifkan.
    const nomorTerakhir = (peran: Peran) => {
      const awalan = `${peran === "mahasiswa" ? "pengguna" : peran}_${unit.code.toLowerCase()}_`;
      let maksimum = 0;
      for (const u of unit.usersPrimary) {
        if (!u.loginIdentifier.startsWith(awalan)) continue;
        const angka = Number(u.loginIdentifier.slice(awalan.length));
        if (Number.isInteger(angka) && angka > maksimum) maksimum = angka;
      }
      return maksimum;
    };

    const tambah: Record<Peran, number> = { pimpinan: 0, dosen: 0, mahasiswa: 0 };
    const jabatanTerpakai = new Set(memimpin.map((j) => j.title));

    for (const peran of PERAN) {
      const target = kelompok.target[peran];
      if (target === undefined) continue;
      tambah[peran] = Math.max(0, target - ada[peran]);
      let urut = nomorTerakhir(peran);
      for (let i = 0; i < tambah[peran]; i++) {
        urut += 1;
        const idLogin = idDummy(peran, unit.code, urut);
        // Jabatan yang belum terpakai di unit ini dipakai lebih dulu; sisanya diberi nomor.
        let title = "";
        if (peran === "pimpinan") {
          title = kelompok.jabatan.find((t) => !jabatanTerpakai.has(t)) ?? `${kelompok.jabatan[1]} ${urut}`;
          jabatanTerpakai.add(title);
          jabatanBaru.push({ unitId: unit.id, unitKode: unit.code, idLogin, title });
        }
        tambahan.push({
          unitKode: unit.code,
          unitNama: unit.name,
          peran,
          idLogin,
          nama: namaDummy(peran, unit.name, urut),
          email: `${idLogin}@contoh.ac.id`,
          jabatan: title,
        });
      }
    }
    ringkasan.push({
      label: kelompok.label,
      unitKode: unit.code,
      unitNama: unit.name,
      ada,
      tambah,
      target: kelompok.target,
    });
  }

  return { tambahan, ringkasan, jabatanBaru, jenisDosen, jenisMahasiswa };
}

async function jalankan() {
  const { tambahan, ringkasan, jabatanBaru, jenisDosen, jenisMahasiswa } = await rencana();

  console.log(`\nMODE: ${TERAPKAN ? "TERAPKAN" : "RENCANA (tidak menulis apa pun)"}`);
  for (const kelompok of KELOMPOK) {
    const baris = ringkasan.filter((r) => r.label === kelompok.label);
    const sasaran = PERAN.filter((p) => kelompok.target[p] !== undefined)
      .map((p) => `${kelompok.target[p]} ${p}`)
      .join(", ");
    console.log(`\n== ${baris.length} ${kelompok.label}, target ${sasaran} ==`);
    console.log(`${"KODE".padEnd(16)}${PERAN.map((p) => p.padStart(12)).join("")}`);
    for (const r of baris) {
      const sel = (p: Peran) =>
        (kelompok.target[p] === undefined ? `${r.ada[p]}` : `${r.ada[p]}+${r.tambah[p]}`).padStart(12);
      console.log(`${r.unitKode.padEnd(16)}${PERAN.map(sel).join("")}`);
    }
  }

  const jumlah = (p: Peran) => tambahan.filter((t) => t.peran === p).length;
  console.log(
    `\n   akun baru: ${tambahan.length} (pimpinan ${jumlah("pimpinan")}, dosen ${jumlah("dosen")}, mahasiswa ${jumlah("mahasiswa")})`
  );
  console.log(`   jabatan pimpinan baru: ${jabatanBaru.length}`);
  for (const r of ringkasan) {
    for (const p of PERAN) {
      const target = r.target[p];
      if (target !== undefined && r.ada[p] > target) {
        console.log(`   catatan: ${r.unitKode} sudah punya ${r.ada[p]} ${p} (target ${target}), dibiarkan.`);
      }
    }
  }

  if (CSV) {
    const baris = [
      "unit_kode,unit_nama,peran,id_login,nama,email,jabatan",
      ...tambahan.map((t) =>
        [t.unitKode, t.unitNama, t.peran, t.idLogin, t.nama, t.email, t.jabatan]
          .map((k) => `"${String(k).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    writeFileSync(CSV, baris.join("\n") + "\n");
    console.log(`   rencana ditulis ke ${CSV} (${tambahan.length} baris).`);
  }

  if (!TERAPKAN) return;
  if (tambahan.length === 0) {
    console.log("   tidak ada yang perlu ditambahkan.");
    return;
  }

  const admin = await prisma.user.findFirst({ where: { ssoRole: "superadmin" }, select: { id: true } });
  const aktor = admin ? await getAuthContext(admin.id) : null;
  if (!aktor) throw new Error("Akun admin tidak ditemukan; jejak audit butuh pelakunya.");

  // Satu transaksi untuk seluruh penambahan: bila ada satu saja yang gagal, tidak ada unit yang
  // separuh terisi. atomic() yang bersarang di dalam createUser ikut bergabung ke transaksi ini.
  await atomic(async () => {
    const idBaru = new Map<string, string>();
    for (const t of tambahan) {
      const unit = await prisma.unit.findUnique({ where: { code: t.unitKode }, select: { id: true } });
      const pengguna = await createUser(
        {
          loginIdentifier: t.idLogin,
          name: t.nama,
          email: t.email,
          userTypeId: t.peran === "mahasiswa" ? jenisMahasiswa : jenisDosen,
          primaryUnitId: unit!.id,
        },
        aktor
      );
      idBaru.set(t.idLogin, pengguna.id);
    }
    const hariIni = new Date().toISOString().slice(0, 10);
    for (const j of jabatanBaru) {
      await assignLeadership(
        { userId: idBaru.get(j.idLogin)!, unitId: j.unitId, title: j.title, effectiveFrom: hariIni },
        aktor
      );
    }
  });

  console.log(`   diterapkan: ${tambahan.length} akun dibuat, ${jabatanBaru.length} jabatan ditetapkan.`);
}

jalankan()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
