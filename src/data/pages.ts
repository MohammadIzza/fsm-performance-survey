export const pages = {
  home: {
    title: 'Survei Penilaian FSM UNDIP - Sistem Penilaian Terstruktur',
    description:
      'Sistem penilaian daring Fakultas Sains dan Matematika Universitas Diponegoro: kategori dinamis, penugasan penilai, dan dua leaderboard terpisah.',
    layout: 'l-front-page',
    path: '/',
  },
  'alur-penilaian': {
    title: 'Alur Penilaian End-to-End - Survei FSM UNDIP',
    description:
      'Sembilan tahap penilaian, dari penyiapan organisasi dan instrumen hingga penugasan, pengisian, perhitungan, finalisasi, dan arsip periode.',
    layout: 'l-bootcamp',
    path: '/alur-penilaian/',
  },
  'panduan-penilai': {
    title: 'Panduan Penilai - Survei FSM UNDIP',
    description:
      'Cara menerima tugas penilaian, menyimpan draf, melengkapi seluruh parameter, dan mengirim jawaban.',
    layout: 'l-bootcamp',
    path: '/panduan-penilai/',
  },
  'panduan-pimpinan': {
    title: 'Panduan Pimpinan - Survei FSM UNDIP',
    description:
      'Pimpinan mengisi formulir penilaian dan menelusuri hasil unit sendiri beserta turunannya sesuai waktu akses yang ditetapkan.',
    layout: 'l-b2b',
    path: '/panduan-pimpinan/',
  },
  'panduan-admin': {
    title: 'Panduan Admin - Survei FSM UNDIP',
    description:
      'Menyusun periode, kategori, instrumen, dan bobot; menerbitkan penugasan acak yang merata; menutup, memfinalkan, dan membuka revisi.',
    layout: 'l-b2b',
    path: '/panduan-admin/',
  },
  'kebijakan-privasi': {
    title: 'Kebijakan Privasi - Survei FSM UNDIP',
    description: 'Terakhir diperbarui: 9 September 2026',
    layout: 'l-page',
    path: '/kebijakan-privasi/',
  },
  'kebijakan-data': {
    title: 'Kebijakan Data dan Sesi - Survei FSM UNDIP',
    description: 'Kebijakan Data dan Sesi - Survei Penilaian FSM UNDIP',
    layout: 'l-page',
    path: '/kebijakan-data/',
  },
} as const;
