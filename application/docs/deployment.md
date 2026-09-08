# Deployment — Survei Penilaian FSM UNDIP

**Status:** dokumen ini menjelaskan deployment DEMO ke `fsm.heyizza.my.id` di host `mbkm`, memakai
database demo yang sudah ada (`survey_fsm_demo`, data dummy jelas berlabel). Ini **bukan** gerbang
produksi (Bab 25.3) — autentikasi sebenarnya, data institusi asli, dan kebijakan retensi resmi
belum ada.

## Kenapa `fsm.heyizza.my.id`, bukan `heyizza.my.id` langsung

Domain akar `heyizza.my.id` diarahkan ke Vercel (di luar server ini) — bukan sesuatu yang bisa
diubah dari LXC ini. Setiap aplikasi lain di server ini (`restart`, `laporanfoto`, `daylight`,
`wujil`, `brain`, `survei` — aplikasi LAMA) punya subdomainnya sendiri lewat tunnel Cloudflare yang
sama. `fsm.heyizza.my.id` dipilih mengikuti pola yang sama, dan sengaja beda dari
`survei.heyizza.my.id` (aplikasi lama di `/var/www/survei-fsm`, port 3910/8093) supaya keduanya
bisa hidup berdampingan tanpa bentrok. Kalau nama subdomain ini tidak sesuai keinginan, gampang
diganti — cukup edit tiga tempat: `deploy/nginx-fsm.heyizza.my.id.conf`, baris `sed` di
`deploy.sh`, dan ganti nama file vhost-nya.

**Catatan penting soal DNS (koreksi asumsi sesi sebelumnya):** semua `*.heyizza.my.id`, termasuk
subdomain yang belum pernah dipakai sama sekali, resolve ke IP proxy Cloudflare yang sama
(edge Cloudflare selalu menjawab begitu untuk domain apa pun yang menggunakan nameserver-nya) —
itu **bukan** bukti ada wildcard CNAME ke tunnel. Yang sebenarnya terjadi: root domain diarahkan ke
Vercel, dan **setiap subdomain yang berfungsi punya DNS record CNAME eksplisit** ke
`<tunnel-id>.cfargotunnel.com`, dibuat satu-satu lewat `cloudflared tunnel route dns` saat subdomain
itu pertama kali di-deploy. Menambahkan hostname baru ke `ingress:` di `/etc/cloudflared/config.yml`
saja **tidak cukup** — itu hanya mengatur apa yang dilakukan tunnel SETELAH traffic sampai; tanpa
DNS record eksplisit, traffic untuk hostname baru tidak pernah sampai ke tunnel sama sekali dan
jatuh ke default akun (Vercel), menghasilkan 404 `DEPLOYMENT_NOT_FOUND` walau tunnel/nginx/app semua
sehat. Wajib jalankan juga:

```bash
cloudflared tunnel route dns e6c83f1b-7271-434c-88e7-fb6669f2bfeb fsm.heyizza.my.id
```

(pakai `/root/.cloudflared/cert.pem` yang sudah ada di server, tidak perlu login ulang). Ini sudah
dijalankan untuk `fsm.heyizza.my.id` (dikonfirmasi publik 200) tapi **belum ditambahkan ke
`deploy.sh`** — kalau subdomain ini pernah dihapus lalu dibuat ulang, atau ada subdomain baru lain
di masa depan, langkah ini harus diulang manual.

## Arsitektur

```
Cloudflare edge (wildcard *.heyizza.my.id)
  -> cloudflared tunnel (config.yml ingress rule baru)
    -> nginx :8094 (vhost baru, server_name fsm.heyizza.my.id)
      -> next start :3930 (fsm-survei.service, user restart)
        -> PostgreSQL :55432 (survey-fsm-postgres.service, user restart, data terpisah dari
           database aplikasi lain di server ini)
```

Tiga unit systemd baru, semuanya jalan sebagai user `restart` (bukan root — beda dari
`survei-fsm.service` lama yang jalan sebagai root):

| Unit | Fungsi |
| --- | --- |
| `survey-fsm-postgres.service` | Database demo, sebelumnya dijalankan manual lewat `pg_ctl`, sekarang persisten lewat systemd (bertahan setelah reboot). |
| `fsm-survei.service` | Proses `next start` aplikasi, port 3930. |
| `fsm-survei-scheduler.timer` + `.service` | Menjalankan `scripts/run-scheduled-transitions.ts` tiap 5 menit — membuka periode berstatus Siap begitu tanggal mulainya tiba (Bab 7.2). Lihat komentar di `runScheduledOpenings()` (`src/lib/services/periods.ts`) untuk alasan kenapa PENUTUPAN periode SENGAJA tidak diotomatiskan. |

## Menjalankan deploy

Semua berkas unit ada di `application/deploy/`, ditulis ulang (idempotent) oleh skrip berikut ke
lokasi sistemnya masing-masing. **Tidak ada langkah yang menghentikan atau mengubah
`survei-fsm.service`/`survei-fsm` (aplikasi lama) atau aplikasi tetangga lain di server ini.**

```bash
sudo bash /home/restart/survey-fsm/application/deploy/deploy.sh
```

Skrip melakukan, berurutan: (1) memastikan Postgres demo hidup lewat systemd — mengambil alih dari
proses manual bila masih berjalan, (2) build Astro+Next sebagai user `restart`, (3) `tsc --noEmit`
+ `test:all` — berhenti kalau ada yang gagal, (4) systemd untuk aplikasi, (5) systemd timer
scheduler, (6) vhost nginx + `nginx -t` + reload, (7) satu baris baru di
`/etc/cloudflared/config.yml` (dengan cadangan file lama sebelum diubah) + restart `cloudflared`,
(8) verifikasi lokal lewat nginx dan menampilkan perintah `curl` untuk verifikasi publik.

Jalankan ulang skrip yang sama kapan pun setelah ada perubahan kode — semua langkahnya aman
diulang.

## Verifikasi setelah deploy

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8094/login   # lewat nginx, dari server ini
curl -sS -o /dev/null -w '%{http_code}\n' https://fsm.heyizza.my.id/login   # publik, lewat tunnel
systemctl status survey-fsm-postgres fsm-survei fsm-survei-scheduler.timer --no-pager
journalctl -u fsm-survei -n 50 --no-pager   # log aplikasi kalau ada masalah
```

Login demo: lihat halaman `/login` (label lingkungan demo + daftar ID sudah ditampilkan di UI —
`admin01`, `dekan01`, `dosen1001`, `dosen1004`).

## Rollback

Setiap langkah bisa dibalik satu-satu tanpa memengaruhi aplikasi lain:

```bash
systemctl disable --now fsm-survei.service fsm-survei-scheduler.timer
rm /etc/nginx/sites-enabled/fsm.heyizza.my.id
systemctl reload nginx
# Kembalikan config cloudflared dari cadangan yang dibuat deploy.sh:
cp /etc/cloudflared/config.yml.bak.<timestamp> /etc/cloudflared/config.yml
systemctl restart cloudflared
```

`survey-fsm-postgres.service` aman dibiarkan tetap jalan (database lokal, tidak diekspos publik,
dipakai juga untuk pengembangan/pengujian lanjutan) — matikan hanya kalau benar-benar tidak
diperlukan lagi: `systemctl disable --now survey-fsm-postgres.service`.

## Backup & pemulihan database demo

Belum ada backup terjadwal (Bab 21.3 eksplisit menyebut ini target operasional, bukan klaim sudah
berjalan). Untuk cadangan manual sewaktu-waktu:

```bash
su - restart -c "PGPASSWORD=\$(grep DATABASE_URL /home/restart/survey-fsm/application/.env | sed -E 's#.*restart:([^@]+)@.*#\1#') \
  pg_dump -h 127.0.0.1 -p 55432 -U restart survey_fsm_demo -Fc -f /home/restart/survey-fsm-demo-backup-\$(date +%Y%m%d).dump"
```

Pulihkan ke database kosong dengan `pg_restore`. Sebelum operasional sesungguhnya, siapkan cadangan
terjadwal (cron/systemd timer serupa scheduler di atas) dan **uji pemulihannya**, bukan hanya
membuat filenya (Bab 21.3: "uji pemulihan sebelum rilis").

## Sebelum ini benar-benar dipakai untuk data asli

Lihat Bab 25.3 requirements dan `docs/acceptance-checklist.md`. Ringkas: autentikasi sebenarnya
(bukan ID-saja), pemetaan akun institusi, migrasi database produksi (bukan `db push` — migration
history sudah lengkap dan tervalidasi, lihat commit yang menambahkan
`add_snapshot_columns_missing_from_history`), kapasitas host yang diukur, backup+restore yang
diuji, dan penetapan admin/Dekan definitif — semuanya gate produksi eksplisit, bukan penghambat
demo yang sedang berjalan sekarang.
