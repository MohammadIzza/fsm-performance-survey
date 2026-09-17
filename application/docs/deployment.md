# Deployment — Survei Penilaian FSM UNDIP

**Status:** deployment **demo** di host `mbkm` (LXC), database demo `survey_fsm_demo` berisi data
demonstrasi. Ini **bukan** gerbang produksi (Bab 25.3 requirement): login masih tanpa kata sandi,
belum ada backup terjadwal, dan data sivitas selain nama pimpinan bukan data asli.

## Alamat

| Alamat | Jalur |
| --- | --- |
| https://apps-fsm.undip.ac.id/survey/ | Gateway UNDIP (Apache, TLS diakhiri di sana) → `http://10.137.58.132:8094/survey/`, awalan diteruskan utuh |
| https://fsm.heyizza.my.id/survey/ | Cloudflare → tunnel `cloudflared` → `http://localhost:8094` |

Aplikasi hanya melayani di bawah `/survey`; alamat lain dialihkan ke padanannya di bawah `/survey`.
Konfigurasi gateway dikelola admin UNDIP di luar server ini — dua hal yang masih perlu diminta:
aktifkan HTTP/2, dan alihkan `/survey` ke `https://` (sekarang ke `http://`).

## Arsitektur

```
Gateway UNDIP ─┐
               ├─> nginx :8094 (vhost fsm.heyizza.my.id, juga server bawaan port itu)
Cloudflare ────┘      -> next start 127.0.0.1:3930 (fsm-survei.service, user restart)
                        -> PostgreSQL 127.0.0.1:55432 (survey-fsm-postgres.service, user restart)
```

| Unit systemd | Fungsi |
| --- | --- |
| `survey-fsm-postgres.service` | Database demo, terpisah dari database aplikasi lain di server ini. |
| `fsm-survei.service` | `next start` aplikasi (Astro sudah disalin ke dalamnya), port 3930. |
| `fsm-survei-scheduler.timer` + `.service` | Tiap 5 menit menjalankan `scripts/run-scheduled-transitions.ts` — membuka periode berstatus Siap saat tanggal mulainya tiba (Bab 7.2). Penutupan sengaja tidak otomatis; lihat `runScheduledOpenings()` di `src/lib/services/periods.ts`. |
| `survey-fsm-db-watchdog.timer` + `.service` | Tiap 2 menit menjalankan `deploy/survey-fsm-db-watchdog.sh`: bila database tidak menjawab `select 1` dua kali berturut-turut, `survey-fsm-postgres` di-restart otomatis. Status "active" di systemd saja tidak cukup — lihat catatan di bawah. |

> **Wajib: `RemoveIPC=no`.** Postgres demo berjalan sebagai user `restart`, bukan `postgres`.
> Bawaan systemd-logind (`RemoveIPC=yes`) menghapus shared memory milik user biasa begitu sesi login
> terakhirnya berakhir, sehingga database masih "active" tetapi setiap kueri gagal dengan
> `could not open shared memory segment` dan halaman menampilkan "This page couldn't load".
> `deploy.sh` menulis `/etc/systemd/logind.conf.d/survey-fsm-postgres.conf` berisi `RemoveIPC=no`.
> Bila galat itu tetap muncul, `survey-fsm-db-watchdog.timer` me-restart database dalam ±2 menit;
> secara manual: `systemctl restart survey-fsm-postgres`.
>
> Kejadian 17 Sep 2026: sesi login terakhir user `restart` ditutup pukul 10.44 WIB, 25 detik kemudian
> semua kueri gagal, dan situs error sampai database di-restart pukul 12.42 WIB.
>
> Penjadwal (`fsm-survei-scheduler`) sempat gagal sejak 10 Sep 2026 (`203/EXEC`) karena menunjuk
> `tsx` di `~/.local/lib/survey-runtime` yang tidak ada; kini memakai `application/node_modules/.bin/tsx`.

Semua berkas unit dan vhost nginx ada di `application/deploy/`. Aplikasi lama `survei-fsm`
(port 3910/8093) dan aplikasi tetangga lain tidak disentuh.

## Build dan terbitkan ulang (perubahan kode biasa)

Node 22 untuk build ada di `/opt/node22/bin`. Node sistem (20.x) dipakai layanan lain dan sengaja
tidak diganti.

```bash
cd /home/restart/survey-fsm
export PATH=/opt/node22/bin:$PATH
npm run build:all
chown -R restart:restart dist application/public application/public-site application/src/styles/theme application/.next
systemctl restart fsm-survei.service
until curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8094/survey/ | grep -q 200; do sleep 1; done
```

Tunggu origin membalas 200 **sebelum** membuka alamat publik: Cloudflare menyimpan jawaban 404 untuk
berkas `_next`/`_astro` yang diminta saat server belum siap.

## Deploy lengkap (mesin baru atau memasang ulang layanan)

```bash
sudo bash /home/restart/survey-fsm/application/deploy/deploy.sh
```

Skrip ini aman diulang. Berurutan: (1) Postgres demo lewat systemd, (2) build Astro+Next sebagai
user `restart`, (3) `tsc --noEmit` + `test:all`, (4) `fsm-survei.service`, (5) timer scheduler,
(6) vhost nginx dari `deploy/nginx-fsm.heyizza.my.id.conf` + `nginx -t` + reload, (7) rute
`cloudflared` dan DNS record tunnel untuk `fsm.heyizza.my.id`, (8) verifikasi lokal.

Setiap subdomain `*.heyizza.my.id` butuh CNAME eksplisit ke tunnel; menambah `ingress` di
`/etc/cloudflared/config.yml` saja tidak cukup. Langkah (7) menjalankan
`cloudflared tunnel route dns` yang idempoten.

## Data demo

```bash
cd /home/restart/survey-fsm/application
export PATH=/opt/node22/bin:$PATH
npm run db:seed      # organisasi, akun contoh (admin01, dekan01, dosen1001–1017, …)
npm run seed:dies    # periode Dies 2026: menghapus SELURUH rancangan lama lalu membangun ulang
```

`seed:dies` menghapus hasil perhitungan; leaderboard kosong sampai admin menekan "Hitung" di tiap
kategori. ID periode, kategori, dan tugas berubah setiap kali dijalankan, jadi tautan langsung lama
tidak berlaku lagi.

## Verifikasi setelah deploy

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8094/survey/login      # 200
curl -s -o /dev/null -w '%{http_code}\n' https://apps-fsm.undip.ac.id/survey/login
curl -s -o /dev/null -w '%{http_code}\n' https://fsm.heyizza.my.id/survey/login
curl -s -o /dev/null -w '%{http_code}\n' -r 0-999 http://127.0.0.1:8094/survey/assets/media/tutorial-survei-fsm-v2.mp4   # 206
systemctl status survey-fsm-postgres fsm-survei fsm-survei-scheduler.timer survey-fsm-db-watchdog.timer --no-pager
journalctl -u fsm-survei -n 50 --no-pager
```

## Rollback

```bash
# Kode: kembali ke commit sebelumnya, lalu build dan terbitkan ulang seperti di atas.
git -C /home/restart/survey-fsm checkout <commit>

# Melepas layanan sepenuhnya (tidak memengaruhi aplikasi lain):
systemctl disable --now fsm-survei.service fsm-survei-scheduler.timer survey-fsm-db-watchdog.timer
rm /etc/nginx/sites-enabled/fsm.heyizza.my.id && systemctl reload nginx
cp /etc/cloudflared/config.yml.bak.<timestamp> /etc/cloudflared/config.yml && systemctl restart cloudflared
```

`survey-fsm-postgres.service` aman dibiarkan berjalan (lokal, tidak diekspos).

## Backup dan pemulihan database demo

Belum ada backup terjadwal. Cadangan manual:

```bash
set -a; . /home/restart/survey-fsm/application/.env; set +a
pg_dump "${DATABASE_URL%%\?*}" -Fc -f /home/restart/survey-fsm-demo-$(date +%Y%m%d).dump
```

Pulihkan dengan `pg_restore --clean -d "${DATABASE_URL%%\?*}" <berkas>.dump`. Sebelum dipakai untuk
data asli, siapkan backup terjadwal dan **uji pemulihannya** (Bab 21.3).

## Sebelum dipakai untuk data asli

Lihat Bab 25.3 requirement dan `docs/acceptance-checklist.md`: autentikasi sebenarnya (SSO UNDIP),
pemetaan akun institusi, migrasi database produksi, kapasitas host yang diukur, backup+restore yang
diuji, header keamanan, dan penetapan admin/Dekan definitif.
