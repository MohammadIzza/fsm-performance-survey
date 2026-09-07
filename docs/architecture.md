# Arsitektur dan catatan migrasi

## Pilihan teknologi

Astro cocok untuk tujuh halaman konten yang sebagian besar statis. Komponen dirender sebagai HTML pada saat build. Tidak ada dependensi runtime WordPress, jQuery, atau Contact Form 7.

Animasi memakai **runtime tema asli**: GSAP, Luge, lottie-web, dan `main.js` milik tema Nod. Migrasi awal melepas runtime ini dan menggantinya dengan modul TypeScript sederhana, sehingga seluruh gerakan situs hilang. Runtime dikembalikan agar perilakunya sama dengan nodcoding.com.

`src/pages` hanya menyusun bagian halaman melalui `SiteLayout`. Layout mengelola metadata, font, stylesheet, header, dan footer. Bagian halaman yang dipakai ulang berada dalam `components/sections/shared`. `CourseSession` memakai jadwal dari `data/courses.ts`; setiap kartu kategori menautkan langsung ke `/login`, bukan ke formulir pendaftaran (ID penilai/pimpinan disiapkan oleh admin, bukan pendaftaran mandiri — lihat "Batas integrasi").

HTML pada bagian konten mempertahankan nama kelas tema asli agar tampilannya tetap konsisten. CSS tema diformat dan dipisah menjadi `base`, `elements`, `blocks`, `sections`, `shell`, dan `layouts`, lalu diimpor dalam urutan cascade aslinya. Untuk perubahan visual, edit kelompok yang sesuai. `global.css` menampung penyesuaian perilaku yang diperlukan setelah runtime tema lama dilepas.

## Runtime tema

`SiteLayout` memuat empat berkas dari `public/assets/js` dalam urutan tetap: `npm-gsap.js`, `npm-luge.js`, `npm-lottie-web.js`, lalu `main.js`. Ketiganya adalah split chunk webpack yang mendaftarkan diri pada `webpackChunknod`; `main.js` berisi runtime webpack sekaligus entry point.

`main.js` memuat controller tiap komponen sebagai **lazy chunk** terpisah, dan chunk itu tidak ikut dalam `archive/webcopy` saat penyalinan awal. Ke-33 chunk diunduh ulang dari origin memakai peta hash di dalam `main.js`, dan disimpan di `public/assets/js/`. Webpack menghitung `publicPath` dari lokasi `main.js` (`/assets/js/` + `../`), sehingga tata letak direktori itu wajib dipertahankan.

Bootstrap `window.plr` ditulis inline oleh `SiteLayout` dari `src/data/theme-runtime.ts`:

- `bundles` mendaftarkan komponen dan layout beserta strategi pemuatan JS-nya. Flag `css` sengaja dihilangkan: seluruh CSS komponen sudah tergabung dalam `src/styles/theme/`, dan permintaan `<tpl_dir>/build/css/components/*.css` hanya akan menghasilkan 404. Promise stylesheet yang ditolak akan menggagalkan `loadControllers()` dan menghentikan inisialisasi situs.
- `transitions` dibangun ulang terhadap `location.origin` di browser, karena controller `SiteLoader` mencarinya berdasarkan URL absolut.

Plugin Luge yang aktif: reveal, transition, scroll, smooth (Lenis), lottie, mouse, parallax, browser. `main.js` juga mendaftarkan tiga tipe reveal khusus melalui GSAP SplitText — `heading` (per kata), `letters` (per karakter), dan `text` (fade naik).

Karena runtime asli kembali, modul `navigation.ts`, `dialogs.ts`, `sliders.ts`, dan `media.ts` dihapus; keduanya akan berebut elemen yang sama. Tidak ada modul aplikasi tersisa di `<body>` — seluruh interaksi (menu, reveal, slider, lottie) ditangani `main.js` milik tema.

Situs asli tidak menghormati `prefers-reduced-motion`, dan perilaku itu dipertahankan.

## Atribut animasi

Gerakan dikendalikan oleh atribut `data-lg-*` dan `data-plr-component` pada markup. Migrasi awal melepas seluruhnya lalu menyematkan `is-in` agar konten yang seharusnya `opacity: 0` tetap terlihat.

`scripts/restore-theme-attributes.py` mengembalikannya dengan mencocokkan tiap elemen ke arsip berdasarkan `(kelas komponen induk terdekat, tanda tangan kelas)`. Konteks diperlukan karena kelas yang sama berbeda perlakuan menurut tempatnya — `.sb__title` melakukan reveal di dalam `s-usps` tetapi tidak di dalam `sb-slide`. Nilai `data-lg-lottie` tidak pernah diambil dari tabel karena unik per elemen; jalurnya sudah benar di komponen, jadi atributnya diganti nama di tempat dan flag pendampingnya dicari berdasarkan nama berkas animasi. Script menghapus semua atribut animasi sebelum menerapkan ulang, sehingga aman dijalankan berkali-kali.

`scripts/verify-theme-attributes.py` membandingkan `dist/` dengan arsip elemen demi elemen dan gagal bila ada selisih. Saat ini ketujuh halaman cocok persis: 0 kurang, 0 lebih.

## Aset dan salinan asli

Semua gambar, font, ilustrasi, dan video yang digunakan halaman berada dalam `public/assets`. Jalur URL menggunakan root `/assets/`, sehingga tidak bergantung pada kedalaman route. Tautan email Cloudflare sudah dipulihkan menjadi `mailto:`, dan tautan lama `/b2b-course/` diarahkan ke `/professional-training/`.

`archive/webcopy` menyimpan berkas asli sebelum perubahan. Folder ini tidak diimpor oleh aplikasi dan tidak dipublikasikan ke `dist`. `scripts/migrate-webcopy.py` adalah alat ekstraksi awal, bukan bagian dari workflow development atau build; komponen hasil ekstraksi kemudian direfaktor. Jangan menjalankannya untuk memperbarui konten. `scripts/download-assets.ps1` dan manifest-nya mencatat 28 aset yang perlu dilengkapi saat migrasi; aset tersebut sudah tersedia lokal.

`public/assets/js` berisi runtime tema: empat bundel dari arsip ditambah 33 lazy chunk yang diunduh dari origin. Berkas-berkas ini adalah build tema pihak ketiga, bukan kode aplikasi; jangan diedit.

## Batas integrasi

Formulir WordPress asli (Contact Form 7: "Ajukan Akses", "Minta Dokumen Instrumen", "Minta Ringkasan Kategori dan Instrumen", "Ada Kendala Konfigurasi") **dihapus**, bukan diadaptasi — tidak ada backend untuk menerimanya, dan ID penilai/pimpinan memang disiapkan oleh admin, bukan lewat pendaftaran mandiri (Bab 5–6 requirements). Membiarkan formulir itu tampil aktif namun diam-diam tidak mengirim apa pun ("Pratinjau lokal: formulir ini belum terhubung ke server") menyesatkan pengguna. Setiap CTA yang dulu membuka formulir tersebut sekarang menuju salah satu dari dua tujuan nyata: `/login` (sudah punya ID) atau `mailto:survei.fsm@undip.ac.id` (belum punya akses/pertanyaan konfigurasi) — kontak yang sama yang sudah dipakai di header dan footer, bukan layanan baru yang dikarang. `ApplicationModal`, `FormModal`, `ContactForm`, `CatalogueModal`, keempat varian `Curriculum`, `src/data/forms.json`, dan `src/scripts/forms.ts` sudah dihapus seluruhnya karena tidak lagi punya pemanggil.

Script tracking dan banner persetujuan dari salinan WordPress tidak digunakan karena aplikasi ini tidak memasang tracker. Tautan sosial media (`nod-coding` LinkedIn/YouTube) dan tanda tangan pengembang (`waaark.com`) di header/footer juga dihapus — keduanya akun/situs pihak ketiga asli milik pembuat tema asal, bukan kanal resmi FSM UNDIP, dan menampilkannya seolah kanal resmi FSM UNDIP menyesatkan. Halaman kebijakan tetap mempertahankan teks sumber; konten kebijakan perlu diselaraskan dengan integrasi yang benar-benar dipilih sebelum publikasi. Tanggal dan harga mengikuti salinan sumber, bukan sinkronisasi CMS langsung.

Efek scroll, smooth scrolling, transisi halaman, loader, dan custom scrollbar milik tema kembali aktif melalui runtime asli. Server hanya bind ke `127.0.0.1` untuk development; hasil `dist/` bisa dipasang di static hosting.

## Dependensi dan verifikasi

`package-lock.json` dikomit bersama source; gunakan `npm ci` untuk instalasi yang konsisten. Override `unifont` ke `0.7.4` mempertahankan kompatibilitas dengan Node 22.13 yang terpasang saat migrasi: `unifont 0.7.5` menarik `undici 8` yang mensyaratkan Node 22.19. Font aplikasi dilayani dari file lokal.

`lottie-web` tidak lagi menjadi dependency npm. Pemutarnya ikut dalam bundel tema (`npm-lottie-web.js`) dan dipakai oleh plugin lottie milik Luge, sehingga Astro tidak perlu mem-bundle salinan kedua. Peringatan `eval` saat build pun hilang bersamanya.

Sebelum menyelesaikan perubahan, jalankan `npm run format:check`, `npm run build`, `python scripts/verify-theme-attributes.py`, kemudian `npm test` dengan server lokal aktif. Tes mencakup semua route dan gambar lokal, tautan internal, boot runtime tema di setiap halaman, reveal yang benar-benar terpicu saat scroll, pemutaran lottie, kartu kategori yang menautkan ke `/login` (bukan formulir), FAQ, slider, dan navigasi mobile. Screenshot pengujian disimpan di `.local-server/`; trace kegagalan ada di `test-results/`.
