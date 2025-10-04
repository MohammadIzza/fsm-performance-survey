import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Kunjungan pertama ke halaman publik memuat berkas dalam tiga gelombang: skrip tema di akhir <body>,
// lalu potongan (chunk) komponen yang baru diketahui main.js setelah ia berjalan, lalu JSON Lottie
// yang baru diminta komponen setelah potongannya berjalan. Totalnya 48 permintaan, dan gateway UNDIP
// (HTTP/1.1) hanya melayani sekitar enam sekaligus — sisanya mengantre.
//
// Integrasi ini, sesudah build:
// 1. Menggabungkan skrip tema (gsap, luge, lottie), semua potongan komponen yang dipakai halaman mana
//    pun, dan main.js menjadi satu berkas ber-hash. Potongan webpack mendaftarkan diri ke
//    self.webpackChunknod; yang sudah terdaftar sebelum main.js berjalan dipakai langsung tanpa
//    diunduh — cara yang sama dengan tiga pustaka vendor yang memang dimuat sebelum main.js. Delapan
//    belas permintaan jadi satu. Potongan yang besar dan jarang (npm-matter-js) tetap dimuat sendiri.
// 2. Menulis <link rel="preload"> di <head> untuk berkas gabungan itu, font, dan animasi Lottie yang
//    ditandai data-lg-lottie-required, supaya semuanya mulai diunduh sejak HTML diterima.
// Peta potongan diambil dari main.js sendiri, jadi selalu cocok dengan build tema yang dipakai.

function petaPotongan(main) {
  // i.u=e=>"js/"+(925===e?"js/npm-matter-js":e)+"-"+{272:"6ca…",…}[e]+".js"
  const u = main.match(
    /"js\/"\+\((\d+)===e\?"([^"]+)":e\)\+"-"\+(\{[^}]*\})\[e\]\+"\.js"/,
  );
  if (!u)
    throw new Error(
      'preload-tema: peta nama potongan tidak ditemukan di main.js',
    );
  const hash = Object.fromEntries(
    [...u[3].matchAll(/(\d+):"([0-9a-f]+)"/g)].map((m) => [m[1], m[2]]),
  );
  const berkas = (id) => `js/${id === u[1] ? u[2] : id}-${hash[id]}.js`;
  const komponen = {};
  for (const m of main.matchAll(
    /"\.\/(components|layouts)\/([\w-]+)\/\2":\[([\d,e]+)\]/g,
  )) {
    const ids = m[3].split(',').map((x) => String(Number(x)));
    komponen[`${m[1]}/${m[2]}`] = ids.filter((id) => hash[id]).map(berkas);
  }
  return komponen;
}

function bundelHalaman(html) {
  const m = html.match(/window\.plr=Object\.assign\((\{.*?\}),\{transitions:/s);
  return m ? JSON.parse(m[1]) : null;
}

async function semuaHtml(dir) {
  const hasil = [];
  for (const nama of await readdir(dir, { recursive: true })) {
    if (nama.endsWith('.html')) hasil.push(path.join(dir, nama));
  }
  return hasil;
}

export default function preloadTema({ base }) {
  const awalan = base.replace(/\/+$/, '');
  return {
    name: 'preload-tema',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const jsDir = path.join(root, 'assets/js');
        const main = await readFile(path.join(jsDir, 'main.js'), 'utf8');
        const peta = petaPotongan(main);
        const halaman = [];
        for (const berkas of await semuaHtml(root)) {
          const html = await readFile(berkas, 'utf8');
          const plr = bundelHalaman(html);
          if (plr) halaman.push({ berkas, html, plr });
        }

        // Potongan yang dimuat tema di halaman mana pun (js aktif). Yang lazy ikut digabung: isinya
        // kecil, dan tanpa itu ia tetap jadi permintaan terpisah saat bagiannya digulir ke layar.
        const potongan = new Set();
        for (const { html, plr } of halaman) {
          const dipakai = [
            ...[...html.matchAll(/data-plr-component="([\w-]+)"/g)].map((m) => [
              'components',
              m[1],
            ]),
            ...[...html.matchAll(/data-plr-layout="([\w-]+)"/g)].map((m) => [
              'layouts',
              m[1],
            ]),
          ];
          for (const [jenis, nama] of dipakai) {
            if (!plr.bundles?.[jenis]?.[nama]?.js) continue;
            for (const js of peta[`${jenis}/${nama}`] ?? []) {
              if (!js.includes('npm-')) potongan.add(js);
            }
          }
        }

        const skripTema = [
          ...halaman[0].html.matchAll(
            /<script src="([^"]*\/assets\/js\/[^"?]+)(?:\?[^"]*)?"><\/script>/g,
          ),
        ].map((m) => path.basename(m[1]));
        const vendor = skripTema.filter((nama) => nama !== 'main.js');
        const urutan = [...vendor, ...[...potongan].sort(), 'main.js'];
        const isi = [];
        for (const nama of urutan) {
          isi.push(
            `/* ${nama} */\n${(await readFile(path.join(root, 'assets', nama.includes('/') ? nama : `js/${nama}`), 'utf8')).trim()}\n`,
          );
        }
        const gabungan = isi.join(';\n');
        const hash = createHash('sha256')
          .update(gabungan)
          .digest('hex')
          .slice(0, 20);
        // Satu folder dengan main.js: publicPath webpack dihitung dari alamat skrip yang berjalan.
        const namaGabungan = `tema-${hash}.js`;
        await writeFile(path.join(jsDir, namaGabungan), gabungan);
        const urlGabungan = `${awalan}/assets/js/${namaGabungan}`;
        logger.info(
          `${namaGabungan}: ${urutan.length} berkas, ${Math.round(gabungan.length / 1024)} KB`,
        );

        for (const { berkas, html: asli } of halaman) {
          let html = asli;
          if (html.includes('data-preload-tema')) continue;
          // Empat <script> tema diganti satu, di posisi skrip pertama.
          let pertama = true;
          html = html.replace(
            /<script src="[^"]*\/assets\/js\/[^"]+"><\/script>/g,
            () => {
              if (!pertama) return '';
              pertama = false;
              return `<script src="${urlGabungan}"></script>`;
            },
          );

          const tautan = [
            `<link rel="preload" href="${urlGabungan}" as="script" data-preload-tema>`,
          ];
          // Font dipakai sejak layar pertama (menu 600, judul 700). HeyWow-Book sudah dipreload
          // oleh SiteLayout.
          for (const f of ['HeyWow-SemiBold', 'HeyWow-Bold'])
            tautan.push(
              `<link rel="preload" href="${awalan}/assets/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin data-preload-tema>`,
            );
          // Animasi yang wajib ada sebelum bagiannya tampil (huruf FSM di beranda).
          for (const m of html.matchAll(
            /data-lg-lottie="([^"]+)"\s+data-lg-lottie-required/g,
          ))
            tautan.push(
              `<link rel="preload" href="${m[1]}" as="fetch" crossorigin data-preload-tema>`,
            );

          html = html.replace('</head>', `${tautan.join('')}</head>`);
          await writeFile(berkas, html);
          logger.info(
            `${path.relative(root, berkas)}: ${tautan.length} preload`,
          );
        }
      },
    },
  };
}
