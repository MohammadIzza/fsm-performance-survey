/**
 * Daftar orang untuk lingkungan demonstrasi: dosen, tenaga kependidikan, dan mahasiswa di setiap
 * departemen dan program studi FSM.
 *
 * Pemegang jabatan pimpinan memakai nama asli sesuai pengumuman fakultas (fsm-pimpinan.ts). Selain
 * mereka, namanya bukan nama sivitas yang sebenarnya — dirakit dari kumpulan nama Indonesia yang lazim,
 * dipasangkan dengan langkah tetap sehingga hasilnya sama setiap kali seed dijalankan dan tidak
 * ada nama yang muncul dua kali. Nomor induknya mengikuti bentuk NIP dan NIM yang berlaku
 * (18 dan 14 angka) supaya kolom identitas di layar terlihat sebagaimana mestinya, tetapi
 * angkanya dibangkitkan berurutan, bukan disalin dari data siapa pun.
 */

import { pejabatRoster, type PejabatFsm } from "./fsm-pimpinan";

export type PeranOrang = "DOSEN" | "TENDIK" | "MAHASISWA";

export interface OrangDemo {
  loginIdentifier: string;
  nama: string;
  peran: PeranOrang;
  /** Kode unit tempat orang ini terdaftar. */
  unit: string;
}

const DEPAN = [
  "Agus", "Ahmad", "Aji", "Andi", "Anggun", "Anisa", "Arif", "Bagas", "Bayu", "Bima",
  "Budi", "Cahya", "Citra", "Dewi", "Dian", "Dimas", "Eka", "Endah", "Fajar", "Farid",
  "Fitri", "Gilang", "Hana", "Hendra", "Ika", "Indah", "Intan", "Joko", "Kartika", "Lestari",
  "Lukman", "Maya", "Mega", "Nanda", "Novi", "Nurul", "Panji", "Pramudya", "Putri", "Rahma",
  "Ratna", "Reza", "Rina", "Rizky", "Sari", "Satria", "Sinta", "Surya", "Tari", "Teguh",
  "Tika", "Umar", "Vina", "Wahyu", "Widya", "Wulan", "Yoga", "Yuni", "Zahra", "Zaki",
];

const BELAKANG = [
  "Anggraini", "Baskoro", "Cahyani", "Dharmawan", "Effendi", "Fadhilah", "Gunawan", "Halimah",
  "Iskandar", "Jatmiko", "Kusuma", "Lesmana", "Maulana", "Nugroho", "Oktaviani", "Prasetyo",
  "Qomariah", "Ramadhan", "Saputra", "Tanjung", "Utami", "Wibowo", "Yulianto", "Zulkarnain",
  "Adiputra", "Budiarto", "Cendekia", "Darmawati", "Firmansyah", "Handayani", "Irawan",
  "Kurniawan", "Mahendra", "Nurhayati", "Purnomo", "Rahmawati", "Setiawan", "Wijayanti",
];

/** Gelar belakang dosen menurut jenjang; dipilih bergiliran agar daftarnya tidak seragam. */
const GELAR_DOSEN = [
  { depan: "Dr. ", belakang: ", S.Si., M.Si." },
  { depan: "Dr. ", belakang: ", S.Si., M.Sc." },
  { depan: "Prof. Dr. ", belakang: ", M.Si." },
  { depan: "", belakang: ", S.Si., M.Si." },
  { depan: "Dr.rer.nat. ", belakang: ", M.Sc." },
  { depan: "", belakang: ", S.Si., M.Sc." },
  { depan: "Dr. ", belakang: ", M.Kom." },
  { depan: "", belakang: ", S.Kom., M.Kom." },
];

const GELAR_TENDIK = [", S.E.", ", S.Kom.", ", A.Md.", ", S.Sos.", "", ", S.T.", ", A.Md.Kom."];

/**
 * Nama diambil dengan langkah berjarak bilangan prima terhadap panjang daftar: pasangan
 * depan-belakang tidak pernah berulang selama jumlah orang tidak melampaui perkalian keduanya.
 */
function namaDasar(i: number): string {
  return `${DEPAN[(i * 7) % DEPAN.length]} ${BELAKANG[(i * 11) % BELAKANG.length]}`;
}

function nip(urut: number): string {
  const lahir = `19${70 + (urut % 25)}${String((urut % 12) + 1).padStart(2, "0")}${String((urut % 28) + 1).padStart(2, "0")}`;
  const tmt = `${2008 + (urut % 16)}${String((urut % 12) + 1).padStart(2, "0")}`;
  const akhir = `${(urut % 2) + 1}${String(urut % 1000).padStart(3, "0")}`;
  return `${lahir}${tmt}${akhir}`;
}

function nim(kodeProdi: string, angkatan: number, urut: number): string {
  return `24${kodeProdi}${angkatan}1${String(urut).padStart(5, "0")}`;
}

/** Empat angka penanda prodi pada NIM, satu per program studi. */
const KODE_NIM: Record<string, string> = {
  "PS-MAT": "0101",
  "PS-BIO": "0102",
  "PS-KIM": "0103",
  "PS-FIS": "0104",
  "PS-STAT": "0105",
  "PS-BIOTEK": "0106",
  "PS-INFOR": "0107",
  "PS-S2-MAT": "0201",
  "PS-S2-BIO": "0202",
  "PS-S2-KIM": "0203",
  "PS-S2-FIS": "0204",
  "PS-S3-SM": "0301",
  "PS-PROF-FISMED": "0401",
};

const STRUKTUR: { departemen: string; prodi: string[] }[] = [
  { departemen: "DEP-MAT", prodi: ["PS-MAT", "PS-S2-MAT"] },
  { departemen: "DEP-BIO", prodi: ["PS-BIO", "PS-BIOTEK", "PS-S2-BIO"] },
  { departemen: "DEP-KIM", prodi: ["PS-KIM", "PS-S2-KIM"] },
  { departemen: "DEP-FIS", prodi: ["PS-FIS", "PS-S2-FIS", "PS-PROF-FISMED"] },
  { departemen: "DEP-STAT", prodi: ["PS-STAT"] },
  { departemen: "DEP-INFOR", prodi: ["PS-INFOR"] },
];

/** Berapa mahasiswa dibuat untuk tiap program studi. */
function jumlahMahasiswa(prodi: string): number {
  if (prodi.startsWith("PS-S2-")) return 6;
  if (prodi === "PS-S3-SM") return 6;
  if (prodi === "PS-PROF-FISMED") return 6;
  return 14;
}

export interface RosterDemo {
  orang: OrangDemo[];
  /** Kode unit → login identifier ketua/koordinatornya. */
  pimpinan: { unit: string; loginIdentifier: string; jabatan: string }[];
  /** Anggota panitia Dies: juri untuk kategori video dan bakat. */
  panitia: string[];
}

export const UNIT_PANITIA = "PANITIA-DIES-2026";

/**
 * Membentuk seluruh daftar orang, penetapan pimpinan, dan keanggotaan panitia dalam satu jalan,
 * sehingga nomor urut — dan karenanya nama serta NIP — tidak pernah bergeser antar-bagian.
 */
export function bangunRoster(): RosterDemo {
  const orang: OrangDemo[] = [];
  const pimpinan: RosterDemo["pimpinan"] = [];
  const panitia: string[] = [];
  let urutDosen = 1;
  let urutTendik = 500;
  // Satu penghitung nama untuk semua orang: pasangan depan-belakang baru berulang setelah 1.140
  // orang, jadi selama roster di bawah angka itu tidak ada dua nama yang sama.
  let urutNama = 0;
  const namaBerikutnya = () => namaDasar(++urutNama);

  const tambahDosen = (unit: string): OrangDemo => {
    const g = GELAR_DOSEN[urutDosen % GELAR_DOSEN.length];
    const o: OrangDemo = {
      loginIdentifier: nip(urutDosen),
      nama: `${g.depan}${namaBerikutnya()}${g.belakang}`,
      peran: "DOSEN",
      unit,
    };
    urutDosen++;
    orang.push(o);
    return o;
  };

  // Pemegang jabatan resmi mengambil tempat satu dosen/tendik roster: nomor induk dan urutan nama
  // tetap dimajukan, sehingga nama semua orang lain tidak bergeser akibat penggantian ini.
  const tambahPejabat = (p: PejabatFsm): OrangDemo => {
    const o = p.peran === "DOSEN" ? tambahDosen(p.unit) : tambahTendik(p.unit);
    o.nama = p.nama;
    pimpinan.push({ unit: p.unit, loginIdentifier: o.loginIdentifier, jabatan: p.jabatan });
    return o;
  };

  // Mengisi satu unit sampai `jumlah` dosen roster: pejabat resminya lebih dulu, sisanya dosen biasa.
  const isiDosen = (unit: string, jumlah: number) => {
    const pejabat = pejabatRoster(unit).filter((p) => p.peran === "DOSEN");
    for (const p of pejabat) tambahPejabat(p);
    for (let i = pejabat.length; i < jumlah; i++) tambahDosen(unit);
  };

  const tambahTendik = (unit: string): OrangDemo => {
    const o: OrangDemo = {
      loginIdentifier: nip(urutTendik),
      nama: `${namaBerikutnya()}${GELAR_TENDIK[urutTendik % GELAR_TENDIK.length]}`,
      peran: "TENDIK",
      unit,
    };
    urutTendik++;
    orang.push(o);
    return o;
  };

  for (const d of STRUKTUR) {
    // Departemen: empat dosen tercatat di departemen langsung, bukan di salah satu prodinya —
    // pimpinan departemen yang diumumkan fakultas lebih dulu, sisanya dosen biasa. Pimpinan
    // terpakai kelompok Pimpinan; sisanya bergabung dengan dosen prodi sebagai Selain Pimpinan.
    // Ketua Departemen Matematika dan Fisika dipegang akun seed dasar (dosen1001, dosen1002),
    // jadi kursinya di sini diisi dosen biasa.
    isiDosen(d.departemen, 4);

    // Tenaga kependidikan di tiap departemen: administrasi akademik, keuangan, dan laboratorium.
    for (let i = 0; i < 4; i++) tambahTendik(d.departemen);

    for (const p of d.prodi) {
      isiDosen(p, 6);

      const kode = KODE_NIM[p];
      const total = jumlahMahasiswa(p);
      for (let i = 1; i <= total; i++) {
        orang.push({
          loginIdentifier: nim(kode, 22 + (i % 3), i),
          nama: namaBerikutnya(),
          peran: "MAHASISWA",
          unit: p,
        });
      }
    }
  }

  // Program doktor diasuh fakultas, jadi pengelola dan mahasiswanya tidak berada di bawah
  // departemen mana pun.
  isiDosen("PS-S3-SM", 6);
  for (let i = 1; i <= jumlahMahasiswa("PS-S3-SM"); i++) {
    orang.push({
      loginIdentifier: nim(KODE_NIM["PS-S3-SM"], 22, i),
      nama: namaBerikutnya(),
      peran: "MAHASISWA",
      unit: "PS-S3-SM",
    });
  }

  // Pimpinan fakultas: dekan sudah ada di seed dasar (dekan01); kedua wakil dekan dibuat di sini.
  for (const p of pejabatRoster("FSM")) tambahPejabat(p);

  // Tata usaha fakultas: layanan akademik dan pengelolaan sumber daya berada di sini.
  // Tendik di tata usaha sengaja banyak: dua kategori Dies menilai tendik dengan sejawat satu unit
  // sebagai penilainya, jadi unit ini harus punya cukup sejawat untuk memenuhi target penilai.
  const pejabatTu = pejabatRoster("TU-FSM");
  for (const p of pejabatTu) tambahPejabat(p);
  // Enam belas tendik di luar pimpinan: dua kategori tendik Dies masing-masing mengambil delapan objek.
  for (let i = 0; i < 16; i++) tambahTendik("TU-FSM");

  // Panitia Dies: satu ketua dari dosen, ditambah dosen, tendik, dan mahasiswa sebagai juri.
  const ketuaPanitia = tambahDosen(UNIT_PANITIA);
  pimpinan.push({ unit: UNIT_PANITIA, loginIdentifier: ketuaPanitia.loginIdentifier, jabatan: "Ketua Panitia Dies" });
  panitia.push(ketuaPanitia.loginIdentifier);
  for (let i = 0; i < 5; i++) panitia.push(tambahDosen(UNIT_PANITIA).loginIdentifier);
  for (let i = 0; i < 3; i++) panitia.push(tambahTendik(UNIT_PANITIA).loginIdentifier);

  const ganda = orang.filter((o, i) => orang.findIndex((x) => x.loginIdentifier === o.loginIdentifier) !== i);
  if (ganda.length > 0) {
    throw new Error(`Nomor induk ganda pada roster demo: ${ganda.map((g) => g.loginIdentifier).join(", ")}`);
  }
  if (new Set(orang.map((o) => o.nama)).size !== orang.length) {
    throw new Error("Ada nama yang muncul lebih dari sekali pada roster demo.");
  }
  return { orang, pimpinan, panitia };
}
