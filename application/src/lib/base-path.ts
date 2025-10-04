/**
 * Awalan alamat aplikasi, mis. "/survey" — diisi next.config.ts dari base-path.mjs di akar repo,
 * nilai yang sama dengan `basePath` Next dan `base` Astro.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Memberi awalan aplikasi pada alamat yang TIDAK diprefix Next sendiri. <Link>, router, dan
 * redirect() sudah otomatis; yang lain tidak: <a href> biasa (unduhan Excel, halaman panduan
 * Astro), <img>/<Image src> ke berkas public/, action formulir biasa, dan path berkas Lottie.
 * Tanpa awalan, alamat itu menunjuk ke akar domain gateway — milik aplikasi lain.
 */
export function withBase(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  // Beranda "/survey/": gateway menjawab "/survey" dengan alih ke http://…/survey/ (skema http),
  // jadi tautan langsung ke bentuk bergaris miring menghindari satu alih yang tidak aman itu.
  return path === "/" ? `${BASE_PATH}/` : `${BASE_PATH}${path}`;
}
