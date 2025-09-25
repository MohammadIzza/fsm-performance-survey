import { expect, test } from '@playwright/test';
import { withBase } from './base';

const routes = [
  '/',
  '/alur-penilaian',
  '/panduan-penilai',
  '/panduan-pimpinan',
  '/panduan-admin',
  '/kebijakan-data',
  '/kebijakan-privasi',
];

// Diagnostic sweep: the theme runtime must boot on every route, bind its
// controllers, and reveal content as the page scrolls.
for (const route of routes) {
  test(`${route} runs the theme runtime`, async ({ page }) => {
    const errors: string[] = [];
    const failed: string[] = [];
    page.on('pageerror', (e) =>
      errors.push(`${route} pageerror: ${e.message}`),
    );
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`${route} console: ${m.text()}`);
    });
    page.on('response', (r) => {
      // 304 is a cache hit, not a failure.
      if (!r.ok() && r.status() !== 304 && !r.url().startsWith('data:'))
        failed.push(`${route} ${r.status()} ${r.url()}`);
    });

    await page.goto(withBase(route));
    await page.waitForFunction(() => (window as any).luge !== undefined);
    await page.evaluate(async () => {
      // Walk the page so IntersectionObserver-driven reveals fire.
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
    });
    await page.waitForTimeout(1200);

    const state = await page.evaluate(() => ({
      controllers: Object.keys((window as any).plr?.controllers ?? {}).length,
      bound: [...document.querySelectorAll('[data-plr-component]')].filter(
        (el) => (el as any).plr,
      ).length,
      components: document.querySelectorAll('[data-plr-component]').length,
      revealed: document.querySelectorAll('[data-lg-reveal].is-in').length,
      reveals: document.querySelectorAll('[data-lg-reveal]').length,
      splitWords: document.querySelectorAll(
        '[data-lg-reveal] .word, [data-lg-reveal] .char',
      ).length,
      lottieSvg: document.querySelectorAll('[data-lg-lottie] svg').length,
      lottie: document.querySelectorAll('[data-lg-lottie]').length,
      html: document.documentElement.className,
    }));

    console.log(route, JSON.stringify(state));
    expect(errors, errors.join('\n')).toEqual([]);
    expect(failed, failed.join('\n')).toEqual([]);
    expect(state.controllers).toBeGreaterThan(0);
    // Everything tagged for reveal should have been revealed after a full pass.
    expect(state.revealed).toBe(state.reveals);
  });
}
