import Link from "next/link";

type Nomor = number | "elipsis-kiri" | "elipsis-kanan";

/** Nomor yang ditampilkan: halaman pertama, terakhir, dan dua tetangga halaman aktif. */
function daftarNomor(halaman: number, totalHalaman: number): Nomor[] {
  const set = new Set([1, totalHalaman, halaman - 1, halaman, halaman + 1]);
  const nomor = [...set].filter((n) => n >= 1 && n <= totalHalaman).sort((a, b) => a - b);
  const hasil: Nomor[] = [];
  nomor.forEach((n, i) => {
    if (i > 0 && n - nomor[i - 1] > 1) hasil.push(n < halaman ? "elipsis-kiri" : "elipsis-kanan");
    hasil.push(n);
  });
  return hasil;
}

/**
 * Navigasi halaman di bawah daftar admin. Bentuknya mengikuti tombol aplikasi (`app-btn`): pil
 * bertepi tipis, halaman aktif terisi biru seperti tombol utama. Tiap nomor adalah tautan biasa,
 * jadi berpindah halaman tetap jalan tanpa JavaScript dan alamatnya bisa dibagikan.
 */
export function Paginasi({
  path,
  params = {},
  halaman,
  totalHalaman,
  total,
  perHalaman,
  satuan,
}: {
  /** Alamat halaman tanpa awalan situs, mis. "/admin/pengguna". */
  path: string;
  /** Parameter lain yang harus ikut terbawa (mis. kata pencarian). */
  params?: Record<string, string | undefined>;
  halaman: number;
  totalHalaman: number;
  total: number;
  perHalaman: number;
  /** Sebutan isinya, mis. "pengguna" — dipakai di keterangan jumlah. */
  satuan: string;
}) {
  if (total === 0) return null;
  const href = (n: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    if (n > 1) qs.set("halaman", String(n));
    const s = qs.toString();
    return s ? `${path}?${s}` : path;
  };
  const awal = (halaman - 1) * perHalaman + 1;
  const akhir = Math.min(halaman * perHalaman, total);

  return (
    <nav className="paginasi" aria-label={`Halaman daftar ${satuan}`}>
      <p className="paginasi__info">
        Menampilkan <strong>{awal}–{akhir}</strong> dari <strong>{total}</strong> {satuan}
      </p>
      {totalHalaman > 1 && (
        <ul className="paginasi__daftar">
          <li>
            {halaman > 1 ? (
              <Link href={href(halaman - 1)} className="app-btn paginasi__arah" aria-label="Halaman sebelumnya" scroll={false}>
                ←<span className="paginasi__teks-arah">Sebelumnya</span>
              </Link>
            ) : (
              <span className="app-btn paginasi__arah" aria-disabled="true">
                ←<span className="paginasi__teks-arah">Sebelumnya</span>
              </span>
            )}
          </li>
          {daftarNomor(halaman, totalHalaman).map((n) =>
            typeof n === "number" ? (
              <li key={n} className={n === halaman ? undefined : "paginasi__lain"}>
                {n === halaman ? (
                  <span className="app-btn paginasi__nomor" aria-current="page">
                    {n}
                  </span>
                ) : (
                  <Link href={href(n)} className="app-btn paginasi__nomor" aria-label={`Halaman ${n}`} scroll={false}>
                    {n}
                  </Link>
                )}
              </li>
            ) : (
              <li key={n} className="paginasi__elipsis paginasi__lain" aria-hidden="true">
                …
              </li>
            )
          )}
          <li className="paginasi__posisi" aria-hidden="true">
            {halaman} / {totalHalaman}
          </li>
          <li>
            {halaman < totalHalaman ? (
              <Link href={href(halaman + 1)} className="app-btn paginasi__arah" aria-label="Halaman berikutnya" scroll={false}>
                <span className="paginasi__teks-arah">Berikutnya</span>→
              </Link>
            ) : (
              <span className="app-btn paginasi__arah" aria-disabled="true">
                <span className="paginasi__teks-arah">Berikutnya</span>→
              </span>
            )}
          </li>
        </ul>
      )}
    </nav>
  );
}
