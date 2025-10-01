import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';

/**
 * Memangkas salinan CSS tema untuk aplikasi Next.
 *
 * Aplikasi mengimpor seluruh lembar gaya tema (±415 KB mentah), padahal sebagian besar aturannya
 * untuk bagian halaman publik — hero, slider, testimoni — yang tidak pernah dirender aplikasi. CSS
 * itu ikut diunduh setiap pengguna pada kunjungan pertama ke halaman masuk. Situs publik tetap
 * memakai lembar gaya tema utuh; hanya salinan di application/src/styles/theme yang dipangkas.
 *
 * Aturan dipertahankan bila SEMUA kelas pada salah satu selektornya dipakai kode aplikasi.
 * "Dipakai" sengaja dihitung longgar supaya tidak ada gaya yang hilang diam-diam:
 * - setiap token mirip nama kelas di berkas .ts/.tsx/.css aplikasi dianggap dipakai, termasuk yang
 *   hanya muncul di komentar;
 * - token yang berakhiran `-`, `--`, atau `__` dianggap awalan kelas dinamis
 *   (mis. `btn-plain--${variant}` menyimpan semua `btn-plain--…`);
 * - kelas keadaan yang dipasang skrip (`is-…`, `has-…`, `lg-…`) selalu dipertahankan;
 * - selektor tanpa kelas (elemen, atribut, :root) serta @font-face dan @keyframes selalu tetap.
 */
export async function pangkasCssTema({ direktoriTema, direktoriSumber }) {
  const token = new Set();
  for (const nama of await readdir(direktoriSumber, { recursive: true })) {
    if (!/\.(tsx?|css)$/.test(nama) || nama.includes('styles/theme')) continue;
    const isi = await readFile(path.join(direktoriSumber, nama), 'utf8');
    for (const t of isi.match(/[A-Za-z0-9_-]+/g) ?? []) token.add(t);
  }
  const awalan = [...token].filter((t) => t.length > 3 && /(-|__)$/.test(t));
  const dipakai = (kelas) =>
    token.has(kelas) ||
    /^(is|has|lg)-/.test(kelas) ||
    awalan.some((a) => kelas.startsWith(a));

  const pangkas = () => ({
    postcssPlugin: 'pangkas-css-tema',
    OnceExit(root) {
      root.walkRules((rule) => {
        if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
        const tetap = rule.selectors.filter((selektor) => {
          const kelas = selektor.match(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g) ?? [];
          return kelas.every((k) => dipakai(k.slice(1)));
        });
        if (tetap.length === 0) rule.remove();
        else if (tetap.length !== rule.selectors.length) rule.selectors = tetap;
      });
      root.walkAtRules((at) => {
        if (/^(media|supports|container|layer)$/i.test(at.name) && (!at.nodes || at.nodes.length === 0)) {
          at.remove();
        }
      });
    },
  });

  return async (css) => (await postcss([pangkas()]).process(css, { from: undefined })).css;
}
