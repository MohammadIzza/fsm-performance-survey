import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BASE_PATH } from '../base-path.mjs';
import { pangkasCssTema } from './pangkas-css-tema.mjs';

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

// Dua penyesuaian pada salinan itu:
// - awalan situs untuk url(/assets/…). Di situs publik Vite memberinya sendiri saat membangun (lewat
//   `base`), tetapi Next membiarkan url() absolut apa adanya — tanpa awalan, gambar dan ikon tema di
//   aplikasi menunjuk ke akar domain dan tidak termuat saat aplikasi dilayani di bawah /survey.
// - aturan yang tidak dipakai aplikasi dibuang (scripts/pangkas-css-tema.mjs), supaya halaman masuk
//   dan ruang survei tidak mengunduh gaya bagian-bagian halaman publik.
const pangkas = await pangkasCssTema({
  direktoriTema: 'application/src/styles/theme',
  direktoriSumber: 'application/src',
});
let sebelum = 0;
let sesudah = 0;
for (const nama of await readdir('application/src/styles/theme', { recursive: true })) {
  if (!nama.endsWith('.css')) continue;
  const berkas = path.join('application/src/styles/theme', nama);
  let isi = await readFile(berkas, 'utf8');
  sebelum += isi.length;
  if (BASE_PATH) isi = isi.replace(/url\((['"]?)\/(?!\/)/g, `url($1${BASE_PATH}/`);
  isi = await pangkas(isi);
  sesudah += isi.length;
  await writeFile(berkas, isi);
}
console.log(`CSS tema untuk aplikasi: ${Math.round(sebelum / 1024)} KB → ${Math.round(sesudah / 1024)} KB.`);

console.log('Halaman publik, aset, font, animasi, dan gaya tema disiapkan untuk aplikasi.');
