// PRNG kecil (mulberry32) supaya pengacakan penugasan dapat direproduksi dari seed yang tersimpan
// (Bab 10.4: "Simpan batch ... seed atau jejak pemilihan ... untuk reproduksi audit").
// Math.random() bawaan tidak bisa diberi seed, jadi tidak cocok untuk kebutuhan ini.

export function createSeed(): string {
  return Math.floor(Math.random() * 2 ** 32)
    .toString(16)
    .padStart(8, "0");
}

function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function createRng(seed: string): () => number {
  let a = hashSeed(seed) || 1;
  return function mulberry32() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fisher-Yates dengan RNG yang diberi seed agar urutan pengacakan dapat direproduksi.
export function seededShuffle<T>(items: T[], rng: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
