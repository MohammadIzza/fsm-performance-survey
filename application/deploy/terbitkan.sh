#!/bin/bash
# Menerbitkan perubahan kode TANPA membuat situs error selama build.
#
# Dulu build ditulis langsung ke application/.next dan aset publik dihapus lalu disalin ulang
# selagi fsm-survei.service melayani pengunjung — selama ±1–2 menit situs membalas "This page
# couldn't load" (log: "Could not find a production build", chunk tidak ditemukan).
#
# Sekarang ada dua folder build yang bergantian, .next-a dan .next-b. Build ditulis ke folder yang
# TIDAK sedang dipakai; setelah selesai, layanan di-restart memakai folder itu (±1 detik). Nama
# folder tidak diganti setelah build karena Next menanam nama distDir di hasil build. Folder lama
# dibiarkan sebagai cadangan untuk kembali cepat, dan berkas statisnya disalin ke build baru supaya
# tab peramban yang masih memuat versi lama tidak gagal memuat potongan skrip.
#
# Pemakaian (sebagai root): application/deploy/terbitkan.sh
set -euo pipefail

REPO=/home/restart/survey-fsm
APP=$REPO/application
NODE22=/opt/node22/bin
BERKAS_AKTIF=$APP/.dist-aktif
LAYANAN=fsm-survei.service
URL_CEK=http://127.0.0.1:3930/survey/login

sebagai_restart() {
  # runuser tidak membuka sesi login (tidak memicu pembersihan IPC systemd-logind).
  runuser -u restart -- env PATH="$NODE22:/usr/bin:/bin" HOME=/home/restart bash -c "$1"
}

aktif=".next"
[ -f "$BERKAS_AKTIF" ] && aktif=$(sed -n 's/^NEXT_DIST_DIR=//p' "$BERKAS_AKTIF")
[ -n "$aktif" ] || aktif=".next"
if [ "$aktif" = ".next-a" ]; then target=".next-b"; else target=".next-a"; fi
echo "== Build aktif: $aktif — build baru ditulis ke $target =="

echo "== 1/5 Situs publik (Astro) =="
sebagai_restart "cd $REPO && npm run build"
sebagai_restart "cd $REPO && SIAPKAN_TERBIT=1 node scripts/prepare-application.mjs"

echo "== 2/5 Aplikasi (Next) =="
# next build menulis ulang next-env.d.ts dan tsconfig.json untuk distDir lain; dikembalikan sesudahnya.
cp "$APP/next-env.d.ts" /tmp/terbit-next-env.d.ts
cp "$APP/tsconfig.json" /tmp/terbit-tsconfig.json
set +e
sebagai_restart "cd $APP && rm -rf $target && NEXT_DIST_DIR=$target npm run build"
hasil_build=$?
set -e
cp /tmp/terbit-next-env.d.ts "$APP/next-env.d.ts"
cp /tmp/terbit-tsconfig.json "$APP/tsconfig.json"
chown restart:restart "$APP/next-env.d.ts" "$APP/tsconfig.json"
if [ $hasil_build -ne 0 ]; then
  rm -rf "$APP/public-site-baru"
  echo "GAGAL: build Next gagal — situs tetap melayani build $aktif, tidak ada yang diganti." >&2
  exit 1
fi

echo "== 3/5 Menukar ke build baru =="
# Potongan skrip build lama ikut disediakan (tanpa menimpa yang baru).
if [ -d "$APP/$aktif/static" ]; then
  sebagai_restart "cp -rn $APP/$aktif/static/. $APP/$target/static/"
fi
rm -rf "$APP/public-site-lama"
[ -d "$APP/public-site" ] && mv "$APP/public-site" "$APP/public-site-lama"
mv "$APP/public-site-baru" "$APP/public-site"
echo "NEXT_DIST_DIR=$target" > "$BERKAS_AKTIF"
chown restart:restart "$BERKAS_AKTIF"
systemctl restart "$LAYANAN"

echo "== 4/5 Memastikan aplikasi baru menjawab =="
siap=0
for _ in $(seq 1 60); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "$URL_CEK")" = "200" ]; then siap=1; break; fi
  sleep 1
done
if [ $siap -ne 1 ]; then
  echo "GAGAL: build baru tidak menjawab — kembali ke $aktif." >&2
  echo "NEXT_DIST_DIR=$aktif" > "$BERKAS_AKTIF"
  if [ -d "$APP/public-site-lama" ]; then
    rm -rf "$APP/public-site" && mv "$APP/public-site-lama" "$APP/public-site"
  fi
  systemctl restart "$LAYANAN"
  exit 1
fi
echo "OK: aplikasi menjawab dari $target."

echo "== 5/5 Membersihkan =="
rm -rf "$APP/public-site-lama"
# Aset yang sudah dihapus dari situs publik jangan tetap terlayani (berkas ber-hash lama dibiarkan
# dulu untuk tab yang masih terbuka; hanya assets/ yang disamakan persis).
sebagai_restart "rsync -a --delete $REPO/dist/assets/ $APP/public/assets/"
sebagai_restart "rsync -a $REPO/dist/_astro/ $APP/public/_astro/"
# Build lama pertama (.next) tidak dipakai lagi setelah beralih ke .next-a/.next-b.
# (Hanya berlaku saat peralihan pertama; setelah itu .next tidak pernah dibuat oleh skrip ini.)
if [ -d "$APP/.next" ]; then rm -rf "$APP/.next"; fi
if [ -d "$APP/$aktif" ]; then cadangan="cadangan: $aktif"; else cadangan="belum ada cadangan"; fi
echo "Selesai. Build aktif: $target ($cadangan)."
