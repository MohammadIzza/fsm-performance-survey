import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { withBase, withoutBase } from './base';

const routes = [
  '/',
  '/alur-penilaian',
  '/panduan-penilai',
  '/panduan-pimpinan',
  '/panduan-admin',
  '/kebijakan-data',
  '/kebijakan-privasi',
];

// Routes this Astro static site links to but does not itself serve: the
// companion Next.js application (`application/`, see scripts/prepare-application.mjs)
// owns them at runtime. A 404 here against the isolated Astro build is expected.
// Routes owned by the Next app, not by this static build: the preview server here cannot
// serve them, so their links are checked for shape only, not fetched.
const appRoutes = new Set(['/login', '/hasil']);

for (const route of routes) {
  test(`${route} renders content, local assets, and valid links`, async ({
    page,
    request,
  }) => {
    const errors: string[] = [];
    const failedAssets: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (
        response.url().includes('/assets/') &&
        !response.ok() &&
        response.status() !== 304
      )
        failedAssets.push(response.url());
    });
    const response = await page.goto(withBase(route));
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('#menu-main-menu')).toBeVisible();
    await page.locator('img').evaluateAll((images) =>
      images.forEach((image) => {
        image.loading = 'eager';
      }),
    );
    // Gambar yang dimuat pemuat malas tema (data-plr-loading + data-src) baru mendapat src saat
    // seksinya masuk layar; berkasnya diperiksa langsung, bukan ditunggu termuat.
    const gambarMalas = await page
      .locator('img[data-plr-loading][data-src]:not([src])')
      .evaluateAll((images) =>
        images.map((image) => image.getAttribute('data-src')!),
      );
    for (const src of gambarMalas) {
      expect((await request.get(src)).status(), src).toBe(200);
    }
    await expect
      .poll(() =>
        page
          .locator('img:not([data-plr-loading]:not([src]))')
          .evaluateAll((images) =>
            images
              .filter((image) => !image.complete || image.naturalWidth === 0)
              .map((image) => image.src),
          ),
      )
      .toEqual([]);
    const targets = await page
      .locator('a[href^="/"]')
      .evaluateAll((anchors) => [
        ...new Set(
          anchors.map((anchor) => (anchor as HTMLAnchorElement).pathname),
        ),
      ]);
    for (const target of targets) {
      if (appRoutes.has(withoutBase(target))) continue;
      expect((await request.get(target)).status(), target).toBe(200);
    }
    expect(errors).toEqual([]);
    expect(failedAssets).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test('the theme runtime boots and reveals content on scroll', async ({
  page,
}) => {
  await page.goto(withBase('/'));
  await page.waitForFunction(() => (window as any).luge !== undefined);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
  });
  await page.waitForTimeout(1000);

  const state = await page.evaluate(() => ({
    reveals: document.querySelectorAll('[data-lg-reveal]').length,
    revealed: document.querySelectorAll('[data-lg-reveal].is-in').length,
    // headings/letters reveals are split into words and chars by GSAP.
    split: document.querySelectorAll(
      '[data-lg-reveal] .word, [data-lg-reveal] .char',
    ).length,
    lottie: document.querySelectorAll('[data-lg-lottie]').length,
    lottieRendered: document.querySelectorAll('[data-lg-lottie] svg').length,
  }));

  expect(state.reveals).toBeGreaterThan(0);
  expect(state.revealed).toBe(state.reveals);
  expect(state.split).toBeGreaterThan(0);
  expect(state.lottieRendered).toBe(state.lottie);
  await expect(page.locator('html')).toHaveClass(/is-loaded/);
});

test('course cards link to the real login page, not a fake application form', async ({
  page,
}) => {
  await page.goto(withBase('/'));
  await page.waitForFunction(() => (window as any).luge !== undefined);

  const card = page
    .locator(
      'a.sb__link[data-option="Dies FSM UNDIP 2026 • 9 kategori • Periode berjalan"]',
    )
    .first();
  await expect(card).toHaveAttribute('href', withBase('/login'));
  await card.click();
  await expect(page).toHaveURL(/\/login$/);
});

test('FAQ opens on click and the content slider changes visible content', async ({
  page,
}) => {
  await page.goto(withBase('/alur-penilaian'));
  await page.waitForFunction(() => (window as any).luge !== undefined);
  const question = page.locator('.s-faq .sb-question').filter({
    hasText: 'Apa yang terjadi jika periode ditutup saat saya belum mengirim?',
  });
  await question.click();
  await expect(question).toHaveClass(/is-opened/);
  await expect(question.locator('.sb__answer')).toBeVisible();

  await page.goto(withBase('/'));
  await page.waitForFunction(() => (window as any).luge !== undefined);
  const slider = page.locator('.b-slider-content').first();
  await slider.locator('.js-page[data-page="1"]').click();
  await expect(slider.locator('.js-slide').nth(1)).toHaveClass(/is-active/);
  await expect(slider.locator('.js-slide').nth(0)).not.toHaveClass(/is-active/);
});

test('mobile navigation and screenshots', async ({ page }) => {
  // Two viewports, two reloads and two screenshots of a page that boots GSAP,
  // Lenis and a dozen lottie animations does not fit the default 30s budget.
  test.setTimeout(90_000);
  await mkdir('.local-server', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(withBase('/'));
  await page.waitForFunction(() => (window as any).luge !== undefined);
  await expect(
    page.locator('.b-hero-home [data-lg-lottie] svg').first(),
  ).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '.local-server/home-desktop.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForFunction(() => (window as any).luge !== undefined);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '.local-server/home-mobile.png' });

  await page.locator('.js-nav-toggle').click();
  await expect(page.locator('body')).toHaveClass(/is-nav-opened/);
  // A top-level entry: the two guide links sit in a submenu whose parent item
  // covers them until it is tapped, which is the theme's own mobile behaviour.
  await page
    .locator(`#menu-main-menu a[href="${withBase('/panduan-admin')}"]`)
    .click();
  await expect(page).toHaveURL(/\/panduan-admin$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '.local-server/admin-mobile.png' });
});
