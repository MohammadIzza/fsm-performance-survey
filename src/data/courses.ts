// Kategori diambil dari Instrumen Penilaian Dies FSM UNDIP 2026 (9 slide):
// nama, jumlah parameter, sumber/responden, dan skala mengikuti dokumen itu.
// Tanggal tidak dicantumkan karena dokumen hanya menyebut "periode yang
// ditetapkan panitia", jadi tidak ada tanggal yang boleh diklaim di sini.
export const sessions = {
  'periode-1': {
    kind: 'bootcamp',
    option: 'Dies FSM UNDIP 2026 • 9 kategori • Periode berjalan',
    title: 'Dies FSM UNDIP 2026',
    dates: 'Periode berjalan',
    location: 'Fakultas Sains dan Matematika',
    topic: '9 kategori',
    topicClass: 'sb__topic sb__topic--data',
  },
  'periode-2': {
    kind: 'bootcamp',
    option: 'Evaluasi Semester Ganjil • Contoh demo • Periode ditutup',
    title: 'Evaluasi Semester Ganjil',
    dates: 'Periode ditutup',
    location: 'Fakultas Sains dan Matematika',
    topic: 'Contoh demo',
    topicClass: 'sb__topic sb__topic--data',
  },
  'periode-3': {
    kind: 'bootcamp',
    option: 'Evaluasi Semester Genap • Contoh demo • Periode final',
    title: 'Evaluasi Semester Genap',
    dates: 'Periode final',
    location: 'Fakultas Sains dan Matematika',
    topic: 'Contoh demo',
    topicClass: 'sb__topic sb__topic--data',
  },

  // Kategori dengan objek orang.
  'kategori-03': {
    kind: 'course',
    option:
      'Dosen dengan Publikasi Terbanyak • Rekap resmi dan basis data ilmiah',
    title: 'Dosen dengan Publikasi Terbanyak',
    dates: 'Periode Dies 2026',
    location: 'Rekap resmi dan basis data ilmiah',
    duration: '4 parameter',
    price: 'Skala 0-100',
  },
  'kategori-04': {
    kind: 'course',
    option: 'Dosen Favorit se-FSM • Polling sivitas FSM',
    title: 'Dosen Favorit se-FSM',
    dates: 'Periode Dies 2026',
    location: 'Polling sivitas FSM',
    duration: '6 parameter',
    price: 'Skala 0-100',
  },
  'kategori-05': {
    kind: 'course',
    option: 'Tendik Terbaik Bidang Akademik • Atasan dan sejawat',
    title: 'Tendik Terbaik Bidang Akademik',
    dates: 'Periode Dies 2026',
    location: 'Atasan dan sejawat',
    duration: '6 parameter',
    price: 'Skala 0-100',
  },
  'kategori-06': {
    kind: 'course',
    option: 'Tendik Terbaik Bidang Sumber Daya • Atasan dan sejawat',
    title: 'Tendik Terbaik Bidang Sumber Daya',
    dates: 'Periode Dies 2026',
    location: 'Atasan dan sejawat',
    duration: '6 parameter',
    price: 'Skala 0-100',
  },
  'kategori-09': {
    kind: 'course',
    option: 'FSM Got Talent • Seleksi awal dan panel juri',
    title: 'FSM Got Talent',
    dates: 'Periode Dies 2026',
    location: 'Seleksi awal dan panel juri',
    duration: '5 parameter',
    price: 'Skala 0-100',
  },

  // Kategori dengan objek unit dan karya.
  'kategori-01': {
    kind: 'course',
    option: 'Prodi dengan Capaian Publikasi Terbanyak • Rekap resmi prodi',
    title: 'Prodi dengan Capaian Publikasi Terbanyak',
    dates: 'Periode Dies 2026',
    location: 'Rekap resmi prodi',
    duration: '4 parameter',
    price: 'Skala 0-100',
  },
  'kategori-02': {
    kind: 'course',
    option: 'Prodi dengan Capaian IKU Terbaik • Dashboard IKU UNDIP',
    title: 'Prodi dengan Capaian IKU Terbaik',
    dates: 'Periode Dies 2026',
    location: 'Dashboard IKU UNDIP',
    duration: '4 parameter',
    price: 'Skala 0-100',
  },
  'kategori-07': {
    kind: 'course',
    option: 'Video Promosi Prodi S1 oleh HM • Panel juri',
    title: 'Video Promosi Prodi S1 oleh HM',
    dates: 'Periode Dies 2026',
    location: 'Panel juri',
    duration: '6 parameter',
    price: 'Skala 0-100',
  },
  'kategori-08': {
    kind: 'course',
    option: 'Video Promosi Prodi oleh Pengelola Prodi • Panel juri',
    title: 'Video Promosi Prodi oleh Pengelola Prodi',
    dates: 'Periode Dies 2026',
    location: 'Panel juri',
    duration: '6 parameter',
    price: 'Skala 0-100',
  },
} as const;

export const sessionGroups = {
  periodePenilaian: ['periode-1', 'periode-2', 'periode-3'],
  kategoriIndividu: [
    'kategori-03',
    'kategori-04',
    'kategori-05',
    'kategori-06',
    'kategori-09',
  ],
  kategoriUnitKarya: [
    'kategori-01',
    'kategori-02',
    'kategori-07',
    'kategori-08',
  ],
} as const;
