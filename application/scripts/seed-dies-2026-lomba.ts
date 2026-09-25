/**
 * Rencana data: Lomba & Penghargaan Dies FSM UNDIP 2026.
 *
 * Berkas ini berisi DUA pekerjaan yang bisa dijalankan terpisah:
 *
 *   1. --samarkan-pengguna : mengganti nama dan ID seluruh pengguna menjadi dummy.
 *   2. --buat-periode      : membuat satu periode Dies 2026 beserta sembilan kategorinya.
 *
 * Bawaannya HANYA MENCETAK RENCANA (uji coba kering). Tidak ada satu pun tulisan ke basis data
 * sampai ditambahkan `--terapkan`.
 *
 *   npx tsx --env-file=.env scripts/seed-dies-2026-lomba.ts --samarkan-pengguna
 *   npx tsx --env-file=.env scripts/seed-dies-2026-lomba.ts --samarkan-pengguna --terapkan
 *   npx tsx --env-file=.env scripts/seed-dies-2026-lomba.ts --buat-periode --terapkan
 *
 * Catatan penting sebelum menerapkan:
 *
 * - Penyamaran pengguna MENGGANTI NAMA AKUN YANG SUDAH ADA, bukan membuat akun baru lalu menghapus
 *   yang lama. Dengan begitu seluruh tugas penilaian, jawaban, jabatan, dan jejak audit tetap utuh
 *   — yang berubah hanya nama, ID masuk, dan emailnya. Menghapus akun tidak mungkin dilakukan
 *   karena akun yang sudah punya tugas atau jawaban memang ditolak oleh aturan penghapusan.
 * - Akun yang masuk lewat SSO (punya sso_id) DILEWATI: namanya akan tertimpa lagi oleh data SSO
 *   pada login berikutnya, dan ID-nya dipakai untuk mencocokkan akun.
 * - Ambil cadangan basis data dulu: pg_dump -Fc "$DATABASE_URL" -f sebelum-samarkan.dump
 */
import { writeFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import type { AggregationMethod, AssessmentGroup, AssignmentScope } from "@/generated/prisma/enums";

const TERAPKAN = process.argv.includes("--terapkan");
/** --csv <berkas>: menulis seluruh rencana penyamaran ke CSV untuk diperiksa sebelum diterapkan. */
const CSV = (() => {
  const i = process.argv.indexOf("--csv");
  return i >= 0 ? process.argv[i + 1] : null;
})();
const SAMARKAN = process.argv.includes("--samarkan-pengguna");
const PERIODE = process.argv.includes("--buat-periode");

// ── Bagian 1: penyamaran pengguna ──────────────────────────────────────────────────────────────
//
// Pola nama mengikuti permintaan: <peran>_<unit>_<nomor urut>. Bagian <unit> memakai kode unit
// huruf kecil (dep-infor, ps-fis, tu-fsm), dan pengguna tanpa unit memakai "tanpa-unit".
//
//   pimpinan_dep-infor_1   — siapa pun yang sedang memegang jabatan pimpinan di unit itu
//   dosen_dep-infor_1      — jenis pengguna Dosen yang bukan pimpinan
//   pengguna_ps-infor_1    — mahasiswa, tenaga kependidikan, dan jenis lainnya
//
// Nomor urut dihitung per unit per peran, mengikuti urutan nama lama agar hasilnya sama bila
// dijalankan ulang. Email diisi <id>@contoh.ac.id supaya tidak ada alamat asli yang tersisa.

const PERAN = ["pimpinan", "dosen", "pengguna"] as const;
type Peran = (typeof PERAN)[number];

async function rencanaPenyamaran() {
  const [pengguna, jabatan] = await Promise.all([
    prisma.user.findMany({
      include: { userType: { select: { name: true } }, primaryUnit: { select: { code: true, name: true } } },
      orderBy: [{ name: "asc" }],
    }),
    prisma.leadership.findMany({
      where: { active: true, OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] },
      select: { userId: true, title: true, unit: { select: { name: true } } },
    }),
  ]);
  const jabatanLengkap = jabatan;
  const idPimpinan = new Set(jabatan.map((j) => j.userId));

  const jabatanPerOrang = new Map<string, string[]>();
  for (const j of jabatanLengkap) {
    const daftar = jabatanPerOrang.get(j.userId) ?? [];
    daftar.push(`${j.title} — ${j.unit.name}`);
    jabatanPerOrang.set(j.userId, daftar);
  }

  const nomor = new Map<string, number>();
  const rencana: {
    id: string;
    lama: string;
    idLama: string;
    baru: string;
    nama: string;
    email: string;
    unitKode: string;
    unitNama: string;
    jenis: string;
    peran: Peran;
    jabatan: string;
  }[] = [];
  const dilewati: string[] = [];

  for (const u of pengguna) {
    if (u.ssoId) {
      dilewati.push(`${u.name} (akun SSO)`);
      continue;
    }
    const peran: Peran = idPimpinan.has(u.id)
      ? "pimpinan"
      : u.userType.name === "Dosen"
        ? "dosen"
        : "pengguna";
    const unit = (u.primaryUnit?.code ?? "tanpa-unit").toLowerCase();
    // Nama unit ditulis utuh pada nama tampilan: "Departemen Informatika", "Sarjana Matematika".
    // Diambil apa adanya dari data unit, bukan dihuruf-besarkan sendiri, supaya singkatan seperti
    // FSM tetap utuh. Kode unit tetap dipakai pada ID masuk, karena itu yang diketik saat login.
    const unitPanjang = u.primaryUnit?.name ?? "Tanpa Unit";
    const kunci = `${peran}_${unit}`;
    const urut = (nomor.get(kunci) ?? 0) + 1;
    nomor.set(kunci, urut);
    const idBaru = `${kunci}_${urut}`;
    rencana.push({
      id: u.id,
      lama: u.name,
      idLama: u.loginIdentifier,
      baru: idBaru,
      // Nama tampilan: spasi biasa, nama unit utuh, dan nomornya menempel pada kata sebelumnya,
      // "dosen departemen informatika1". Kecuali bila nama unit sendiri berakhir angka
      // ("Panitia Dies Natalis FSM 2026"), karena "20261" tidak terbaca lagi sebagai dua angka.
      nama: `${peran[0].toUpperCase()}${peran.slice(1)} ${unitPanjang}${/\d$/.test(unitPanjang) ? " " : ""}${urut}`,
      email: `${idBaru}@contoh.ac.id`,
      unitKode: u.primaryUnit?.code ?? "TANPA-UNIT",
      unitNama: u.primaryUnit?.name ?? "(tanpa unit)",
      jenis: u.userType.name,
      peran,
      jabatan: (jabatanPerOrang.get(u.id) ?? []).join("; "),
    });
  }
  return { rencana, dilewati };
}

async function samarkanPengguna() {
  const { rencana, dilewati } = await rencanaPenyamaran();
  console.log(`\n== Penyamaran pengguna: ${rencana.length} akun, ${dilewati.length} dilewati ==`);
  for (const r of rencana.slice(0, 12)) {
    console.log(`  ${r.idLama} / ${r.lama}  →  ${r.baru} / ${r.nama}`);
  }
  if (rencana.length > 12) console.log(`  … dan ${rencana.length - 12} lainnya`);
  for (const d of dilewati) console.log(`  dilewati: ${d}`);

  if (CSV) {
    // Sengaja tanpa nama lama: berkas ini dibagikan untuk melihat identitas dummy-nya saja.
    const urutan = [...rencana].sort(
      (a, b) =>
        a.unitKode.localeCompare(b.unitKode) ||
        PERAN.indexOf(a.peran) - PERAN.indexOf(b.peran) ||
        a.baru.localeCompare(b.baru, "id", { numeric: true })
    );
    const baris = [
      "unit_kode,unit_nama,peran,jenis_pengguna,id_login,nama,email,jabatan",
      ...urutan.map((r) =>
        [r.unitKode, r.unitNama, r.peran, r.jenis, r.baru, r.nama, r.email, r.jabatan]
          .map((k) => `"${String(k).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    writeFileSync(CSV, baris.join("\n") + "\n");
    console.log(`  rencana ditulis ke ${CSV} (${rencana.length} baris).`);
  }

  if (!TERAPKAN) return;
  // Dua tahap: ID baru bisa bentrok dengan ID lama milik akun lain (mis. seseorang sudah bernama
  // "dosen_dep-fis_1"), jadi semua digeser dulu ke nama sementara.
  for (const r of rencana) {
    await prisma.user.update({ where: { id: r.id }, data: { loginIdentifier: `tmp_${r.id}` } });
  }
  for (const r of rencana) {
    await prisma.user.update({
      where: { id: r.id },
      data: { loginIdentifier: r.baru, name: r.nama, email: `${r.baru}@contoh.ac.id` },
    });
  }
  console.log(`  diterapkan: ${rencana.length} akun disamarkan.`);
}

// ── Bagian 2: periode Dies 2026 dan sembilan kategorinya ───────────────────────────────────────
//
// Kategori di aplikasi ini tidak menyimpan tanggalnya sendiri; yang berjadwal adalah periodenya.
// Tanggal tiap lomba pada poster karena itu ditulis di deskripsi kategori, dan periodenya
// merentang dari tanggal paling awal (pendaftaran futsal, 29 September) sampai paling akhir
// (final FSM Got Talent, 21 Oktober).

const PERIODE_DIES = {
  code: "DIES-FSM-2026",
  name: "Lomba & Penghargaan Dies FSM UNDIP 2026",
  description: "Bergerak Bersama dalam Rangka Mendukung Undip Menuju 500 Dunia.",
  mulai: "2026-09-29T00:00:00+07:00",
  tenggat: "2026-10-21T23:59:00+07:00",
};

interface RencanaKategori {
  code: string;
  name: string;
  /** Jadwal dari poster, ditulis apa adanya di deskripsi kategori. */
  jadwal: string;
  /** Kode jenis objek: ORANG, UNIT, KARYA, atau LAINNYA. */
  jenisObjek: "ORANG" | "UNIT" | "KARYA" | "LAINNYA";
  keterangan: string;
  skala: { min: number; max: number; step: number };
  /** normalized = angka mentah (jumlah publikasi, sitasi) yang dinormalisasi terhadap objek tertinggi. */
  parameter: { nama: string; bobot: number; mentah?: boolean; indikator?: string }[];
  kelompok: Record<AssessmentGroup, { agregasi: AggregationMethod; target: number; minimum: number }>;
  syarat: Record<AssessmentGroup, { lingkup: AssignmentScope; jenisPengguna: string[] }>;
  /** Predikat nilai dipakai pada kategori yang dinilai dengan skala, bukan hitungan angka. */
  predikat: boolean;
  kecualikanPembuat?: boolean;
}

/** Skala penilaian orang: 1 sampai 100, dipakai lima kategori yang dinilai juri atau pemilih. */
const skala100 = { min: 1, max: 100, step: 1 };
const skalaPersen = { min: 0, max: 100, step: 1 };
/** Lomba berbasis hitungan: yang mengisi angkanya panitia, satu orang per objek. */
const kelompokHitungan = {
  PIMPINAN: { agregasi: "RATA_RATA" as AggregationMethod, target: 1, minimum: 1 },
  SELAIN_PIMPINAN: { agregasi: "RATA_RATA" as AggregationMethod, target: 0, minimum: 1 },
};
const syaratBawaan = {
  PIMPINAN: { lingkup: "UNIT_DAN_INDUK" as AssignmentScope, jenisPengguna: [] },
  SELAIN_PIMPINAN: { lingkup: "UNIT_DAN_SUBUNIT" as AssignmentScope, jenisPengguna: [] },
};

const KATEGORI: RencanaKategori[] = [
  {
    code: "PRODI-PUBLIKASI",
    name: "Prodi dengan Capaian Publikasi Terbanyak",
    jadwal: "Penilaian 15 Oktober 2026",
    jenisObjek: "UNIT",
    keterangan: "Rekapitulasi luaran publikasi tiap program studi sepanjang 2026.",
    skala: { min: 0, max: 1000, step: 1 },
    parameter: [
      { nama: "Artikel terindeks Scopus", bobot: 50, mentah: true, indikator: "Jumlah artikel terbit pada 2026." },
      { nama: "Artikel jurnal nasional terakreditasi", bobot: 30, mentah: true, indikator: "Jumlah artikel pada jurnal Sinta 1 sampai 3 sepanjang 2026." },
      { nama: "Publikasi bersama mahasiswa", bobot: 20, mentah: true, indikator: "Jumlah artikel yang memuat mahasiswa sebagai penulis." },
    ],
    kelompok: kelompokHitungan,
    syarat: syaratBawaan,
    predikat: false,
  },
  {
    code: "PRODI-IKU",
    name: "Prodi dengan Capaian IKU Terbaik",
    jadwal: "Penilaian 15 Oktober 2026",
    jenisObjek: "UNIT",
    keterangan: "Capaian Indikator Kinerja Utama program studi, dalam persen terhadap targetnya.",
    skala: skalaPersen,
    parameter: [
      { nama: "IKU 1 Lulusan mendapat pekerjaan layak", bobot: 25, indikator: "Persen lulusan yang bekerja, berwiraswasta, atau lanjut studi dalam setahun." },
      { nama: "IKU 2 Mahasiswa berkegiatan di luar kampus", bobot: 25, indikator: "Persen mahasiswa yang berkegiatan minimal 20 sks di luar kampus." },
      { nama: "IKU 5 Hasil kerja dosen dipakai masyarakat", bobot: 25, indikator: "Persen luaran dosen yang dipakai masyarakat atau terbit di jurnal internasional." },
      { nama: "IKU 8 Program studi berstandar internasional", bobot: 25, indikator: "Persen capaian terhadap target akreditasi atau sertifikasi internasional." },
    ],
    kelompok: kelompokHitungan,
    syarat: syaratBawaan,
    predikat: false,
  },
  {
    code: "DOSEN-PUBLIKASI",
    name: "Dosen dengan Publikasi Terbanyak",
    jadwal: "Penilaian 15 Oktober 2026",
    jenisObjek: "ORANG",
    keterangan: "Rekapitulasi luaran publikasi tiap dosen sepanjang 2026.",
    skala: { min: 0, max: 500, step: 1 },
    parameter: [
      { nama: "Artikel terindeks Scopus", bobot: 50, mentah: true, indikator: "Jumlah artikel 2026 dengan dosen ini sebagai penulis." },
      { nama: "Sitasi baru", bobot: 25, mentah: true, indikator: "Pertambahan sitasi sepanjang 2026." },
      { nama: "Paten dan hak cipta terdaftar", bobot: 25, mentah: true, indikator: "Jumlah paten dan hak cipta yang terdaftar pada 2026." },
    ],
    kelompok: kelompokHitungan,
    syarat: syaratBawaan,
    predikat: false,
  },
  {
    code: "DOSEN-FAVORIT",
    name: "Dosen Favorit FSM",
    jadwal: "Penilaian 14 dan 15 Oktober 2026",
    jenisObjek: "ORANG",
    keterangan: "Pilihan mahasiswa atas dosen yang paling berkesan dalam mengajar dan membimbing.",
    skala: skala100,
    parameter: [
      { nama: "Penguasaan materi", bobot: 30, indikator: "Menjelaskan dengan runtut dan menjawab pertanyaan dengan tepat." },
      { nama: "Cara mengajar", bobot: 30, indikator: "Kelas hidup, contohnya membumi, mudah diikuti." },
      { nama: "Keterbukaan dan bimbingan", bobot: 20, indikator: "Mudah ditemui dan responsif saat dimintai bantuan." },
      { nama: "Kedisiplinan", bobot: 20, indikator: "Tepat waktu dan konsisten dengan rencana pembelajaran." },
    ],
    kelompok: {
      PIMPINAN: { agregasi: "RATA_RATA", target: 1, minimum: 1 },
      SELAIN_PIMPINAN: { agregasi: "RATA_RATA", target: 7, minimum: 5 },
    },
    // Yang memilih dosen favorit adalah mahasiswa di departemen dan prodi di bawahnya.
    syarat: {
      PIMPINAN: { lingkup: "UNIT_DAN_INDUK", jenisPengguna: [] },
      SELAIN_PIMPINAN: { lingkup: "UNIT_DAN_SUBUNIT", jenisPengguna: ["Mahasiswa"] },
    },
    predikat: true,
  },
  {
    code: "TENDIK-AKADEMIK",
    name: "Tendik Terbaik Bidang Akademik",
    jadwal: "Penilaian 14 dan 15 Oktober 2026",
    jenisObjek: "ORANG",
    keterangan: "Tenaga kependidikan pada layanan akademik dan kemahasiswaan.",
    skala: skala100,
    parameter: [
      { nama: "Ketepatan layanan akademik", bobot: 30, indikator: "Dokumen dan data yang diproses benar sejak awal." },
      { nama: "Kecepatan menanggapi permintaan", bobot: 25, indikator: "Permintaan dijawab pada hari kerja yang sama." },
      { nama: "Ketelitian administrasi", bobot: 25, indikator: "Berkas lengkap, arsip rapi, tenggat terjaga." },
      { nama: "Sikap melayani", bobot: 20, indikator: "Ramah, jelas menerangkan, dan mudah dihubungi." },
    ],
    kelompok: {
      PIMPINAN: { agregasi: "RATA_RATA", target: 2, minimum: 1 },
      SELAIN_PIMPINAN: { agregasi: "RATA_RATA", target: 5, minimum: 3 },
    },
    syarat: syaratBawaan,
    predikat: true,
  },
  {
    code: "TENDIK-SUMBER-DAYA",
    name: "Tendik Terbaik Bidang Sumber Daya",
    jadwal: "Penilaian 14 dan 15 Oktober 2026",
    jenisObjek: "ORANG",
    keterangan: "Tenaga kependidikan pada layanan keuangan, kepegawaian, dan sarana prasarana.",
    skala: skala100,
    parameter: [
      { nama: "Pengelolaan sarana dan prasarana", bobot: 30, indikator: "Ruang dan alat siap dipakai saat dibutuhkan." },
      { nama: "Ketertiban administrasi keuangan dan kepegawaian", bobot: 30, indikator: "Pengajuan diproses sesuai prosedur dan selesai tepat waktu." },
      { nama: "Kecepatan menangani permintaan", bobot: 20, indikator: "Permintaan perbaikan atau pengadaan langsung ditindaklanjuti." },
      { nama: "Sikap melayani", bobot: 20, indikator: "Ramah, jelas menerangkan, dan mudah dihubungi." },
    ],
    kelompok: {
      PIMPINAN: { agregasi: "RATA_RATA", target: 2, minimum: 1 },
      SELAIN_PIMPINAN: { agregasi: "RATA_RATA", target: 5, minimum: 3 },
    },
    syarat: syaratBawaan,
    predikat: true,
  },
  {
    code: "VIDEO-PROMOSI",
    name: "Video Promosi Prodi S1 Terbaik oleh HM",
    jadwal: "Mulai tayang 1 Oktober 2026, penilaian 15 Oktober 2026",
    jenisObjek: "KARYA",
    keterangan: "Video promosi program studi sarjana yang digarap himpunan mahasiswa.",
    skala: skala100,
    parameter: [
      { nama: "Kesesuaian pesan promosi", bobot: 30, indikator: "Menyampaikan keunggulan prodi dengan tepat." },
      { nama: "Kreativitas dan orisinalitas", bobot: 25, indikator: "Gagasan segar dan bukan tiruan karya lain." },
      { nama: "Kualitas visual dan audio", bobot: 25, indikator: "Gambar, suara, dan penyuntingan." },
      { nama: "Dampak dan jangkauan", bobot: 20, indikator: "Tayangan, bagikan, dan tanggapan penonton." },
    ],
    kelompok: {
      PIMPINAN: { agregasi: "RATA_RATA", target: 2, minimum: 1 },
      SELAIN_PIMPINAN: { agregasi: "RATA_RATA", target: 5, minimum: 3 },
    },
    syarat: syaratBawaan,
    predikat: true,
    // Anggota himpunan yang menggarap videonya tidak ikut menilai karyanya sendiri.
    kecualikanPembuat: true,
  },
  {
    code: "LOMBA-FUTSAL",
    name: "Lomba Futsal",
    jadwal: "Pendaftaran 29 September 2026, pertandingan 16 Oktober 2026",
    jenisObjek: "LAINNYA",
    keterangan: "Tim futsal antarunit; angka diisi panitia berdasarkan hasil pertandingan.",
    skala: { min: 0, max: 100, step: 1 },
    parameter: [
      { nama: "Poin klasemen", bobot: 60, mentah: true, indikator: "Menang 3, seri 1, kalah 0." },
      { nama: "Selisih gol", bobot: 25, mentah: true, indikator: "Gol memasukkan dikurangi gol kemasukan." },
      { nama: "Nilai fair play", bobot: 15, indikator: "Penilaian wasit atas sportivitas tim." },
    ],
    kelompok: kelompokHitungan,
    syarat: syaratBawaan,
    predikat: false,
  },
  {
    code: "GOT-TALENT",
    name: "FSM Got Talent Dosen & Tendik",
    jadwal: "Pendaftaran 10 Oktober 2026, penyisihan 16 Oktober 2026, final 21 Oktober 2026",
    jenisObjek: "ORANG",
    keterangan: "Penampilan bakat dosen dan tenaga kependidikan; dinilai juri dan penonton.",
    skala: skala100,
    parameter: [
      { nama: "Kualitas penampilan", bobot: 35, indikator: "Teknik dan kematangan pembawaan." },
      { nama: "Kreativitas dan keunikan", bobot: 25, indikator: "Konsep penampilan yang berbeda dari peserta lain." },
      { nama: "Penguasaan panggung", bobot: 20, indikator: "Percaya diri, memakai ruang panggung, dan terhubung dengan penonton." },
      { nama: "Sambutan penonton", bobot: 20, indikator: "Antusiasme penonton saat dan sesudah penampilan." },
    ],
    kelompok: {
      PIMPINAN: { agregasi: "RATA_RATA", target: 3, minimum: 2 },
      SELAIN_PIMPINAN: { agregasi: "RATA_RATA", target: 7, minimum: 5 },
    },
    syarat: syaratBawaan,
    predikat: true,
  },
];

async function buatPeriode() {
  console.log(`\n== Periode: ${PERIODE_DIES.name} (${PERIODE_DIES.code}) ==`);
  console.log(`   Jadwal ${PERIODE_DIES.mulai} sampai ${PERIODE_DIES.tenggat}`);
  console.log(`   ${KATEGORI.length} kategori:`);
  for (const k of KATEGORI) {
    const total = k.parameter.reduce((j, p) => j + p.bobot, 0);
    console.log(
      `   - ${k.name} [${k.jenisObjek}] — ${k.jadwal}\n` +
        `     skala ${k.skala.min} sampai ${k.skala.max}, ${k.parameter.length} parameter (total bobot ${total}%)` +
        `, Pimpinan ${k.kelompok.PIMPINAN.target}/${k.kelompok.PIMPINAN.minimum}` +
        `, Selain ${k.kelompok.SELAIN_PIMPINAN.target}/${k.kelompok.SELAIN_PIMPINAN.minimum}` +
        `${k.predikat ? ", predikat aktif" : ""}`
    );
    for (const p of k.parameter) {
      console.log(`       · ${p.nama} ${p.bobot}%${p.mentah ? " (nilai mentah)" : ""}`);
    }
    if (total !== 100) console.log(`       !! total bobot ${total}%, seharusnya 100%`);
  }

  if (!TERAPKAN) return;

  const admin = await prisma.user.findFirstOrThrow({
    where: { roleGrants: { some: { role: "ADMIN", active: true } } },
  });
  const jenisObjek = Object.fromEntries(
    (await prisma.objectType.findMany()).map((t) => [t.code, t.id])
  );
  const jenisPengguna = Object.fromEntries(
    (await prisma.userType.findMany()).map((t) => [t.name, t.id])
  );

  const ada = await prisma.period.findFirst({ where: { code: PERIODE_DIES.code } });
  if (ada) throw new Error(`Periode ${PERIODE_DIES.code} sudah ada; hapus dulu bila ingin dibuat ulang.`);

  const periode = await prisma.period.create({
    data: {
      code: PERIODE_DIES.code,
      name: PERIODE_DIES.name,
      description: PERIODE_DIES.description,
      timezone: "Asia/Jakarta",
      startsAt: new Date(PERIODE_DIES.mulai),
      endsAt: new Date(PERIODE_DIES.tenggat),
      status: "DRAF",
      createdById: admin.id,
    },
  });

  for (const k of KATEGORI) {
    const kategori = await prisma.category.create({
      data: {
        periodId: periode.id,
        code: k.code,
        name: k.name,
        description: `${k.keterangan} Jadwal: ${k.jadwal}.`,
        objectTypeId: jenisObjek[k.jenisObjek],
        excludeContributors: k.kecualikanPembuat ?? true,
        pimpinanWeight: null,
        gradeBands: k.predikat
          ? [
              { label: "Sangat baik", min: 90 },
              { label: "Baik", min: 75 },
              { label: "Cukup", min: 60 },
              { label: "Perlu perbaikan", min: 0 },
            ]
          : undefined,
      },
    });
    const instrumen = await prisma.instrumentVersion.create({
      data: {
        categoryId: kategori.id,
        revision: 1,
        scaleMin: k.skala.min,
        scaleMax: k.skala.max,
        scaleStep: k.skala.step,
      },
    });
    await prisma.parameter.createMany({
      data: k.parameter.map((p, i) => ({
        instrumentVersionId: instrumen.id,
        name: p.nama,
        indicator: p.indikator ?? null,
        weight: p.bobot,
        normalized: p.mentah ?? false,
        order: i + 1,
      })),
    });
    for (const group of ["PIMPINAN", "SELAIN_PIMPINAN"] as AssessmentGroup[]) {
      const kel = k.kelompok[group];
      await prisma.groupRule.create({
        data: {
          categoryId: kategori.id,
          group,
          aggregation: kel.agregasi,
          target: kel.target,
          minimum: kel.minimum,
        },
      });
      const syarat = k.syarat[group];
      await prisma.assignmentRule.create({
        data: {
          categoryId: kategori.id,
          group,
          scope: syarat.lingkup,
          userTypeIds: syarat.jenisPengguna.length
            ? syarat.jenisPengguna.map((n) => jenisPengguna[n])
            : undefined,
        },
      });
    }
    console.log(`   dibuat: ${k.name}`);
  }
  console.log(`   diterapkan: periode ${periode.code} beserta ${KATEGORI.length} kategori.`);
}

async function main() {
  if (!SAMARKAN && !PERIODE) {
    console.log(
      "Pilih pekerjaannya: --samarkan-pengguna dan/atau --buat-periode.\n" +
        "Tambahkan --terapkan untuk benar-benar menulis ke basis data."
    );
    return;
  }
  console.log(TERAPKAN ? "MODE: MENERAPKAN (menulis ke basis data)" : "MODE: RENCANA (tidak menulis apa pun)");
  if (SAMARKAN) await samarkanPengguna();
  if (PERIODE) await buatPeriode();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
