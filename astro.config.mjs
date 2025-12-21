import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  // Halaman-halaman ini dilayani oleh rute tangkap-semua Next (application/src/app/[[...publicPath]]),
  // dan Next memakai bawaannya: alamat tanpa garis miring penutup. Selama Astro menulis tautannya
  // dengan garis miring, setiap perpindahan halaman kena satu alih 308 lebih dulu.
  trailingSlash: 'never',
  devToolbar: { enabled: false },
  vite: { server: { strictPort: true } },
});
