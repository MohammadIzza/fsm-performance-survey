"use client";

import { useMemo, useState } from "react";

type Penilai = { id: string; nama: string; login: string; unit: string | null; aktif: boolean; belumMulai: number; draf: number; terkirim: number };

const BATAS = 15;

/** Penilai yang masih punya tugas belum dikirim, dengan pencarian dan "tampilkan semua". */
export function DaftarPenilai({ penilai }: { penilai: Penilai[] }) {
  const [cari, setCari] = useState("");
  const [semua, setSemua] = useState(false);
  const cocok = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return q ? penilai.filter((p) => `${p.nama} ${p.login} ${p.unit ?? ""}`.toLowerCase().includes(q)) : penilai;
  }, [penilai, cari]);
  const tampil = semua ? cocok : cocok.slice(0, BATAS);

  return (
    <div className="pantau-daftar">
      <input
        type="search"
        value={cari}
        onChange={(e) => setCari(e.target.value)}
        placeholder="Cari nama, NIP/NIM, atau unit…"
        aria-label="Cari penilai"
        className="form__control pantau-daftar__cari"
      />
      <div className="app-table-wrap">
        <table className="pantau-tabel">
          <thead>
            <tr>
              <th>Penilai</th>
              <th>Unit</th>
              <th className="pantau-tabel__angka">Belum dibuka</th>
              <th className="pantau-tabel__angka">Draf</th>
              <th className="pantau-tabel__angka">Sudah dikirim</th>
            </tr>
          </thead>
          <tbody>
            {tampil.map((p) => (
              <tr key={p.id}>
                <td data-label="Penilai">
                  <strong>{p.nama}</strong>
                  <small>
                    {p.login}
                    {!p.aktif && " · akun nonaktif"}
                  </small>
                </td>
                <td data-label="Unit">{p.unit ?? "—"}</td>
                <td data-label="Belum dibuka" className="pantau-tabel__angka">{p.belumMulai || "—"}</td>
                <td data-label="Draf" className="pantau-tabel__angka">{p.draf || "—"}</td>
                <td data-label="Sudah dikirim" className="pantau-tabel__angka">{p.terkirim || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cocok.length === 0 && <p className="app-empty">Tidak ada penilai yang cocok.</p>}
      {cocok.length > BATAS && (
        <button type="button" className="app-btn app-btn--polos" onClick={() => setSemua((s) => !s)}>
          {semua ? "Tampilkan lebih sedikit" : `Tampilkan semua (${cocok.length})`}
        </button>
      )}
    </div>
  );
}
