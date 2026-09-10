import { readFile } from "node:fs/promises";

// Blok komentar CSS yang tidak tertutup adalah kesalahan yang mahal di sini, karena akibatnya
// TIDAK selalu berupa build gagal: kalau sisa teksnya kebetulan masih terurai sebagai CSS, yang
// terjadi hanyalah aturan-aturan setelahnya ikut tertelan komentar dan hilang diam-diam. Ini sudah
// dua kali terjadi pada globals.css — aturan pembatas lebar baris daftar tidak pernah berlaku, dan
// baru ketahuan lewat pemeriksaan lebar di browser, bukan dari keluaran build.
//
// Pemeriksaannya tidak mengurai CSS, cuma mencocokkan pembuka dan penutup secara berurutan, yang
// sudah cukup untuk menangkap bentuk kesalahan tersebut.
const files = ["src/app/globals.css"];
let failed = false;

for (const file of files) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  let depth = 0;
  let line = 1;
  let openedAt = 0;

  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") line++;
    if (source[i] === "/" && source[i + 1] === "*") {
      if (depth === 0) openedAt = line;
      depth++;
      i++;
    } else if (source[i] === "*" && source[i + 1] === "/") {
      depth--;
      i++;
      if (depth < 0) {
        console.error(`${file}:${line}: penutup komentar "*/" tanpa pembuka.`);
        failed = true;
        depth = 0;
      }
    }
  }

  if (depth > 0) {
    console.error(`${file}:${openedAt}: komentar dibuka tapi tidak pernah ditutup.`);
    failed = true;
  }
}

if (failed) {
  console.error("Perbaiki komentar CSS di atas sebelum build.");
  process.exit(1);
}
