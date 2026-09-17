#!/bin/bash
# Penjaga database demo: memastikan Postgres bukan hanya "active" di systemd, tetapi benar-benar
# menjawab kueri. Galat seperti hilangnya shared memory (lihat catatan RemoveIPC di
# docs/deployment.md) membuat proses tetap hidup sementara setiap kueri gagal — systemd tidak
# melihatnya sebagai kegagalan, jadi Restart=on-failure tidak pernah terpicu.
set -u

UNIT=${UNIT:-survey-fsm-postgres.service}
ENV_FILE=${ENV_FILE:-/home/restart/survey-fsm/application/.env}
PSQL=/usr/lib/postgresql/16/bin/psql

# Dihentikan dengan sengaja (pemeliharaan) — jangan dinyalakan paksa.
systemctl is-active --quiet "$UNIT" || exit 0

# DATABASE_URL tanpa tanda kutip dan tanpa parameter Prisma (?schema=...) yang tidak dikenal psql.
URL=$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"'"'" | sed 's/?.*$//')
[ -n "$URL" ] || { echo "DATABASE_URL tidak ditemukan di $ENV_FILE" >&2; exit 1; }

cek() { "$PSQL" "$URL" -tAc 'select 1' >/dev/null 2>&1; }

cek && exit 0
sleep 10
cek && exit 0

echo "Database tidak menjawab kueri dua kali berturut-turut — memulai ulang $UNIT."
systemctl restart "$UNIT"
sleep 3
if cek; then
  echo "Pulih: database kembali menjawab kueri."
else
  echo "Masih gagal setelah restart — perlu diperiksa manual (journalctl -u $UNIT)." >&2
  exit 1
fi
