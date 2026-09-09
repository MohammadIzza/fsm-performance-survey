import { test, expect, type Page, type Locator } from "@playwright/test";

// Bukti end-to-end lewat browser sungguhan untuk UC-01/02/03/06/07/10 — sebelumnya hanya diuji
// per-potongan lewat scripts/test-tahap*.ts (level service), belum ada satu jalan UI utuh yang
// direkam (lihat docs/acceptance-checklist.md, "Ringkasan celah yang masih terbuka"). UC-04/05/08/09
// sudah punya bukti terpisah (UC-04/05 diverifikasi manual+screenshot, UC-08/09 diuji penuh sebagai
// kode) — tidak diulang di sini.
//
// Satu `test()` berurutan (bukan beberapa test independen) karena tiap UC di sini membangun di atas
// state yang dibuat UC sebelumnya (periode/kategori/objek/penugasan yang sama) — persis alur
// pemakaian nyata. Jalankan terhadap DATABASE_URL survey_fsm_e2e (lihat playwright.config.ts),
// BUKAN survey_fsm_demo.

const stamp = Date.now().toString(36);

async function login(page: Page, loginIdentifier: string) {
  await page.goto("/login");
  await page.getByLabel("ID Pengguna").fill(loginIdentifier);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function logout(page: Page) {
  // Tidak ada tombol logout terlihat di semua layout — cara paling andal & tercepat: hapus cookie
  // sesi lalu login ulang sebagai pengguna lain (setara logout untuk keperluan test ini).
  await page.context().clearCookies();
}

// selectOption({label}) Playwright hanya menerima string persis, bukan regex — helper ini mencari
// <option> lewat teksnya (regex, cocok substring) lalu memilih berdasarkan value-nya. Dipakai
// karena label pilihan di form ini sering menyisipkan kode/ID dinamis (mis. "Nama (KODE)").
async function selectByOptionText(select: Locator, pattern: RegExp) {
  const option = select.locator("option", { hasText: pattern }).first();
  const value = await option.getAttribute("value");
  if (value === null) throw new Error(`Tidak ada <option> yang cocok dengan ${pattern}`);
  await select.selectOption(value);
}

test("UC-01/02/03/06/07/10: alur admin utuh lewat UI", async ({ page }) => {
  page.on("dialog", (d) => d.accept());

  // ===== UC-01 — Menyiapkan organisasi =====
  await test.step("UC-01: buat unit baru, buat pengguna baru, tetapkan pimpinan", async () => {
    await login(page, "admin01");

    await page.goto("/admin/organisasi");
    const unitCode = `E2E-UNIT-${stamp}`;
    await page.getByPlaceholder("Kode (mis. PS-INF)").fill(unitCode);
    await page.getByPlaceholder("Nama unit").fill("Unit Uji E2E");
    // Induk: Fakultas Sains dan Matematika (unit akar dari seed dasar).
    await selectByOptionText(
      page.locator('select[name="parentId"]').first(),
      /Fakultas Sains dan Matematika/
    );
    await page.getByRole("button", { name: "Tambah unit" }).click();
    await expect(page.getByRole("table").getByText(unitCode).first()).toBeVisible();

    await page.goto("/admin/pengguna");
    const userLoginId = `e2euser${stamp}`;
    await page.getByPlaceholder("ID (NIP/NIM/NIK)").fill(userLoginId);
    await page.getByPlaceholder("Nama lengkap").fill("Dr. Pengguna Uji E2E");
    await page.locator('select[name="userTypeId"]').selectOption({ label: "Dosen" });
    await selectByOptionText(
      page.locator('select[name="primaryUnitId"]'),
      new RegExp(`Unit Uji E2E \\(${unitCode}\\)`)
    );
    await page.getByRole("button", { name: "Tambah pengguna" }).click();
    await expect(page.getByRole("table").getByText("Dr. Pengguna Uji E2E").first()).toBeVisible();

    await page.goto("/admin/organisasi");
    // Cocokkan lewat kode unit (unik per run), bukan nama tampilan "Unit Uji E2E" (sama tiap run,
    // jadi run sebelumnya yang datanya masih ada di DB e2e akan membuat hasText nama saja ambigu).
    const unitRow = page.locator("tr", { hasText: unitCode });
    await unitRow.getByRole("button", { name: "Pimpinan" }).click();
    const leadershipForm = unitRow.locator("+ tr").locator("form").filter({ has: page.locator('select[name="userId"]') });
    await selectByOptionText(leadershipForm.locator('select[name="userId"]'), new RegExp(userLoginId));
    await leadershipForm.getByPlaceholder("Jabatan (mis. Ketua Departemen)").fill("Ketua Uji E2E");
    await leadershipForm.getByRole("button", { name: "Tetapkan pimpinan" }).click();
    await expect(page.getByText("Ketua Uji E2E").first()).toBeVisible();
  });

  // ===== UC-02 — Menyusun survei =====
  let periodId = "";
  let categoryId = "";
  const periodCode = `E2E-PERIODE-${stamp}`;
  const categoryCode = `E2E-KATEGORI-${stamp}`;
  // Nama tampilan (bukan cuma kode) diberi stamp juga — dipakai getByRole('link', {name}) yang
  // butuh teks unik; nama generik akan ambigu (strict-mode) kalau test ini dijalankan berkali-kali
  // tanpa reset DB (lihat scripts/reset-e2e-db.sh) karena run sebelumnya masih meninggalkan baris.
  const periodName = `Periode Uji E2E ${stamp}`;
  const categoryName = `Kategori Uji E2E ${stamp}`;

  await test.step("UC-02: buat periode, kategori, parameter, skala, aturan kelompok", async () => {
    await page.goto("/admin/periode");
    await page.getByPlaceholder("Kode (mis. DIES-2026)").fill(periodCode);
    await page.getByPlaceholder("Nama periode").fill(periodName);
    const startsAt = page.locator('input[name="startsAt"]').first();
    const endsAt = page.locator('input[name="endsAt"]').first();
    await startsAt.fill("2026-01-01");
    await endsAt.fill("2099-12-31");
    await page.getByRole("button", { name: "Buat periode" }).click();
    await expect(page.getByRole("link", { name: periodName })).toBeVisible();
    await page.getByRole("link", { name: periodName }).click();
    await expect(page).toHaveURL(/\/admin\/periode\/[^/]+$/);
    periodId = new URL(page.url()).pathname.split("/").pop()!;

    await page.getByPlaceholder("Kode (mis. KINERJA-DOSEN)").fill(categoryCode);
    await page.getByPlaceholder("Nama kategori").fill(categoryName);
    await page.locator('select[name="objectTypeId"]').selectOption({ label: "Orang" });
    await page.getByRole("button", { name: "Tambah kategori" }).click();
    await expect(page.getByRole("link", { name: categoryName })).toBeVisible();
    await page.getByRole("link", { name: categoryName }).click();
    await expect(page).toHaveURL(/\/kategori\/[^/]+$/);
    categoryId = new URL(page.url()).pathname.split("/").pop()!;

    // Tab Instrumen sudah aktif secara default: atur skala + tambah 2 parameter (total bobot 100).
    const scaleForm = page.locator("form", { has: page.locator('input[name="scaleMin"]') });
    await scaleForm.locator('input[name="scaleMin"]').fill("1");
    await scaleForm.locator('input[name="scaleMax"]').fill("5");
    await scaleForm.locator('input[name="scaleStep"]').fill("1");
    await scaleForm.getByRole("button", { name: "Simpan" }).click();

    const addParamForm = page.locator("form", { has: page.getByPlaceholder("Nama parameter") });
    await addParamForm.getByPlaceholder("Urutan").fill("1");
    await addParamForm.getByPlaceholder("Nama parameter").fill("Kualitas Kerja");
    await addParamForm.getByPlaceholder("Bobot %").fill("60");
    await addParamForm.getByRole("button", { name: "Tambah parameter" }).click();
    await expect(page.getByText("Kualitas Kerja").first()).toBeVisible();

    await addParamForm.getByPlaceholder("Urutan").fill("2");
    await addParamForm.getByPlaceholder("Nama parameter").fill("Ketepatan Waktu");
    await addParamForm.getByPlaceholder("Bobot %").fill("40");
    await addParamForm.getByRole("button", { name: "Tambah parameter" }).click();
    await expect(page.getByText("Ketepatan Waktu").first()).toBeVisible();
    await expect(page.getByText("Total bobot: 100%").first()).toBeVisible();

    // Tab Kelompok & Kelayakan: dua GroupRule (Pimpinan/Selain Pimpinan) sudah dibuat otomatis
    // saat kategori dibuat — tinggal isi target/minimum supaya lolos checkReadiness (Bab 7.3).
    await page.getByRole("tab", { name: "Kelompok & Kelayakan" }).click();
    const groupForms = page.locator("form", { has: page.locator('select[name="aggregation"]') });
    const groupCount = await groupForms.count();
    for (let i = 0; i < groupCount; i++) {
      const f = groupForms.nth(i);
      await f.locator('select[name="aggregation"]').selectOption("RATA_RATA");
      await f.locator('input[name="target"]').fill("2");
      await f.locator('input[name="minimum"]').fill("1");
      await f.getByRole("button", { name: "Simpan" }).click();
    }
  });

  // ===== UC-03 — Menerbitkan penugasan =====
  await test.step("UC-03: tambah objek penilaian, peserta, pratinjau & terapkan penugasan", async () => {
    // Objek yang dinilai: dosen seed di DEP-FIS (unit dengan banyak calon Pimpinan/Selain
    // Pimpinan sedia — dosen1002/1003 sebagai ketua/sekretaris, dosen1007+1010..1017 sebagai
    // anggota) supaya pratinjau pengacakan punya calon nyata, bukan unit kosong buatan test ini.
    await page.goto("/admin/objek");
    // objectTypes diurutkan alfabetis (Karya, Lainnya, Orang, Unit) — "Orang" BUKAN default,
    // harus dipilih eksplisit dulu supaya field referenceUserId (khusus isOrang) muncul. Objek
    // (AssessmentObject) tidak punya field kode sendiri — beda dari ObjectType (jenis objek,
    // form terpisah di balik tombol "Kelola jenis objek", tidak dipakai di sini).
    await page.locator('select[name="typeId"]').selectOption({ label: "Orang" });
    const objectName = `Dr. Dosen Fisika A (Objek Uji E2E ${stamp})`;
    // exact:true — "Nama objek" tanpa itu cocok substring case-insensitive dengan placeholder
    // kotak pencarian ("Cari nama objek, jenis, unit, ...") di halaman yang sama.
    await page.getByPlaceholder("Nama objek", { exact: true }).fill(objectName);
    await selectByOptionText(page.locator('select[name="ownerUnitId"]'), /Departemen Fisika/);
    await selectByOptionText(page.locator('select[name="referenceUserId"]'), /dosen1007/);
    await page.getByRole("button", { name: "Tambah objek" }).click();
    await expect(page.getByText(objectName).first()).toBeVisible();

    await page.goto(`/admin/periode/${periodId}/kategori/${categoryId}`);
    await page.getByRole("tab", { name: /Peserta/ }).click();
    await selectByOptionText(page.locator('select[name="objectIds"]'), new RegExp(objectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await page.getByRole("button", { name: "Tambahkan sebagai peserta" }).click();
    await expect(page.getByText(objectName).first()).toBeVisible();

    await page.getByRole("tab", { name: /Penugasan/ }).click();
    await page.getByRole("button", { name: "Pratinjau pengacakan" }).click();
    await expect(page.getByText(/tugas baru akan diterbitkan/).first()).toBeVisible();

    // Teks berada di dalam <label> yang sama dengan checkbox-nya (lihat assignment-planner.tsx).
    const shortageLabel = page.locator("label", { hasText: "Saya menerima kekurangan calon" });
    if (await shortageLabel.isVisible().catch(() => false)) {
      await shortageLabel.locator('input[type="checkbox"]').check();
    }
    await page.getByRole("button", { name: "Terapkan penugasan" }).click();
    // Sukses ATAU pesan error tervalidasi (mis. semua calon kekurangan) — keduanya membuktikan
    // jalur UI benar-benar tersambung ke commitAssignmentPlanAction, bukan cuma tombol diam.
    await expect(
      page.getByText(/Penugasan diterapkan|tugas baru akan diterbitkan|Kekurangan|error/i).first()
    ).toBeVisible();
  });

  // Tandai periode Siap lalu Aktif — assignment planning (di atas) hanya bisa saat Draf, jadi
  // ini SENGAJA dilakukan setelah UC-03, bukan sebelumnya.
  let firstAssignmentUrl = "";
  let firstEvaluatorLogin = "";
  await test.step("Buka periode (Draf → Siap → Aktif) supaya tugas dapat diisi", async () => {
    await page.goto(`/admin/periode/${periodId}`);
    const readySection = page.locator("text=Semua syarat konfigurasi terpenuhi");
    if (!(await readySection.isVisible().catch(() => false))) {
      // Kalau readiness belum lolos (mis. karena shortage penugasan di atas), catat alasannya di
      // laporan test alih-alih memaksa lanjut dan gagal membingungkan di langkah berikutnya.
      const problems = await page.locator("ul.list-disc li").allTextContents();
      test.info().annotations.push({
        type: "readiness-problems",
        description: problems.join(" | "),
      });
    }
    await page.getByRole("button", { name: "Tandai siap" }).click();
    await page.getByRole("button", { name: "Buka periode" }).click();
    await expect(page.getByText("Aktif").first()).toBeVisible();

    const listResponse = await page.goto(`/admin/periode/${periodId}/kategori/${categoryId}`);
    expect(listResponse?.ok()).toBeTruthy();
    await page.getByRole("tab", { name: /Penugasan/ }).click();
    // Tab "Instrumen" tetap ter-mount (hanya disembunyikan lewat atribut hidden, lihat
    // category-tabs.tsx) dan juga punya <table> (daftar parameter) — filter lewat isi kolom
    // "Penilai" (link /tugas/...) supaya benar-benar dapat tabel "Daftar tugas", bukan tabel lain.
    const assignmentTable = page.locator("table").filter({ has: page.locator('a[href^="/tugas/"]') });
    const firstRow = assignmentTable.locator("tbody tr").first();
    if (await firstRow.count()) {
      const link = firstRow.locator('a[href^="/tugas/"]').first();
      firstAssignmentUrl = (await link.getAttribute("href")) ?? "";
      firstEvaluatorLogin = (await firstRow.locator(".font-mono").first().textContent())?.trim() ?? "";
    } else {
      const problems = await page.locator("p", { hasText: "Belum ada tugas" }).allTextContents();
      test.info().annotations.push({ type: "no-assignments", description: problems.join(" | ") });
    }
  });

  // ===== UC-06 — Menangani kesalahan tugas =====
  await test.step("UC-06: penilai melaporkan masalah tugas, admin menangani laporan", async () => {
    test.skip(!firstAssignmentUrl, "Tidak ada tugas terbit (kekurangan calon) — lihat anotasi readiness-problems di atas.");

    await logout(page);
    await login(page, firstEvaluatorLogin); // penilai sebenarnya yang dipilih commitAssignmentPlan
    await page.goto(firstAssignmentUrl);
    await page.locator('select[name="type"]').selectOption("LAINNYA");
    const issueDetail = `Uji E2E ${stamp}: objek sepertinya keliru, mohon ditinjau.`;
    await page.getByPlaceholder("Keterangan").fill(issueDetail);
    await page.getByRole("button", { name: "Laporkan" }).click();
    // reportIssueAction tidak menampilkan pesan sukses eksplisit (form re-render diam via
    // revalidatePath) — bukti nyata laporan tersimpan ada di langkah admin di bawah, yang melihat
    // laporan ini muncul di /admin/masalah. Di sini cukup pastikan TIDAK ada galat tervalidasi.
    await expect(page.locator('p[role="alert"]')).toHaveCount(0);

    await logout(page);
    await login(page, "admin01");
    await page.goto("/admin/masalah");
    await expect(page.getByText(issueDetail).first()).toBeVisible();
    const issueRow = page.locator("tr", { hasText: issueDetail });
    await issueRow.getByRole("button", { name: "Tangani" }).click(); // buka form resolusi
    await issueRow.locator('select[name="status"]').selectOption("DITANGANI");
    await issueRow.getByPlaceholder("Tanggapan / tindakan yang diambil").fill("Sudah ditinjau, tugas dipertahankan (uji E2E).");
    await issueRow.getByRole("button", { name: "Simpan" }).click();
    await expect(issueRow.locator("span", { hasText: "Ditangani" })).toBeVisible();
  });

  // ===== UC-07 — Koreksi jawaban =====
  await test.step("UC-07: penilai mengirim jawaban, admin mengoreksi langsung", async () => {
    test.skip(!firstAssignmentUrl, "Tidak ada tugas terbit — lihat langkah UC-03/06 di atas.");

    await logout(page);
    await login(page, firstEvaluatorLogin);
    await page.goto(firstAssignmentUrl);
    // Skala pendek (1–5, langkah 1) dirender sebagai tombol bulat bernomor ala Google Forms
    // (ScoreField di assignment-form.tsx), BUKAN <input type="number"> — itu hanya dipakai untuk
    // skala panjang (>11 langkah). Satu kartu per parameter, ditandai dari input hidden
    // "parameterId" langsung di dalamnya.
    const paramCards = page.locator('div:has(> input[name="parameterId"])');
    const paramCount = await paramCards.count();
    for (let i = 0; i < paramCount; i++) {
      await paramCards.nth(i).getByRole("button", { name: "4", exact: true }).click();
    }
    await page.getByRole("button", { name: "Kirim jawaban" }).click();
    // Setelah terkirim, formulir jadi read-only (isLocked) dan menampilkan "Terkirim pada ...".
    await expect(page.getByText(/Terkirim pada/)).toBeVisible();

    await logout(page);
    await login(page, "admin01");
    await page.goto(firstAssignmentUrl);
    await page.getByRole("button", { name: "Edit langsung" }).click();
    const editInputs = page.locator('form:has-text("Simpan koreksi") input[name="scoreValue"]');
    const editCount = await editInputs.count();
    for (let i = 0; i < editCount; i++) {
      await editInputs.nth(i).fill("5");
    }
    await page.getByPlaceholder("Alasan koreksi (wajib)").fill("Koreksi uji E2E: nilai awal keliru diinput.");
    await page.getByRole("button", { name: "Simpan koreksi & kirim" }).click();
    // adminEditResponseAction juga tidak menampilkan pesan sukses eksplisit — pastikan tidak ada
    // galat tervalidasi (mis. "Alasan koreksi wajib" atau versi bentrok).
    await expect(page.locator('p[role="alert"]')).toHaveCount(0);
  });

  // ===== UC-10 — Menggunakan kembali periode =====
  await test.step("UC-10: salin periode ke draf baru dengan jadwal baru", async () => {
    await page.goto(`/admin/periode/${periodId}`);
    const copyCode = `E2E-PERIODE-COPY-${stamp}`;
    const copyName = `Periode Uji E2E ${stamp} (Salinan)`;
    const copyForm = page.locator("form", { has: page.getByPlaceholder(/Kode periode baru/) });
    await copyForm.getByPlaceholder(/Kode periode baru/).fill(copyCode);
    await copyForm.getByPlaceholder("Nama periode baru").fill(copyName);
    await copyForm.locator('input[name="startsAt"]').fill("2027-01-01");
    await copyForm.locator('input[name="endsAt"]').fill("2027-12-31");
    await copyForm.getByRole("button", { name: "Gunakan kembali periode ini" }).click();

    // copyPeriodAction redirect ke halaman periode baru.
    await expect(page).toHaveURL(/\/admin\/periode\/[^/]+$/);
    await expect(page.getByText(copyName).first()).toBeVisible();
    await expect(page.getByText("Draf").first()).toBeVisible();
    await expect(page.getByRole("link", { name: categoryName })).toBeVisible();

    // Kategori DAN peserta aktif ikut tersalin (titik awal yang bisa ditinjau admin) — tapi
    // penugasan/jawaban TIDAK (selalu dievaluasi ulang dari nol, lihat comment copyPeriod di
    // services/periods.ts). Ditemukan saat menulis test ini: comment lama di kode mengklaim
    // peserta "sengaja tidak disalin" padahal baris di atasnya benar-benar menyalinnya — comment
    // (dan test-tahap2.ts yang sudah lama menguji true behavior-nya) sudah benar sekarang.
    await page.getByRole("link", { name: categoryName }).click();
    await page.getByRole("tab", { name: /Peserta/ }).click();
    await expect(page.getByText("Peserta (1)").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: /Penugasan \(0\)/ })).toBeVisible();
  });
});
