// Satu sumber untuk awalan alamat aplikasi. Situs dipublikasikan lewat gateway UNDIP di
// https://apps-fsm.undip.ac.id/survey/ dengan awalan diteruskan utuh, jadi setiap halaman, aset, dan
// cookie harus hidup di bawah /survey — bukan di akar domain yang dipakai bersama aplikasi lain.
//
// Dibaca oleh astro.config.mjs (base), application/next.config.ts (basePath), dan
// scripts/prepare-application.mjs (awalan url() pada CSS tema yang disalin ke aplikasi). Nilainya
// tanpa garis miring penutup; kosongkan lewat BASE_PATH= untuk kembali melayani dari akar.
//
// Satu tempat yang tidak bisa membaca nilai ini: url() di application/src/app/globals.css ditulis
// langsung dengan /survey — ubah ikut bila awalannya diganti.
export const BASE_PATH = (process.env.BASE_PATH ?? '/survey').replace(
  /\/+$/,
  '',
);
