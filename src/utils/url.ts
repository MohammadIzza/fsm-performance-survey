// Awalan alamat situs, mis. "/survey" — diambil dari `base` di astro.config.mjs. BASE_URL bisa
// datang dengan atau tanpa garis miring penutup; di sini selalu tanpa.
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

/**
 * Memberi awalan situs pada alamat yang ditulis tangan di templat — aset di public/ dan tautan ke
 * halaman lain. Astro hanya memprefix berkas yang ia bangun sendiri; `src="/assets/…"` apa adanya
 * akan menunjuk ke akar domain dan rusak begitu situs dilayani di bawah sub-path.
 *
 * Beranda menjadi "/survey" tanpa garis miring penutup — bentuk yang sama dengan <Link href="/"> di Next
 * dan satu-satunya yang dilayani server dev Astro (trailingSlash "never"). "/survey/" tetap terbuka
 * di produksi: nginx melayani keduanya. Alamat luar, `//…`, `#…`, dan `mailto:` dikembalikan apa adanya.
 */
export function withBase(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) return path;
  return path === '/' ? BASE || '/' : `${BASE}${path}`;
}

/** Kebalikan withBase untuk alamat halaman saat ini: "/survey/panduan-penilai" → "/panduan-penilai". */
export function withoutBase(pathname: string): string {
  if (BASE && (pathname === BASE || pathname.startsWith(`${BASE}/`))) {
    return pathname.slice(BASE.length) || '/';
  }
  return pathname;
}
