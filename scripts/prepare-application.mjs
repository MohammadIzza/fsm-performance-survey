import { cp, mkdir, rm } from 'node:fs/promises';

// rm dulu sebelum cp: `cp` recursive tidak pernah menghapus berkas tujuan yang sudah tidak ada
// di sumber (dist/) — tanpa ini, foto/aset lama yang sudah dihapus dari repo tetap nyangkut dan
// tetap terlayani di aplikasi (pernah kejadian: foto lama masih bisa diakses meski sudah diganti
// di Astro dan sudah di-build ulang).
await rm('application/public-site', { recursive: true, force: true });
await rm('application/public/assets', { recursive: true, force: true });
await rm('application/public/_astro', { recursive: true, force: true });

await mkdir('application/public', { recursive: true });
await cp('dist', 'application/public-site', { recursive: true });
await cp('dist/assets', 'application/public/assets', { recursive: true });
await cp('dist/_astro', 'application/public/_astro', { recursive: true });
console.log('Halaman publik, aset, font, dan animasi disiapkan untuk aplikasi.');
