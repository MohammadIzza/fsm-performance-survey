// Tautan yang meninggalkan situs publik lewat muat ulang penuh (data-lg-reload — "Masuk Survei" ke
// aplikasi Next) menjalankan transisi keluar tema lebih dulu: lapisan .site-loader dibuat buram,
// bentuk krem di dalamnya menutup seluruh layar, gulir Lenis dihentikan, lalu barulah peramban
// berpindah halaman. Keadaan tertutup itulah yang dibekukan back/forward cache peramban.
//
// Saat pengguna menekan Kembali, Chrome (terutama di ponsel) memulihkan halaman dari cache itu apa
// adanya — tanpa memuat ulang dan tanpa menjalankan tema lagi — sehingga yang terlihat hanya layar
// krem kosong. Di sini, bila halaman dipulihkan dari cache, keadaan transisi keluar itu dibatalkan:
// lapisan dimunculkan kembali ke keadaan diam, bentuknya dikembalikan, dan gulir dijalankan lagi.

interface LugeGlobal {
  smoothscroll?: { lenis?: { start(): void } };
}

window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;

  const loader = document.querySelector<HTMLElement>('.site-loader');
  if (loader) {
    loader.style.opacity = '0';
    delete loader.dataset.transitionFrom;
    delete loader.dataset.transitionTo;
    for (const bagian of loader.querySelectorAll<HTMLElement>(
      '.js-shape, .js-head, .js-eye',
    )) {
      bagian.style.transform = '';
      bagian.style.translate = '';
      bagian.style.scale = '';
      bagian.style.opacity = '';
    }
  }

  document.body.classList.remove('is-nav-hidden');
  document.documentElement.classList.remove('is-blocked');
  const luge = (window as unknown as { luge?: LugeGlobal }).luge;
  luge?.smoothscroll?.lenis?.start();
});
