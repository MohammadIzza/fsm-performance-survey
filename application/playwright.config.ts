import { defineConfig, devices } from "@playwright/test";

// Test end-to-end untuk UC-01/02/03/06/07/10 (lihat docs/acceptance-checklist.md).
//
// SENGAJA berjalan lewat browser sungguhan terhadap instance Next.js nyata (bukan mock), memakai
// database `survey_fsm_e2e` yang terpisah dari `survey_fsm_demo` (dipakai demo publik) — supaya
// data yang dibuat/diubah test ini (periode, kategori, penugasan, jawaban) tidak pernah bocor ke
// demo publik. Server TIDAK di-start otomatis oleh config ini (lihat catatan di README bagian
// "Menjalankan test E2E") karena penyiapan database (migrate + seed) harus terjadi sebelum server
// dimulai, dan mengelolanya lewat webServer di sini akan membuat urutan itu sulit dijamin.
//
// `channel: 'chrome'` (dipakai tests/site.spec.ts di situs Astro) TIDAK dipakai di sini — Chrome
// sistem gagal sandbox saat dijalankan sebagai root di LXC ini. Pakai Chromium bawaan Playwright
// (sudah terinstal untuk user `restart`, lihat ~/.cache/ms-playwright) dan jalankan skrip ini
// sebagai user `restart`, bukan root.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3931",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
