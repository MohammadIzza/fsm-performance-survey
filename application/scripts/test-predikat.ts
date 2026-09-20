import {
  PREDIKAT_BAWAAN,
  bacaAmbang,
  periksaAmbang,
  predikatUntuk,
  skorMaksimum,
  type AmbangPredikat,
} from "../src/lib/predikat";

/**
 * Uji predikat nilai. Seluruhnya fungsi murni — tidak menyentuh basis data — karena predikat
 * memang tidak ikut perhitungan: ia hanya menerjemahkan nilai yang sudah jadi menjadi label.
 */

let lulus = 0;
let gagal = 0;

function ok(nama: string, syarat: boolean, aktual?: unknown) {
  if (syarat) {
    lulus++;
    console.log(`  OK  ${nama}`);
  } else {
    gagal++;
    console.log(`  GAGAL  ${nama}${aktual !== undefined ? ` (aktual: ${JSON.stringify(aktual)})` : ""}`);
  }
}

function judul(t: string) {
  console.log(`== ${t} ==`);
}

const p100 = [{ weight: 100, normalized: false }];
const p5050 = [
  { weight: 50, normalized: false },
  { weight: 50, normalized: false },
];

judul("1. Nilai maksimum dihitung dari instrumen, bukan diasumsikan 100");
ok("Skala 0–100, satu parameter → 100", skorMaksimum(p100, 100, "RATA_RATA") === 100, skorMaksimum(p100, 100, "RATA_RATA"));
ok("Skala 1–5 → 5", skorMaksimum(p100, 5, "RATA_RATA") === 5, skorMaksimum(p100, 5, "RATA_RATA"));
ok("Dua parameter 50:50 pada skala 5 → 5", skorMaksimum(p5050, 5, "RATA_RATA") === 5, skorMaksimum(p5050, 5, "RATA_RATA"));
ok(
  "Parameter bernilai mentah dinormalisasi ke 100, campuran ikut terhitung",
  skorMaksimum([{ weight: 50, normalized: true }, { weight: 50, normalized: false }], 4, "RATA_RATA") === 52,
  skorMaksimum([{ weight: 50, normalized: true }, { weight: 50, normalized: false }], 4, "RATA_RATA")
);
ok("Metode Total tidak punya maksimum", skorMaksimum(p100, 100, "TOTAL") === null);
ok("Tanpa parameter tidak punya maksimum", skorMaksimum([], 100, "RATA_RATA") === null);

judul("2. Ambang diterjemahkan sebagai persen dari maksimum");
const maks5 = skorMaksimum(p100, 5, "RATA_RATA");
ok("4,6 dari 5 (92%) → Sangat baik", predikatUntuk(4.6, maks5, PREDIKAT_BAWAAN)?.label === "Sangat baik", predikatUntuk(4.6, maks5, PREDIKAT_BAWAAN));
ok("4,0 dari 5 (80%) → Baik", predikatUntuk(4, maks5, PREDIKAT_BAWAAN)?.label === "Baik");
ok("3,1 dari 5 (62%) → Cukup", predikatUntuk(3.1, maks5, PREDIKAT_BAWAAN)?.label === "Cukup");
ok("2,0 dari 5 (40%) → Perlu perbaikan", predikatUntuk(2, maks5, PREDIKAT_BAWAAN)?.label === "Perlu perbaikan");
ok(
  "Angka yang sama pada skala 100 memberi predikat berbeda dari skala 5",
  predikatUntuk(4.6, 100, PREDIKAT_BAWAAN)?.label === "Perlu perbaikan",
  predikatUntuk(4.6, 100, PREDIKAT_BAWAAN)
);
ok("Tepat di batas masuk tingkat atas", predikatUntuk(90, 100, PREDIKAT_BAWAAN)?.label === "Sangat baik");
ok("Sedikit di bawah batas turun satu tingkat", predikatUntuk(89.99, 100, PREDIKAT_BAWAAN)?.label === "Baik");
ok("Nilai maksimum sempurna → tingkat tertinggi", predikatUntuk(5, maks5, PREDIKAT_BAWAAN)?.level === 0);
ok("Persen ikut dilaporkan untuk keterangan", predikatUntuk(4, 5, PREDIKAT_BAWAAN)?.persen === 80, predikatUntuk(4, 5, PREDIKAT_BAWAAN)?.persen);

judul("3. Predikat tidak dipaksakan bila tidak bermakna");
ok("Nilai kosong (belum ada penilaian) → tanpa predikat", predikatUntuk(null, 100, PREDIKAT_BAWAAN) === null);
ok("Kategori tanpa ambang → tanpa predikat", predikatUntuk(80, 100, null) === null);
ok("Metode Total (maksimum null) → tanpa predikat", predikatUntuk(240, null, PREDIKAT_BAWAAN) === null);
ok("Maksimum nol tidak menyebabkan pembagian nol", predikatUntuk(0, 0, PREDIKAT_BAWAAN) === null);

judul("4. Susunan ambang yang salah ditolak dengan alasan");
const sah: AmbangPredikat[] = [
  { label: "Lulus", min: 60 },
  { label: "Tidak lulus", min: 0 },
];
ok("Dua tingkat berbatas 0 di bawah → sah", periksaAmbang(sah) === null, periksaAmbang(sah));
ok("Satu tingkat ditolak", periksaAmbang([{ label: "Baik", min: 0 }]) !== null);
ok(
  "Tingkat terendah bukan 0 ditolak",
  periksaAmbang([{ label: "Baik", min: 70 }, { label: "Cukup", min: 50 }]) !== null
);
ok(
  "Batas bawah kembar ditolak",
  periksaAmbang([{ label: "Baik", min: 50 }, { label: "Cukup", min: 50 }, { label: "Kurang", min: 0 }]) !== null
);
ok(
  "Nama kembar ditolak",
  periksaAmbang([{ label: "Baik", min: 50 }, { label: "baik ", min: 0 }]) !== null
);
ok("Persen di luar 0–100 ditolak", periksaAmbang([{ label: "Baik", min: 120 }, { label: "Kurang", min: 0 }]) !== null);
ok("Lebih dari enam tingkat ditolak", periksaAmbang(
  Array.from({ length: 7 }, (_, i) => ({ label: `T${i}`, min: i === 6 ? 0 : 100 - i * 10 }))
) !== null);
ok("Susunan bawaan sah", periksaAmbang(PREDIKAT_BAWAAN) === null, periksaAmbang(PREDIKAT_BAWAAN));

judul("5. Isi kolom Json yang aneh tidak merusak tampilan");
ok("null → tidak memakai predikat", bacaAmbang(null) === null);
ok("Daftar kosong → tidak memakai predikat", bacaAmbang([]) === null);
ok("Bukan daftar → tidak memakai predikat", bacaAmbang({ label: "Baik" }) === null);
ok("Item tanpa label → tidak memakai predikat", bacaAmbang([{ min: 50 }]) === null);
ok("Batas bukan angka → tidak memakai predikat", bacaAmbang([{ label: "Baik", min: "50" }]) === null);
ok(
  "Daftar sah dibaca dan diurutkan dari tertinggi",
  JSON.stringify(bacaAmbang([{ label: "Kurang", min: 0 }, { label: "Baik", min: 70 }])) ===
    JSON.stringify([{ label: "Baik", min: 70 }, { label: "Kurang", min: 0 }]),
  bacaAmbang([{ label: "Kurang", min: 0 }, { label: "Baik", min: 70 }])
);
ok(
  "Urutan masukan tidak memengaruhi hasil predikat",
  predikatUntuk(80, 100, [{ label: "Cukup", min: 60 }, { label: "Sangat baik", min: 90 }, { label: "Baik", min: 75 }])?.label ===
    "Baik"
);

judul("6. Warna tingkat: level dan total cukup untuk memetakan palet");
const tigaTingkat: AmbangPredikat[] = [
  { label: "A", min: 80 },
  { label: "B", min: 50 },
  { label: "C", min: 0 },
];
ok("Tingkat tertinggi level 0", predikatUntuk(90, 100, tigaTingkat)?.level === 0);
ok("Tingkat terendah level terakhir", predikatUntuk(10, 100, tigaTingkat)?.level === 2);
ok("Total tingkat ikut dilaporkan", predikatUntuk(10, 100, tigaTingkat)?.total === 3);

console.log(`\nLulus: ${lulus}  Gagal: ${gagal}`);
if (gagal > 0) process.exit(1);
