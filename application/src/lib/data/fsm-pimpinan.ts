/**
 * Pimpinan Fakultas Sains dan Matematika UNDIP — nama dan jabatan persis seperti diumumkan
 * fakultas, bukan karangan. Dipakai seed dasar (akun dekan01, dosen1001, dosen1002) dan roster
 * demo (scripts/seed-dies-2026.ts) sebagai pemegang jabatan pada unit masing-masing.
 *
 * Sumber (diakses 13 September 2026):
 * - https://fsm.undip.ac.id/pimpinan-fakultas-2/ — Dekan, Wakil Dekan, Tata Usaha.
 *   Halaman yang sama memuat blok tersembunyi berisi pimpinan Fakultas Teknik (sisa templat);
 *   blok itu tidak dipakai.
 * - https://fsm.undip.ac.id/pimpinan-departemen-prodi/ — pimpinan departemen dan program studi
 *   (diperbarui 11 Juni 2026). Dicocokkan dengan berita FSM 10 Agustus 2026 (Dekan, Wakil Dekan
 *   Akademik), math.undip.ac.id (Ketua Departemen Matematika), dan pengumuman pimpinan Departemen
 *   Fisika periode 2026–2031.
 *
 * Bila sumber berbeda, halaman fakultas yang dipakai: Departemen Biologi (situs departemen per
 * 31 Mei 2026 masih menyebut Prof. Drs. Sapto P. Putro, M.Si.) dan Departemen Statistika (situs
 * departemen menyebut Prof. Dr. Tarno, M.Si. dengan sekretaris Dr. Di Asih I Maruddani).
 *
 * Jabatan yang tidak tercantum di sumber tidak diisi siapa pun: Ketua Program Studi S1 (keenam
 * departemen) dan Sekretaris Departemen Matematika, Biologi, Fisika, dan Kimia. Nomor induk mereka di lingkungan demo tetap dibangkitkan, bukan NIP
 * yang sebenarnya.
 */

export interface PejabatFsm {
  /** Kode unit (lihat fsm-org.ts, ditambah TU-FSM). */
  unit: string;
  jabatan: string;
  nama: string;
  peran: "DOSEN" | "TENDIK";
  /** Akun contoh seed dasar yang memegang jabatan ini; tanpa ini orangnya dibuat roster demo. */
  akunSeed?: "dekan01" | "dosen1001" | "dosen1002";
}

export const PIMPINAN_FSM: PejabatFsm[] = [
  // Fakultas
  { unit: "FSM", jabatan: "Dekan", nama: "Prof. Dr. Kusworo Adi, S.Si., M.T.", peran: "DOSEN", akunSeed: "dekan01" },
  { unit: "FSM", jabatan: "Wakil Dekan Akademik dan Kemahasiswaan", nama: "Prof. Dr. Ngadiwiyana, S.Si., M.Si.", peran: "DOSEN" },
  { unit: "FSM", jabatan: "Wakil Dekan Sumber Daya", nama: "Dr. Eng. Adi Wibowo, S.Si., M.Kom.", peran: "DOSEN" },
  { unit: "TU-FSM", jabatan: "Manajer Bagian Tata Usaha", nama: "Slamet Purwanto, S.Si.", peran: "TENDIK" },
  { unit: "TU-FSM", jabatan: "Supervisor Subbagian Akademik dan Kemahasiswaan", nama: "Umi Arbiati, S.Kom.", peran: "TENDIK" },
  { unit: "TU-FSM", jabatan: "Supervisor Subbagian Sumber Daya", nama: "Andi Prabowo, S.Kom., M.Kom.", peran: "TENDIK" },

  // Departemen Matematika
  { unit: "DEP-MAT", jabatan: "Ketua Departemen", nama: "Dr. Sutrisno, S.Si., M.Sc.", peran: "DOSEN", akunSeed: "dosen1001" },
  { unit: "PS-MAT", jabatan: "Sekretaris Program Studi", nama: "Robertus Heri Soelistyo Utomo, S.Si., M.Si.", peran: "DOSEN" },
  { unit: "PS-S2-MAT", jabatan: "Ketua Program Studi", nama: "Dr. Lucia Ratnasari, S.Si., M.Si.", peran: "DOSEN" },

  // Departemen Biologi
  { unit: "DEP-BIO", jabatan: "Ketua Departemen", nama: "Rully Rahadian, S.Si., M.Si., Ph.D.", peran: "DOSEN" },
  { unit: "PS-BIO", jabatan: "Sekretaris Program Studi", nama: "Dr. Sri Widodo Agung Suedy, S.Si., M.Si.", peran: "DOSEN" },
  { unit: "PS-BIOTEK", jabatan: "Ketua Program Studi", nama: "Dr. Sri Pujiyanto, S.Si., M.Si.", peran: "DOSEN" },
  { unit: "PS-BIOTEK", jabatan: "Sekretaris Program Studi", nama: "Dr. Dra. Arina Tri Lunggani, M.Si.", peran: "DOSEN" },
  { unit: "PS-S2-BIO", jabatan: "Ketua Program Studi", nama: "Prof. Dr. Dra. Erma Prihastanti, M.Si.", peran: "DOSEN" },

  // Departemen Fisika
  { unit: "DEP-FIS", jabatan: "Ketua Departemen", nama: "Dr.Eng. Ali Khumaeni, S.Si., M.E.", peran: "DOSEN", akunSeed: "dosen1002" },
  { unit: "PS-FIS", jabatan: "Sekretaris Program Studi", nama: "Dr. Rina Dwi Indriana, S.Si., M.Si.", peran: "DOSEN" },
  { unit: "PS-S2-FIS", jabatan: "Ketua Program Studi", nama: "Dr.Eng. Udi Harmoko, S.Si., M.Si.", peran: "DOSEN" },
  { unit: "PS-PROF-FISMED", jabatan: "Ketua Program Studi", nama: "Dr. Choirul Anam, S.Si., M.Si., F.Med.", peran: "DOSEN" },

  // Departemen Kimia
  { unit: "DEP-KIM", jabatan: "Ketua Departemen", nama: "Prof. Adi Darmawan, S.Si., M.Si., Ph.D.", peran: "DOSEN" },
  { unit: "PS-KIM", jabatan: "Sekretaris Program Studi", nama: "Purbowatiningrum Ria Sarjono, S.Si., M.Si.", peran: "DOSEN" },
  { unit: "PS-S2-KIM", jabatan: "Ketua Program Studi", nama: "Drs. Gunawan, M.Si., Ph.D.", peran: "DOSEN" },

  // Departemen Statistika
  { unit: "DEP-STAT", jabatan: "Ketua Departemen", nama: "Dr. Drs. Tarno, M.Si.", peran: "DOSEN" },
  { unit: "DEP-STAT", jabatan: "Sekretaris Departemen", nama: "Dr. Dra. Tatik Widiharih, M.Si.", peran: "DOSEN" },

  // Departemen Informatika
  { unit: "DEP-INFOR", jabatan: "Ketua Departemen", nama: "Dr. Aris Sugiharto, S.Si., M.Kom.", peran: "DOSEN" },
  { unit: "DEP-INFOR", jabatan: "Sekretaris Departemen", nama: "Dr. Helmie Arif Wibawa, S.Si., M.Cs.", peran: "DOSEN" },

  // Program doktor yang diasuh fakultas
  { unit: "PS-S3-SM", jabatan: "Ketua Program Studi", nama: "Prof. Dr. Muhammad Cholid Djunaidi, S.Si., M.Si.", peran: "DOSEN" },
];

/** Pejabat pada satu unit yang orangnya dibuat roster demo (bukan akun contoh seed dasar). */
export function pejabatRoster(unit: string): PejabatFsm[] {
  return PIMPINAN_FSM.filter((p) => p.unit === unit && !p.akunSeed);
}

/** Pejabat yang dipegang akun contoh seed dasar. */
export function pejabatAkunSeed(akun: NonNullable<PejabatFsm["akunSeed"]>): PejabatFsm {
  const p = PIMPINAN_FSM.find((x) => x.akunSeed === akun);
  if (!p) throw new Error(`Tidak ada jabatan untuk akun ${akun}`);
  return p;
}
