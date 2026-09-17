#!/bin/bash
# Backup harian database demo (pg_dump format custom), disimpan 14 hari.
# Dijalankan survey-fsm-backup-db.timer; boleh juga dijalankan manual sebelum perubahan besar.
# Memulihkan: lihat "Backup dan pemulihan database" di docs/deployment.md.
set -euo pipefail

ENV_FILE=${ENV_FILE:-/home/restart/survey-fsm/application/.env}
TUJUAN=${TUJUAN:-/home/restart/backups/survey-fsm}
SIMPAN_HARI=${SIMPAN_HARI:-14}
BIN=/usr/lib/postgresql/16/bin

umask 077
mkdir -p "$TUJUAN"

URL=$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"'"'" | sed 's/?.*$//')
[ -n "$URL" ] || { echo "DATABASE_URL tidak ditemukan di $ENV_FILE" >&2; exit 1; }

nama="survey_fsm_demo-$(date -u +%Y%m%d-%H%M%S)Z.dump"
sementara="$TUJUAN/.$nama.sebagian"
trap 'rm -f "$sementara"' EXIT

"$BIN/pg_dump" "$URL" --format=custom --no-owner --no-privileges --file="$sementara"
# Berkas yang terpotong atau rusak tidak bisa dibaca daftar isinya — jangan sampai dianggap backup.
jumlah=$("$BIN/pg_restore" --list "$sementara" | grep -c "TABLE DATA" || true)
[ "$jumlah" -gt 0 ] || { echo "GAGAL: backup tidak berisi data tabel." >&2; exit 1; }
mv "$sementara" "$TUJUAN/$nama"
trap - EXIT

# Hapus yang lebih tua dari SIMPAN_HARI, tapi selalu sisakan minimal 3 backup terbaru.
mapfile -t semua < <(ls -1t "$TUJUAN"/survey_fsm_demo-*.dump)
for berkas in "${semua[@]:3}"; do
  if [ -n "$(find "$berkas" -mtime +"$SIMPAN_HARI")" ]; then rm -f "$berkas"; fi
done

echo "Backup OK: $nama ($(numfmt --to=iec --suffix=B "$(stat -c %s "$TUJUAN/$nama")"), $jumlah tabel berisi data, total ${#semua[@]} berkas)"
