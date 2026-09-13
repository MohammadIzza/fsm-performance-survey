#!/usr/bin/env bash
# Deploy Survei Penilaian FSM UNDIP di server ini (host mbkm). Aplikasi hidup di bawah /survey dan
# dijangkau lewat dua jalan: gateway UNDIP (https://apps-fsm.undip.ac.id/survey/ → nginx :8094) dan
# tunnel Cloudflare (https://fsm.heyizza.my.id/survey/). Rute gateway dikelola di luar server ini.
#
# Aman dijalankan ulang (idempotent) — setiap langkah memeriksa kondisi sebelum bertindak.
# TIDAK menyentuh aplikasi lain di server ini (survei-fsm lama tetap di port 3910/8093,
# tidak dihentikan/diubah oleh skrip ini).
#
# Jalankan sebagai root:
#   sudo bash /home/restart/survey-fsm/application/deploy/deploy.sh
#
# Setiap langkah punya alasannya sendiri di komentar — baca dulu sebelum menjalankan kalau ragu.

set -euo pipefail

APP_ROOT=/home/restart/survey-fsm
APP_DIR="$APP_ROOT/application"
DEPLOY_DIR="$APP_DIR/deploy"
NODE_BIN=/home/restart/.local/lib/survey-runtime/node_modules/.bin
# Node khusus build. Node sistem di mesin ini adalah 20.x dari repositori NodeSource, sedangkan
# Astro 7 menolak jalan di bawah 22.12 — `astro check` berhenti sebelum apa pun dibangun. Node 22
# TIDAK dipasang sebagai Node sistem karena mesin ini juga menjalankan layanan Node milik proyek
# lain (kkn-wujil, survei-fsm lama, dan beberapa proses PM2); menaikkan /usr/bin/node akan ikut
# mengubah runtime mereka semua sekaligus. Runtime terpisah ini hanya aktif ketika dipanggil lewat
# PATH di bawah, jadi tidak ada layanan lain yang tersentuh.
#
# Kalau direktori ini hilang (mesin baru / dibersihkan), pasang ulang dengan:
#   curl -fsSL https://nodejs.org/dist/v22.21.1/node-v22.21.1-linux-x64.tar.xz \
#     | tar -xJ -C /opt/node22 --strip-components=1   # buat direktorinya dulu
NODE22_BIN=/opt/node22/bin
DOMAIN=fsm.heyizza.my.id
# Port aplikasi (3930) sudah tertanam di deploy/fsm-survei.service (bukan di-template dari sini) —
# ubah di SANA juga kalau nilainya diganti. NGINX_PORT di bawah dipakai skrip ini untuk verifikasi
# dan baris cloudflared, dan harus sama dengan `listen` di deploy/nginx-fsm.heyizza.my.id.conf.
NGINX_PORT=8094

if [ "$(id -u)" -ne 0 ]; then
  echo "Jalankan sebagai root (sudo bash $0)." >&2
  exit 1
fi

if [ ! -x "$NODE22_BIN/node" ]; then
  echo "GAGAL: Node 22 untuk build tidak ada di $NODE22_BIN — lihat catatan di kepala skrip ini." >&2
  exit 1
fi

echo "== 1/8: Pastikan database demo hidup =="
# survey-fsm-postgres.service SUDAH ditulis ke /etc/systemd/system/ oleh sesi sebelumnya
# (isinya identik dengan deploy/survey-fsm-postgres.service) — baris ini menyalinnya ulang
# hanya untuk memastikan konsisten dengan yang ada di repo, lalu mengaktifkannya.
cp "$DEPLOY_DIR/survey-fsm-postgres.service" /etc/systemd/system/survey-fsm-postgres.service
systemctl daemon-reload
if ss -ltn 2>/dev/null | grep -q ':55432 '; then
  echo "Postgres demo sudah berjalan (proses manual dari sesi sebelumnya) — akan diambil alih systemd."
  su - restart -c "/usr/lib/postgresql/16/bin/pg_ctl stop -D /home/restart/.local/share/survey-fsm/postgres -m fast -w -t 60" || true
  sleep 1
fi
systemctl enable --now survey-fsm-postgres.service
sleep 2
systemctl is-active --quiet survey-fsm-postgres.service && echo "OK: survey-fsm-postgres aktif." || { echo "GAGAL: survey-fsm-postgres tidak aktif." >&2; exit 1; }

echo "== 2/8: Build aplikasi (Astro + Next) =="
# Dijalankan sebagai user restart (BUKAN root) — build harus dijalankan oleh pemilik berkas
# ($APP_ROOT dimiliki restart:restart), kalau tidak .next/dist hasil build akan dimiliki root dan
# tidak bisa ditulis ulang/dibaca oleh proses fsm-survei.service yang jalan sebagai restart.
su - restart -c "export PATH=$NODE22_BIN:$NODE_BIN:\$PATH && cd $APP_ROOT && npm run build:all"

echo "== 3/8: Uji layanan sebelum deploy (jangan lanjut kalau ada yang gagal) =="
su - restart -c "export PATH=$NODE22_BIN:$NODE_BIN:\$PATH && cd $APP_DIR && npx tsc --noEmit && npm run test:all" | tail -20

echo "== 4/8: Systemd — aplikasi Next.js =="
cp "$DEPLOY_DIR/fsm-survei.service" /etc/systemd/system/fsm-survei.service
systemctl daemon-reload
systemctl enable --now fsm-survei.service
sleep 2
systemctl is-active --quiet fsm-survei.service && echo "OK: fsm-survei aktif." || { echo "GAGAL: fsm-survei tidak aktif. Cek: journalctl -u fsm-survei -n 50" >&2; exit 1; }

echo "== 5/8: Systemd — scheduler periode terjadwal (Bab 7.2) =="
cp "$DEPLOY_DIR/fsm-survei-scheduler.service" /etc/systemd/system/fsm-survei-scheduler.service
cp "$DEPLOY_DIR/fsm-survei-scheduler.timer" /etc/systemd/system/fsm-survei-scheduler.timer
systemctl daemon-reload
systemctl enable --now fsm-survei-scheduler.timer
echo "OK: timer scheduler aktif (jalan tiap 5 menit)."

echo "== 6/8: Nginx vhost =="
cp "$DEPLOY_DIR/nginx-fsm.heyizza.my.id.conf" "/etc/nginx/sites-available/$DOMAIN"
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
nginx -t
systemctl reload nginx
echo "OK: nginx vhost $DOMAIN aktif di port $NGINX_PORT."

echo "== 7/8: Cloudflared — tambah rute tunnel =="
TUNNEL_ID=e6c83f1b-7271-434c-88e7-fb6669f2bfeb
CF_CONFIG=/etc/cloudflared/config.yml
if grep -q "hostname: $DOMAIN" "$CF_CONFIG"; then
  echo "Rute ingress $DOMAIN sudah ada di $CF_CONFIG — dilewati."
else
  cp "$CF_CONFIG" "$CF_CONFIG.bak.$(date +%Y%m%d%H%M%S)"
  # Sisipkan SEBELUM baris catch-all "- service: http_status:404" — urutan ingress rule penting,
  # aturan pertama yang cocok yang dipakai cloudflared.
  sed -i "/- service: http_status:404/i\\  - hostname: $DOMAIN\\n    service: http://localhost:$NGINX_PORT" "$CF_CONFIG"
  echo "Ditambahkan ke $CF_CONFIG (cadangan lama disimpan sebagai $CF_CONFIG.bak.*):"
  grep -A1 "hostname: $DOMAIN" "$CF_CONFIG"
  systemctl restart cloudflared
  sleep 2
  systemctl is-active --quiet cloudflared && echo "OK: cloudflared aktif dengan rute baru." || { echo "GAGAL: cloudflared tidak aktif setelah restart. Cek: journalctl -u cloudflared -n 50" >&2; exit 1; }
fi
# PENTING: baris ingress di atas HANYA mengatur perilaku tunnel setelah traffic sampai padanya —
# ini TIDAK membuat DNS record. Tanpa CNAME eksplisit ke tunnel, hostname baru tidak pernah
# ter-routing ke tunnel sama sekali (jatuh ke default akun Cloudflare, yaitu Vercel, -> 404
# DEPLOYMENT_NOT_FOUND) walau tunnel/nginx/app semua sehat. `route dns` idempoten: aman dipanggil
# ulang meski record sudah ada.
cloudflared tunnel route dns "$TUNNEL_ID" "$DOMAIN"
echo "OK: DNS record $DOMAIN -> tunnel $TUNNEL_ID dipastikan ada."

echo "== 8/8: Verifikasi =="
sleep 2
LOCAL_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:$NGINX_PORT/survey/login" || echo "000")
echo "Lokal lewat nginx (http://127.0.0.1:$NGINX_PORT/survey/login): $LOCAL_CODE"
if [ "$LOCAL_CODE" != "200" ]; then
  echo "PERINGATAN: nginx tidak mengembalikan 200. Cek: journalctl -u fsm-survei -n 50" >&2
fi
echo ""
echo "Verifikasi publik (tunggu beberapa detik untuk propagasi tunnel), lalu jalankan manual:"
echo "  curl -sS -o /dev/null -w '%{http_code}\n' https://$DOMAIN/survey/login"
echo "  curl -sS -o /dev/null -w '%{http_code}\n' https://apps-fsm.undip.ac.id/survey/login"
echo ""
echo "Selesai. survei-fsm lama (port 3910/8093, survei.heyizza.my.id) tidak disentuh."
