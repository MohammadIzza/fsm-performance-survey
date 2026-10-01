/**
 * Paginasi daftar di halaman admin.
 *
 * Halaman admin dulu merender seluruh baris sekaligus. Tiap baris membawa panel sunting lengkap
 * (formulir, pilihan unit, pilihan pengguna), jadi Pengguna dengan ±900 akun atau Organisasi yang
 * tiap barisnya membawa daftar seluruh pengguna aktif terasa lambat sejak pertama dibuka. Sekarang
 * yang dikirim ke peramban hanya satu halaman; pencarian ikut dikerjakan di server supaya tetap
 * menjangkau seluruh data, bukan cuma halaman yang sedang tampil.
 */
export const PER_HALAMAN = 20;

/** `?halaman=` dari alamat; apa pun yang bukan bilangan bulat positif dianggap halaman 1. */
export function bacaHalaman(nilai: string | undefined): number {
  const n = Number(nilai);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** Halaman yang diminta dijepit ke rentang yang ada, lalu dihitung posisi potongnya. */
export function hitungHalaman(total: number, diminta: number, perHalaman = PER_HALAMAN) {
  const totalHalaman = Math.max(1, Math.ceil(total / perHalaman));
  const halaman = Math.min(Math.max(1, diminta), totalHalaman);
  return { halaman, totalHalaman, total, perHalaman, lewati: (halaman - 1) * perHalaman };
}

/** Untuk daftar yang sudah ada di memori server (mis. unit, objek): potong satu halaman. */
export function potongHalaman<T>(daftar: T[], diminta: number, perHalaman = PER_HALAMAN) {
  const info = hitungHalaman(daftar.length, diminta, perHalaman);
  return { ...info, isi: daftar.slice(info.lewati, info.lewati + perHalaman) };
}

/** Pencocokan pencarian sederhana, tidak peka huruf besar-kecil. Kata kunci kosong cocok semua. */
export function cocokCari(cari: string, ...teks: (string | null | undefined)[]): boolean {
  const kunci = cari.trim().toLowerCase();
  if (!kunci) return true;
  return teks.some((t) => t?.toLowerCase().includes(kunci));
}
