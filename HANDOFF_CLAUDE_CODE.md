# Handoff untuk Claude Code — Survei FSM UNDIP

Tanggal: 9 September 2026. Pekerjaan dihentikan atas permintaan pengguna untuk pindah ke Claude Code. **Implementasi belum selesai dan belum dideploy.** Jangan menganggap seluruh requirement sudah terpenuhi.

## Permintaan pengguna (prioritas tertinggi)

1. Clone `https://github.com/MohammadIzza/survey-fsm.git`, kembangkan sesuai `Requirements_Web_Survei_FSM_UNDIP_End_to_End.md`, deploy ke **heyizza.my.id**.
2. Pelajari aplikasi lain di LXC server ini.
3. **Seluruh aplikasi survei harus memakai desain repository asli**, termasuk aset, font, ilustrasi, SVG, warna, dan animasinya. Bukan hanya landing page. Jangan mengganti dengan dashboard generik.
4. Pengguna meminta berhenti dan menyediakan handoff ini, bukan melanjutkan pengembangan pada sesi Codex.

## Workspace dan provenance

- Clone kerja: `/home/restart/survey-fsm`.
- HEAD awal: `7a890a61bbbbaa5e490f600627778c1aedd0c5fb`.
- Semua perubahan **belum di-commit / push**. `application/` masih untracked.
- Repo asal adalah Astro 7.3.2 + TypeScript, halaman publik statis, tema Nod dengan GSAP/Luge/Lottie dan font HeyWow.
- Aplikasi terpisah yang sudah ada di server: `/var/www/survei-fsm` (Next.js 16.3.4 / React 19 / Prisma 6 / PostgreSQL / ExcelJS / iron-session).
- Source aplikasi terpisah tersebut **disalin** ke `application/`: src, prisma, scripts, public dan konfigurasi. Bukan dikembangkan seluruhnya dari nol. Aplikasi asli, database asli, service asli dan konfigurasi routing asli **tidak diubah**.
- Baca `application/AGENTS.md` dan dokumentasi Next.js lokal `application/node_modules/next/dist/docs/` sebelum melanjutkan.
- `git diff --stat` tidak menghitung application/ yang untracked. Periksa file baru juga.

## Lingkungan server dan deployment

- Host `mbkm`, Ubuntu, LXC. User `restart`, uid 1000, grup sudo.
- `sudo -n true` gagal: password diperlukan. Sudah meminta pengguna menyediakan akses administrator via mekanisme server, tanpa mengirim password. Belum ada jawaban/akses baru.
- Nginx, cloudflared, PostgreSQL 16, MySQL, PHP 8.3/8.4, beberapa Node services berjalan.
- Aplikasi tetangga: `/var/www/restart`, `kkn-wujil`, `rag-wujil`, `daylight`, `laporanfoto`, `skirpsi22`, `survei-fsm`.
- Existing survei: `survei-fsm.service`, user root, cwd `/var/www/survei-fsm`, Next pada 3910. Nginx `/etc/nginx/sites-enabled/survei-fsm`: listen 8093, `server_name survei.heyizza.my.id`, proxy ke 127.0.0.1:3910.
- `/etc/cloudflared/config.yml` root-only, belum dibaca.
- `curl -I https://heyizza.my.id` menunjukkan 307 ke `https://www.heyizza.my.id/`, header Vercel dan Cloudflare. Domain target **belum mengarah ke aplikasi baru**. Perlu akses routing/DNS/tunnel selain service LXC.
- Jangan menyentuh aplikasi tetangga atau menghentikan proses berdasarkan nama global.

## Database dan runtime TERPISAH untuk development

- PostgreSQL baru milik user restart, tidak memakai database aplikasi asli.
- Data: `/home/restart/.local/share/survey-fsm/postgres`.
- Socket: `/home/restart/.local/run/survey-fsm`.
- Port: **127.0.0.1:55432**; database `survey_fsm_demo`.
- Log: `/home/restart/.local/share/survey-fsm/postgres.log`.
- Password random dan SESSION_SECRET tersimpan di `application/.env` (chmod 600, di-ignore). Jangan mencetak atau commit secret.
- Cluster di-init dengan local trust dan host scram-sha-256. Ini lingkungan demo development, belum setup operasional produksi.
- Dijalankan pg_ctl manual, belum service persisten/backup/restore/boot startup.
- Sistem Node default v20, Astro membutuhkan >=22.12. Node 22 terpasang lokal:
  `/home/restart/.local/lib/survey-runtime/node_modules/.bin/node`.
- Gunakan `export PATH=/home/restart/.local/lib/survey-runtime/node_modules/.bin:$PATH`.
- Dependencies kedua proyek sudah terinstall. application tambah gsap, lottie-web, decimal.js.
- Prisma schema sudah `db push` dan generate, termasuk perubahan `unitTreeSnapshot`. **Belum membuat migration SQL untuk perubahan terbaru**; migration historis salinan belum mewakili schema akhir.
- Seed: `db:seed`, `seed:demo`, `seed:leaderboard` sudah dijalankan. Ada periode Draf/Aktif/Ditutup/Final/revisi final serta showcase dosen/karya.
- Login dummy: admin01, dekan01, dosen1001 (pimpinan), dosen1004 (pengguna).

## Integrasi dan tampilan yang telah dibuat

- `application/` menampung aplikasi fungsional Next.
- Beranda aplikasi dipindah dari `/` ke `/dashboard`; login redirect disesuaikan.
- Landing/panduan Astro tetap di root dan route aslinya.
- `scripts/prepare-application.mjs`: menyalin dist ke application/public-site, assets dan _astro ke application/public.
- `application/src/app/[[...publicPath]]/route.ts`: menyajikan HTML Astro dengan validasi path.
- Root scripts: `build:all` dan `start:app` (port 3920).
- Astro tsconfig mengecualikan application; ignore ditambah untuk generated client, build, aset salinan, env.
- Beberapa CTA Ajukan akses diarahkan `/login`; bahasa HTML menjadi id. Audit CTA/form publik lain masih perlu.
- `application/src/app/globals.css`: font HeyWow asli, palet krem/kuning/biru/pastel repository, tombol membulat, layout login dua kolom, header/footer dan hero aplikasi.
- `application/src/components/theme-motion.tsx`: render JSON Lottie **asli** `/assets/lottie/home-hero-{c,o,d}.json`, GSAP sway/reveal, cleanup effects, reduced motion.
- **Belum sama lengkap dengan seluruh animasi tema asli**. Runtime asli GSAP/Luge/main.js masih pada Astro; aplikasi menggunakan Lottie asli dan GSAP adaptasi. User meminta kesamaan lengkap: perlu review visual/gerak dan penyempurnaan, jangan klaim selesai.
- Logo yang digunakan adalah `logo-nod.svg` dari repository (secara visual masih bertuliskan nod). Jangan mengganti aset asal sembarangan; pertimbangkan konteks identitas FSM saat review.

## Perbaikan domain yang sudah ditulis

Seluruhnya perlu review, terutama perubahan setelah build/uji terakhir:

- `src/lib/prisma.ts`: AsyncLocalStorage + Proxy mengarahkan nested service ke transaksi yang sama. `atomic()` memakai advisory transaction lock PostgreSQL untuk serialisasi mutasi demo. Banyak fungsi mutasi services dibungkus atomic sehingga audit/finalisasi ikut transaksi.
- **Audit daftar wrapper**: penamaan prefix otomatis tidak mencakup semua mutasi (contoh manualAssignEvaluator, deleteParameter, ensureAssignmentRules). Beberapa guard masih hanya di Server Actions. Jangan menganggap semua race sudah tertutup.
- Jawaban: cek akun aktif dan ownership sebelum replay idempotency; validasi parameter duplikat; penghapusan nilai draf benar-benar menghapus skor; guard final/revisi; correctionEndsAt; larangan koreksi final tanpa revisi; void seluruh respons berlaku tanpa menghidupkan respons lama.
- Snapshot unit ID objek (`ownerUnitIdSnapshot`), nama/ID penilai saat penugasan, responseSnapshot pada calculation run.
- Perhitungan decimal.js, error pada parameter tak sebanding, aturan tie-break disnapshot, hasil final tidak dihitung ulang, detail respons memakai snapshot.
- `getLatestRun()` mencoba kalkulasi ulang otomatis jika timestamps input lebih baru. Review konsistensi, repeated reads, concurrency dan error handling.
- Ranking pimpinan dihitung dalam lingkup sebelum filter, bukan ranking global lalu dipangkas.
- `getPeriodScope()` memakai unitTreeSnapshot periode dan jabatan pimpinan saat ini; dipakai halaman/ekspor hasil baru. Review seluruh jalur akses, termasuk fallback periode lama tanpa snapshot.
- Ekspor melakukan pemeriksaan role/waktu/scope sendiri, metadata versi ditambah.
- Finalisasi atomik melalui wrapper, catatan wajib, masalah terbuka menjadi blocker; endpoint transisi status tidak bisa bypass finalisasi/revisi.
- Copy periode membawa objek aktif dan memetakan ulang parameter tie-break; jawaban/penugasan tidak disalin.
- Minimum >=1; target0 diperbolehkan tanpa mengubah minimum.
- Role ADMIN grant mentransfer admin tunggal dalam transaksi, bukan menambah admin kedua. UI belum menjelaskan dampak transfer secara memadai.
- Fingerprint preview penugasan dan checkbox penerimaan kekurangan pada UI. Review fingerprint apakah perubahan seluruh kandidat tercakup.
- Halaman `/akses-hasil` khusus Admin/Dekan di luar layout admin.
- `/arsip/[finalizationId]` menampilkan hasil snapshot final; link dari riwayat. Belum diuji dan belum ekspor arsip per versi.
- Parameter tie-break ditambahkan pada form rule.
- Revisi instrumen: beginInstrumentRevision + action + form baru pada kategori status REVISI; clone parameter, buka ulang tugas, tenggat eksplisit. **Baru ditulis, belum diuji.** Review mutable assignment instrument ID, migrasi respons, editability, compatibility, dan old draft behavior.
- Halaman admin dibungkus guard requireAdminActor untuk otorisasi pada page, tidak hanya layout.

## Verifikasi yang BENAR-BENAR dijalankan

1. Astro build/check sukses: 77 file, 0 error/warning/hint, 7 halaman.
2. Next production build awal sukses (sebelum beberapa perubahan terakhir): `application-build.log`.
3. 7 suite service tests terakhir lulus total **171 assertion**: 23+30+18+32+21+32+15. Log: `application-tests.log`.
   - Sebagian fixture lama diperbarui untuk requirement minimum>=1, copy objek dan void tanpa resurrect.
   - Tes ini **mendahului perubahan historical scope / export guards / archive / instrument revision / page guards terbaru**. Jangan mengklaim lulus untuk HEAD working tree terakhir.
4. agent-browser berhasil membuka login, snapshot, screenshot, errors kosong menggunakan Chromium headless shell.
5. Playwright probe berhasil login admin01, POST 200, redirect `/dashboard`, screenshot. Script sementara `/tmp/browser-probe.cjs`.
6. Screenshots: `login-desktop.png`, `dashboard-probe.png`. Login sudah ditinjau visual. Belum visual review menyeluruh dashboard/mobile.
7. **Typecheck TERAKHIR GAGAL**, satu error di `typecheck.log`:
   `src/lib/services/periods.ts(322,20): TS2367 ... comparison ... targetStatus ... FINAL has no overlap`.
   Sebab guard baru menolak targetStatus FINAL, tetapi update masih memeriksa targetStatus === FINAL untuk finalizedAt. Selesaikan konsisten dengan state machine.

## Proses yang masih berjalan

- Next production preview pada **http://127.0.0.1:3920**, PID yang teramati 126003. Ini **build lama**, belum mencakup perubahan terakhir. Jangan gunakan preview ini sebagai bukti source terkini.
- PostgreSQL demo port 55432.
- Belum daemon/service startup untuk aplikasi baru.
- Beberapa percobaan agent-browser `survey`, `survey2`, `survey3` mengalami hang Chrome. Jangan kill browser global; batasi proses milik sesi kerja ini jika cleanup diperlukan.
- Browser yang berhasil:
  `/home/restart/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell`
  flags `--no-sandbox,--disable-dev-shm-usage`, session `survey4`.
- Browser sistem `/opt/google/chrome/chrome` sempat gagal/hang karena permission socket LXC. Playwright installed headless shell bekerja.

## Pekerjaan berikutnya — belum selesai

1. Baca requirement SELURUHNYA dan buat checklist AC-01..AC-38 / UC-01..UC-10; jangan menganggap reuse aplikasi asli berarti lengkap.
2. Perbaiki typecheck, review perubahan terbaru, generate migration aman, build ulang; gunakan database demo ini saja.
3. Uji negatif authorization direct URL/Server Action/export; cek peran Dekan akses policy, hierarchy reparent, old scope, idempotency replay dan final archive.
4. Uji regresi transaksi/snapshot, finalization rollback/failure/retry, instrument version incompatibility dan pengisian ulang, stale preview, closed deadline dan correction window.
5. Lengkapi optimistic lock konfigurasi periode/instrumen/master bila requirement membutuhkan; saat ini belum menyeluruh.
6. Manual assignment masih punya bypass filter scope/pimpinan; canceled assignment reuse bisa mencampur riwayat. Tinjau dan perbaiki sesuai PRD.
7. Jadwal buka/tutup otomatis belum dibuat. Pengiriman punya guard waktu, tetapi lifecycle scheduler dan operasional belum selesai.
8. Preview/simulasi instrumen, pagination/filter tiap tabel, state error/loading, aksesibilitas label form/mobile drawer, logout/cache masih perlu audit.
9. Halaman publik masih berisi form/tautan warisan dan modal permintaan akses/instrumen yang belum menjadi fungsi survey. Hilangkan placeholder misleading atau integrasikan sesuai lingkup demo, jangan mengarang layanan eksternal.
10. Selesaikan desain/animasi semua halaman persis senada repo dan uji desktop/mobile, alur pengguna lengkap. Jangan hanya mengganti warna.
11. Rapikan kode/style/import/comment usang yang bertentangan dengan implementasi. `application/application/public` adalah direktori kosong tak sengaja dari cwd salah, bisa dibersihkan. Jangan commit node_modules, .env, generated files atau secret.
12. Buat dokumentasi menjalankan/demo, deployment+rollback, backup/restore dan matriks hasil uji yang jujur.
13. Deploy target heyizza.my.id belum dikerjakan: perlu akses admin dan routing domain yang saat ini ke Vercel. Jangan mengganggu aplikasi survei lama / situs tetangga. User telah meminta deployment, jadi tak perlu meminta ulang izin generik; tanyakan hanya akses yang benar-benar belum tersedia.

## Perintah untuk melanjutkan

```bash
cd /home/restart/survey-fsm
export PATH=/home/restart/.local/lib/survey-runtime/node_modules/.bin:$PATH
# Setelah memperbaiki error dan review schema:
cd application
npx prisma generate
npx tsc --noEmit
npm run test:all
cd ..
npm run build:all
# Restart HANYA preview aplikasi baru; port 3910 adalah aplikasi lama.
npm run start:app
```

Untuk browser:
```bash
cd /home/restart/survey-fsm
node_modules/.bin/agent-browser --session claude-survey --executable-path /home/restart/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell --args '--no-sandbox,--disable-dev-shm-usage' open http://127.0.0.1:3920/login
```

**Status akhir handoff:** fondasi integrasi dan perubahan signifikan sudah ada; sebagian teruji; working tree terkini memiliki satu error typecheck; desain/animasi dan requirement belum seluruhnya selesai; domain belum dideploy.
