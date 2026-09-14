import type { ReactNode } from "react";

/**
 * Keterangan istilah yang ditampilkan lewat ikon ⓘ (components/theme/info.tsx). Dikumpulkan di satu
 * tempat supaya istilah yang sama dijelaskan dengan kalimat yang sama di halaman mana pun.
 */
export const KET: Record<string, ReactNode> = {
  // Aturan penilai
  kelompok: (
    <>
      <b>Pimpinan</b>: pemegang jabatan pimpinan di unit objek. <b>Selain pimpinan</b>: anggota biasa (dosen, tendik,
      mahasiswa). Nilai kedua kelompok dihitung dan diperingkat terpisah.
    </>
  ),
  agregasi: (
    <>
      Cara menggabungkan skor dari beberapa penilai. <b>Rata-rata</b>: skor dijumlah lalu dibagi banyak penilai — adil
      bila jumlah penilai tiap objek berbeda. <b>Total</b>: skor dijumlahkan saja, sehingga objek dengan lebih banyak
      penilai bisa unggul.
    </>
  ),
  target: (
    <>
      Berapa orang yang ingin ditugaskan menilai <b>setiap objek</b> dari kelompok ini. Dipakai saat pembagian tugas
      otomatis. Isi 0 bila kelompok ini tidak dipakai.
    </>
  ),
  minimum: (
    <>
      Berapa penilaian yang harus <b>sudah dikirim</b> agar objek masuk peringkat. Kurang dari itu, objek berstatus
      “Belum memenuhi minimum”. Tidak boleh lebih besar dari target.
    </>
  ),
  pembeda: (
    <>Bila nilai akhir dua objek sama persis, peringkatnya ditentukan skor parameter yang dipilih di sini, sesuai urutan.</>
  ),
  lingkup: (
    <>
      Dari unit mana calon penilai diambil. <b>Unit objek saja</b>: hanya anggota unit tempat objek berada.{" "}
      <b>Unit objek dan subunitnya</b>: termasuk unit di bawahnya, mis. departemen beserta prodinya.
    </>
  ),
  filterJenis: <>Batasi calon penilai ke jenis tertentu, mis. hanya Mahasiswa. Bila tidak ada yang dicentang, semua jenis boleh.</>,
  // Kategori & skala
  jenisObjek: (
    <>
      Apa yang dinilai kategori ini: <b>Orang</b> (dosen, tendik), <b>Unit</b> (prodi, departemen), <b>Karya</b> (video,
      publikasi), atau <b>Lainnya</b>. Hanya objek berjenis sama yang bisa dimasukkan.
    </>
  ),
  kecualikanPembuat: <>Orang yang tercatat ikut membuat sebuah karya tidak akan ditugaskan menilai karyanya sendiri.</>,
  skalaBatas: <>Batas skor yang boleh diisi penilai untuk setiap parameter, mis. 0 sampai 100.</>,
  skalaLangkah: (
    <>
      Jarak antarskor yang boleh diisi, dihitung dari nilai minimum. <b>1</b>: bilangan bulat (70, 71, 72).{" "}
      <b>0,5</b>: boleh setengah (70; 70,5). <b>5</b>: hanya kelipatan 5 (70, 75, 80). Harus lebih dari 0.
    </>
  ),
  kebijakanAkses: (
    <>
      Kapan Dekan dan pimpinan unit boleh melihat hasil. Admin selalu bisa. <b>Selama aktif</b>: sejak pengisian dibuka,
      nilainya masih bisa berubah. <b>Setelah ditutup</b>: setelah pengisian ditutup. <b>Setelah final</b>: setelah hasil
      difinalkan. <b>Waktu tertentu</b>: mulai tanggal dan jam yang ditentukan.
    </>
  ),
  // Objek
  penggunaTerkait: <>Akun orang yang dinilai. Orang ini otomatis tidak akan ditugaskan menilai dirinya sendiri.</>,
  unitDinilai: <>Unit yang menjadi objek penilaian, mis. sebuah prodi.</>,
  unitPemilik: (
    <>
      Unit tempat objek ini berada. Menentukan calon penilainya (anggota dan pimpinan unit ini) dan pimpinan mana yang bisa
      melihat hasilnya.
    </>
  ),
  penanggungJawab: (
    <>Kontak yang bertanggung jawab atas objek ini, mis. ketua tim karya. Wajib untuk objek selain Orang sebelum periode bisa dibuka.</>
  ),
  // Pengguna & organisasi
  idMasuk: <>ID yang diketik saat masuk: NIP, NIM, atau NIK. Tidak boleh sama dengan pengguna lain.</>,
  jenisPengguna: <>Golongan pengguna (Dosen, Mahasiswa, Tenaga Kependidikan). Dipakai untuk membatasi siapa yang boleh menilai kategori tertentu.</>,
  unitUtama: <>Unit tempat orang ini bernaung. Menentukan objek mana yang bisa ia nilai sebagai anggota unit.</>,
  peran: (
    <>
      <b>Admin</b>: mengelola seluruh aplikasi. <b>Dekan</b>: melihat hasil seluruh fakultas dan mengatur waktu akses
      hasil. Pimpinan unit tidak diberikan di sini, melainkan lewat jabatan di menu Organisasi.
    </>
  ),
  induk: <>Unit di atasnya dalam struktur, mis. prodi berinduk ke departemen. Pimpinan unit induk ikut melihat hasil unit di bawahnya.</>,
  jabatan: (
    <>Nama jabatan, mis. Ketua Departemen. Pemegang jabatan aktif menjadi penilai kelompok Pimpinan dan bisa melihat hasil unitnya.</>
  ),
  // Pembagian tugas
  calonSah: <>Jumlah orang yang memenuhi aturan untuk menilai objek ini: sesuai lingkup dan jenis pengguna, serta bukan objeknya sendiri.</>,
  kekurangan: <>Slot target yang tidak terisi karena calon sah sudah habis. Tambahkan penilai secara manual bila perlu.</>,
  // Status periode
  siklusPeriode: (
    <>
      <b>Draf</b>: sedang disusun. <b>Siap</b>: lolos pemeriksaan, menunggu dibuka. <b>Aktif</b>: penilai bisa mengisi.{" "}
      <b>Ditutup</b>: pengisian berhenti, hasil bisa dihitung. <b>Final</b>: hasil resmi dikunci. <b>Revisi</b>: final
      dibuka lagi untuk koreksi.
    </>
  ),
  // Hasil
  respons: <>Jumlah penilaian yang sudah dikirim untuk objek ini di kelompok tersebut.</>,
  nilaiAkhir: (
    <>Skor tiap parameter digabung antarpenilai (rata-rata atau total), lalu dikali bobot parameternya dan dijumlahkan.</>
  ),
  statusKelayakan: (
    <>
      <b>Memenuhi syarat</b>: penilaian terkirim sudah mencapai minimum, ikut peringkat. <b>Belum memenuhi minimum</b> /{" "}
      <b>Belum ada penilaian</b>: ditaruh di bawah tanpa nomor peringkat.
    </>
  ),
  sementara: <>Selama periode belum final, nilai masih bisa berubah karena penilaian baru atau koreksi. Setelah final, nilai dikunci.</>,
  // Pemantauan
  sudahDikirim: <>Persentase tugas penilaian yang jawabannya sudah dikirim. Tugas yang dibatalkan tidak dihitung.</>,
  penilaiBelumSelesai: <>Orang yang masih punya minimal satu tugas yang belum dikirim.</>,
  belumCukup: <>Objek yang penilaian terkirimnya belum mencapai minimum di aturan penilai, sehingga belum bisa masuk peringkat.</>,
  sedangDiisi: <>Penilai sudah mulai mengisi dan menyimpan draf, tetapi belum menekan Kirim. Draf belum ikut dihitung.</>,
};
