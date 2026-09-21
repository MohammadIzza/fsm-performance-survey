import type { ImportEntity } from "@/generated/prisma/enums";

/**
 * Bentuk berkas impor: nama kolom, mana yang wajib, dan apa isinya.
 *
 * Satu sumber dipakai dua tempat supaya keduanya tidak pernah berbeda: berkas template .xlsx yang
 * diunduh (lib/services/imports.ts) dan keterangan format yang ditampilkan di halaman Impor
 * (app/(app)/admin/impor/import-form.tsx). Berkas ini sengaja bebas dari Prisma dan modul server
 * supaya boleh ikut ke sisi peramban.
 *
 * Kolomnya mengikuti apa yang benar-benar dibaca oleh previewUnitImport/previewUserImport/
 * previewLeadershipImport; bila validasinya berubah, keterangan di sini ikut diperbarui.
 */

export interface KolomImpor {
  nama: string;
  wajib: boolean;
  /** Satu kalimat: apa yang ditulis di kolom ini. */
  ket: string;
  contoh: string;
  /** Contoh kedua, untuk baris contoh di template. */
  contoh2?: string;
  /** Lebar kolom di berkas Excel, dalam satuan lebar karakter Excel. */
  lebar: number;
  /** Isian yang dibatasi: daftar tetap, atau daftar nama dari data yang ada. */
  pilihan?: "status" | "unit" | "jenis";
}

export interface FormatImpor {
  label: string;
  /** Satu kalimat di halaman Impor: berkas ini untuk apa. */
  ringkas: string;
  kolom: KolomImpor[];
  catatan: string[];
}

const UMUM = [
  "Baris pertama adalah judul kolom — jangan diubah, jangan dihapus. Isi mulai baris kedua.",
  "Yang dibaca hanya sheet pertama; sheet Petunjuk, Contoh, dan Referensi boleh dibiarkan.",
  "Berkas dibaca sebagai pratinjau dulu. Bila ada satu baris yang salah, seluruh berkas dibatalkan dan tidak ada data yang masuk setengah jalan.",
];

export const FORMAT_IMPOR: Record<ImportEntity, FormatImpor> = {
  UNIT: {
    label: "Unit",
    ringkas: "Daftar unit beserta induknya — fakultas, departemen, program studi, dan bagian.",
    kolom: [
      {
        nama: "nama_unit",
        wajib: true,
        ket: "Nama unit seperti yang ditampilkan di aplikasi. Nama yang sudah terdaftar diperbarui, nama baru dibuat.",
        contoh: "Departemen Fisika",
        contoh2: "Program Studi Fisika",
        lebar: 34,
      },
      {
        nama: "nama_induk",
        wajib: false,
        ket: "Nama unit induknya. Kosongkan untuk unit paling atas. Boleh menunjuk unit lain di berkas yang sama.",
        contoh: "Fakultas Sains dan Matematika",
        contoh2: "Departemen Fisika",
        lebar: 34,
        pilihan: "unit",
      },
      {
        nama: "status",
        wajib: false,
        ket: 'Diisi "aktif" atau "nonaktif". Dikosongkan berarti aktif.',
        contoh: "aktif",
        contoh2: "aktif",
        lebar: 12,
        pilihan: "status",
      },
    ],
    catatan: [
      "Unit dicocokkan menurut namanya, jadi menulis ulang nama yang sudah ada berarti memperbarui unit itu — bukan membuat unit kembar.",
      "Induk boleh berada di baris mana saja; urutan baris tidak perlu diatur dari atas ke bawah.",
      ...UMUM,
    ],
  },
  PENGGUNA: {
    label: "Pengguna",
    ringkas: "Daftar orang yang boleh masuk aplikasi beserta jenis dan unit utamanya.",
    kolom: [
      {
        nama: "id_login",
        wajib: true,
        ket: "Identitas untuk masuk: NIP, NIM, atau nama pengguna. Dipakai sebagai kunci — id yang sudah ada diperbarui, id baru dibuat.",
        contoh: "198001012005011001",
        contoh2: "24060121130001",
        lebar: 24,
      },
      {
        nama: "nama",
        wajib: true,
        ket: "Nama lengkap beserta gelar bila ada.",
        contoh: "Dr. Andi Wijaya, M.Si.",
        contoh2: "Rina Kusuma",
        lebar: 30,
      },
      {
        nama: "email",
        wajib: false,
        ket: "Alamat email UNDIP orang ini. Dipakai mengenali akunnya saat masuk lewat SSO — tanpa email, dosen dan tenaga kependidikan tidak dikenali otomatis. Boleh dikosongkan dan diisi belakangan.",
        contoh: "andi.wijaya@lecturer.undip.ac.id",
        contoh2: "24060121130001@students.undip.ac.id",
        lebar: 36,
      },
      {
        nama: "jenis",
        wajib: true,
        ket: "Jenis pengguna, ditulis persis seperti daftar di sheet Referensi.",
        contoh: "Dosen",
        contoh2: "Mahasiswa",
        lebar: 18,
        pilihan: "jenis",
      },
      {
        nama: "unit",
        wajib: false,
        ket: "Unit utama orang ini, ditulis persis seperti daftar di sheet Referensi. Kosongkan bila tidak terikat unit.",
        contoh: "Departemen Fisika",
        contoh2: "Departemen Informatika",
        lebar: 34,
        pilihan: "unit",
      },
      {
        nama: "status",
        wajib: false,
        ket: 'Diisi "aktif" atau "nonaktif". Dikosongkan berarti aktif.',
        contoh: "aktif",
        contoh2: "aktif",
        lebar: 12,
        pilihan: "status",
      },
    ],
    catatan: [
      "Nol di depan tidak hilang: id_login selalu dibaca sebagai teks, jadi NIM atau NIP yang diawali nol tetap utuh.",
      "Email boleh dikosongkan. Mengisinya membuat orang itu langsung dikenali saat pertama kali masuk lewat SSO, lengkap dengan unit dan penugasannya — tanpa email, yang terbentuk justru akun baru yang terpisah.",
      "Satu alamat email hanya boleh dipakai satu orang; email yang sudah dipakai akun lain membatalkan seluruh berkas.",
      "Impor ini tidak pernah mengubah peran atau hak akses siapa pun — tidak ada kolom peran di berkasnya.",
      ...UMUM,
    ],
  },
  PIMPINAN: {
    label: "Pimpinan",
    ringkas: "Siapa memimpin unit apa dan sejak kapan — dipakai untuk menentukan penilai kelompok Pimpinan.",
    kolom: [
      {
        nama: "id_login",
        wajib: true,
        ket: "id_login orang yang sudah terdaftar dan berstatus aktif. Impor Pengguna dulu bila orangnya belum ada.",
        contoh: "198001012005011001",
        contoh2: "198203152008012002",
        lebar: 24,
      },
      {
        nama: "unit",
        wajib: true,
        ket: "Unit yang dipimpin, ditulis persis seperti daftar di sheet Referensi.",
        contoh: "Departemen Fisika",
        contoh2: "Fakultas Sains dan Matematika",
        lebar: 34,
        pilihan: "unit",
      },
      {
        nama: "nama_jabatan",
        wajib: true,
        ket: "Sebutan jabatannya.",
        contoh: "Ketua Departemen",
        contoh2: "Dekan",
        lebar: 24,
      },
      {
        nama: "mulai_aktif",
        wajib: true,
        ket: "Tanggal mulai menjabat, ditulis YYYY-MM-DD.",
        contoh: "2026-01-01",
        contoh2: "2025-09-01",
        lebar: 16,
      },
      {
        nama: "akhir_aktif",
        wajib: false,
        ket: "Tanggal selesai menjabat, ditulis YYYY-MM-DD. Kosongkan bila masih menjabat.",
        contoh: "",
        contoh2: "2029-08-31",
        lebar: 16,
      },
    ],
    catatan: [
      "Tiap baris menambah satu masa jabatan baru; masa jabatan yang sudah tercatat tidak dihapus oleh impor ini.",
      "Satu orang boleh memimpin lebih dari satu unit — tulis satu baris untuk tiap unit.",
      ...UMUM,
    ],
  },
};

export const URUTAN_IMPOR: ImportEntity[] = ["UNIT", "PENGGUNA", "PIMPINAN"];
