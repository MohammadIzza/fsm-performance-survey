# Survei Penilaian FSM UNDIP

Sistem penilaian daring Fakultas Sains dan Matematika Universitas Diponegoro: halaman informasi dan
panduan publik, ditambah ruang survei untuk admin, dekan, pimpinan unit, dan penilai — kategori
penilaian dinamis, pembagian penilai acak dan merata, pengisian skor, perhitungan otomatis, dua
leaderboard (Pimpinan dan Selain Pimpinan), ekspor Excel, finalisasi, dan arsip.

| | |
| --- | --- |
| Alamat publik | https://apps-fsm.undip.ac.id/survey/ (gateway UNDIP) |
| Alamat cadangan | https://fsm.heyizza.my.id/survey/ (tunnel Cloudflare) |
| Status | **Demo** — data demonstrasi dan login tanpa kata sandi, bukan sistem produksi |
| Kontak | up2ti@live.undip.ac.id |

## Isi repositori

```text
.                       Situs publik: Astro 7 + TypeScript (beranda, panduan, kebijakan)
application/            Ruang survei: Next.js 16 (App Router) + React 19 + Prisma 6 + PostgreSQL
base-path.mjs           Satu sumber awalan alamat /survey (Astro, Next, dan skrip salin tema)
integrations/           Integrasi build Astro: penggabungan skrip tema dan preload
docs/architecture.md    Arsitektur situs publik, runtime tema, pemuatan, dan penerbitan
application/docs/       Deployment dan checklist kriteria penerimaan
HANDOFF_CLAUDE_CODE.md  Kondisi terkini, pekerjaan terbuka, dan cara melanjutkan
Requirements_Web_Survei_FSM_UNDIP_End_to_End.md   Spesifikasi lengkap
```

Kedua bagian dilayani oleh **satu** proses Next: `npm run build:all` membangun Astro, menyalin
hasilnya ke `application/public-site` dan `application/public`, lalu membangun Next. Halaman Astro
disajikan rute tangkap-semua `application/src/app/[[...publicPath]]/route.ts`.

## Akun demo

Login cukup dengan ID (tanpa kata sandi) — daftar yang sama tampil di halaman `/survey/login`.

| Peran | ID | Nama |
| --- | --- | --- |
| Admin | `admin01` | Rangga Prakoso, S.Kom. (fiktif) |
| Dekan | `dekan01` | Prof. Dr. Kusworo Adi, S.Si., M.T. |
| Pimpinan | `dosen1001` | Dr. Sutrisno, S.Si., M.Sc. — Ketua Departemen Matematika |
| Penilai | `dosen1004` | Dr. Sulistyo Raharjo, S.Si., M.Si. (fiktif) — 7 tugas belum diisi |

## Data demo

- **Organisasi:** fakultas, 6 departemen, 13 program studi, Tata Usaha, dan Panitia Dies
  (`application/src/lib/data/fsm-org.ts`).
- **Pimpinan:** 27 jabatan memakai nama asli sesuai fsm.undip.ac.id, beserta sumbernya
  (`application/src/lib/data/fsm-pimpinan.ts`). Jabatan yang tidak diumumkan fakultas tidak diisi.
- **Orang lain:** dosen, tendik, dan mahasiswa demo dengan nama dan nomor induk bangkitan
  (`application/src/lib/data/fsm-people.ts`) — bukan data sivitas sebenarnya.
- **Periode:** Dies Natalis FSM UNDIP 2026, status Aktif, 9 kategori dari dokumen instrumen panitia
  (`application/src/lib/data/dies-2026.ts`), ±660 penugasan dengan sebagian jawaban terisi.

## Menjalankan lokal

Butuh Node.js **22.12+** dan PostgreSQL. Di server demo, Node 22 ada di `/opt/node22/bin` (Node
sistem 20.x dipakai layanan lain dan sengaja tidak diganti).

```sh
npm ci && npm --prefix application ci

# Situs publik saja
npm run dev                          # http://127.0.0.1:4321/survey

# Ruang survei (butuh application/.env: DATABASE_URL, SESSION_SECRET)
cd application
npx prisma generate
npm run db:seed && npm run seed:dies # organisasi, akun contoh, periode Dies
npm run dev                          # http://localhost:3000/survey/login
```

`npm run dev` Next hanya menyajikan halaman publik yang sudah disalin; untuk situs publik lengkap
jalankan `npm run build && node scripts/prepare-application.mjs` lebih dulu.

## Perintah

| Tempat | Perintah | Kegunaan |
| --- | --- | --- |
| akar | `npm run dev` / `dev:status` / `dev:stop` | Server dev Astro (port 4321, bisa berjalan di latar) |
| akar | `npm run check` | Pemeriksaan Astro dan TypeScript |
| akar | `npm run build` | Build situs publik ke `dist/` |
| akar | `npm run build:all` | Build Astro + salin ke aplikasi + build Next |
| akar | `npm test` | Tes Playwright situs publik (server dev harus berjalan) |
| application | `npm run test:all` | 7 skrip uji layanan, 254 assertion |
| application | `npm run db:seed` | Akun contoh dan struktur organisasi |
| application | `npm run seed:units` | Menyelaraskan unit dengan `fsm-org.ts` |
| application | `npm run seed:dies` | Membangun ulang periode Dies 2026 (menghapus seluruh rancangan lama) |
| application | `npm run lint` | ESLint |

Menerbitkan ke server: lihat [application/docs/deployment.md](application/docs/deployment.md).

## Aturan penting saat mengubah kode

- **Awalan `/survey`.** Next memprefix `<Link>`, router, dan `redirect()` sendiri; Astro memprefix
  berkas yang ia bangun. Alamat yang ditulis tangan — `src="/assets/…"`, `<a href>` biasa, `<img>`,
  `<Image>`, ikon metadata, path Lottie, `action` formulir — wajib lewat `withBase()`
  (`src/utils/url.ts` di Astro, `application/src/lib/base-path.ts` di aplikasi). `url()` di
  `application/src/app/globals.css` ditulis langsung dengan `/survey`.
- **Nama berkas statis diberi versi saat isinya diganti** (mis. `tutorial-survei-fsm-v2.mp4`):
  gambar, font, Lottie, dan video disimpan peramban dan CDN selama seminggu.
- **CSS tema** berada di `src/styles/theme/` dan disalin ke aplikasi saat build — ubah di sumbernya.
  Runtime tema di `public/assets/js/` adalah build pihak ketiga; jangan diedit.
- **Pimpinan** hanya diubah lewat `fsm-pimpinan.ts` dengan sumber resmi, lalu `npm run db:seed` dan
  `npm run seed:dies`.

## Tempat mengubah kode

| Yang diubah | Tempat |
| --- | --- |
| Judul/SEO halaman publik | `src/data/pages.ts` |
| Menu dan email kontak | `src/data/site.ts`, `src/components/layout/` |
| Konten halaman publik | `src/components/sections/<halaman>/` |
| Warna, huruf, jarak dasar | `src/styles/theme/base.css`, `src/styles/fonts.css` |
| Penyesuaian perilaku tema | `src/styles/global.css`, `src/scripts/` |
| Halaman ruang survei | `application/src/app/` |
| Komponen tampilan aplikasi | `application/src/components/theme/` |
| Aturan bisnis (penugasan, perhitungan, akses) | `application/src/lib/services/` |
| Data organisasi, pimpinan, instrumen Dies | `application/src/lib/data/` |
