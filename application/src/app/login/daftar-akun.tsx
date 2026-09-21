"use client";

import { useMemo, useState } from "react";
import type { AkunDemo, DirektoriAkunDemo, UnitDemo } from "@/lib/services/demoAccounts";

/**
 * Direktori akun demo: satu baris per akun, dikelompokkan per unit mengikuti pohon organisasi.
 *
 * Tiap unit dilipat supaya 700-an akun tidak menjadi satu gulungan panjang; pencarian membuka
 * unit yang berisi hasil. Menekan sebuah ID mengisikannya ke kolom ID di atas — penguji tidak
 * perlu mengetik ulang NIP delapan belas digit.
 */

function isiKolomLogin(login: string) {
  const input = document.getElementById("loginIdentifier") as HTMLInputElement | null;
  if (!input) return;
  input.value = login;
  input.focus();
  input.scrollIntoView({ block: "center", behavior: "smooth" });
}

function cocok(q: string, ...teks: string[]) {
  return teks.some((t) => t.toLowerCase().includes(q));
}

function BarisAkun({ akun, keterangan }: { akun: AkunDemo; keterangan?: string }) {
  return (
    <li className="akun-demo__baris">
      <span className="akun-demo__nama">
        {akun.name}
        {keterangan && <span className="akun-demo__jabatan">{keterangan}</span>}
      </span>
      {akun.tugas > 0 && <span className="akun-demo__tugas">{akun.tugas} tugas</span>}
      <button
        type="button"
        className="akun-demo__id"
        onClick={() => isiKolomLogin(akun.login)}
        title="Isikan ke kolom ID pengguna"
      >
        {akun.login}
      </button>
    </li>
  );
}

function saringUnit(u: UnitDemo, q: string): UnitDemo | null {
  if (!q) return u;
  // Nama unit yang cocok menampilkan seluruh isinya; selain itu hanya akun yang cocok.
  if (cocok(q, u.name)) return u;
  const pimpinan = u.pimpinan.filter((a) => cocok(q, a.name, a.login, a.title));
  const anggota = u.anggota
    .map((g) => ({ ...g, akun: g.akun.filter((a) => cocok(q, a.name, a.login)) }))
    .filter((g) => g.akun.length > 0);
  if (pimpinan.length === 0 && anggota.length === 0) return null;
  return { ...u, pimpinan, anggota, total: anggota.reduce((s, g) => s + g.akun.length, 0) };
}

export function DaftarAkunDemo({ direktori }: { direktori: DirektoriAkunDemo }) {
  const [kueri, setKueri] = useState("");
  const q = kueri.trim().toLowerCase();
  const tampil = useMemo(
    () => direktori.units.map((u) => saringUnit(u, q)).filter((u): u is UnitDemo => u !== null),
    [direktori.units, q]
  );
  const jumlahHasil = tampil.reduce((s, u) => s + u.total + u.pimpinan.length, 0);

  return (
    <div className="akun-demo">
      <dl className="akun-demo__khusus">
        {direktori.khusus.map((k) => (
          <div key={k.login}>
            <dt>{k.peran}</dt>
            <dd>
              <button type="button" className="akun-demo__id" onClick={() => isiKolomLogin(k.login)}>
                {k.login}
              </button>
            </dd>
          </div>
        ))}
      </dl>

      <label className="akun-demo__cari">
        <span className="u-sr-only">Cari akun demo</span>
        <input
          type="search"
          value={kueri}
          onChange={(e) => setKueri(e.target.value)}
          placeholder={`Cari di ${direktori.totalAkun} akun: nama, ID, unit`}
          className="form__control"
        />
      </label>

      <div className="akun-demo__daftar">
        {tampil.length === 0 ? (
          <p className="akun-demo__kosong">Tidak ada akun yang cocok dengan &ldquo;{kueri}&rdquo;.</p>
        ) : (
          tampil.map((u) => (
            // Kunci ikut kueri supaya <details> dibuat ulang: terbuka saat mencari, terlipat lagi
            // begitu kolom cari dikosongkan — tanpa mengendalikan atribut `open` secara manual.
            <details key={`${u.id}-${q ? "cari" : "semua"}`} open={!!q} className="akun-demo__unit" data-depth={u.depth}>
              <summary>
                <span className="akun-demo__unit-nama">{u.name}</span>
                <span className="akun-demo__unit-jumlah">
                  {u.pimpinan.length > 0 && `${u.pimpinan.length} pimpinan · `}
                  {u.total} akun
                </span>
              </summary>
              {u.pimpinan.length > 0 && (
                <section>
                  <h3 className="akun-demo__jenis">Pimpinan</h3>
                  <ul>
                    {u.pimpinan.map((p) => (
                      <BarisAkun key={`${p.login}-${p.title}`} akun={p} keterangan={p.title} />
                    ))}
                  </ul>
                </section>
              )}
              {u.anggota.map((g) => (
                <section key={g.jenis}>
                  <h3 className="akun-demo__jenis">
                    {g.jenis} <span>({g.akun.length})</span>
                  </h3>
                  <ul>
                    {g.akun.map((a) => (
                      <BarisAkun key={a.login} akun={a} />
                    ))}
                  </ul>
                </section>
              ))}
            </details>
          ))
        )}
      </div>
      {q && tampil.length > 0 && (
        <p className="akun-demo__ringkas" role="status">
          {jumlahHasil} akun cocok di {tampil.length} unit
        </p>
      )}
    </div>
  );
}
