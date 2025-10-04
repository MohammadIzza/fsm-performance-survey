// Awalan alamat situs, mis. "/survey" — diambil dari `base` di astro.config.mjs. BASE_URL bisa
// datang dengan atau tanpa garis miring penutup; di sini selalu tanpa.
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/**
 * Memberi awalan situs pada alamat yang ditulis tangan di templat — aset di public/ dan tautan ke
 * halaman lain. Astro hanya memprefix berkas yang ia bangun sendiri; `src="/assets/…"` apa adanya
 * akan menunjuk ke akar domain dan rusak begitu situs dilayani di bawah sub-path.
 *
 * Beranda di hasil build ditulis "/survey/", sama dengan alamat yang didaftarkan di gateway. Gateway
 * (Apache) menjawab "/survey" dengan alih 302 ke http://…/survey/ — skema http, bukan https — yang
 * diblokir peramban sebagai konten campuran saat transisi halaman mengambilnya lewat fetch, sehingga
 * transisi gagal dan halaman dimuat ulang penuh. Server dev Astro (trailingSlash "never") hanya
 * melayani "/survey", jadi di dev bentuk itu yang dipakai. Alamat luar, `//…`, `#…`, dan `mailto:`
 * dikembalikan apa adanya.
 */
export function withBase(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  if (path === '/') return import.meta.env.DEV ? BASE || '/' : `${BASE}/`;
  return `${BASE}${path}`;
}

/** Kebalikan withBase untuk alamat halaman saat ini: "/survey/panduan-penilai" → "/panduan-penilai". */
export function withoutBase(pathname: string): string {
  if (BASE && (pathname === BASE || pathname.startsWith(`${BASE}/`))) {
    return pathname.slice(BASE.length) || '/';
  }
  return pathname;
}
