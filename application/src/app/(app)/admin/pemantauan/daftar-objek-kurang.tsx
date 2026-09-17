"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Kelompok = { kelompok: "PIMPINAN" | "SELAIN_PIMPINAN"; minimum: number; terkirim: number; ditugaskan: number };
type Objek = { categoryId: string; kategori: string; objek: string; unit: string; kelompok: Kelompok[] };

const BATAS = 15;
const namaKelompok = (k: Kelompok["kelompok"]) => (k === "PIMPINAN" ? "Pimpinan" : "Selain pimpinan");

export function DaftarObjekKurang({ periodeId, objek, bisaTambah }: { periodeId: string; objek: Objek[]; bisaTambah: boolean }) {
  const [kategori, setKategori] = useState("");
  const [semua, setSemua] = useState(false);
  const daftarKategori = useMemo(() => [...new Set(objek.map((o) => o.kategori))], [objek]);
  const cocok = kategori ? objek.filter((o) => o.kategori === kategori) : objek;
  const tampil = semua ? cocok : cocok.slice(0, BATAS);

  return (
    <div className="pantau-daftar">
      {daftarKategori.length > 1 && (
        <select
          value={kategori}
          onChange={(e) => setKategori(e.target.value)}
          aria-label="Saring kategori"
          className="form__control pantau-daftar__cari"
        >
          <option value="">Semua kategori ({objek.length} objek)</option>
          {daftarKategori.map((k) => (
            <option key={k} value={k}>
              {k} ({objek.filter((o) => o.kategori === k).length})
            </option>
          ))}
        </select>
      )}
      <div className="app-table-wrap">
        <table className="pantau-tabel">
          <thead>
            <tr>
              <th>Objek</th>
              <th>Kategori</th>
              <th>Sudah dinilai / minimum</th>
              <th>Yang perlu dilakukan</th>
            </tr>
          </thead>
          <tbody>
            {tampil.map((o) => {
              // Kalau penilai yang ditugaskan saja kurang dari minimum, menunggu tidak akan cukup.
              const kurang = o.kelompok.reduce((n, k) => n + Math.max(0, k.minimum - k.ditugaskan), 0);
              return (
                <tr key={`${o.categoryId}|${o.objek}`}>
                  <td data-label="Objek">
                    <strong>{o.objek}</strong>
                    <small>{o.unit}</small>
                  </td>
                  <td data-label="Kategori">{o.kategori}</td>
                  <td data-label="Sudah dinilai / minimum">
                    <span className="pantau-tabel__kelompok">
                      {o.kelompok.map((k) => (
                        <span key={k.kelompok}>
                          {namaKelompok(k.kelompok)}: <b>{k.terkirim}/{k.minimum}</b>
                          <small>{k.ditugaskan} penilai ditugaskan</small>
                        </span>
                      ))}
                    </span>
                  </td>
                  <td data-label="Yang perlu dilakukan">
                    {kurang > 0 ? (
                      bisaTambah ? (
                        <Link href={`/admin/periode/${periodeId}/kategori/${o.categoryId}?bagian=penugasan`} className="pantau-tautan">
                          Tambah {kurang} penilai →
                        </Link>
                      ) : (
                        <span className="pantau-catatan">Penilai kurang {kurang}</span>
                      )
                    ) : (
                      <span className="pantau-catatan">Ingatkan penilainya</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {cocok.length > BATAS && (
        <button type="button" className="app-btn app-btn--polos" onClick={() => setSemua((s) => !s)}>
          {semua ? "Tampilkan lebih sedikit" : `Tampilkan semua (${cocok.length})`}
        </button>
      )}
    </div>
  );
}
