import { expect, test } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { withBase, withoutBase } from './base';

// Optional isolated build transport for environments whose browser has no
// network access. The exact emitted HTML, modules, fonts and Lottie are served.
test.beforeEach(async ({ page }) => {
  const directory = process.env.TEST_STATIC_DIR;
  if (!directory) return;
  const types: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  await page.route('**/*', async (route) => {
    // Berkas di build terisolasi tersimpan tanpa awalan situs (dist/index.html, dist/assets/…).
    const pathname = withoutBase(
      decodeURIComponent(new URL(route.request().url()).pathname),
    );
    const relative = path.extname(pathname)
      ? pathname
      : `${pathname}/index.html`;
    try {
      const file = path.join(directory, relative);
      await route.fulfill({
        status: 200,
        contentType: types[path.extname(file)] || 'application/octet-stream',
        body: await readFile(file),
      });
    } catch {
      await route.fulfill({ status: 404, body: 'Not found in isolated build' });
    }
  });
});

for (const viewport of [
  { width: 1920, height: 900 },
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`FSM renders and keeps its stems attached at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.stack || e.message));
    page.on('response', (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto(withBase('/'));
    const hero = page.locator('[data-fsm-hero]');
    await expect(hero.locator('.js-letter')).toHaveCount(3);
    await expect
      .poll(
        () =>
          hero.evaluate((el) =>
            [...el.querySelectorAll('.js-flower')].every((f) => {
              const p = (f as any).player;
              return (
                p?.isLoaded && p.isPaused && p.currentFrame >= p.totalFrames - 1
              );
            }),
          ),
        { timeout: 15000 },
      )
      .toBe(true);
    const state = await hero.evaluate((el) => {
      const letters = [...el.querySelectorAll<HTMLElement>('.js-letter')];
      return letters.map((letter) => {
        const flower = letter.querySelector<HTMLElement>('.js-flower')!;
        const stem = letter.querySelector<SVGElement>('.js-stem')!;
        const d = (stem as any).pathData;
        const pivot = getComputedStyle(flower)
          .transformOrigin.split(' ')
          .map(Number.parseFloat);
        return {
          source: flower.getAttribute('data-lg-lottie'),
          gapX: Math.abs(
            stem.getBoundingClientRect().left -
              letter.getBoundingClientRect().left +
              d.x2 -
              pivot[0],
          ),
          gapY: Math.abs(letter.clientHeight - stem.clientHeight - pivot[1]),
          height: d.height,
          finite:
            Number.isFinite(d.angle) &&
            !stem.querySelector('path')!.getAttribute('d')!.includes('NaN'),
          loop: (flower as any).player.loop,
        };
      });
    });
    expect(state.map((s) => s.source)).toEqual(
      ['f', 's', 'm'].map((l) =>
        withBase(`/assets/lottie/home-hero-${l}.json`),
      ),
    );
    for (const letter of state) {
      expect(letter.gapX).toBeLessThan(1.5);
      expect(letter.gapY).toBeLessThan(1.5);
      expect(letter.height).toBeGreaterThan(40);
      expect(letter.finite).toBe(true);
      expect(letter.loop).toBe(false);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await mkdir('.local-server', { recursive: true });
    await page.screenshot({ path: `.local-server/fsm-${viewport.width}.png` });
    expect(errors).toEqual([]);
  });
}

test('FSM responds to the pointer, pauses offscreen and survives page transitions', async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.stack || e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(withBase('/'));
  await page.waitForFunction(
    () =>
      (document.querySelector('[data-fsm-hero]') as any)?.plr?.controller
        ?.wait === false,
  );
  await page.waitForTimeout(3500);
  const stem = await page.locator('.js-stem').first().boundingBox();
  for (let i = 0; i < 12; i++)
    await page.mouse.move(stem!.x - 100 + i * 25, stem!.y, { steps: 2 });
  expect(
    await page
      .locator('.js-stem')
      .evaluateAll((els) =>
        els.some((el) => Math.abs((el as any).pathData.force) > 0.1),
      ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 1700));
  await expect
    .poll(() =>
      page
        .locator('[data-fsm-hero]')
        .evaluate((el) => (el as any).plr.controller.isPaused),
    )
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect
    .poll(() =>
      page
        .locator('[data-fsm-hero]')
        .evaluate((el) => (el as any).plr.controller.isPaused),
    )
    .toBe(false);
  await page
    .locator(`a[href="${withBase('/panduan-admin')}"]`)
    .first()
    .click();
  await page.waitForURL('**/panduan-admin');
  // The legacy guide intro is outside the FSM adapter; let it finish.
  await page.waitForTimeout(4500);
  await page
    .locator(`a[href="${withBase('/')}"]`)
    .first()
    .click();
  await page.waitForURL((url) => url.pathname === withBase('/'));
  await expect(page.locator('[data-fsm-hero]')).toHaveCount(1);
  await page.waitForFunction(
    () =>
      (document.querySelector('[data-fsm-hero]') as any)?.plr?.controller
        ?.wait === false,
  );
  await expect
    .poll(() =>
      page
        .locator('[data-fsm-hero] .js-flower')
        .evaluateAll((els) =>
          els.every((el) => (el as any).player?.currentFrame > 60),
        ),
    )
    .toBe(true);
  expect(errors).toEqual([]);
});

test('FSM initializes when the first visit starts on a guide page', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(withBase('/panduan-admin'));
  await expect(page.locator('html')).toHaveClass(/is-loaded/);
  // Let the unchanged guide hero finish its own intro before leaving it.
  await page.waitForTimeout(4500);
  await page
    .locator(`a[href="${withBase('/')}"]`)
    .first()
    .click();
  await page.waitForURL((url) => url.pathname === withBase('/'));
  await expect
    .poll(
      () =>
        page
          .locator('[data-fsm-hero] .js-flower')
          .evaluateAll(
            (els) =>
              els.length === 3 &&
              els.every((el) => (el as any).player?.currentFrame > 100),
          ),
      { timeout: 15000 },
    )
    .toBe(true);
  expect(errors).toEqual([]);
});
