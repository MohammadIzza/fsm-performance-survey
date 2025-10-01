# Handoff — Survei Penilaian FSM UNDIP

Kondisi per **13 September 2026**. Dokumen ini menggantikan handoff awal 9 September (tersimpan di
riwayat git) yang ditulis sebelum aplikasi dideploy.

## Ringkasan

- **Sudah berjalan** di https://apps-fsm.undip.ac.id/survey/ (gateway UNDIP) dan
  https://fsm.heyizza.my.id/survey/ (tunnel Cloudflare), sebagai **demo**.
- Situs publik Astro (akar repo) + ruang survei Next 16 (`application/`) diterbitkan bersama oleh
  satu proses `next start`. Awalan `/survey` diatur di `base-path.mjs`.
- Database demo `survey_fsm_demo` (PostgreSQL 16, 127.0.0.1:55432): periode **Dies Natalis FSM
  UNDIP 2026** (Aktif, 9 kategori, ±660 penugasan), 313 pengguna, 23 unit.
- Pimpinan fakultas/departemen/prodi memakai **nama asli** sesuai fsm.undip.ac.id
  (`application/src/lib/data/fsm-pimpinan.ts`, dengan sumber); orang lain adalah data demo.
- 254 assertion uji layanan lulus; tes Playwright situs publik 23/24 (lihat "Masalah terbuka").

Dokumen lanjutan: [README.md](README.md), [docs/architecture.md](docs/architecture.md),
[application/docs/deployment.md](application/docs/deployment.md),
[application/docs/acceptance-checklist.md](application/docs/acceptance-checklist.md).

## Server

| Hal | Nilai |
| --- | --- |
| Host | `mbkm` (LXC Proxmox), repo di `/home/restart/survey-fsm`, pemilik `restart` |
| Node untuk build | `/opt/node22/bin` (Node sistem 20.x dipakai layanan lain) |
| Aplikasi | `fsm-survei.service` → `next start 127.0.0.1:3930` |
| Proxy | nginx `:8094`, vhost `/etc/nginx/sites-available/fsm.heyizza.my.id` (salinan: `application/deploy/`) |
| Database | `survey-fsm-postgres.service`, kredensial di `application/.env` (jangan dicetak/dikomit) |
| Scheduler | `fsm-survei-scheduler.timer` tiap 5 menit |
| Aplikasi lain | `survei-fsm` lama (3910/8093) dan situs tetangga — jangan disentuh |

## Akun demo

`admin01` (admin), `dekan01` (Prof. Dr. Kusworo Adi), `dosen1001` (Dr. Sutrisno, Ketua Departemen
Matematika), `dosen1004` (penilai, 7 tugas belum diisi). Login hanya dengan ID.

## Menerbitkan perubahan

```bash
cd /home/restart/survey-fsm && export PATH=/opt/node22/bin:$PATH
(cd application && npx tsc --noEmit && npm run test:all)
npm run build:all
chown -R restart:restart dist application/public application/public-site application/src/styles/theme application/.next
systemctl restart fsm-survei.service
# tunggu http://127.0.0.1:8094/survey/ membalas 200 sebelum membuka alamat publik
```

Memeriksa tampilan: Playwright dengan Chromium bawaan (`application/node_modules/playwright`).
Chrome sistem di LXC ini tidak bisa membuka alamat lokal (`ERR_ACCESS_DENIED`); alamat publik bisa.

## Konvensi kerja dengan pemilik

- Komunikasi dalam bahasa Indonesia, ringkas.
- Commit atas nama `MOHAMMAD IZZA HAKIKI <m.izza.hakiki@gmail.com>`, **tanpa** trailer
  `Co-Authored-By`. Tanggal commit mengikuti permintaan pemilik; bila tidak disebut, tanyakan.
- Jangan mengarang data institusi (nama pejabat, NIP): riset sumber resmi dulu.
- Standar tampilan adalah beranda publik; komponen aplikasi mengikuti gaya itu (kartu putih,
  label kapital, tombol pil, huruf HeyWow), bukan kotak sistem peramban.
- Saat situs sedang dipakai demo, jangan deploy atau mengubah kode tanpa izin.

## Masalah terbuka

**Syarat sebelum dipakai sungguhan**
1. Login tanpa kata sandi dan daftar akun demo tampil di halaman login — perlu SSO UNDIP atau
   autentikasi lain (Bab 6.3).
2. Belum ada backup database terjadwal.
3. Banner dan footer "Demonstrasi", data selain pimpinan adalah data demo.
4. Belum ada pembatasan percobaan login; header keamanan (CSP, X-Frame-Options, Referrer-Policy)
   belum dipasang (`X-Powered-By` sudah dilepas).

**Gateway (perlu admin UNDIP)**
5. Gateway masih HTTP/1.1 dan mengompres ulang respons dengan gzip lemah (±40% lebih besar dari yang
   dikirim server ini) — sisa hambatan terbesar kunjungan pertama.
6. Gateway mengalihkan `/survey` ke `http://…/survey/`, bukan `https://`.

**Aplikasi**
7. Kolom skor: tanda minus dari papan ketik Android yang tidak melaporkan tombolnya, nilai `-0`, dan
   mengetik `-` saja yang mengosongkan skor belum ditangani (server tetap menolak skor negatif).
8. Halaman 404 masih bawaan Next berbahasa Inggris; 404 halaman publik berupa teks polos.
9. Halaman "Tidak berwenang" membalas HTTP 200, bukan 403.
10. Uji E2E `application/tests/e2e` belum disesuaikan dengan awalan `/survey`.
11. Tes Playwright hero FSM pada 1920×900 gagal (sambungan tangkai), sudah sejak sebelum awalan.
12. Satu error lint lama di `assignment-form.tsx` ("Cannot access refs during render").
13. Bagian daftar materi di beranda masih memakai gambar pengganti yang sama untuk 10 kartu.
14. Sumber resmi berbeda untuk Ketua Departemen Biologi dan pimpinan Statistika; data memakai halaman
    fakultas (catatan lengkap di `fsm-pimpinan.ts`).
