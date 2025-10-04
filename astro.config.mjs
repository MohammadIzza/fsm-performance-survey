import { defineConfig } from 'astro/config';
import { BASE_PATH } from './base-path.mjs';
import preloadTema from './integrations/preload-tema.mjs';

// Saat build, Vite memberi awalan `base` pada url(/assets/…) di CSS. Server dev tidak: CSS dilayani
// apa adanya, sehingga font dan gambar tema diminta dari /assets/… dan 404 karena berkas public/
// hanya dilayani di bawah awalan. Plugin khusus dev ini memberi awalan itu pada CSS dev di dua
// tempat: gaya yang disisipkan server ke HTML (modul virtual:astro:dev-css:…, sudah berisi berkas
// tema dari @import) dan modul .css yang dimuat ulang peramban lewat HMR. Keduanya sudah berupa
// string JS, jadi tanda kutip yang di-escape juga dikenali. Hasil build tidak tersentuh.
const awalanAsetDev = {
  name: 'awalan-aset-dev',
  apply: 'serve',
  enforce: 'post',
  transform(code, id) {
    const cssDev =
      id.includes('virtual:astro:dev-css:') || /\.css(\?|$)/.test(id);
    if (!BASE_PATH || !cssDev) return null;
    return code.replace(
      /url\((\\?['"]?)\/assets\//g,
      `url($1${BASE_PATH}/assets/`,
    );
  },
};

export default defineConfig({
  output: 'static',
  integrations: [preloadTema({ base: BASE_PATH })],
  // Halaman publik ikut hidup di bawah awalan aplikasi. `base` hanya memprefix berkas yang dibangun
  // Astro sendiri (/_astro/…); alamat yang ditulis tangan di templat memakai withBase() dari
  // src/utils/url.ts.
  base: BASE_PATH || '/',
  // Halaman-halaman ini dilayani oleh rute tangkap-semua Next (application/src/app/[[...publicPath]]),
  // dan Next memakai bawaannya: alamat tanpa garis miring penutup. Selama Astro menulis tautannya
  // dengan garis miring, setiap perpindahan halaman kena satu alih 308 lebih dulu.
  trailingSlash: 'never',
  devToolbar: { enabled: false },
  vite: { server: { strictPort: true }, plugins: [awalanAsetDev] },
});
