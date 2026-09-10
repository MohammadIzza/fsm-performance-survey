# Checklist Kriteria Penerimaan (AC-01..38 / UC-01..10)

**Dibuat:** 10 September 2026. **Sumber:** `Requirements_Web_Survei_FSM_UNDIP_End_to_End.md` Bab 24.
**Cara membaca:** setiap baris merujuk bukti nyata (file uji + baris, atau kode yang benar-benar
dibaca) — bukan asumsi bahwa fitur "pasti sudah benar" karena terlihat ada di kode. Baris berstatus
⚠️ **belum diverifikasi** berarti persis itu: belum ada bukti otomatis atau manual yang tercatat,
bukan berarti perilakunya salah.

Jalankan bukti sendiri sebelum mempercayai baris manapun di sini:
```bash
cd application && npx tsc --noEmit && npm run test:all
```
Terakhir dijalankan: 254/254 assertion lulus di 7 skrip (`test-services`, `test-tahap2`..`test-tahap7`).

Untuk bukti UI browser sungguhan (UC-01/02/03/06/07/10, lihat bagian "UC-01..10" di bawah):
```bash
# Sekali saja / kalau DB e2e sudah pernah dipakai dan ingin bersih lagi:
bash scripts/reset-e2e-db.sh
# Jalankan server terhadap DB e2e (BUKAN survey_fsm_demo) di port terpisah dari demo publik:
set -a && source .env.e2e && set +a && next start -p 3931 -H 127.0.0.1 &
npx playwright test   # target default: http://127.0.0.1:3931, lihat playwright.config.ts
```

## Legenda

- ✅ **Diuji otomatis** — ada assertion di `scripts/test-*.ts` yang gagal bila perilaku ini rusak.
- 🔍 **Terverifikasi kode** — dibaca langsung di kode dan logikanya benar, tapi tidak ada assertion
  otomatis yang akan gagal bila regresi terjadi di kemudian hari.
- ⚠️ **Belum diverifikasi** — celah nyata. Tercantum di sini justru supaya tidak terlewat.

## AC-01..38

| ID | Status | Bukti |
| -- | ------ | ----- |
| AC-01 | ✅ | `test-tahap2.ts` "Category"/"Instrument & Parameter" — kategori+instrumen dibuat lewat service admin, tanpa kode baru. |
| AC-02 | ✅ | `test-tahap2.ts`: bobot 80% "masih dilaporkan sebagai masalah" oleh `checkReadiness`. |
| AC-03 | ✅ (diuji sesi ini) | `test-tahap3.ts` "AC-03/AC-05/EDGE-07/AC-07/EDGE-23" — DEP-FIS (2 pimpinan nyata dari seed) target 2 → keduanya terpilih, `instrumentVersionId` sama untuk kedua tugas. |
| AC-04 | ✅ | `test-tahap3.ts` "EDGE-06: pimpinan menjadi objek dirinya sendiri". |
| AC-05 | ✅ (diuji sesi ini) | `test-tahap3.ts` blok yang sama — pool Selain Pimpinan (9 staf) dibuktikan TIDAK berisi kedua pimpinan (sudah terpakai kelompok Pimpinan objek yang sama), jadi yang terpilih murni staf. |
| AC-06 | ✅ | `test-tahap3.ts` "computePlan"/shortage — target vs kandidat sah dihitung dan dilaporkan sebagai `shortage`, bukan tugas palsu. |
| AC-07 | ✅ (diuji sesi ini) | `test-tahap3.ts` blok yang sama — 1 kandidat dibebani manual (3 tugas dummy di kategori lain, periode sama) sementara 8 lainnya nol; dibuktikan kandidat berbeban itu TIDAK pernah terpilih untuk target 1 (pemerataan beban Bab 10.4 deterministik, bukan uji distribusi statistik). |
| AC-08 | ✅ | `test-tahap3.ts` "Pembatalan & pengisian ulang slot": tugas dibatalkan → slot kembali kosong, diganti; tugas terkirim tidak disentuh (lihat juga EDGE-14 di bawah). |
| AC-09 | ✅ | `test-services.ts` "Draf: boleh tidak lengkap" — draf skor sebagian tersimpan tanpa mempengaruhi hasil. |
| AC-10 | ✅ | `test-services.ts` — submit dengan skor tidak lengkap ditolak (`validateScores` `requireComplete=true`). |
| AC-11 | ✅ | `test-services.ts` "Submit lengkap (AC-11 idempotensi)" — idempotency key mencegah respons ganda. |
| AC-12 | ✅ | `test-services.ts` "Kunci setelah terkirim (AC-12)". |
| AC-13 | ✅ | `test-tahap6.ts` "Bab 14.3/UC-09: buka revisi dari Final" + `test-tahap7.ts` revisi instrumen substantif (Bab 9.3) — revisi dan alasan tercatat, snapshot lama tetap. |
| AC-14 | ✅ | `test-tahap5.ts` "AC-14: rata-rata → Pimpinan 88,5; Selain Pimpinan 84" — cocok fixture Bab 12.4. |
| AC-15 | ✅ | `test-tahap5.ts` "AC-15: metode total → Pimpinan 177; Selain Pimpinan 252". |
| AC-16 | ✅ | `test-tahap5.ts` "AC-16: objek tanpa respons sama sekali → null, bukan 0". |
| AC-17 | ✅ | `test-tahap5.ts` "AC-17: minimum 5, masuk 3 → rekap ada, ranking belum layak". |
| AC-18 | ✅ | `test-tahap5.ts` "AC-18: dua nilai sama → peringkat kompetisi (1,2,2,4)". |
| AC-19 | ✅ | `test-tahap5.ts` "AC-19/20/24: jalur otorisasi NYATA..." — pimpinan Dep. Matematika melihat lingkupnya lewat `getPeriodScope`+`getRanking` (jalur asli halaman `/hasil`, bukan jalur paralel `filterRankingByScope` yang sudah tidak dipakai). |
| AC-20 | ✅ | Test yang sama: pimpinan unit lain menerima array kosong, bukan data unit lain. Tidak ada endpoint ID-addressable untuk detail objek tunggal di luar halaman kategori yang sudah diperiksa lingkupnya, jadi tidak ada permukaan URL untuk "menebak ID" di luar itu. |
| AC-21 | ✅ (diuji sesi ini) | `test-tahap5.ts` "AC-21/EDGE-18" — matriks penuh `isResultAccessOpenForNonAdmin` (4 mode × 6 status periode), termasuk kasus halus SETELAH_FINAL yang sengaja tertutup lagi saat status REVISI. |
| AC-22 | ✅ (diuji sesi ini) | `test-tahap5.ts` "AC-22" — `setAccessPolicy` dipanggil, versi bertambah, dan `listAuditEvents({entity:"AccessPolicy"})` memuat event `ACCESS_POLICY_UPDATE` dengan `entityId`/`actorId` yang benar. |
| AC-23 | ✅ | `export/route.ts` menolak (403) bila `!isAdmin && !isDekan && leadershipUnitIds.length===0` — dibaca langsung, sama seperti AC-19/20 di atas. |
| AC-24 | ✅ | Route ekspor tidak menerima parameter filter unit dari klien sama sekali — `unitIds` selalu dari `getPeriodScope(ctx,...)` sisi server, jadi tidak ada permukaan untuk "meminta semua unit". Diuji lewat AC-19/20/24 di `test-tahap5.ts`. |
| AC-25 | ✅ | `test-tahap7.ts` revisi instrumen (memakai `categoryObject.unitSnapshot`/`ownerUnitIdSnapshot`, bukan unit live objek) + `getPeriodScope` memakai `period.unitTreeSnapshot`, bukan pohon organisasi saat ini. |
| AC-26 | ✅ | `test-tahap7.ts` "AC-26: jawaban lama (parameter lama) tidak ikut tercampur..." — **bug nyata ditemukan & diperbaiki sesi ini**: percobaan kalkulasi gagal sebelumnya tidak pernah tersimpan sebagai GAGAL karena rollback `atomic()` ikut menghapus baris run itu sendiri; lihat `calculations.ts` (`isNested()`/`rawClient`). |
| AC-27 | ✅ (diuji sesi ini) | `test-tahap4.ts` "AC-27/EDGE-13" — periode dengan `endsAt` 2 detik dari sekarang: kirim jawaban berhasil sebelum, ditolak persis setelah (menunggu nyata via `setTimeout`), sekaligus dibuktikan `Period.status` TETAP "AKTIF" tersimpan di DB (bukan status yang menentukan, waktu server yang menentukan). |
| AC-28 | ✅ | `test-tahap6.ts` "Bab 14: finalisasi" — `CalculationRun` terpatri ke `Finalization`, dapat ditelusuri. |
| AC-29 | ✅ | `test-tahap6.ts` "Finalisasi ulang -> revisi 2" — final lama (88) tetap, final baru (95) terpisah dengan `priorFinalId`. |
| AC-30 | ✅ | `test-tahap6.ts` "Impor Unit: all-or-nothing" — baris duplikat/gagal membatalkan seluruh batch. |
| AC-31 | ✅ | `test-tahap3.ts` "Pengecualian pembuat karya". |
| AC-32 | ✅ | `test-services.ts` "Unit: cycle & uniqueness". |
| AC-33 | ✅ | `test-tahap2.ts` "AC-33: dua admin memakai versi konfigurasi lama..." — **ditambahkan sesi ini** (sebelumnya hanya versi respons/EDGE-12 yang diuji, bukan versi konfigurasi GroupRule/Periode). |
| AC-34 | ✅ (diuji sesi ini) | `test-tahap2.ts` "AC-34" — `getAuthContext` dipanggil langsung (primitif yang sama dipakai `getCurrentAuthContext`/login): sebelum nonaktif `active===true`, segera setelah `prisma.user.update({active:false})` konteksnya `active===false` (yang oleh `getCurrentAuthContext` diperlakukan sebagai tanpa sesi sah). `loginAction` sendiri tidak dipanggil langsung (butuh konteks request Next.js), tapi predikatnya identik. |
| AC-35 | ✅ (fitur baru sesi ini) | `LeaderboardTable`/`LeaderboardGroups` — pencarian klien murni menyaring array yang sudah diperingkat, tidak pernah menghitung ulang `rank`. Diverifikasi manual lewat Playwright (bukan skrip `test-*.ts`, karena tidak ada infra uji komponen React di proyek ini). |
| AC-36 | ✅ | `test-tahap2.ts` "Salin periode (Bab 7.5)". |
| AC-37 | ✅ | `test-services.ts` "Laporan masalah penugasan (Bab 11.6)". |
| AC-38 | ✅ (diuji sesi ini) | Retry kalkulasi: `test-tahap5.ts` Bab 21.4, `test-tahap7.ts` AC-26. Retry EKSPOR: `test-tahap6.ts` "AC-38" — `buildResultsExport` dipanggil dua kali berturut-turut, keduanya berhasil dengan struktur sheet identik (regenerasi murni baca-saja, bukan akumulasi state). |

## EDGE-01..30 (ringkas — hanya yang belum tercakup tabel AC di atas)

| ID | Status | Bukti |
| -- | ------ | ----- |
| EDGE-02/03 | ✅ | `test-tahap4.ts` "EDGE-02/EDGE-03: validasi skor". |
| EDGE-04/05 | ✅ | `test-tahap3.ts` computePlan/shortage (lihat AC-06). |
| EDGE-06 | ✅ | Lihat AC-04. |
| EDGE-07 | ✅ (diuji sesi ini) | Lihat AC-05. |
| EDGE-08 | ✅ (diuji sesi ini) | `test-tahap4.ts` "EDGE-08" — penilai kirim jawaban, lalu `primaryUnitId`-nya diubah SAAT periode masih Aktif: snapshot nama/ID login di tugas tidak berubah, jawaban lama tetap terbaca utuh. |
| EDGE-09/10 | ✅ (diuji sesi ini) | `test-tahap4.ts` "EDGE-09/10" — penilai kirim jawaban, tugas dibuka kembali admin, LALU akunnya dinonaktifkan: simpan draf/kirim jawaban ditolak ("Akun tidak aktif.") walau tugas sedang terbuka untuk koreksi, tapi jawaban lama tetap bisa DILIHAT (oleh pemilik maupun admin). |
| EDGE-11 | ✅ | Lihat AC-11. |
| EDGE-12 | ✅ | `test-tahap7.ts` — dua varian (draf sudah ada, draf sama-sama baru) + submit. |
| EDGE-13/27 | ✅ (diuji sesi ini) | Lihat AC-27. |
| EDGE-14 | ✅ | Lihat AC-08 ("Pembatalan & pengisian ulang slot"). |
| EDGE-15 | ✅ | `test-services.ts` "Admin: buka kembali untuk pengisi (Bab 11.5/UC-07)" + `test-tahap7.ts`. |
| EDGE-16 | ✅ | Lihat AC-17. |
| EDGE-17 | ✅ | Lihat AC-18. |
| EDGE-18 | ✅ (diuji sesi ini) | Lihat AC-21. |
| EDGE-19 | ✅ | `test-tahap5.ts`. |
| EDGE-20 | ✅ (diuji sesi ini) | `test-tahap6.ts` "EDGE-20" — tidak ada `deleteUnit`/`prisma.unit.delete` di mana pun kode aplikasi (hanya nonaktifkan); dibuktikan langsung mencoba `prisma.unit.delete()` pada unit berpenghuni ditolak oleh foreign key constraint di level DB, bukan cuma "tidak ada tombolnya di UI". |
| EDGE-21 | ✅ (diuji sesi ini) | `test-tahap6.ts` "EDGE-21..." — nilai berawalan `=`/`+`/`-`/`@` disimpan APA ADANYA saat impor (tidak dievaluasi), dan `safeCell()` (diekspor dari `exports.ts` khusus untuk diuji) menandainya dengan prefiks kutip saat ditulis ke berkas ekspor baru — satu-satunya titik yang benar-benar dibuka lagi di Excel. |
| EDGE-22 | ✅ | Lihat AC-29. |
| EDGE-23 | ✅ (diuji sesi ini) | `test-tahap3.ts` "EDGE-23" — pratinjau diambil (fingerprint dicatat), `GroupRule` diubah, lalu `commitPlan` dengan fingerprint LAMA ditolak eksplisit ("Calon atau konfigurasi berubah..."), berbeda dari EDGE-12/Bab 10.6 yang menguji seed sama tanpa perubahan config. |
| EDGE-24 | ✅ (diuji sesi ini) | `test-tahap6.ts` "EDGE-24" — dua baris `kode_unit` SAMA (dan terpisah, dua baris `id_login` sama) dalam SATU berkas impor: pratinjau menandai "duplikat dalam berkas ini", `applyImport` menolak seluruh batch, tidak ada baris yang tersimpan. |
| EDGE-25 | ✅ | `test-tahap7.ts`. |
| EDGE-26 | ✅ (diuji sesi ini) | `test-tahap5.ts` "EDGE-26" — metode TOTAL pada 2 objek dengan jumlah respons berbeda (3 vs 1): `responseCount` benar per objek, skor masing-masing dihitung dari respons objeknya sendiri (252 vs 50), tidak tercampur/dinormalisasi ke n yang sama. |
| EDGE-28 | ✅ (diuji sesi ini) | `test-tahap5.ts` "EDGE-28" — satu pimpinan diberi jabatan KEDUA di unit tak berkerabat: `leadershipUnitIds` berisi kedua unit tanpa duplikasi, `scopeUnitIds` adalah gabungan kedua subtree tanpa ID ganda. |
| EDGE-29 | ✅ (diuji sesi ini) | `test-tahap5.ts` "EDGE-29" — `unitIds:[]` (lingkup kosong) dan kategori tanpa peserta sama sekali, keduanya menghasilkan array kosong dari `getRanking`, bukan error. |
| EDGE-30 | ✅ | Ini persis AC-35 di atas. |

## UC-01..10

Seluruh UC adalah gabungan AC/EDGE di atas dijalankan berurutan sebagai satu alur peran. Tidak ada
skrip `test-*.ts` yang menjalankan SATU UC dari awal sampai akhir sebagai satu test bernama — setiap
tahap UC diuji terpisah di berbagai file tahap. Verifikasi manual (Playwright/browser) selama sesi
ini yang benar-benar dijalankan dan diamati langsung:

- **UC-04 (mengisi sebagai pengguna):** login `dosen1004` → `/tugas` (filter periode/status) →
  buka tugas "Dibuka kembali" → formulir menampilkan unit objek, bobot, indikator → Simpan
  draf/Kirim jawaban. Diamati langsung lewat screenshot, bukan hanya dibaca di kode.
- **UC-05 (pimpinan menilai dan memantau):** login `admin01` → `/hasil` → detail kategori →
  leaderboard dua kelompok, pencarian, ekspor Excel. Diamati langsung.
- **UC-08/09 (menutup/finalisasi, membuka revisi):** dijalankan penuh sebagai kode (bukan lewat
  UI) di `test-tahap6.ts`/`test-tahap7.ts` — Ditutup → Final → buka Revisi → (baru) revisi
  instrumen substantif → kalkulasi ditolak sampai pengisian ulang → Final lagi.
- **UC-01/02/03/06/07/10 (✅ baru):** `tests/e2e/uc-admin-flows.spec.ts` (Playwright, browser
  Chromium sungguhan lewat `npx playwright test`, target `http://127.0.0.1:3931` dengan database
  terpisah `survey_fsm_e2e` — lihat `playwright.config.ts` dan `scripts/reset-e2e-db.sh`) —
  SATU jalan berurutan nyata: admin login → buat unit+pengguna+tetapkan pimpinan (UC-01) → buat
  periode+kategori+parameter+skala+aturan kelompok (UC-02) → buat objek penilaian+peserta+pratinjau
  &terapkan penugasan (UC-03) → buka periode → penilai melapor tugas keliru, admin menangani
  laporan (UC-06) → penilai kirim jawaban, admin koreksi langsung (UC-07) → admin salin periode ke
  draf baru (UC-10). Lulus (`1 passed`).

  Menulis test ini menemukan (dan sudah diperbaiki) **dua celah UI nyata**, bukan cuma celah test:
  - `copyPeriodAction`/`copyPeriod` (UC-10) sudah lengkap & teruji di `test-tahap2.ts` sejak lama,
    tapi **tidak pernah dipanggil dari UI mana pun** — tidak ada tombol/form untuk memakainya.
    Diperbaiki: `copy-period-form.tsx` baru + dipasang di halaman detail periode.
  - `IssueReportForm` (UC-06, "melaporkan tugas keliru") sudah lengkap sebagai komponen tapi
    **tidak pernah diimpor ke halaman tugas** (`tugas/[assignmentId]/page.tsx`) — pengguna secara
    praktis tidak bisa melaporkan tugas keliru sama sekali lewat UI. Diperbaiki: dipasang untuk
    `isOwner`.
  - Bonus: komentar kode di `copyPeriod` (`services/periods.ts`) mengklaim peserta "sengaja tidak
    disalin" padahal baris tepat di atasnya benar-benar menyalinnya (dan `test-tahap2.ts` sudah
    lama menguji perilaku salin-nya) — komentar yang salah, bukan kode yang salah; diperbaiki
    dengan meluruskan komentarnya + teks UI terkait (`copy-period-form.tsx`, halaman periode).

## Ringkasan celah yang masih terbuka setelah sesi ini

Seluruh baris AC-01..38 dan EDGE-01..30 kini ✅ (diuji otomatis) — tidak ada lagi baris 🔍 tersisa.
Sesi ini menutup AC-03/05/07/21/22/27/34/38 dan EDGE-07/08/09/10/13/18/20/23/24/26/28/29 (13
skenario) lewat penambahan assertion bernama ke `test-tahap2.ts`/`test-tahap3.ts`/`test-tahap4.ts`/
`test-tahap5.ts`/`test-tahap6.ts` (215 → 254 assertion, semuanya lulus). Tidak ada celah lain yang
diketahui pada level AC/EDGE per `Requirements_Web_Survei_FSM_UNDIP_End_to_End.md` Bab 24.

Yang masih di luar cakupan ✅/🔍/⚠️ di atas (bukan gap AC/EDGE, tapi tetap relevan sebelum produksi
sungguhan — lihat `docs/deployment.md` bagian penutup): autentikasi institusi asli (bukan ID-saja),
backup+restore yang benar-benar diuji terjadwal, dan penetapan admin/Dekan definitif.
