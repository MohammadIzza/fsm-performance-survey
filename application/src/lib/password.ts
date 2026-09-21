import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

// Parameter scrypt disimpan bersama hash, jadi bisa dinaikkan kelak tanpa membatalkan hash lama.
const N = 16384;
const R = 8;
const P = 1;
const PANJANG = 64;

export const PANJANG_MINIMUM = 8;

/** Hash berformat `scrypt$N$r$p$garam$hash` (base64). Garam acak per kata sandi. */
export async function hashKataSandi(kataSandi: string): Promise<string> {
  const garam = crypto.randomBytes(16);
  const hasil = await scrypt(kataSandi, garam, PANJANG, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, R, P, garam.toString("base64"), hasil.toString("base64")].join("$");
}

export async function cocokKataSandi(kataSandi: string, tersimpan: string): Promise<boolean> {
  const bagian = tersimpan.split("$");
  if (bagian.length !== 6 || bagian[0] !== "scrypt") return false;
  const [, n, r, p, garam, hash] = bagian;
  const harapan = Buffer.from(hash, "base64");
  const hasil = await scrypt(kataSandi, Buffer.from(garam, "base64"), harapan.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return hasil.length === harapan.length && crypto.timingSafeEqual(hasil, harapan);
}

// Hash tiruan untuk pengguna yang tidak ditemukan: pemeriksaan tetap menghabiskan waktu yang sama,
// supaya lamanya jawaban tidak membocorkan email/ID mana yang terdaftar.
let hashTiruan: Promise<string> | null = null;
export function hashPengecoh(): Promise<string> {
  hashTiruan ??= hashKataSandi(crypto.randomBytes(16).toString("hex"));
  return hashTiruan;
}
