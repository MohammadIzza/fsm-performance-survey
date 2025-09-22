import { defineConfig } from 'astro/config';
import { BASE_PATH } from './base-path.mjs';

export default defineConfig({
  output: 'static',
  // Halaman publik ikut hidup di bawah awalan aplikasi. `base` hanya memprefix berkas yang dibangun
  // Astro sendiri (/_astro/…); alamat yang ditulis tangan di templat memakai withBase() dari
  // src/utils/url.ts.
  base: BASE_PATH || '/',
  // Halaman-halaman ini dilayani oleh rute tangkap-semua Next (application/src/app/[[...publicPath]]),
  // dan Next memakai bawaannya: alamat tanpa garis miring penutup. Selama Astro menulis tautannya
  // dengan garis miring, setiap perpindahan halaman kena satu alih 308 lebih dulu.
  trailingSlash: 'never',
  devToolbar: { enabled: false },
  vite: { server: { strictPort: true } },
});
