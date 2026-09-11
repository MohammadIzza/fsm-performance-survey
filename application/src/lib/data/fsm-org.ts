/**
 * Struktur organisasi Fakultas Sains dan Matematika UNDIP: enam departemen dan tiga belas program
 * studi, sesuai daftar di laman fakultas (fsm.undip.ac.id/program-studi).
 *
 * Daftar ini dipakai dua tempat — `prisma/seed.ts` saat basis data dibuat dari nol, dan
 * `scripts/seed-units-fsm.ts` untuk menyelaraskan basis data yang sudah berisi — supaya tidak ada
 * dua versi struktur yang saling menyimpang. Unit lain (tata usaha, unit uji) tidak ditulis di
 * sini: yang dijaga berkas ini hanya tulang punggung akademiknya.
 */

export interface FsmUnitSeed {
  code: string;
  name: string;
  /** Kode induknya; `null` hanya untuk fakultas. */
  parentCode: string | null;
}

export const FSM_ROOT_CODE = "FSM";

/**
 * Kode program studi: `PS-<bidang>` untuk sarjana, dengan jenjang disisipkan untuk jenjang lain
 * (`PS-S2-…`, `PS-S3-…`, `PS-PROF-…`). Sarjana tidak diberi penanda jenjang karena kode PS-MAT,
 * PS-FIS, dan PS-STAT sudah beredar di basis data dan berkas impor sejak awal — mengubahnya
 * hanya demi kerapian akan memutus rujukan yang sudah ada.
 */
export const FSM_UNITS: FsmUnitSeed[] = [
  { code: "FSM", name: "Fakultas Sains dan Matematika", parentCode: null },

  { code: "DEP-MAT", name: "Departemen Matematika", parentCode: "FSM" },
  { code: "DEP-BIO", name: "Departemen Biologi", parentCode: "FSM" },
  { code: "DEP-KIM", name: "Departemen Kimia", parentCode: "FSM" },
  { code: "DEP-FIS", name: "Departemen Fisika", parentCode: "FSM" },
  { code: "DEP-STAT", name: "Departemen Statistika", parentCode: "FSM" },
  { code: "DEP-INFOR", name: "Departemen Informatika", parentCode: "FSM" },

  // Sarjana (S1)
  { code: "PS-MAT", name: "Sarjana Matematika", parentCode: "DEP-MAT" },
  { code: "PS-BIO", name: "Sarjana Biologi", parentCode: "DEP-BIO" },
  { code: "PS-KIM", name: "Sarjana Kimia", parentCode: "DEP-KIM" },
  { code: "PS-FIS", name: "Sarjana Fisika", parentCode: "DEP-FIS" },
  { code: "PS-STAT", name: "Sarjana Statistika", parentCode: "DEP-STAT" },
  // Bioteknologi berdiri sebagai program studi sendiri, tetapi diasuh Departemen Biologi.
  { code: "PS-BIOTEK", name: "Sarjana Bioteknologi", parentCode: "DEP-BIO" },
  { code: "PS-INFOR", name: "Sarjana Informatika", parentCode: "DEP-INFOR" },

  // Magister (S2)
  { code: "PS-S2-MAT", name: "Magister Matematika", parentCode: "DEP-MAT" },
  { code: "PS-S2-BIO", name: "Magister Biologi", parentCode: "DEP-BIO" },
  { code: "PS-S2-KIM", name: "Magister Kimia", parentCode: "DEP-KIM" },
  { code: "PS-S2-FIS", name: "Magister Fisika", parentCode: "DEP-FIS" },

  // Doktor (S3) — lintas departemen, jadi induknya fakultas, bukan salah satu departemen.
  { code: "PS-S3-SM", name: "Doktor Sains dan Matematika", parentCode: "FSM" },

  // Profesi — diasuh Departemen Fisika. Kata "Profesi" ditambahkan di depan namanya supaya
  // jenjangnya terbaca di daftar unit, sejajar dengan "Sarjana …", "Magister …", dan "Doktor …".
  { code: "PS-PROF-FISMED", name: "Profesi Fisikawan Medik", parentCode: "DEP-FIS" },
];
