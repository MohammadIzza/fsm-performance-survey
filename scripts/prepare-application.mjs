import { cp, mkdir } from 'node:fs/promises';
await mkdir('application/public', { recursive: true });
await cp('dist', 'application/public-site', { recursive: true });
await cp('dist/assets', 'application/public/assets', { recursive: true });
await cp('dist/_astro', 'application/public/_astro', { recursive: true });
console.log('Halaman publik, aset, font, dan animasi disiapkan untuk aplikasi.');
