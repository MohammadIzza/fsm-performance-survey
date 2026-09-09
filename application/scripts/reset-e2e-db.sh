#!/usr/bin/env bash
# Reset database survey_fsm_e2e ke keadaan bersih (hanya seed dasar) sebelum menjalankan
# tests/e2e/*.spec.ts. Test E2E membuat periode/unit/pengguna baru bertanda waktu unik di setiap
# run, tapi menjalankannya berkali-kali tanpa reset lambat laun mengotori DB dan bisa membuat
# selector berbasis nama tampilan (bukan kode unik) jadi ambigu. Jalankan skrip ini sebelum
# `npm run test:e2e` kalau sudah pernah dijalankan sebelumnya di database yang sama.
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
source .env.e2e
set +a
npx prisma migrate deploy
npx tsx prisma/seed.ts
