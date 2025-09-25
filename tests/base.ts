import { BASE_PATH } from '../base-path.mjs';

// Situs dibangun dengan `base` dari base-path.mjs, jadi setiap halaman, aset, dan tautan hidup di
// bawah awalan itu. Playwright menyelesaikan goto('/x') terhadap origin, bukan terhadap baseURL
// ber-path, sehingga awalannya diberi di sini — sama dengan withBase() di src/utils/url.ts.
export function withBase(path: string): string {
  return path === '/' ? BASE_PATH || '/' : `${BASE_PATH}${path}`;
}

export function withoutBase(pathname: string): string {
  if (
    BASE_PATH &&
    (pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`))
  )
    return pathname.slice(BASE_PATH.length) || '/';
  return pathname;
}
