# Nod frontend

Frontend statis berbasis Astro + TypeScript. Hasil salinan WordPress sudah dipisahkan menjadi halaman, komponen, data, stylesheet, dan modul interaksi. Tidak membutuhkan PHP, WordPress, atau database untuk berjalan lokal.

## Menjalankan lokal

Gunakan Node.js **22.12 atau lebih baru** dan npm.

```sh
npm ci
npm run dev
```

Buka **http://127.0.0.1:4321/**. Perubahan dalam `src/` otomatis dimuat ulang.

```sh
npm run dev:status
npm run dev:stop
```

Astro dapat menjalankan server sebagai proses background pada terminal noninteraktif. Gunakan perintah stop di atas untuk menghentikannya. Pada terminal interaktif, `Ctrl+C` juga dapat digunakan.

## Perintah proyek

| Perintah               | Kegunaan                                           |
| ---------------------- | -------------------------------------------------- |
| `npm run dev`          | Server pengembangan di port 4321                   |
| `npm run dev:status`   | Status server background                           |
| `npm run dev:stop`     | Menghentikan server background                     |
| `npm run check`        | Pemeriksaan Astro dan TypeScript                   |
| `npm run build`        | Pemeriksaan tipe dan build statis ke `dist/`       |
| `npm run preview`      | Memeriksa hasil build di port 4322                 |
| `npm run format`       | Merapikan format kode                              |
| `npm run format:check` | Memeriksa format tanpa mengubah file               |
| `npm test`             | Tes browser; jalankan server lokal terlebih dahulu |

Verifikasi atribut animasi terhadap salinan asli (jalankan setelah `npm run build`):

```sh
python scripts/verify-theme-attributes.py
```

Tes menggunakan Google Chrome yang terpasang. Jika Chrome belum tersedia, gunakan `npx playwright install chrome`. Untuk mengetes preview produksi, arahkan variabel `TEST_BASE_URL` ke `http://127.0.0.1:4322`.

## Tempat mengubah kode

```text
src/
  pages/                  Route halaman
  layouts/                Kerangka HTML, bootstrap runtime tema
  components/
    layout/               Header, footer, loader, scrollbar
    courses/              Komponen kartu jadwal kursus
    forms/                Formulir dan modal
    ui/                   Elemen tema yang dipakai ulang (btn-plain)
    sections/             Konten per halaman
      shared/             Bagian yang dipakai beberapa halaman
  data/                   Navigasi, metadata, jadwal, formulir, config runtime
  scripts/                Pengiriman formulir (sisanya ditangani runtime tema)
  styles/
    theme/                CSS tema yang sudah dipisahkan dan diformat
    global.css            Penyesuaian untuk markup formulir non-CF7
public/assets/            Gambar, font, video, dan animasi lokal
  js/                     Runtime tema: GSAP, Luge, lottie-web, main.js + chunk
scripts/                  Perkakas migrasi dan verifikasi atribut animasi
tests/                    Pengujian alur pengguna dan runtime tema
docs/                     Dokumentasi arsitektur dan batas integrasi
archive/webcopy/          Salinan asli sebelum migrasi; tidak ikut build
```

Animasi dijalankan oleh runtime tema asli, bukan kode aplikasi. Detailnya ada di [docs/architecture.md](docs/architecture.md). Bila mengubah markup section, jalankan `python scripts/verify-theme-attributes.py` setelah build untuk memastikan atribut animasinya masih sama dengan aslinya.

- Ubah judul/SEO halaman: `src/data/pages.ts`.
- Ubah menu/kontak: `src/data/site.ts` dan `src/components/layout/`.
- Ubah jadwal kursus: `src/data/courses.ts`. Kartu jadwal dan pilihan formulir aplikasi memakai data yang sama.
- Ubah konten halaman: `src/components/sections/<nama-halaman>/`.
- Tambah halaman: buat `src/pages/nama-halaman.astro`, gunakan `SiteLayout`, lalu tambahkan navigasinya bila diperlukan.
- Ubah warna/font/spacing dasar: `src/styles/theme/base.css` dan `src/styles/fonts.css`.

Struktur mengikuti [konvensi proyek Astro](https://docs.astro.build/en/basics/project-structure/).

## Formulir

Secara default, formulir **hanya memvalidasi input secara lokal**. Tidak ada data yang dikirim, disimpan, atau dianggap berhasil terkirim.

Untuk menghubungkan backend milik Anda, salin `.env.example` menjadi `.env`, isi `PUBLIC_FORM_ENDPOINT`, lalu restart server. Endpoint harus menerima POST JSON `{ formId, page, fields }`, memvalidasi input pada server, dan mengembalikan status 2xx hanya setelah permintaan diterima. Endpoint lintas origin memerlukan konfigurasi CORS. Nilai `PUBLIC_` terlihat di browser; jangan masukkan secret.

Detail integrasi dan catatan migrasi tersedia di [docs/architecture.md](docs/architecture.md).
