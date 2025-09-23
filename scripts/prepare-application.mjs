import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BASE_PATH } from '../base-path.mjs';

// rm dulu sebelum cp: `cp` recursive tidak pernah menghapus berkas tujuan yang sudah tidak ada
// di sumber (dist/) — tanpa ini, foto/aset lama yang sudah dihapus dari repo tetap nyangkut dan
// tetap terlayani di aplikasi (pernah kejadian: foto lama masih bisa diakses meski sudah diganti
// di Astro dan sudah di-build ulang).
await rm('application/public-site', { recursive: true, force: true });
await rm('application/public/assets', { recursive: true, force: true });
await rm('application/public/_astro', { recursive: true, force: true });

await rm('application/src/styles/theme', { recursive: true, force: true });

await mkdir('application/public', { recursive: true });
await cp('dist', 'application/public-site', { recursive: true });
await cp('dist/assets', 'application/public/assets', { recursive: true });
await cp('dist/_astro', 'application/public/_astro', { recursive: true });

// Lembar gaya tema disalin apa adanya, bukan ditulis ulang dengan nilai yang mirip: aplikasi dan
// halaman publik jadi membaca satu sumber yang sama, sehingga ganti warna/ukuran huruf di tema
// otomatis ikut di ruang survei dan tidak bisa lagi menyimpang diam-diam.
await cp('src/styles/theme', 'application/src/styles/theme', { recursive: true });

// Satu-satunya penyesuaian pada salinan itu: awalan situs untuk url(/assets/…). Di situs publik Vite
// memberinya sendiri saat membangun (lewat `base`), tetapi Next membiarkan url() absolut apa adanya
// — tanpa awalan, gambar dan ikon tema di aplikasi menunjuk ke akar domain dan tidak termuat saat
// aplikasi dilayani di bawah /survey.
if (BASE_PATH) {
  for (const nama of await readdir('application/src/styles/theme', { recursive: true })) {
    if (!nama.endsWith('.css')) continue;
    const berkas = path.join('application/src/styles/theme', nama);
    const isi = await readFile(berkas, 'utf8');
    await writeFile(berkas, isi.replace(/url\((['"]?)\/(?!\/)/g, `url($1${BASE_PATH}/`));
  }
}

console.log('Halaman publik, aset, font, animasi, dan gaya tema disiapkan untuk aplikasi.');
