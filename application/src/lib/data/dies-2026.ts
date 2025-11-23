/**
 * Rancangan penilaian Dies Natalis FSM UNDIP 2026 — sembilan kategori, disalin apa adanya dari
 * berkas panitia "Instrumen Penilaian Dies FSM UNDIP 2026" (9 slide).
 *
 * Yang disimpan di sini hanya rancangannya: nama kategori, jenis objek yang dinilai, parameter
 * beserta indikator operasional dan bobotnya, urutan pembeda saat nilai sama, serta catatan sumber
 * dan cara hitung yang dipakai sebagai panduan instrumen. Data orang, unit, dan objeknya dibentuk
 * oleh skrip seed, bukan berkas ini.
 *
 * Bobot tiap kategori dijumlahkan tepat 100 — dijaga oleh pemeriksaan di bawah, bukan oleh
 * kepercayaan pada ketelitian penyalinan.
 */

export type JenisObjek = "ORANG" | "UNIT" | "KARYA";

export interface ParameterDies {
  nama: string;
  indikator: string;
  bobot: number;
}

export interface KategoriDies {
  /** Nomor urut pada berkas panitia (01–09). */
  nomor: number;
  kode: string;
  nama: string;
  ringkasan: string;
  jenisObjek: JenisObjek;
  parameter: ParameterDies[];
  sumber: string;
  perhitungan: string;
  /** Urutan parameter pembeda saat nilai akhir sama, sebagai indeks pada `parameter`. */
  pembeda: number[];
  /** Kalimat penutup tie-break di berkas panitia bila pembedanya bukan parameter instrumen. */
  pembedaCatatan?: string;
}

const SKALA = "Skala: 90–100 sangat baik • 75–89 baik • 60–74 cukup • <60 perlu perbaikan.";

/** Panduan instrumen: gabungan sumber, cara hitung, dan skala penilaian dari berkas panitia. */
export function panduanInstrumen(k: KategoriDies): string {
  const pembeda = k.pembeda.map((i) => k.parameter[i].nama.toLowerCase());
  if (k.pembedaCatatan) pembeda.push(k.pembedaCatatan);
  return [
    `Sumber/responden: ${k.sumber}`,
    `Perhitungan: ${k.perhitungan}`,
    `Nilai bobot = skor parameter × bobot ÷ 100; nilai akhir = jumlah seluruh nilai bobot.`,
    `Urutan pembeda saat nilai sama: ${pembeda.join(", lalu ")}.`,
    SKALA,
    "Bobot dan teknis final disahkan oleh Panitia Dies FSM UNDIP 2026.",
  ].join("\n");
}

export const KATEGORI_DIES: KategoriDies[] = [
  {
    nomor: 1,
    kode: "01-PUBLIKASI-PRODI",
    nama: "Prodi dengan Capaian Publikasi Terbanyak",
    ringkasan:
      "Berbasis data publikasi resmi program studi pada periode yang ditetapkan panitia.",
    jenisObjek: "UNIT",
    parameter: [
      {
        nama: "Kuantitas publikasi",
        indikator:
          "Jumlah karya ilmiah terverifikasi dengan afiliasi FSM UNDIP dan tanpa duplikasi.",
        bobot: 60,
      },
      {
        nama: "Proporsi publikasi bereputasi",
        indikator:
          "Persentase publikasi pada jurnal/prosiding terindeks sesuai klasifikasi panitia.",
        bobot: 20,
      },
      {
        nama: "Peran penulis & afiliasi",
        indikator:
          "Keterlibatan penulis utama/korespondensi serta penulisan afiliasi yang benar.",
        bobot: 10,
      },
      {
        nama: "Kelengkapan bukti",
        indikator:
          "DOI/URL, tahun, jenis publikasi, daftar penulis, dan status indeksasi lengkap.",
        bobot: 10,
      },
    ],
    sumber:
      "Rekap resmi prodi/fakultas dan basis data ilmiah yang ditetapkan panitia.",
    perhitungan:
      "Skor kuantitas = jumlah valid prodi ÷ jumlah tertinggi × 100. Parameter lain dinilai 0–100.",
    pembeda: [0, 1, 3],
  },
  {
    nomor: 2,
    kode: "02-IKU-PRODI",
    nama: "Prodi dengan Capaian IKU Terbaik",
    ringkasan:
      "Menggunakan capaian IKU resmi UNDIP dan bukti kinerja yang telah tervalidasi.",
    jenisObjek: "UNIT",
    parameter: [
      {
        nama: "Nilai capaian IKU resmi",
        indikator:
          "Nilai agregat capaian seluruh indikator IKU yang berlaku pada periode penilaian.",
        bobot: 60,
      },
      {
        nama: "IKU mencapai target",
        indikator:
          "Persentase indikator yang mencapai atau melampaui target yang ditetapkan.",
        bobot: 20,
      },
      {
        nama: "Pertumbuhan capaian",
        indikator:
          "Kenaikan kinerja dibandingkan periode sebelumnya berdasarkan data resmi.",
        bobot: 10,
      },
      {
        nama: "Kualitas pelaporan",
        indikator:
          "Bukti lengkap, konsisten, tepat waktu, dan lolos verifikasi unit terkait.",
        bobot: 10,
      },
    ],
    sumber:
      "Dashboard/laporan IKU UNDIP yang telah disahkan dan rekap pendukung program studi.",
    perhitungan:
      "Nilai agregat dinormalisasi terhadap capaian tertinggi. Parameter lain dihitung dari persentase dan verifikasi bukti.",
    pembeda: [1, 2, 3],
  },
  {
    nomor: 3,
    kode: "03-PUBLIKASI-DOSEN",
    nama: "Dosen dengan Publikasi Terbanyak",
    ringkasan:
      "Berbasis publikasi dosen yang valid, tercatat, dan menggunakan afiliasi FSM UNDIP.",
    jenisObjek: "ORANG",
    parameter: [
      {
        nama: "Jumlah publikasi valid",
        indikator:
          "Total karya ilmiah terverifikasi pada periode penilaian dan bebas duplikasi.",
        bobot: 60,
      },
      {
        nama: "Mutu & indeksasi",
        indikator:
          "Kualitas media publikasi berdasarkan indeksasi/klasifikasi yang ditetapkan panitia.",
        bobot: 25,
      },
      {
        nama: "Peran kepengarangan",
        indikator:
          "Peran sebagai penulis utama, penulis korespondensi, atau kontribusi penting.",
        bobot: 10,
      },
      {
        nama: "Validitas data",
        indikator:
          "DOI/URL, tahun terbit, status publikasi, dan afiliasi dapat diverifikasi.",
        bobot: 5,
      },
    ],
    sumber:
      "Rekap resmi dosen/fakultas serta basis data publikasi yang disepakati panitia.",
    perhitungan:
      "Skor jumlah = jumlah valid dosen ÷ jumlah tertinggi × 100. Skor mutu dan peran mengikuti bukti terverifikasi.",
    pembeda: [0, 1, 2],
  },
  {
    nomor: 4,
    kode: "04-DOSEN-FAVORIT",
    nama: "Dosen Favorit se-FSM",
    ringkasan:
      "Polling sivitas FSM yang dikoordinasikan BEM dan HM dengan responden terverifikasi.",
    jenisObjek: "ORANG",
    parameter: [
      {
        nama: "Inspirasi & kualitas pembelajaran",
        indikator:
          "Pembelajaran jelas, menarik, relevan, dan mendorong mahasiswa berkembang.",
        bobot: 25,
      },
      {
        nama: "Komunikasi & empati",
        indikator:
          "Menghargai sivitas, mendengarkan, inklusif, dan berkomunikasi secara positif.",
        bobot: 20,
      },
      {
        nama: "Aksesibilitas & responsivitas",
        indikator:
          "Mudah dihubungi sesuai etika, memberi konsultasi dan umpan balik tepat waktu.",
        bobot: 15,
      },
      {
        nama: "Integritas & keteladanan",
        indikator:
          "Adil, disiplin, konsisten, dan menjadi teladan akademik maupun etika.",
        bobot: 20,
      },
      {
        nama: "Kontribusi pengembangan mahasiswa",
        indikator:
          "Aktif membimbing prestasi, kegiatan, riset, atau pengembangan karier mahasiswa.",
        bobot: 15,
      },
      {
        nama: "Profesionalisme",
        indikator:
          "Menjalankan tanggung jawab akademik secara tertib dan dapat dipercaya.",
        bobot: 5,
      },
    ],
    sumber:
      "Form polling untuk sivitas FSM; satu akun hanya satu respons dan identitas diverifikasi.",
    perhitungan:
      "Nilai akhir = rata-rata skor valid setiap parameter setelah penyaringan respons tidak sah/duplikat.",
    pembeda: [3, 0],
    pembedaCatatan: "jumlah respons valid",
  },
  {
    nomor: 5,
    kode: "05-TENDIK-AKADEMIK",
    nama: "Tendik Terbaik Bidang Akademik",
    ringkasan: "Penilaian kinerja layanan akademik melalui atasan dan sejawat.",
    jenisObjek: "ORANG",
    parameter: [
      {
        nama: "Kecepatan & ketepatan layanan",
        indikator:
          "Layanan akademik diselesaikan tepat waktu, akurat, dan minim koreksi.",
        bobot: 25,
      },
      {
        nama: "Kualitas sikap layanan",
        indikator:
          "Ramah, solutif, responsif, dan konsisten membantu pengguna layanan.",
        bobot: 20,
      },
      {
        nama: "Penguasaan SOP & sistem",
        indikator:
          "Memahami regulasi, alur administrasi, aplikasi, dan dokumentasi akademik.",
        bobot: 20,
      },
      {
        nama: "Disiplin & tanggung jawab",
        indikator:
          "Kehadiran, ketuntasan tugas, kerahasiaan data, dan kepatuhan kerja.",
        bobot: 15,
      },
      {
        nama: "Komunikasi & kerja sama",
        indikator:
          "Mampu berkoordinasi dan bekerja efektif dengan dosen, mahasiswa, dan unit lain.",
        bobot: 10,
      },
      {
        nama: "Inovasi layanan",
        indikator:
          "Menghasilkan perbaikan alur, efisiensi, atau solusi layanan yang terukur.",
        bobot: 10,
      },
    ],
    sumber:
      "Usulan komposisi penilai: atasan 60% dan sejawat 40%, dilengkapi bukti kinerja. Di sistem ini atasan masuk kelompok Pimpinan dan sejawat masuk kelompok Selain Pimpinan; keduanya dihitung dan diperingkat terpisah.",
    perhitungan:
      "Nilai tiap kelompok penilai dirata-ratakan, kemudian digabung sesuai komposisi penilai.",
    pembeda: [0, 1, 3],
  },
  {
    nomor: 6,
    kode: "06-TENDIK-SUMBER-DAYA",
    nama: "Tendik Terbaik Bidang Sumber Daya",
    ringkasan:
      "Penilaian kinerja pengelolaan sumber daya melalui atasan dan sejawat.",
    jenisObjek: "ORANG",
    parameter: [
      {
        nama: "Efektivitas pengelolaan",
        indikator:
          "Sumber daya dikelola tepat sasaran sesuai tugas unit: SDM, keuangan, aset, laboratorium, atau TI.",
        bobot: 25,
      },
      {
        nama: "Kepatuhan & akuntabilitas",
        indikator:
          "Mematuhi SOP, menyusun pelaporan, menjaga dokumen, dan dapat dipertanggungjawabkan.",
        bobot: 20,
      },
      {
        nama: "Kualitas & respons layanan",
        indikator:
          "Memberikan solusi cepat, akurat, ramah, dan sesuai kebutuhan unit/pengguna.",
        bobot: 20,
      },
      {
        nama: "Disiplin & tanggung jawab",
        indikator:
          "Kehadiran, ketuntasan tugas, ketelitian, dan konsistensi dalam pekerjaan.",
        bobot: 15,
      },
      {
        nama: "Kolaborasi & komunikasi",
        indikator:
          "Koordinasi lintas unit berjalan efektif, terbuka, dan saling mendukung.",
        bobot: 10,
      },
      {
        nama: "Efisiensi & inovasi",
        indikator:
          "Menciptakan penghematan, perbaikan proses, digitalisasi, atau solusi baru.",
        bobot: 10,
      },
    ],
    sumber:
      "Usulan komposisi penilai: atasan 60% dan sejawat 40%, dengan bukti kinerja unit. Di sistem ini atasan masuk kelompok Pimpinan dan sejawat masuk kelompok Selain Pimpinan; keduanya dihitung dan diperingkat terpisah.",
    perhitungan:
      "Nilai tiap kelompok penilai dirata-ratakan, lalu digabung sesuai komposisi penilai.",
    pembeda: [1, 0, 2],
  },
  {
    nomor: 7,
    kode: "07-VIDEO-HM",
    nama: "Video Promosi Prodi S1 Terbaik oleh HM",
    ringkasan:
      "Karya Himpunan Mahasiswa yang mempromosikan program studi secara kreatif dan akurat.",
    jenisObjek: "KARYA",
    parameter: [
      {
        nama: "Akurasi & relevansi konten",
        indikator:
          "Informasi prodi benar, relevan, mudah dipahami, dan sesuai sasaran calon mahasiswa.",
        bobot: 20,
      },
      {
        nama: "Kreativitas & orisinalitas",
        indikator:
          "Ide segar, tidak meniru, serta menampilkan karakter khas prodi dan mahasiswa.",
        bobot: 20,
      },
      {
        nama: "Alur cerita & daya persuasif",
        indikator:
          "Narasi runtut, menarik, memiliki pesan utama, dan ajakan yang jelas.",
        bobot: 15,
      },
      {
        nama: "Kualitas visual, audio & teknis",
        indikator:
          "Gambar stabil, komposisi baik, suara jelas, editing rapi, dan nyaman ditonton.",
        bobot: 20,
      },
      {
        nama: "Branding & call-to-action",
        indikator:
          "Identitas UNDIP/FSM/prodi digunakan tepat dan mengarahkan audiens pada informasi resmi.",
        bobot: 15,
      },
      {
        nama: "Partisipasi & kepatuhan",
        indikator:
          "Melibatkan mahasiswa dan memenuhi durasi, format, hak cipta, serta tenggat.",
        bobot: 10,
      },
    ],
    sumber:
      "Video dibuat oleh HM masing-masing prodi dan diserahkan melalui kanal resmi panitia.",
    perhitungan:
      "Minimal tiga juri menggunakan rubrik yang sama; nilai akhir adalah rata-rata skor juri.",
    pembeda: [0, 1, 3],
  },
  {
    nomor: 8,
    kode: "08-VIDEO-PENGELOLA",
    nama: "Video Promosi Prodi S1, S2, S3 Terbaik oleh Pengelola Prodi",
    ringkasan:
      "Video resmi pengelola program studi dengan informasi akademik yang lengkap dan kredibel.",
    jenisObjek: "KARYA",
    parameter: [
      {
        nama: "Akurasi & kelengkapan akademik",
        indikator:
          "Profil, jenjang, kurikulum, keunggulan, fasilitas, prospek, dan kontak resmi disajikan benar.",
        bobot: 25,
      },
      {
        nama: "Keunikan & proposisi nilai",
        indikator:
          "Menonjolkan diferensiasi program studi dan manfaat bagi calon mahasiswa/mitra.",
        bobot: 20,
      },
      {
        nama: "Struktur & narasi",
        indikator:
          "Informasi tersusun logis, ringkas, menarik, dan memiliki pesan utama yang kuat.",
        bobot: 15,
      },
      {
        nama: "Kualitas visual & audio",
        indikator:
          "Sinematografi, grafis, suara, editing, dan konsistensi visual terlihat profesional.",
        bobot: 15,
      },
      {
        nama: "Branding & kredibilitas",
        indikator:
          "Identitas institusi tepat, narasumber/bukti meyakinkan, dan tautan resmi ditampilkan.",
        bobot: 10,
      },
      {
        nama: "Aksesibilitas & kepatuhan teknis",
        indikator:
          "Subtitle/teks terbaca serta memenuhi durasi, format, hak cipta, dan tenggat.",
        bobot: 15,
      },
    ],
    sumber:
      "Video dibuat pengelola prodi dan diverifikasi pimpinan/penanggung jawab sebelum dikirim.",
    perhitungan:
      "Minimal tiga juri menilai secara independen; nilai akhir adalah rata-rata skor juri.",
    pembeda: [0, 1, 3],
  },
  {
    nomor: 9,
    kode: "09-FSM-GOT-TALENT",
    nama: "FSM Got Talent",
    ringkasan:
      "Seleksi bakat sivitas FSM untuk menentukan tiga finalis dan peringkat Juara 1–3.",
    jenisObjek: "ORANG",
    parameter: [
      {
        nama: "Penguasaan teknis",
        indikator:
          "Kemampuan inti sesuai jenis bakat: vokal, musik, tari, seni, komedi, sulap, atau lainnya.",
        bobot: 30,
      },
      {
        nama: "Kreativitas & orisinalitas",
        indikator:
          "Konsep unik, interpretasi pribadi, dan unsur pembeda yang kuat.",
        bobot: 20,
      },
      {
        nama: "Penampilan & ekspresi panggung",
        indikator:
          "Percaya diri, ekspresif, menguasai ruang, dan mampu membangun energi pertunjukan.",
        bobot: 20,
      },
      {
        nama: "Daya hibur & penyampaian pesan",
        indikator:
          "Menarik perhatian, komunikatif, berkesan, dan sesuai nilai acara Dies FSM.",
        bobot: 15,
      },
      {
        nama: "Kesiapan, waktu & keselamatan",
        indikator:
          "Persiapan matang, durasi terkendali, properti aman, dan mematuhi ketentuan panitia.",
        bobot: 15,
      },
    ],
    sumber:
      "Tahap 1: pendaftaran dan seleksi awal. Tiga nilai tertinggi menjadi finalis.",
    perhitungan:
      "Tahap final: tiga finalis tampil pada Dies FSM; peringkat Juara 1–3 ditentukan dari nilai final juri.",
    pembeda: [0, 2],
    pembedaCatatan: "keputusan panel juri",
  },
];

// Salah satu bobot yang meleset membuat seluruh peringkat kategori itu salah tanpa pesan galat,
// jadi jumlahnya diperiksa saat berkas ini dimuat, bukan saat datanya sudah masuk basis data.
for (const k of KATEGORI_DIES) {
  const total = k.parameter.reduce((a, p) => a + p.bobot, 0);
  if (Math.round(total * 100) / 100 !== 100) {
    throw new Error(`Bobot kategori ${k.kode} berjumlah ${total}, seharusnya 100.`);
  }
}
