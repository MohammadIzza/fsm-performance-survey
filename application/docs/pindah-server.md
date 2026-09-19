# Pindah ke Server (LXC) Baru

Panduan memindahkan Survei Penilaian FSM UNDIP ke server baru dengan kode dari GitHub, lalu
mengarahkan `https://apps-fsm.undip.ac.id/survey` ke server itu.

Yang perlu dibawa dari server lama ada tiga, dan hanya yang pertama ada di GitHub:

| Bawaan | Sumber | Cara |
|---|---|---|
| Kode | GitHub `MohammadIzza/fsm-performance-survey`, branch `master` | `git clone` |
| Rahasia (`application/.env`) | Server lama | Salin manual, jangan di-commit |
| Isi database | Server lama | `pg_dump` → `pg_restore` |

## 1. Di server lama: ambil database dan `.env`

```bash
cd /home/restart/survey-fsm/application
URL=$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | sed 's/?.*$//')
sudo -u restart /usr/lib/postgresql/16/bin/pg_dump "$URL" --format=custom \
  --no-owner --no-privileges --file=/home/restart/survei-fsm-$(date +%F).dump
```

Salin berkas `.dump` dan `application/.env` ke server baru (mis. `scp`). Isi `.env` hanya dua
kunci: `DATABASE_URL` dan `SESSION_SECRET`.

## 2. Server baru: prasyarat

Ubuntu 24.04, user `restart`, lalu:

```bash
sudo apt install -y git nginx postgresql-16 xz-utils
# Node.js 22 di /opt/node22 (dipakai skrip build dan terbitkan.sh)
sudo mkdir -p /opt/node22
curl -fsSL https://nodejs.org/dist/v22.21.1/node-v22.21.1-linux-x64.tar.xz \
  | sudo tar -xJ -C /opt/node22 --strip-components=1
```

## 3. Ambil kode dan pasang dependensi

Clone ke `/home/restart/survey-fsm` — jalur yang dipakai skrip dan berkas layanan. **Jangan ke
folder tersembunyi** (nama diawali titik, mis. `~/.app`): build Tailwind gagal menemukan berkas
tema di jalur seperti itu.

```bash
sudo -u restart git clone https://github.com/MohammadIzza/fsm-performance-survey.git /home/restart/survey-fsm
cd /home/restart/survey-fsm
export PATH=/opt/node22/bin:$PATH
sudo -u restart env PATH=$PATH npm ci
sudo -u restart env PATH=$PATH npm ci --prefix application
```

## 4. Database

```bash
sudo -u postgres createuser restart
sudo -u postgres createdb -O restart survey_fsm
sudo -u postgres psql -c "ALTER USER restart PASSWORD '<kata-sandi-baru>'"
```

Tempatkan `.env` dari server lama ke `/home/restart/survey-fsm/application/.env`, lalu ganti
`DATABASE_URL` ke database baru, mis.
`postgresql://restart:<kata-sandi-baru>@127.0.0.1:5432/survey_fsm?schema=public`.
`SESSION_SECRET` boleh dibiarkan; bila diganti, semua pengguna cukup masuk ulang.

Pulihkan isi database, lalu jalankan **tiga migrasi baru** yang belum ada di database produksi
lama (database ini tidak memakai tabel `_prisma_migrations`, jadi migrasi dijalankan per berkas,
berurutan, masing-masing sekali):

```bash
cd /home/restart/survey-fsm/application
URL=$(grep -m1 '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"' | sed 's/?.*$//')
sudo -u restart pg_restore --no-owner --no-privileges -d "$URL" /home/restart/survei-fsm-<tanggal>.dump

export PATH=/opt/node22/bin:$PATH
for m in 20260918065445_nilai_mentah_dan_gabungan 20260920152938_kelompok_objek 20260920182322_predikat_nilai; do
  sudo -u restart env PATH=$PATH npx prisma db execute --schema prisma/schema.prisma \
    --file prisma/migrations/$m/migration.sql
done

# Harus kosong — artinya database sudah sama dengan kode:
sudo -u restart env PATH=$PATH npx prisma migrate diff --from-url "$URL" \
  --to-schema-datamodel prisma/schema.prisma --script
```

> Jangan jalankan `npm run test:all`, `db:seed`, `seed:dies`, atau `seed:uat` ke database
> produksi. Tes dan seed menulis serta menghapus data.

## 5. Build

```bash
cd /home/restart/survey-fsm
sudo -u restart env PATH=/opt/node22/bin:$PATH bash -c "npm run build:all"
```

`build:all` = build halaman publik (Astro) → salin aset & tema ke aplikasi → `next build`.

## 6. Layanan systemd

```bash
cd /home/restart/survey-fsm/application/deploy
sudo cp fsm-survei.service fsm-survei-scheduler.service fsm-survei-scheduler.timer \
        survey-fsm-backup-db.service survey-fsm-backup-db.timer /etc/systemd/system/
```

Di server lama Postgres berjalan sebagai instance terpisah (`survey-fsm-postgres.service`). Di
server baru yang memakai Postgres bawaan, ubah dua baris di
`/etc/systemd/system/fsm-survei.service`:

```ini
After=network.target postgresql.service
Requires=postgresql.service
```

Sesuaikan juga `survey-fsm-backup-db.sh` bila jalur `pg_dump` atau folder backup berbeda. Lalu:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now fsm-survei.service fsm-survei-scheduler.timer survey-fsm-backup-db.timer
curl -sI http://127.0.0.1:3930/survey/login | head -1   # HTTP/1.1 200 OK
```

## 7. nginx

```bash
sudo cp /home/restart/survey-fsm/application/deploy/nginx-fsm.heyizza.my.id.conf \
        /etc/nginx/sites-available/fsm
sudo ln -s /etc/nginx/sites-available/fsm /etc/nginx/sites-enabled/fsm
sudo nginx -t && sudo systemctl reload nginx
curl -sI http://127.0.0.1:8094/survey/login | head -1  # HTTP/1.1 200 OK
```

Vhost mendengarkan port **8094** dan menjadi server bawaan untuk Host apa pun dari gateway.

## 8. Arahkan gateway UNDIP

Minta admin jaringan UNDIP mengganti tujuan `https://apps-fsm.undip.ac.id/survey/` dari
`10.137.58.132:8094` (server lama) ke `<IP-LXC-baru>:8094`, dengan awalan `/survey/` diteruskan
utuh seperti sekarang.

Alamat Cloudflare `fsm.heyizza.my.id` bersifat opsional; bila tetap dipakai, pasang `cloudflared`
dan pindahkan rutenya (lihat langkah 7 di `deploy/deploy.sh`).

## 9. Verifikasi

- [ ] `https://apps-fsm.undip.ac.id/survey/login` terbuka dan `admin01` dapat masuk.
- [ ] Periode, kategori, pengguna, dan hasil sama dengan server lama.
- [ ] Menu Hasil menampilkan peringkat (tekan Hitung bila kosong).
- [ ] Penilai dapat membuka tugas dan mengisi per pertanyaan.
- [ ] `systemctl list-timers | grep -E 'survei|survey'` menampilkan scheduler dan backup.

Setelah server baru terbukti berjalan, matikan layanan di server lama agar tidak ada dua salinan
data yang sama-sama diisi.

## Pembaruan berikutnya

```bash
cd /home/restart/survey-fsm && sudo -u restart git pull
sudo bash application/deploy/terbitkan.sh   # build bergantian tanpa jeda layanan
```

Bila sebuah rilis membawa migrasi baru (`application/prisma/migrations/`), jalankan berkasnya
dengan `prisma db execute` seperti langkah 4 **sebelum** `terbitkan.sh`.
