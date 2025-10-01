# Arsitektur situs publik

Dokumen ini membahas bagian Astro (akar repositori) dan cara ia diterbitkan bersama ruang survei
Next di `application/`. Aturan bisnis aplikasi dijelaskan di requirement dan di komentar
`application/src/lib/services/`.

## Pilihan teknologi

Tujuh halaman publik (beranda, alur penilaian, tiga panduan peran, dua kebijakan) sebagian besar
statis, jadi Astro merendernya menjadi HTML saat build. Tidak ada WordPress, jQuery, atau PHP.

`src/pages` hanya menyusun bagian halaman lewat `SiteLayout`, yang mengelola metadata, font,
stylesheet, header, footer, dan bootstrap runtime tema. Bagian yang dipakai ulang ada di
`components/sections/shared`. Nama folder bagian (`data-bootcamp`, `professional-training`, …) dan
nama kelas CSS mengikuti kerangka tema yang dipakai; isinya konten FSM UNDIP.

HTML bagian konten memakai nama kelas tema agar dikenali runtime dan CSS-nya. CSS tema dipisah
menjadi `base`, `elements`, `blocks`, `sections`, `shell`, dan `layouts` di `src/styles/theme/`,
diimpor dalam urutan cascade tetap. `global.css` menampung penyesuaian situs ini.

Hasil `dist/` tidak dipasang di hosting statis: `scripts/prepare-application.mjs` menyalinnya ke
`application/public-site` (HTML) dan `application/public` (aset), dan Next yang menyajikannya.

## Runtime tema

Animasi dijalankan runtime tema: GSAP, Luge, lottie-web, dan `main.js` beserta potongan (chunk)
komponennya di `public/assets/js/`. Berkas-berkas itu build pihak ketiga — jangan diedit.

- **Server dev** memuat empat berkas berurutan dari `SiteLayout`: `npm-gsap.js`, `npm-luge.js`,
  `npm-lottie-web.js`, lalu `main.js` (dengan `?v=<versi tema>`). Tiga yang pertama mendaftarkan
  diri pada `webpackChunknod`; `main.js` berisi runtime webpack dan entry point, lalu memuat
  controller komponen sebagai potongan terpisah.
- **Build** menjalankan `integrations/preload-tema.mjs`: keempat skrip dan semua potongan komponen
  yang dipakai halaman mana pun digabung menjadi satu `assets/js/tema-<hash>.js`. Potongan yang
  sudah terdaftar sebelum `main.js` berjalan dipakai tanpa diunduh. Peta potongan dibaca dari
  `main.js` sendiri; potongan besar yang jarang (`npm-matter-js`) tetap dimuat terpisah. Berkas
  gabungan harus satu folder dengan `main.js`: webpack menghitung `publicPath` dari alamat skrip
  yang berjalan.

Bootstrap `window.plr` ditulis inline oleh `SiteLayout` dari `src/data/theme-runtime.ts`:

- `bundles` mendaftarkan komponen dan layout beserta strategi pemuatan JS-nya. Flag `css` sengaja
  tidak dipakai: seluruh CSS komponen sudah ada di `src/styles/theme/`, dan permintaan
  `<tpl_dir>/build/css/…` hanya menghasilkan 404 yang menggagalkan `loadControllers()`.
- `transitions` diberi awalan situs lalu dibangun ulang terhadap `location.origin`, karena
  controller `SiteLoader` mencarinya berdasarkan URL absolut.
- `tpl_dir` adalah `/survey/assets`.

Plugin Luge yang aktif: reveal, transition, scroll, smooth (Lenis), lottie, mouse, parallax,
browser. `main.js` juga mendaftarkan tipe reveal `heading`, `letters`, dan `text`.

Skrip milik situs ini (`src/scripts/`, dimuat sebagai modul dari `SiteLayout`):

- `hero-fsm.ts` — adapter hero F/S/M (lihat bagian Hero FSM).
- `luge-navigation-guard.ts` — mencegah transisi halaman kedua dimulai di atas yang pertama, yang
  membuat pemuat krem tidak pernah disembunyikan.
- `reveal-fallback.ts` — memasang `is-in` pada elemen reveal yang sudah terlihat tetapi tidak
  terpicu.
- `pulih-dari-bfcache.ts` — lihat "Kembali ke halaman".

Runtime tema tidak menghormati `prefers-reduced-motion`; perilaku itu dipertahankan.

## Atribut animasi

Gerakan dikendalikan atribut `data-lg-*` dan `data-plr-component` pada markup. Bila mengubah markup
bagian, pertahankan atribut itu pada elemen yang sama — tanpa `data-lg-reveal` elemen yang semula
`opacity: 0` tetap tak terlihat, dan tanpa `data-plr-component` controller-nya tidak dimuat.
Nilai `data-lg-lottie` ditulis lewat `withBase()`.

## Aset

Gambar, font, ilustrasi, Lottie, dan video ada di `public/assets/`. Semua alamat memakai awalan
situs:

- Alamat di templat Astro memakai `withBase()` dari `src/utils/url.ts`.
- `url(/assets/…)` di CSS diberi awalan oleh Vite saat build. Server dev tidak melakukannya, jadi
  plugin dev di `astro.config.mjs` menambahkan awalan pada CSS yang disisipkan ke halaman.
- Salinan CSS tema di aplikasi diberi awalan oleh `scripts/prepare-application.mjs`.

Berkas statis disimpan peramban dan CDN (lihat bawah), jadi berkas yang isinya diganti diberi nama
baru — mis. `tutorial-survei-fsm-v2.mp4` — bukan ditimpa.

## Batas integrasi

Tidak ada formulir di halaman publik: ID penilai dan pimpinan disiapkan admin (Bab 5–6
requirement), bukan lewat pendaftaran mandiri. Setiap ajakan bertindak menuju `/survey/login` atau
`mailto:up2ti@live.undip.ac.id`, kontak yang sama di header dan footer.

Tidak ada tracker, banner persetujuan cookie, atau tautan media sosial. Halaman kebijakan perlu
diselaraskan dengan kebijakan resmi sebelum dipakai untuk data asli.

## Kunjungan pertama dan cache

Gateway UNDIP melayani HTTP/1.1, jadi setiap permintaan tambahan terasa. Yang dilakukan:

- **Satu langkah tampil.** `html:not(.is-loaded) .site-container` tak terlihat sampai tema
  memasang `is-loaded` (sesaat sebelum animasi masuk), sehingga halaman setengah jadi tidak pernah
  terlihat. Jaring pengaman: animasi CSS menampilkannya setelah 4 detik, dan `<noscript>`
  menampilkannya langsung.
- **Preload.** Integrasi build menulis preload untuk skrip gabungan, font SemiBold/Bold, dan JSON
  Lottie bertanda `data-lg-lottie-required`. Beranda turun dari 48 menjadi ±25 permintaan.
- **Cache** (`application/next.config.ts`): nama ber-hash (`_astro/`, potongan tema,
  `tema-<hash>.js`) disimpan setahun dan `immutable`; sisa `assets/` seminggu dengan
  `stale-while-revalidate`. HTML tetap `max-age=0`.
- **Font** HeyWow dipangkas ke karakter yang dipakai (Latin dasar, Latin-1, Latin Extended-A,
  tanda baca, panah, dan simbol matematika umum): 94 KB → 65 KB untuk ketiga ketebalan. Bila teks
  baru memakai karakter di luar rentang itu, karakter tersebut tampil dengan font cadangan.
- **Sampul video beranda** dimuat pemuat malas tema (`data-plr-loading="lazy"`) saat seksinya
  terlihat; `loading="lazy"` peramban tetap mengunduhnya sejak awal pada koneksi lambat.
- **Halaman masuk aplikasi** memuat ketiga font sejak HTML diterima. Huruf F/S/M di ponsel memakai
  SVG bingkai terakhir (`public/assets/images/login-fsm-*.svg`) tanpa pemutar Lottie; di layar lebar
  JSON animasinya dipreload dengan `media` dan pemutar Lottie diunduh saat modul dievaluasi.
- **Aplikasi tanpa GSAP.** Gerak masuk halaman memakai Web Animations API.
- **CSS tema di aplikasi dipangkas** saat disalin (`scripts/pangkas-css-tema.mjs`): hanya aturan yang
  kelasnya muncul di kode aplikasi yang dipertahankan (249 KB → 68 KB). Menambah kelas tema baru
  di komponen aplikasi otomatis ikut terbawa pada build berikutnya; kelas yang hanya dirakit dari
  string di luar pola awalan (`nama-`, `nama--`, `nama__`) perlu ditulis utuh di kode.

Masih di luar kendali server ini: gateway belum HTTP/2; gateway membongkar lalu mengompres ulang
setiap respons dengan gzip yang lebih lemah dan tanpa brotli (skrip tema: 150 KB dari server ini,
216 KB sampai pengguna); dan gateway menjawab `/survey` (tanpa garis miring) dengan alih ke
`http://…/survey/`. Karena itu tautan beranda di hasil build ditulis
`/survey/` — alih ke `http` diblokir peramban sebagai konten campuran saat transisi halaman.

## Kembali ke halaman

Tautan yang meninggalkan situs publik lewat muat ulang penuh (`data-lg-reload`, mis. "Masuk
Survei") menjalankan transisi keluar tema lebih dulu: pemuat krem menutup layar dan Lenis
dihentikan. Back/forward cache peramban membekukan halaman dalam keadaan itu. `pulih-dari-bfcache.ts`
mengembalikan pemuat, kelas penahan, dan Lenis saat `pageshow` dengan `persisted`.

## Dependensi dan verifikasi

`package-lock.json` dikomit; gunakan `npm ci`. Override `unifont` ke `0.7.4` menjaga kompatibilitas
dengan Node 22.13 (`unifont 0.7.5` menarik `undici 8` yang mensyaratkan Node 22.19). Font dilayani
dari berkas lokal. `lottie-web` bukan dependency npm situs publik: pemutarnya ikut bundel tema.

Sebelum menyelesaikan perubahan: `npm run check`, `npm run build`, lalu `npm test` dengan server dev
berjalan (`npm run dev`). Tes mencakup semua halaman dan gambar lokal, tautan internal, boot runtime
tema, reveal saat gulir, Lottie, FAQ, slider, navigasi ponsel, dan hero FSM; semuanya berjalan di
bawah awalan `/survey` lewat `tests/base.ts`. Konfigurasi memakai Chrome terpasang
(`channel: 'chrome'`); di LXC server demo Chrome sistem tidak bisa membuka alamat lokal, jadi pakai
Chromium bawaan Playwright (`channel` dikosongkan).

## Hero FSM

Beranda memakai tiga Lottie vektor F/S/M. Sumber bentuk dan keyframe yang bisa
diedit ada di `scripts/generate-fsm-hero.mjs`; jalankan
`node scripts/generate-fsm-hero.mjs` untuk meregenerasi ketiga JSON. Setiap kanvas
memiliki padding 90 unit. Warna dan geometri disimpan sebagai data vektor,
sehingga tidak membutuhkan font atau gambar raster.

`src/scripts/hero-fsm.ts`, dimuat dari `SiteLayout`, memasang adapter pada
`beforePageInit`. Saat itu controller tema sudah dibuat, tetapi intro belum
berjalan. Adapter mengganti pembuka enam huruf menjadi tiga dan membersihkan
timeline pada `kill()`. Simulasi tangkai, ticker, mouse, viewport observer,
gelombang dan logo tetap menggunakan runtime tema. Adapter mengakses GSAP
(module 8520) dan CustomEase (124) melalui registry webpack tema yang dipatok;
jika bundle vendor diperbarui, verifikasi kedua ID ini dan tes hero. Tidak ada
bundle vendor yang diedit, pemutar Lottie kedua, atau loop RAF tambahan.

CSS khusus `[data-fsm-hero]` menyamakan pivot dengan pusat tangkai dan menghitung
panjangnya dari `--flower-height`. Jangan mengganti tinggi tangkai dengan
persentase tetap. Pembuka Lottie diputar sekali; goyangan berulang berasal dari
controller tangkai.

Tes terfokus: `npx playwright test tests/fsm-hero.spec.ts`. Browser tanpa jaringan
bisa memakai `TEST_STATIC_DIR=/path/to/isolated-build` dan
`TEST_BASE_URL=https://hero-test.local`; fixture memuat hasil build lengkap dari
disk (awalan `/survey` dilepas sebelum mencari berkas). Tes mencakup ukuran
desktop/mobile/landscape, geometri sambungan, respons mouse, pause/resume dan
navigasi pulang ke beranda. Satu kasus — sambungan tangkai pada 1920×900 — sudah
gagal sebelum perubahan awalan `/survey` dan belum diperbaiki.

Batas tes navigasi: intro hero panduan admin dibiarkan selesai sebelum kembali
ke beranda. Berpindah sebelum intro tersebut selesai dapat memicu error lama
`BHeroB2b.setPathD` setelah controller dilepas; bundle panduan itu tidak diubah
oleh pekerjaan FSM ini.

## Penerbitan di bawah /survey

Alamat publik: https://apps-fsm.undip.ac.id/survey/. Gateway UNDIP mengakhiri TLS dan meneruskan
permintaan **dengan awalan utuh** ke `http://10.137.58.132:8094/survey/`, beserta `Host`,
`X-Forwarded-For`, dan `X-Forwarded-Proto: https`. Konfigurasi gateway dikelola di luar server ini.
Alamat cadangan https://fsm.heyizza.my.id/survey/ lewat tunnel Cloudflare memakai vhost yang sama.

Rantai di server: nginx `:8094` → `next start` di `127.0.0.1:3930` (`fsm-survei.service`). Vhost
nginx ada di [`application/deploy/nginx-fsm.heyizza.my.id.conf`](../application/deploy/nginx-fsm.heyizza.my.id.conf)
dan dipasang `application/deploy/deploy.sh`. Hal yang bergantung padanya:

- `/survey/` diteruskan ke Next sebagai `/survey`. Next dengan basePath membalas `/survey/` dengan
  alih 308 ke `/survey`; bila gateway mengalihkan balik ke `/survey/`, keduanya berputar tanpa akhir.
- Alamat di luar `/survey` dialihkan (302, relatif) ke padanannya di bawah `/survey`, jadi tautan lama
  seperti `fsm.heyizza.my.id/login` tetap sampai.
- `X-Forwarded-Proto` dari depan diteruskan apa adanya, bukan ditimpa skema koneksi lokal (`http`).
- `client_max_body_size 10M` untuk impor Excel; header `Range` diteruskan (video beranda butuh 206).

Cookie sesi `survey_fsm_session` ber-path `/survey` dan selalu `Secure` di produksi, jadi login hanya
berhasil lewat HTTPS. Cookie `cookiesession1` berasal dari gateway, bukan dari aplikasi.

Langkah membangun ulang dan menerbitkan ada di [application/docs/deployment.md](../application/docs/deployment.md).
